// Browser test, Phase 4a: guest date picking + live price + request, and the
// partner booking/calendar page. Desktop and phone.
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import pg from 'pg'
import { AGREEMENTS } from './.agreements-list.generated.mjs'

const BASE = 'http://localhost:3300'
const OUT = process.env.OUT
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)))
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') }); await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)

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
const day = (n) => { const d = new Date(Date.now() + 3600_000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const label = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

// Partner (agreement already signed), a published bookable listing, a guest.
await q('delete from "RateLimit"')
const P = makeJar(); const pEmail = `ui.host${stamp}@test.local`
await P.api('/api/auth/sign-up/email', { name: 'Ui Host', email: pEmail, password })
const pid = (await q(`select id from "User" where email=$1`, [pEmail]))[0].id
await q(`update "User" set role='partner' where id=$1`, [pid])
const en = await P.api('/api/auth/two-factor/enable', { password })
await P.api('/api/auth/two-factor/verify-totp', { code: totp(new URL(en.totpURI).searchParams.get('secret')) })
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","updatedAt") values (gen_random_uuid(),$1,'property_host','approved','Ui Host Stays',now())`, [pid])
for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x','Ui Host',$5,'Ui Host Stays')`, [pid, a.key, a.version, a.title, pEmail])
const slug = `lekki-villa-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),'Lekki Villa UI',$1,'real_estate','Test villa.',450000,'₦450,000','Lekki, Lagos','Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200'],'{}',ARRAY[]::text[],'booking','luxury_shortlets',$2,true,now())`, [slug, pid])
const L = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
await q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","maxUnits","maxGuests","updatedAt") values ($1,true,'night',450000,50000,200000,2,14,6,now())`, [L])
await q(`insert into "UnavailableDate" (id,"listingId","startDate","endDate",note) values (gen_random_uuid(),$1,$2,$3,'Owner stay')`, [L, `${day(50)}T00:00:00Z`, `${day(53)}T00:00:00Z`])
await q('delete from "RateLimit"')
const G = makeJar(); const gEmail = `ui.guest${stamp}@example.com` // Paystack rejects @test.local
await G.api('/api/auth/sign-up/email', { name: 'Ui Guest', email: gEmail, password })

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9342', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'bu-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9342/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
const signInAs = async (j) => { await send('Network.clearBrowserCookies'); if (j) for (const [name, value] of j.jar) await send('Network.setCookie', { name, value, url: BASE }) }
async function load(url) { await send('Page.navigate', { url: 'about:blank' }); await sleep(100); await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(2000) }
const waitFor = async (expr, ms = 12000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await sleep(200) } return false }
const noSideScroll = () => ev('document.documentElement.scrollWidth <= innerWidth + 1')
// Click a calendar day, paging months forward until it is on screen.
async function pickDay(d) {
  for (let i = 0; i < 14; i++) {
    const done = await ev(`(() => { const b = [...document.querySelectorAll('#enquire button[aria-label]')].find(x => x.getAttribute('aria-label').startsWith(${JSON.stringify(label(d))}) && x.offsetParent); if (!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true })()`)
    if (done) return true
    await ev(`document.querySelector('#enquire button[aria-label="Next month"]')?.click()`)
    await sleep(250)
  }
  return false
}
// Page forward until the day is on screen (it may fall in a later month).
async function dayState(d) {
  for (let i = 0; i < 6; i++) {
    const st = await dayStateNow(d)
    if (st) return st
    await ev(`document.querySelector('#enquire button[aria-label="Next month"]')?.click()`)
    await sleep(250)
  }
  return null
}
const dayStateNow = (d) => ev(`(() => { const b = [...document.querySelectorAll('#enquire button[aria-label]')].find(x => x.getAttribute('aria-label').startsWith(${JSON.stringify(label(d))}) && x.offsetParent); return b ? { disabled: b.disabled, label: b.getAttribute('aria-label') } : null })()`)

