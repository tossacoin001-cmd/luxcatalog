// A free, dependency-light backup of Lux Catalog's database (no pg_dump needed).
// Writes one file per table plus a manifest with row counts and checksums, so a
// restore can prove it got everything back.
//
//   BACKUP_DATABASE_URL="<neon connection string>" node scripts/db-backup.mjs
//
// The connection string is read from the environment only and is never printed.
// Output: backups/<timestamp>/ (ignored by git: it holds customer data; keep it
// somewhere private such as an encrypted drive).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import pg from 'pg'

export function tablesFromSchema(schemaText) {
  // Prisma model name = table name unless @@map("other") is given.
  const out = []
  for (const m of schemaText.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const map = /@@map\("([^"]+)"\)/.exec(m[2])
    out.push(map ? map[1] : m[1])
  }
  return out
}

const q = (name) => `"${name.replace(/"/g, '""')}"`

export async function backup({ url, outDir, schemaPath = 'prisma/schema.prisma', schema = 'public', log = () => {} }) {
  const tables = tablesFromSchema(readFileSync(schemaPath, 'utf8'))
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query('BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ') // one consistent picture of all tables
    mkdirSync(outDir, { recursive: true })
    const manifest = { at: new Date().toISOString(), schema, tables: {} }
    for (const t of tables) {
      const exists = await client.query('select 1 from information_schema.tables where table_schema=$1 and table_name=$2', [schema, t])
      if (!exists.rowCount) { manifest.tables[t] = { missing: true }; log(`skipped ${t} (not in this database)`); continue }
      const rows = await client.query(`select row_to_json(x)::text as j from ${q(schema)}.${q(t)} x order by 1`)
      const sum = await client.query(`select coalesce(md5(string_agg(j, '' order by j)), md5('')) as s from (select row_to_json(x)::text as j from ${q(schema)}.${q(t)} x) y`)
      writeFileSync(join(outDir, `${t}.ndjson`), rows.rows.map((r) => r.j).join('\n') + (rows.rowCount ? '\n' : ''))
      manifest.tables[t] = { rows: rows.rowCount, md5: sum.rows[0].s }
      log(`${t}: ${rows.rowCount} rows`)
    }
    await client.query('COMMIT')
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    writeFileSync(join(outDir, 'schema.prisma'), readFileSync(schemaPath, 'utf8'))
    return manifest
  } finally {
    await client.end()
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('db-backup.mjs')) {
  const url = process.env.BACKUP_DATABASE_URL
  if (!url) {
    console.error('Set BACKUP_DATABASE_URL to the database connection string first (it is never printed).')
    process.exit(2)
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = resolve(process.env.BACKUP_DIR ?? 'backups', stamp)
  try {
    const m = await backup({ url, outDir, log: (s) => console.log(' ', s) })
    const total = Object.values(m.tables).reduce((n, t) => n + (t.rows ?? 0), 0)
    console.log(`\nBackup written to ${outDir}\n${Object.keys(m.tables).length} tables, ${total} rows. Keep this folder private.`)
  } catch (e) {
    // Never echo the connection string; report only the reason.
    console.error('Backup failed:', String(e.message ?? e).replace(/postgres(ql)?:\/\/\S+/g, '[connection string hidden]'))
    process.exit(1)
  }
}
