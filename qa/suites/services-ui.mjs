// Private Services S1 UI in headless Chrome, desktop and phone: homepage
// pillar, category page (groups, anchors, cards), apply wizard type card and
// documents, and the admin price-floors page (edit + save).
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
  const api = async (path, body, method) => {
    const res = await fetch(BASE + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { origin: BASE, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
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
const A = makeJar(); const aEmail = `ada.sui${stamp}@test.local`
await A.api('/api/auth/sign-up/email', { name: 'Ada Admin', email: aEmail, password })
await db.query(`update "User" set role='admin' where email=$1`, [aEmail])
const en = await A.api('/api/auth/two-factor/enable', { password })
await A.api('/api/auth/two-factor/verify-totp', { code: totp(new URL(en.totpURI).searchParams.get('secret')) })
await db.query('delete from "RateLimit"')
const C = makeJar(); const cEmail = `kemi.sui${stamp}@test.local`
await C.api('/api/auth/sign-up/email', { name: 'Kemi Stylist', email: cEmail, password })

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9343', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'su-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9343/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
async function load(url) { await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1500) }
const setCookies = async (jar) => { await send('Network.clearBrowserCookies'); for (const [name, value] of jar) await send('Network.setCookie', { name, value, url: BASE }) }
const fits = () => ev('document.documentElement.scrollWidth <= innerWidth + 1')

const VIEWPORTS = [['desktop', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }]]

// Warm ISR pages once so the checks see the current build.
await fetch(BASE + '/'); await fetch(BASE + '/catalog/private-services')

for (const [vp, metrics] of VIEWPORTS) {
  console.log(`— ${vp}`)
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await send('Network.clearBrowserCookies')

  await load(BASE + '/')
  await ev(`[...document.querySelectorAll('h3')].find(h => h.textContent.includes('Private Services'))?.scrollIntoView({block:'center'})`)
  await sleep(1200)
  let pillarSeen = false
  for (let i = 0; i < 20 && !pillarSeen; i++) { pillarSeen = await ev(`(() => { const h = [...document.querySelectorAll('h3')].find(h => h.textContent.includes('Private Services')); if (!h) return false; const r = h.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && r.bottom > 0 })()`); if (!pillarSeen) await sleep(250) }
  check(`${vp}: homepage pillar visible`, pillarSeen || await ev(`(() => { const h = [...document.querySelectorAll('h3')].find(h => h.textContent.includes('Private Services')); if (!h) return false; const r = h.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && r.bottom > 0 })()`))
  check(`${vp}: pillar has the four group chips`, await ev(`['Private Dining','Wellness','Grooming & Beauty','Home & Hosting'].every(l => [...document.querySelectorAll('a')].some(a => a.textContent.trim() === l && a.getAttribute('href').startsWith('/catalog/private-services#')))`))
  check(`${vp}: homepage has no sideways scroll`, await fits())
  await shot(`${vp}-home-pillar.jpg`)

  await load(BASE + '/catalog/private-services')
  check(`${vp}: category headline`, await ev(`document.querySelector('h1')?.textContent.trim() === 'Services'`))
  check(`${vp}: 11 service blocks`, await ev(`document.querySelectorAll('[id^="svc-"]').length === 11`))
  check(`${vp}: group jump links present`, await ev(`['dining','wellness','grooming','hosting'].every(g => document.querySelector('a[href="#'+g+'"]'))`))
  check(`${vp}: category page has no sideways scroll`, await fits())
  await shot(`${vp}-category-top.jpg`)
  await ev(`document.querySelector('a[href="#wellness"]').click()`)
  let atWellness = false
  for (let i = 0; i < 20 && !atWellness; i++) { await sleep(250); atWellness = await ev(`(() => { const r = document.getElementById('wellness').getBoundingClientRect(); return r.top >= -5 && r.top < innerHeight / 2 })()`) }
  check(`${vp}: jump link scrolls to Wellness`, atWellness, await ev(`document.getElementById('wellness').getBoundingClientRect().top`))
  await shot(`${vp}-category-wellness.jpg`)
  check(`${vp}: empty service offers an on-site request`, await ev(`!!document.querySelector('#svc-nail_technician [data-brief-trigger]') && ![...document.querySelectorAll('#svc-nail_technician a')].some(a => /wa\\.me/.test(a.href))`))
  check(`${vp}: tap targets at least 40px`, await ev(`[...document.querySelectorAll('#svc-nail_technician a, a[href="#wellness"]')].every(a => a.getBoundingClientRect().height >= 40)`))
  await ev(`document.querySelector('a[href="/partners/apply"]')?.scrollIntoView({block:'center'})`)
  await sleep(600)
  await shot(`${vp}-category-apply.jpg`)
}

console.log('— apply wizard (phone)')
await send('Emulation.setDeviceMetricsOverride', VIEWPORTS[1][1])
await setCookies(C.jar)
await load(BASE + '/partners/apply')
check('Service professional card offered', await ev(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Service professional'))`))
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Service professional')).click()`)
await sleep(2500)
await ev(`[...document.querySelectorAll('ol[aria-label="Application steps"] button')].find(b => /Business/.test(b.textContent))?.click()`)
await sleep(1200)
check('services listed as collections to pick', await ev(`['Private Chef','Massage & Spa','Private Barber'].every(l => document.body.textContent.includes(l))`))
check('wizard fits on phone', await fits())
await shot('phone-apply-type.jpg')
const saved = (await db.query(`select "partnerType" from "PartnerApplication" a join "User" u on u.id=a."userId" where u.email=$1`, [cEmail])).rows[0]
check('choice autosaved as service_professional', saved?.partnerType === 'service_professional', JSON.stringify(saved))
// Jump straight to the documents step via the step strip.
await ev(`[...document.querySelectorAll('ol[aria-label="Application steps"] button')].find(b => /Documents/.test(b.textContent))?.click()`)
await sleep(1200)
check('documents step lists police certificate, portfolio and references', await ev(`['Police character certificate','Portfolio','Two references','Proof of address'].every(l => document.body.textContent.includes(l))`))
check('documents step fits on phone', await fits())
await shot('phone-apply-docs.jpg')

console.log('— admin price floors')
await setCookies(A.jar)
for (const [vp, metrics] of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await load(BASE + '/admin/services')
  check(`${vp}: floors page lists 11 services`, await ev(`document.querySelectorAll('input[data-floor]').length === 11`))
  check(`${vp}: floors page fits`, await fits())
  await shot(`${vp}-admin-floors.jpg`)
}
await ev(`(() => { const i = document.querySelector('input[data-floor="photographer"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '120000'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
await ev(`[...document.querySelectorAll('button')].find(b => /Save floors/.test(b.textContent)).click()`)
let floor = null
for (let i = 0; i < 40; i++) { await sleep(250); floor = (await db.query(`select "minPrice" from "ServicePriceFloor" where subcategory='photographer'`)).rows[0]; if (floor && Number(floor.minPrice) === 120000) break }
check('save from the page writes the floor', floor && Number(floor.minPrice) === 120000, JSON.stringify(floor))
await load(BASE + '/admin/services')
check('saved value shown after reload', await ev(`document.querySelector('input[data-floor="photographer"]').value.replace(/\\D/g,'') === '120000'`))
await A.api('/api/admin/service-floors', { floors: { photographer: 100000 } }, 'PUT')

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