for (const [vp, metrics] of [['desktop', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }]]) {
  console.log(`\n== ${vp} ==`)
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await signInAs(null)
  await load(`${BASE}/catalog/real-estate/${slug}`)
  check(`${vp}: booking panel loads with the nightly price`, await waitFor(`document.querySelector('#enquire')?.innerText.includes('450,000')`), await ev(`document.querySelector('#enquire')?.innerText.slice(0,200)`))
  check(`${vp}: no sideways scroll`, await noSideScroll())
  check(`${vp}: pick check-in`, await pickDay(day(40)))
  check(`${vp}: pick check-out`, await pickDay(day(43)))
  check(`${vp}: exact total shown (3 nights + cleaning)`, await waitFor(`document.querySelector('#enquire').innerText.includes('₦1,400,000')`), await ev(`document.querySelector('#enquire').innerText.slice(0,600)`))
  check(`${vp}: caution deposit shown separately`, await waitFor(`document.querySelector('#enquire').innerText.includes('₦200,000')`))
  check(`${vp}: dates kept in the address`, (await ev('location.search')).includes(`start=${day(40)}`) && (await ev('location.search')).includes(`end=${day(43)}`), await ev('location.search'))
  await ev(`document.querySelector('#enquire').scrollIntoView({block:'start'})`)
  await sleep(500)
  await shot(`${vp}-guest-quote.jpg`)
  // A day inside the closed range can't be picked
  await pickDay(day(40)) // restart selection at check-in
  await sleep(300)
  const closed = await dayState(day(51))
  check(`${vp}: closed day is disabled and announced`, closed?.disabled === true && /unavailable/.test(closed.label), JSON.stringify(closed))
  check(`${vp}: no sideways scroll with the price showing`, await noSideScroll())
}

console.log('\n== request flow (phone) ==')
await load(`${BASE}/catalog/real-estate/${slug}?start=${day(40)}&end=${day(43)}&guests=2`)
check('dates restored from the address', await waitFor(`document.querySelector('#enquire').innerText.includes('₦1,400,000')`))
await ev(`[...document.querySelectorAll('#enquire button')].find(b => b.textContent.includes('Reserve & pay'))?.click()`)
await waitFor(`location.pathname.startsWith('/sign-up')`)
check('signed-out guest sent to sign-up, keeping the dates', /\/sign-up/.test(await ev('location.pathname')) && decodeURIComponent(await ev('location.search')).includes(`start=${day(40)}`), await ev('location.href'))
await signInAs(G)
await load(`${BASE}/catalog/real-estate/${slug}?start=${day(40)}&end=${day(43)}&guests=2`)
await waitFor(`document.querySelector('#enquire').innerText.includes('₦1,400,000')`)
await ev(`[...document.querySelectorAll('#enquire button')].find(b => b.textContent.includes('Reserve & pay'))?.click()`)
check('signed-in guest is sent to Paystack checkout', await waitFor(`location.hostname.includes('paystack')`, 25000), await ev('location.href'))
await shot('phone-guest-checkout.jpg')
const held = (await q(`select to_char(b."startDate",'YYYY-MM-DD') s, to_char(b."endDate",'YYYY-MM-DD') e, b.guests, b.status, b.total::text from "Booking" b join "User" u on u.id=b."userId" where b."listingId"=$1 and u.email=$2`, [L, gEmail]))[0]
check('booking held with the exact dates', held && held.s === day(40) && held.e === day(43), JSON.stringify(held))
check('held for payment with 2 guests and the quoted total', held?.status === 'pending_payment' && held.guests === 2 && Number(held.total) === 1400000, JSON.stringify(held))

console.log('\n== partner calendar (phone) ==')
await signInAs(P)
await load(`${BASE}/admin/listings/${L}/booking`)
check('partner booking page loads', await waitFor(`document.body.innerText.includes('Online booking is on')`), await ev('document.body.innerText.slice(0,300)'))
check('existing closed dates listed', await ev(`document.body.innerText.includes('Owner stay')`))
check('no sideways scroll', await noSideScroll())
const pick = async (d) => {
  for (let i = 0; i < 14; i++) {
    const ok = await ev(`(() => { const b = [...document.querySelectorAll('button[aria-label]')].find(x => x.getAttribute('aria-label').startsWith(${JSON.stringify(label(d))}) && x.offsetParent); if (!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true })()`)
    if (ok) return true
    await ev(`document.querySelector('button[aria-label="Next month"]')?.click()`); await sleep(250)
  }
  return false
}
await pick(day(60)); await sleep(200); await pick(day(62)); await sleep(300)
await ev(`(() => { const i = [...document.querySelectorAll('input')].find(x => x.placeholder?.includes('Owner stay')); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Maintenance'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Close '))?.click()`)
check('partner closes dates from the calendar', await waitFor(`document.body.innerText.includes('Maintenance')`))
const blocks = await q(`select "startDate","endDate" from "UnavailableDate" where "listingId"=$1 and note='Maintenance'`, [L])
check('stored as 3 closed days', blocks.length === 1 && blocks[0].startDate.toISOString().slice(0, 10) === day(60) && blocks[0].endDate.toISOString().slice(0, 10) === day(63), JSON.stringify(blocks))
await shot('phone-partner-calendar.jpg')

console.log(`\n${pass} passed, ${fail} failed`)
await db.end(); ws.close(); chrome.kill()
process.exit(fail ? 1 : 0)
