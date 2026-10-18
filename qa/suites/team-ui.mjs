// Partner programme UI in headless Chrome, desktop and phone:
// landing page, the application wizard (autosave, reload, document upload),
// and the admin review queue + detail page.
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
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

function makeJar() {
  const jar = new Map()
  const api = async (path, body) => {
    const res = await fetch(BASE + path, { method: body ? 'POST' : 'GET', headers: { origin: BASE, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); jar.set(p.slice(0, i), p.slice(i + 1)) }
    return res.json().catch(() => null)
  }
  return { jar, api }
}
function totp(secret) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) bits += alpha.indexOf(ch).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const h = createHmac('sha1', key).update(buf).digest(); const o = h[h.length - 1] & 0xf
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0')
}
const stamp = Date.now(), password = 'correct-horse-battery-7'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') }); await db.connect()



await db.query('delete from "RateLimit"')
const A = makeJar()
const email = `ada.tui${stamp}@test.local`
await A.api('/api/auth/sign-up/email', { name: 'Ada Admin', email, password })
await db.query(`update "User" set role='admin' where email=$1`, [email])
const en = await A.api('/api/auth/two-factor/enable', { password })
await A.api('/api/auth/two-factor/verify-totp', { code: totp(new URL(en.totpURI).searchParams.get('secret')) })
await db.query('delete from "RateLimit"')
const W = makeJar(); const wEmail = `bisi.tui${stamp}@test.local`
await W.api('/api/auth/sign-up/email', { name: 'Bisi Old Invite', email: wEmail, password })
await db.query(`update "User" set role='partner' where email=$1`, [wEmail])

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9341', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tu-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9341/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
for (const [name, value] of A.jar) await send('Network.setCookie', { name, value, url: BASE })
async function load(url) { await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1500) }
for (const [vp, metrics] of [['desktop', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }]]) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await load(BASE + '/admin/team')
  check(`${vp}: team page renders with presets`, await ev(`document.body.textContent.includes('Operations manager') && document.body.textContent.includes('Invited as partners')`))
  check(`${vp}: no sideways scroll`, await ev('document.documentElement.scrollWidth <= innerWidth + 1'))
  await shot(`${vp}-team.jpg`)
}
await ev(`[...[...document.querySelectorAll('div.p-4')].find(d => d.textContent.includes(${JSON.stringify(wEmail)})).querySelectorAll('button')].find(b => b.textContent.trim() === 'Move to team')?.click()`)
await sleep(500)
await ev(`[...[...document.querySelectorAll('div.p-4')].find(d => d.textContent.includes(${JSON.stringify(wEmail)})).querySelectorAll('button')].find(b => b.textContent.trim() === 'Partner onboarding')?.click()`)
await sleep(400)
await ev(`[...[...document.querySelectorAll('div.p-4')].find(d => d.textContent.includes(${JSON.stringify(wEmail)})).querySelectorAll('button')].filter(b => b.textContent.includes('Move to team')).pop()?.scrollIntoView({block:'center'})`)
await sleep(400)
check('phone: move-to-team editor still fits', await ev('document.documentElement.scrollWidth <= innerWidth + 1'))
await shot('phone-team-move.jpg')
await ev(`[...[...document.querySelectorAll('div.p-4')].find(d => d.textContent.includes(${JSON.stringify(wEmail)})).querySelectorAll('button')].filter(b => b.textContent.includes('Move to team')).pop()?.click()`)
let moved = false
for (let i = 0; i < 40 && !moved; i++) { await sleep(250); moved = (await db.query(`select role from "User" where email=$1`, [wEmail])).rows[0].role === 'team' }
check('phone: tapping Move to team works', moved)
console.log(`\n${pass} passed, ${fail} failed`)
await db.end(); ws.close(); chrome.kill()
process.exit(fail ? 1 : 0)
