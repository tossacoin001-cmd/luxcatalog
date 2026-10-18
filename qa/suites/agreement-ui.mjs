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


const P = makeJar()
const email = `kemi.agr${stamp}@test.local`
await P.api('/api/auth/sign-up/email', { name: 'Kemi Ade', email, password })
const uid = (await db.query(`select id from "User" where email=$1`, [email])).rows[0].id
await db.query(`update "User" set role='partner' where id=$1`, [uid])
await db.query(`insert into "PartnerApplication" (id,"userId","partnerType",status,"legalForm","businessName","contactName",collections,"updatedAt") values (gen_random_uuid(),$1,'marine_operator','approved','company','Kemi Marine Charters','Kemi Ade',ARRAY['boat_cruises','aqua_homes'],now())`, [uid])

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9340', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'au-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9340/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
for (const [name, value] of P.jar) await send('Network.setCookie', { name, value, url: BASE })
async function load(url) { await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1500) }
const waitFor = async (expr, ms = 10000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await sleep(200) } return false }

for (const [vp, metrics] of [['desktop', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }]]) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await load(BASE + '/partners/agreement')
  check(`${vp}: agreement page shows master + marine schedule`, await ev(`document.body.innerText.includes('Partner Agreement') && document.body.innerText.includes('Schedule C: Boat Cruises')`))
  check(`${vp}: no sideways scroll`, await ev('document.documentElement.scrollWidth <= innerWidth + 1'))
  check(`${vp}: sign buttons disabled until agreed`, await ev(`[...document.querySelectorAll('button')].filter(b => b.textContent.includes('Sign agreement')).every(b => b.disabled)`))
  await shot(`${vp}-agreement-top.jpg`)
}
// sign both through the UI on the phone
for (let n = 0; n < 2; n++) {
  await ev(`(() => { const box = document.querySelector('input[type=checkbox]'); box.click(); })()`)
  await sleep(300)
  await ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Sign agreement')); b.scrollIntoView({block:'center'}); })()`)
  await sleep(400)
  if (n === 0) await shot('phone-agreement-ready-to-sign.jpg')
  await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Sign agreement') && !b.disabled)?.click()`)
  check(`phone: signature ${n + 1} recorded`, await waitFor(`document.querySelectorAll('a[href*="/api/partner-agreements/"]').length >= ${n + 1}`, 15000))
  await sleep(800)
}
check('phone: "all set" with next step shown', await waitFor(`document.body.innerText.includes('all set') && !!document.querySelector('a[href="/admin/listings/new"]')`))
await ev('window.scrollTo(0, 0)'); await sleep(400)
await shot('phone-agreement-signed.jpg')
const rec = (await db.query(`select id from "PartnerAgreement" where "userId"=$1 and "agreementKey"='master'`, [uid])).rows[0]
const pdf = Buffer.from(await (await fetch(`${BASE}/api/partner-agreements/${rec.id}/pdf`, { headers: { cookie: [...P.jar].map(([k, v]) => `${k}=${v}`).join('; ') } })).arrayBuffer())
writeFileSync(join(OUT, 'signed-master.pdf'), pdf)
check('signed PDF saved', pdf.subarray(0, 5).toString() === '%PDF-', String(pdf.length))

console.log(`\n${pass} passed, ${fail} failed`)
await db.end(); ws.close(); chrome.kill()
process.exit(fail ? 1 : 0)
