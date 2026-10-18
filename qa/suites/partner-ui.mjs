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

const applicant = makeJar()
await applicant.api('/api/auth/sign-up/email', { name: 'Kemi Ade', email: `kemi.ui${stamp}@test.local`, password })
const admin = makeJar()
const adminEmail = `ui.rev${stamp}@test.local`
await admin.api('/api/auth/sign-up/email', { name: 'Ada Admin', email: adminEmail, password })
await db.query(`update "User" set role='admin' where email=$1`, [adminEmail])
const en = await admin.api('/api/auth/two-factor/enable', { password })
await admin.api('/api/auth/two-factor/verify-totp', { code: totp(new URL(en.totpURI).searchParams.get('secret')) })

const pdfPath = join(OUT, 'id.pdf')
writeFileSync(pdfPath, '%PDF-1.4\n% ui test\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9339', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pu-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9339/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('DOM.enable')
async function signInAs(j) { await send('Network.clearBrowserCookies'); for (const [name, value] of j.jar) await send('Network.setCookie', { name, value, url: BASE }) }
async function load(url) { await send('Page.navigate', { url: 'about:blank' }); await sleep(100); await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1500) }
const noSideScroll = () => ev('document.documentElement.scrollWidth <= innerWidth + 1')
const clickText = (sel, text) => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().includes(${JSON.stringify(text)}) && !e.disabled); if (!b) return false; b.click(); return true })()`)
const typeInto = (labelText, value) => ev(`(() => { const lab = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(${JSON.stringify(labelText)})); const inp = lab?.querySelector('input,textarea') ?? lab?.parentElement.querySelector('input,textarea'); if (!inp) return false; const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, ${JSON.stringify(value)}); inp.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
const waitFor = async (expr, ms = 8000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await sleep(200) } return false }

const VIEWPORTS = [
  ['desktop', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }],
  ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }],
]

let appId
for (const [vp, metrics] of VIEWPORTS) {
  console.log(`\n== ${vp} ==`)
  await send('Emulation.setDeviceMetricsOverride', metrics)

  await signInAs({ jar: new Map() })
  await load(BASE + '/partners')
  check(`${vp}: landing page renders`, await ev(`document.body.innerText.includes('Security company') && !!document.querySelector('a[href="/partners/apply"]')`))
  check(`${vp}: landing page has no sideways scroll`, await noSideScroll())
  await shot(`${vp}-landing.jpg`)

  await signInAs(applicant)
  await load(BASE + '/partners/apply')
  check(`${vp}: wizard opens for signed-in user`, (await ev('location.pathname')) === '/partners/apply', await ev('location.pathname'))
  check(`${vp}: wizard has no sideways scroll`, await noSideScroll())
  await shot(`${vp}-wizard-type.jpg`)

  if (vp === 'desktop') {
    check('choose "Car owner / Fleet"', await clickText('button', 'Car owner / Fleet'))
    check('autosave confirms the draft', await waitFor(`document.body.innerText.includes('All changes saved')`))
    await clickText('button', 'Business'); await sleep(500)
    check('business step shows fields', await typeInto('Trading or brand name', 'Kemi Prestige Rides'))
    await typeInto('City', 'Lagos')
    await waitFor(`document.body.innerText.includes('Saving')`, 3000)
    check('autosave after typing', await waitFor(`document.body.innerText.includes('All changes saved')`))
    await load(BASE + '/partners/apply')
    await clickText('button', 'Business'); await sleep(500)
    const kept = await ev(`[...document.querySelectorAll('input')].some(i => i.value === 'Kemi Prestige Rides')`)
    check('draft survives a page reload', kept)
  }

  await clickText('button', 'Documents'); await sleep(600)
  check(`${vp}: documents step lists Government ID`, await ev(`document.body.innerText.includes('Government ID') && document.body.innerText.includes('Insurance covering hire')`))
  check(`${vp}: documents step has no sideways scroll`, await noSideScroll())
  if (vp === 'desktop') {
    const { root } = (await send('DOM.getDocument', { depth: -1 })).result
    const { nodeIds } = (await send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'input[type=file]' })).result
    await send('DOM.setFileInputFiles', { nodeId: nodeIds[0], files: [pdfPath] })
    check('upload shows as done in the row', await waitFor(`!!document.querySelector('[aria-label="Uploaded"]')`, 15000))
  }
  await shot(`${vp}-wizard-docs.jpg`)

  await clickText('button', 'Review'); await sleep(600)
  check(`${vp}: review lists what is still needed`, await ev(`document.body.innerText.includes('Still needed before you can submit')`))
  check(`${vp}: submit disabled while incomplete`, await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Submit application'))?.disabled === true`))
  await shot(`${vp}-wizard-review.jpg`)

  appId ??= (await db.query(`select a.id from "PartnerApplication" a join "User" u on u.id=a."userId" where u.email=$1`, [`kemi.ui${stamp}@test.local`])).rows[0]?.id

  await signInAs(admin)
  await load(BASE + '/admin/applications?status=draft')
  check(`${vp}: admin queue shows the draft`, await ev(`document.body.innerText.includes('Kemi Prestige Rides')`))
  check(`${vp}: admin queue has no sideways scroll`, await noSideScroll())
  await shot(`${vp}-admin-queue.jpg`)
  await load(`${BASE}/admin/applications/${appId}`)
  check(`${vp}: admin detail shows business and document`, await ev(`document.body.innerText.includes('Kemi Prestige Rides') && document.body.innerText.includes('Government ID')`))
  check(`${vp}: admin detail has no sideways scroll`, await noSideScroll())
  await shot(`${vp}-admin-detail.jpg`)
}

console.log(`\n${pass} passed, ${fail} failed`)
await db.end(); ws.close(); chrome.kill()
process.exit(fail ? 1 : 0)
