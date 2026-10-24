// The free backup and restore tools (scripts/db-backup.mjs, db-restore.mjs),
// proved on the local test database. Written 2026-10-24 for the Neon
// allowance scare: a backup must be complete, must prove itself on restore,
// must refuse to overwrite, must be all-or-nothing, and must never print the
// connection string.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import pg from 'pg'
import { backup, tablesFromSchema } from '../../scripts/db-backup.mjs'
import { restore, loadOrder } from '../../scripts/db-restore.mjs'

const DB = process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable'
const db = new pg.Client({ connectionString: DB })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x).slice(0, 300)}`)))
const stamp = Date.now()
const work = mkdtempSync(join(tmpdir(), 'bk-'))

console.log('Setup: some real-looking data of every awkward type (arrays, json, money, dates, booleans, text with quotes)')
const slug = `bk-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,'real_estate',$3,123456789.50,'₦123,456,789','Ikoyi, Lagos','Nigeria',ARRAY['https://x/a.jpg','https://x/b "quoted".jpg'],'{"Bedrooms":"4","Note":"a ''quote'' and \\"double\\""}',ARRAY['Pool','Gym, sauna'],'sale','for_sale',true,now())`, [`Backup "Test" Villa ${stamp}`, slug, 'Line one\nLine two with a tab\t and ünïcödé ₦'])
const tables = tablesFromSchema(readFileSync('prisma/schema.prisma', 'utf8'))
check(`the model list is read from the Prisma schema (${tables.length} tables)`, tables.length >= 30 && tables.includes('Listing') && tables.includes('Booking') && tables.includes('User'), tables.length)

console.log('1. Backup')
const dir = join(work, 'b1')
const m = await backup({ url: DB, outDir: dir })
check('writes a manifest and one file per table', existsSync(join(dir, 'manifest.json')) && tables.every((t) => m.tables[t]?.missing || existsSync(join(dir, `${t}.ndjson`))))
check('copies the schema alongside, so the backup says what it was', existsSync(join(dir, 'schema.prisma')))
check('every table has a row count and a checksum', Object.values(m.tables).every((t) => t.missing || (Number.isInteger(t.rows) && /^[0-9a-f]{32}$/.test(t.md5))))
check('the row counts match the database', (await Promise.all(tables.slice(0, 12).map(async (t) => m.tables[t].missing || (await q(`select count(*)::int n from "${t}"`))[0].n === m.tables[t].rows))).every(Boolean))
check('the awkward listing is in the file exactly (quotes, newline, array, money)', (() => { const l = readFileSync(join(dir, 'Listing.ndjson'), 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x)).find((r) => r.slug === slug); return l && l.title.includes('"Test"') && l.description.includes('\n') && l.images.length === 2 && l.features[1] === 'Gym, sauna' && Number(l.price) === 123456789.5 })())
check('a backup is read-only: it changed nothing in the source', (await q(`select count(*)::int n from "Listing" where slug=$1`, [slug]))[0].n === 1)

console.log('2. Restore into an empty copy, and prove it')
await q('drop schema if exists bk_copy cascade'); await q('create schema bk_copy')
for (const t of tables) await q(`create table bk_copy."${t}" (like public."${t}" including all)`)
const r1 = await restore({ url: DB, dir, schema: 'bk_copy' })
check('the restore reports every table and row', r1.tables >= 30 && r1.rows === Object.values(m.tables).reduce((n, t) => n + (t.rows ?? 0), 0), r1)
check('the copy equals the original, table by table, row by row', (await Promise.all(tables.map(async (t) => { const a = (await q(`select coalesce(md5(string_agg(j,'' order by j)),md5('')) s from (select row_to_json(x)::text j from public."${t}" x) y`))[0].s; const b = (await q(`select coalesce(md5(string_agg(j,'' order by j)),md5('')) s from (select row_to_json(x)::text j from bk_copy."${t}" x) y`))[0].s; return a === b }))).every(Boolean))
check('the awkward listing came back exactly', (await q(`select a.title = b.title and a.description = b.description and a.images = b.images and a.features = b.features and a.price = b.price and a.specs::text = b.specs::text ok from public."Listing" a join bk_copy."Listing" b on a.id = b.id where a.slug=$1`, [slug]))[0]?.ok === true)

console.log('3. It refuses to overwrite')
let err = null; try { await restore({ url: DB, dir, schema: 'bk_copy' }) } catch (e) { err = e }
check('restoring into a copy that already has rows is refused, with the table named', !!err && /already has \d+ rows/.test(err.message) && /Restore only into an empty database/.test(err.message), err?.message)
check('and nothing was changed by the refusal', (await q(`select count(*)::int n from bk_copy."Listing"`))[0].n === m.tables.Listing.rows)
await q('drop schema if exists bk_missing cascade'); await q('create schema bk_missing')
err = null; try { await restore({ url: DB, dir, schema: 'bk_missing' }) } catch (e) { err = e }
check('restoring where the tables do not exist says to run the schema push first', !!err && /prisma db push/.test(err.message), err?.message)

console.log('4. It is all-or-nothing and catches damage')
const bad = join(work, 'b2'); cpSync(dir, bad, { recursive: true })
const lf = join(bad, 'Listing.ndjson'); const lines = readFileSync(lf, 'utf8').split('\n').filter(Boolean)
writeFileSync(lf, lines.slice(1).join('\n') + '\n') // one row lost from the file
await q('drop schema if exists bk_bad cascade'); await q('create schema bk_bad')
for (const t of tables) await q(`create table bk_bad."${t}" (like public."${t}" including all)`)
err = null; try { await restore({ url: DB, dir: bad, schema: 'bk_bad' }) } catch (e) { err = e }
check('a backup with a missing row is caught by the checksum, not trusted', !!err && /did not match/.test(err.message) && /Listing/.test(err.message), err?.message)
check('and the failed restore left the target empty (nothing half-loaded)', (await Promise.all(tables.slice(0, 10).map(async (t) => (await q(`select count(*)::int n from bk_bad."${t}"`))[0].n === 0))).every(Boolean))

console.log('5. Parents are loaded before children')
await q('drop schema if exists bk_fk cascade'); await q('create schema bk_fk')
await q('create table bk_fk."Parent" (id int primary key)')
await q('create table bk_fk."Child" (id int primary key, "parentId" int references bk_fk."Parent"(id))')
const ord = await loadOrder(db, 'bk_fk', ['Child', 'Parent'])
check('Parent comes before Child even when listed after it', ord.order.join() === 'Parent,Child', ord)

console.log('6. The command line, and secrets')
const run = (script, env, args = []) => spawnSync(process.execPath, [script, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' })
let o = run('scripts/db-backup.mjs', { BACKUP_DATABASE_URL: '' })
check('with no connection string it refuses (exit 2) and says what to set', o.status === 2 && /BACKUP_DATABASE_URL/.test(o.stderr), o.stderr)
const secret = 'S3cretPassw0rdXYZ'
o = run('scripts/db-backup.mjs', { BACKUP_DATABASE_URL: `postgres://neon_user:${secret}@127.0.0.1:1/db?connect_timeout=2` , BACKUP_DIR: join(work, 'cli') })
check('with a connection string that fails it exits 1 and never prints the password or the string', o.status === 1 && !(o.stdout + o.stderr).includes(secret) && !/postgres:\/\/neon_user/.test(o.stdout + o.stderr), (o.stdout + o.stderr).slice(0, 200))
o = run('scripts/db-restore.mjs', { RESTORE_DATABASE_URL: `postgres://neon_user:${secret}@127.0.0.1:1/db?connect_timeout=2` }, [dir])
check('restore with a failing connection also hides it', o.status === 1 && !(o.stdout + o.stderr).includes(secret), (o.stdout + o.stderr).slice(0, 200))
o = run('scripts/db-backup.mjs', { BACKUP_DATABASE_URL: DB, BACKUP_DIR: join(work, 'cli2') })
check('the real command line works end to end and prints no connection string', o.status === 0 && /Backup written/.test(o.stdout) && !/postgres:\/\//.test(o.stdout + o.stderr), o.stdout.slice(-200) + o.stderr)
check('backups are written under their own folder with the time in the name', readdirSync(join(work, 'cli2')).length === 1)

for (const s of ['bk_copy', 'bk_missing', 'bk_bad', 'bk_fk']) await q(`drop schema if exists ${s} cascade`)
await q(`delete from "Listing" where slug=$1`, [slug])
await db.end()
rmSync(work, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
