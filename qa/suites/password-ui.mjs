// Browser test: show/hide password on sign-in, sign-up and reset, and that
// signing in with the toggle still works. Desktop and phone.
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import pg from 'pg'

const BASE = 'http://localhost:3300'
const OUT = process.env.OUT
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)))
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') }); await db.connect()
await db.query('delete from "RateLimit"')
const stamp = Date.now(), email = `pw.ui${stamp}@test.local`, password = 'correct-horse-battery-5'
await fetch(BASE + '/api/auth/sign-up/email', { method: 'POST', headers: { origin: BASE, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Pw Tester', email, password }) })

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9343', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pw-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9343/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
async function load(url) { await send('Page.navigate', { url: 'about:blank' }); await sleep(100); await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(2000) }
const waitFor = async (expr, ms = 15000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await sleep(200) } return false }
const type = (sel, value) => ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(value)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)

for (const [vp, metrics] of [['desktop', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }]]) {
  console.log(`\n== ${vp} ==`)
  await send('Emulation.setDeviceMetricsOverride', metrics)
  for (const [page, count] of [['/sign-in', 1], ['/sign-up', 2]]) {
    await load(BASE + page)
    const n = await ev(`document.querySelectorAll('button[aria-label="Show password"]').length`)
    check(`${vp} ${page}: every password field has a show button (${count})`, n === count, `${n}`)
    check(`${vp} ${page}: passwords start hidden`, await ev(`[...document.querySelectorAll('input[autocomplete$="password"]')].every(i => i.type === 'password')`))
    await type('input[autocomplete$="password"]', 'Secret-Phrase-123')
    await ev(`document.querySelector('button[aria-label="Show password"]').click()`)
    await sleep(200)
    check(`${vp} ${page}: tapping the eye reveals the text`, await ev(`document.querySelector('input[autocomplete$="password"]').type === 'text' && document.querySelector('input[autocomplete$="password"]').value === 'Secret-Phrase-123'`))
    check(`${vp} ${page}: button now says "Hide password" and is pressed`, await ev(`(() => { const b = document.querySelector('button[aria-label="Hide password"]'); return !!b && b.getAttribute('aria-pressed') === 'true' })()`))
    if (vp === 'phone' && page === '/sign-in') await shot('phone-signin-visible.jpg')
    await ev(`document.querySelector('button[aria-label="Hide password"]').click()`)
    await sleep(200)
    check(`${vp} ${page}: tapping again hides it`, await ev(`document.querySelector('input[autocomplete$="password"]').type === 'password'`))
    check(`${vp} ${page}: no sideways scroll`, await ev('document.documentElement.scrollWidth <= innerWidth + 1'))
  }
}

console.log('\n== sign in with the password shown ==')
await send('Network.clearBrowserCookies')
await load(BASE + '/sign-in')
await type('input[type="email"]', email)
await type('input[autocomplete="current-password"]', password)
await ev(`document.querySelector('button[aria-label="Show password"]').click()`)
await sleep(200)
await ev(`document.querySelector('form button[type="submit"]').click()`)
check('signing in works while the password is visible', await waitFor(`!location.pathname.startsWith('/sign-in')`), await ev('location.href'))

console.log(`\n${pass} passed, ${fail} failed`)
await db.end(); ws.close(); chrome.kill()
process.exit(fail ? 1 : 0)
