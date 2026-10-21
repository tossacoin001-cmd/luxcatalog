// The human check (Cloudflare Turnstile): it must show up where visitors can
// see it whenever the secret is set, whichever way the site key was named, and
// it must really refuse a visitor who fails it. Uses Cloudflare's published
// TEST keys, which never touch a real widget:
//   site key  1x00000000000000000000AA   (always passes)
//   secret    1x0000000000000000000000000000000AA (always passes)
//   secret    2x0000000000000000000000000000000AA (always fails)
//   token     XXXX.DUMMY.TOKEN.XXXX       (accepted by the always-pass secret)
// Starts extra copies of the built app, so it needs qa/serve.sh's build.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DB = process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable'
const root = fileURLToPath(new URL('../../', import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const SITE = '1x00000000000000000000AA'
const PASS_SECRET = '1x0000000000000000000000000000000AA'
const FAIL_SECRET = '2x0000000000000000000000000000000AA'

const children = []
async function start(port, extraEnv) {
  const base = `http://localhost:${port}`
  const env = { ...process.env, DATABASE_URL: DB, DIRECT_URL: DB, DATABASE_POOL_MAX: '1', BETTER_AUTH_SECRET: 'local-test-secret-0123456789abcdef0123', BETTER_AUTH_URL: base, NEXT_PUBLIC_APP_URL: base, CRON_SECRET: 'local-cron-secret-0123456789', EMAIL_DEBUG_DIR: fileURLToPath(new URL('../mail', import.meta.url)) }
  for (const k of ['TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'OWNER_EMAIL']) delete env[k]
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { cwd: root, stdio: 'ignore', env: { ...env, ...extraEnv } })
  children.push(child)
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${base}/robots.txt`)).status === 200) return base } catch {} await sleep(1000) }
  return null
}
const stop = () => children.forEach((c) => { try { c.kill() } catch {} })
process.on('exit', stop)
const keyOf = async (base) => (await (await fetch(base + '/api/turnstile-config')).json()).siteKey
const post = (base, path, body, ip) => fetch(base + path, { method: 'POST', headers: { origin: base, 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }))
const enquiry = (extra = {}) => ({ kind: 'enquiry', name: 'Check Person', email: `check.${Date.now()}@example.com`, message: 'A short question about a home in Ikoyi, please.', ...extra })

console.log('1. The site key was saved WITHOUT the NEXT_PUBLIC_ prefix (what happened in production)')
const a = await start(3302, { TURNSTILE_SECRET_KEY: PASS_SECRET, TURNSTILE_SITE_KEY: SITE })
check('the copy starts', !!a)
if (a) {
  check('the page asks the server for the key, and it is handed over', (await keyOf(a)) === SITE, await keyOf(a))
  for (const p of ['/sign-up', '/sign-in', '/contact']) check(`${p} opens`, (await fetch(a + p)).status === 200)
  check('a guest enquiry with no human-check token is refused', (await post(a, '/api/inquiries', enquiry(), '10.30.0.1')).status === 400)
  const ok = await post(a, '/api/inquiries', enquiry({ captcha: 'XXXX.DUMMY.TOKEN.XXXX' }), '10.30.0.2')
  check('a guest enquiry with a passing token is accepted', ok.status === 200 && ok.json?.success === true, ok)
  check('a made-up token is not accepted by the real check', (await post(a, '/api/inquiries', enquiry({ captcha: '' }), '10.30.0.3')).status === 400)
}

console.log('2. The site key saved WITH the prefix still works')
const b = await start(3303, { TURNSTILE_SECRET_KEY: PASS_SECRET, NEXT_PUBLIC_TURNSTILE_SITE_KEY: SITE })
check('the copy starts', !!b)
if (b) check('the key is handed over', (await keyOf(b)) === SITE)

console.log('3. A failing check really blocks')
const c = await start(3304, { TURNSTILE_SECRET_KEY: FAIL_SECRET, TURNSTILE_SITE_KEY: SITE })
check('the copy starts', !!c)
if (c) {
  const r = await post(c, '/api/inquiries', enquiry({ captcha: 'XXXX.DUMMY.TOKEN.XXXX' }), '10.30.0.4')
  check('a token the check rejects is refused with a plain message', r.status === 400 && /quick check/i.test(r.json?.error ?? ''), r)
}

console.log('4. With no keys at all (local and tests) nothing is shown and nothing is required')
const d = await start(3305, {})
check('the copy starts', !!d)
if (d) {
  check('no key is handed over', (await keyOf(d)) === null)
  const r = await post(d, '/api/inquiries', enquiry(), '10.30.0.5')
  check('an enquiry with no token is accepted', r.status === 200, r)
}

const f2 = await start(3307, { TURNSTILE_SITE_KEY: SITE })
check('a site key without its secret shows nothing (they switch on together)', !!f2 && (await keyOf(f2)) === null)

console.log('5. A site key with a stray space or newline is cleaned')
const e = await start(3306, { TURNSTILE_SECRET_KEY: PASS_SECRET, TURNSTILE_SITE_KEY: `  ${SITE}\n` })
check('the copy starts', !!e)
if (e) check('the clean key is handed over', (await keyOf(e)) === SITE)

stop()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
