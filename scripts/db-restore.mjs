// Restores a backup made by scripts/db-backup.mjs into an EMPTY database whose
// tables already exist (create them first with `npx prisma db push` pointed at
// the new database). It refuses to write into tables that already hold rows,
// loads parents before children, and proves the result: every table's row
// count and checksum must match the backup's manifest.
//
//   RESTORE_DATABASE_URL="<new database connection string>" node scripts/db-restore.mjs backups/<timestamp>
//
// The connection string is read from the environment only and is never printed.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import pg from 'pg'

const q = (name) => `"${name.replace(/"/g, '""')}"`
const BATCH = 200

// Parents first, using the real foreign keys of the target database.
export async function loadOrder(client, schema, tables) {
  const fk = await client.query(
    `select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
       from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where c.contype = 'f' and n.nspname = $1`,
    [schema],
  )
  const clean = (s) => s.replace(/^"?[^".]+"?\./, '').replace(/"/g, '')
  const deps = new Map(tables.map((t) => [t, new Set()]))
  for (const r of fk.rows) {
    const child = clean(r.child), parent = clean(r.parent)
    if (child !== parent && deps.has(child) && deps.has(parent)) deps.get(child).add(parent)
  }
  const order = [], done = new Set()
  let progress = true
  while (order.length < tables.length && progress) {
    progress = false
    for (const t of tables) if (!done.has(t) && [...deps.get(t)].every((p) => done.has(p))) { order.push(t); done.add(t); progress = true }
  }
  for (const t of tables) if (!done.has(t)) order.push(t) // a cycle: loaded last, with constraints relaxed
  return { order, cyclic: tables.filter((t) => !done.has(t) || false).length > 0 }
}

export async function restore({ url, dir, schema = 'public', log = () => {} }) {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  const tables = Object.entries(manifest.tables).filter(([, v]) => !v.missing).map(([k]) => k)
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    // 1. The target must be ready and empty.
    for (const t of tables) {
      const r = await client.query(`select count(*)::int n from ${q(schema)}.${q(t)}`).catch(() => null)
      if (!r) throw new Error(`Table ${t} does not exist in the target. Run "npx prisma db push" against it first.`)
      if (r.rows[0].n > 0) throw new Error(`Table ${t} already has ${r.rows[0].n} rows. Restore only into an empty database.`)
    }
    const { order, cyclic } = await loadOrder(client, schema, tables)
    await client.query('BEGIN')
    if (cyclic) await client.query(`SET LOCAL session_replication_role = replica`).catch(() => {})
    // 2. Load.
    for (const t of order) {
      const file = join(dir, `${t}.ndjson`)
      const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : []
      for (let i = 0; i < lines.length; i += BATCH) {
        const chunk = '[' + lines.slice(i, i + BATCH).join(',') + ']'
        await client.query(`insert into ${q(schema)}.${q(t)} select * from json_populate_recordset(null::${q(schema)}.${q(t)}, $1::json)`, [chunk])
      }
      log(`${t}: ${lines.length} rows loaded`)
    }
    // 3. Prove it, still inside the transaction: a bad copy is undone, never kept.
    const problems = []
    for (const t of tables) {
      const want = manifest.tables[t]
      const got = await client.query(`select count(*)::int n, coalesce(md5(string_agg(j, '' order by j)), md5('')) as s from (select row_to_json(x)::text as j from ${q(schema)}.${q(t)} x) y`)
      if (got.rows[0].n !== want.rows) problems.push(`${t}: ${got.rows[0].n} rows, expected ${want.rows}`)
      else if (got.rows[0].s !== want.md5) problems.push(`${t}: contents differ from the backup`)
    }
    if (problems.length) throw new Error('Restore did not match the backup:\n  ' + problems.join('\n  '))
    await client.query('COMMIT')
    return { tables: tables.length, rows: tables.reduce((n, t) => n + manifest.tables[t].rows, 0) }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    await client.end()
  }
}

if (process.argv[1]?.endsWith('db-restore.mjs')) {
  const url = process.env.RESTORE_DATABASE_URL
  const dir = process.argv[2] && resolve(process.argv[2])
  if (!url || !dir) {
    console.error('Usage: RESTORE_DATABASE_URL="<new database>" node scripts/db-restore.mjs backups/<timestamp>\n(the connection string is never printed)')
    process.exit(2)
  }
  try {
    const r = await restore({ url, dir, schema: process.env.RESTORE_SCHEMA ?? 'public', log: (s) => console.log(' ', s) })
    console.log(`\nRestored and verified: ${r.tables} tables, ${r.rows} rows, every checksum matches the backup.`)
  } catch (e) {
    console.error('Restore failed:', String(e.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, '[connection string hidden]'))
    process.exit(1)
  }
}
