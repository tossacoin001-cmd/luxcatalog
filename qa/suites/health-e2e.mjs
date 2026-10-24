// The uptime check must not keep the database awake (Neon's free plan bills
// compute time while it is awake; a check that queried it every few minutes
// used the whole month). Proved the strongest way: a copy of the app whose
// database is UNREACHABLE still answers the ordinary check, and only the deep
// check (with the scheduled-job secret) reports the database failure.
// Written 2026-10-24. Starts an extra copy of the built app.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DB = process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable'
const DEAD = 'postgres://nobody:nothing@127.0.0.1:1/none?sslmode=disable&connect_timeout=2'
const root = fileURLToPath(new URL('../../', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x).slice(0, 300)}`)))
const SECRET = 'local-cron-secret-0123456789'

const children = []
async function start(port, dbUrl) {
  const base = `http://localhost:${port}`
  const env = { ...process.env, DATABASE_URL: dbUrl, DIRECT_URL: dbUrl, DATABASE_POOL_MAX: '1', BETTER_AUTH_SECRET: 'local-test-secret-0123456789abcdef0123', BETTER_AUTH_URL: base, NEXT_PUBLIC_APP_URL: base, CRON_SECRET: SECRET }
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { cwd: root, stdio: 'ignore', env })
  children.push(child)
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${base}/robots.txt`)).status === 200) return base } catch {} await sleep(1000) }
  return null
}
const stop = () => children.forEach((c) => { try { c.kill() } catch {} })
process.on('exit', stop)
const get = async (base, path, headers = {}) => { const r = await fetch(base + path, { headers }); let json = null; try { json = await r.json() } catch {} return { status: r.status, json, headers: r.headers } }

console.log('1. With a healthy database')
const ok = await start(3311, DB)
check('the copy starts', !!ok)
if (ok) {
  let r = await get(ok, '/api/health')
  check('the ordinary check answers 200 and says it is the light one', r.status === 200 && r.json?.mode === 'light' && r.json?.status === 'ok', r)
  check('it lists no database, email or exchange-rate check', !(r.json?.checks ?? []).some((c) => /database|email|fx/.test(c.name)), r.json)
  check('it is never cached', /no-store/.test(r.headers.get('cache-control') ?? ''))
  r = await get(ok, '/api/health?deep=1')
  check('asking for the deep check without the secret still gets only the light one', r.json?.mode === 'light', r.json)
  r = await get(ok, '/api/health?deep=1', { authorization: 'Bearer not-the-secret' })
  check('a wrong secret gets only the light one', r.json?.mode === 'light', r.json)
  r = await get(ok, '/api/health?deep=1', { authorization: `Bearer ${SECRET}` })
  check('the right secret gets the deep check, including the database', r.json?.mode === 'deep' && (r.json.checks ?? []).some((c) => c.name === 'database' && c.status === 'ok'), r.json)
}

console.log('2. With the database unreachable (the proof that the ordinary check never touches it)')
const dead = await start(3312, DEAD)
check('the copy starts even though its database is unreachable', !!dead)
if (dead) {
  const t0 = Date.now()
  let r = await get(dead, '/api/health')
  check('the ordinary check still answers 200 straight away', r.status === 200 && r.json?.mode === 'light' && Date.now() - t0 < 3000, [r.status, Date.now() - t0])
  r = await get(dead, '/api/health?deep=1', { authorization: `Bearer ${SECRET}` })
  check('the deep check, with the secret, reports the database failure (503)', r.status === 503 && (r.json?.checks ?? []).some((c) => c.name === 'database' && c.status === 'fail'), r)
}

stop()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
