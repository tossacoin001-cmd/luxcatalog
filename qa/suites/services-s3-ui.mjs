// Private Services S3 in headless Chrome:
// - guest (phone) reports a concern from their booking page;
// - admin (desktop) sees it under "Needs attention" and resolves it;
// - stay page (phone) cross-sells Private Services with group links;
// - service panel offers "At my Lux Catalog stay" and fills the address.
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import pg from 'pg'
import { AGREEMENTS } from './.agreements-list.generated.mjs'

const BASE = 'http://localhost:3300'
const OUT = process.env.OUT
const SK = process.env.PAYSTACK_SECRET_KEY
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') }); await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)

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
async function person(name, email, role) {
  await q('delete from "RateLimit"')
  const j = makeJar()
  await j.api('/api/auth/sign-up/email', { name, email, password })
  await sleep(600)
  j.id = (await q(`select id from "User" where email=$1`, [email]))[0].id
  if (role) {
    await q(`update "User" set role=$2 where id=$1`, [j.id, role])
    const en = await j.api('/api/auth/two-factor/enable', { password })
    await j.api('/api/auth/two-factor/verify-totp', { code: totp(new URL(en.totpURI).searchParams.get('secret')) })
  }
  return j
}
const pay = async (ref) => {
  const b = (await q(`select "amountDue"::text due from "Booking" where reference=$1`, [ref]))[0]
  const raw = JSON.stringify({ event: 'charge.success', data: { reference: ref, status: 'success', amount: Math.round(Number(b.due) * 100), currency: 'NGN', paid_at: new Date().toISOString(), channel: 'card' } })
  await fetch(`${BASE}/api/paystack/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': createHmac('sha512', SK).update(raw).digest('hex') }, body: raw })
}
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const lagosToday = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)

const P = await person('Amaka Obi', `amaka.s3ui${stamp}@test.local`, 'partner')
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","contactName",collections,"updatedAt") values (gen_random_uuid(),$1,'service_professional','approved','Chef Amaka Kitchen','Amaka Obi',ARRAY['private_chef'],now())`, [P.id])
await q(`insert into "PartnerProfile" (id,"userId","brandName","updatedAt") values (gen_random_uuid(),$1,'Chef Amaka Kitchen',now())`, [P.id])
for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x','Amaka Obi',$5,'Chef Amaka Kitchen')`, [P.id, a.key, a.version, a.title, `amaka.s3ui${stamp}@test.local`])
const A = await person('Ada Admin', `ada.s3ui${stamp}@test.local`, 'admin')
const G = await person('Grace Guest', `grace.s3ui${stamp}@example.com`)
const slug = `chef-amaka-s3ui-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),'Chef Amaka Private Dining',$1,'private_services','Private dinners at home.',60000,'₦60,000','Ikoyi, Lagos','Nigeria',ARRAY['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80'],'{}',ARRAY[]::text[],'booking','private_chef',$2,true,now())`, [slug, P.id])
const L = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
const allDay = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { from: '09:00', to: '22:00' }]))
const set = await P.api(`/api/admin/listings/${L}/services`, { enabled: true, instantBook: true, cancellationPolicy: 'moderate', advanceNoticeHours: 24, bufferMinutes: 60, capacity: 1, workingHours: allDay, areas: [{ area: 'Ikoyi', fee: 0 }, { area: 'Victoria Island', fee: 5000 }], packages: [{ name: 'Dinner for two', description: 'Three courses.', durationMinutes: 120, pricing: 'fixed', price: 60000, minGuests: 1, maxGuests: 2 }] }, 'PUT')
const PKG = set?.settings?.packages?.[0]?.id
// A stay for the guest, and a paid session.
const sslug = `ikoyi-loft-s3ui-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),'Ikoyi Loft UI',$1,'real_estate','Test stay.',300000,'₦300,000','Ikoyi, Lagos','Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200'],'{}',ARRAY[]::text[],'booking','luxury_shortlets',true,now())`, [sslug])
const SL = (await q(`select id from "Listing" where slug=$1`, [sslug]))[0].id
await q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","maxUnits","maxGuests","instantBook","advanceNoticeHours","updatedAt") values ($1,true,'night',300000,0,0,1,14,4,true,0,now())`, [SL])
const STAY_FROM = addDays(lagosToday, 12)
const STAY = (await G.api('/api/bookings', { listingId: SL, start: STAY_FROM, end: addDays(STAY_FROM, 3) }))?.reference
await pay(STAY)
const SESSION_DAY = addDays(STAY_FROM, 1)
const SESS = (await G.api('/api/bookings', { listingId: L, session: { packageId: PKG, date: SESSION_DAY, time: '19:00', guests: 2, area: 'Ikoyi', address: 'Ikoyi Loft UI, Ikoyi, Lagos, Flat 3', notes: '' } }))?.reference
await pay(SESS)
check('setup: paid stay and paid session', !!STAY && !!SESS, `${STAY} ${SESS}`)

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9347', `--user-data-dir=${mkdtempSync(join(tmpdir(), 's3-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9347/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }) }
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
async function signInAs(j) { await send('Network.clearBrowserCookies'); for (const [name, value] of j.jar) await send('Network.setCookie', { name, value, url: BASE }) }
async function load(url) { await send('Page.navigate', { url: 'about:blank' }); await sleep(100); await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1500) }
const waitFor = async (expr, ms = 10000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await sleep(200) } return false }
const fits = () => ev('document.documentElement.scrollWidth <= innerWidth + 1')
const setVal = (sel, value) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const click = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || el.disabled) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const clickText = (sel, txt) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().includes(${JSON.stringify(txt)}) && !e.disabled); if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }

console.log('1. Guest reports a concern (phone)')
await send('Emulation.setDeviceMetricsOverride', PHONE)
await signInAs(G)
await load(`${BASE}/bookings/${SESS}`)
check('"Report a concern" offered', await clickText('button', 'Report a concern'))
check('form shows the kinds', await waitFor(`(() => { const s = document.querySelector('select[name=kind]'); return !!s && [...s.options].some(o => o.textContent.includes('Safety or conduct')) })()`, 4000))
await setVal('select[name=kind]', 'no_show')
await setVal('textarea[name=message]', 'The chef had not arrived 40 minutes after the start time and is not answering.')
check('form fits the phone', await fits())
await shot('1-concern-form.jpg')
await clickText('button', 'Send report')
check('guest sees it was received', await waitFor(`document.body.textContent.includes('received your report')`, 10000), await ev(`document.body.textContent.slice(0, 300)`))
await sleep(500)
const c = (await q(`select bc.id, bc.kind, bc.status from "BookingConcern" bc join "Booking" b on b.id=bc."bookingId" where b.reference=$1`, [SESS]))[0]
check('stored as an open no-show report', c?.kind === 'no_show' && c.status === 'open', JSON.stringify(c))
await shot('2-concern-sent.jpg')

console.log('2. Admin resolves it (desktop)')
await send('Emulation.setDeviceMetricsOverride', DESKTOP)
await signInAs(A)
await load(`${BASE}/admin/bookings?view=attention`)
check('listed under Needs attention with the report', await ev(`document.body.textContent.includes(${JSON.stringify(SESS)}) && document.body.textContent.includes('40 minutes')`))
await setVal(`[data-concern="${c?.id}"] textarea[name=note]`, 'Reached the chef: traffic on Third Mainland Bridge, arrived 18:55. Partial refund offered.')
check('click Mark resolved', await clickText(`[data-concern="${c?.id}"] button`, 'Mark resolved'))
check('shown as resolved', await waitFor(`!document.querySelector('[data-concern="${c?.id}"] button') || document.querySelector('[data-concern="${c?.id}"]').textContent.includes('Resolved')`, 10000))
await sleep(500)
const cr = (await q(`select status, "resolutionNote" from "BookingConcern" where id=$1`, [c?.id]))[0]
check('stored as resolved with the note', cr?.status === 'resolved' && /Third Mainland/.test(cr.resolutionNote ?? ''), JSON.stringify(cr))
await shot('3-admin-resolved.jpg')

console.log('3. Stay page cross-sell (phone)')
await send('Emulation.setDeviceMetricsOverride', PHONE)
await signInAs(G)
await load(`${BASE}/bookings/${STAY}`)
check('"Make your stay effortless" shown', await ev(`!!document.querySelector('[data-cross-sell]') && document.querySelector('[data-cross-sell]').textContent.includes('Make your stay effortless')`))
check('links to each group', await ev(`['#dining','#wellness','#grooming','#hosting'].every(h => !!document.querySelector('[data-cross-sell] a[href="/catalog/private-services' + h + '"]'))`))
check('cross-sell fits the phone', await fits())
check('cancel and report links don’t run into each other', await ev(`(() => { const a = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Cancel this booking')); const c = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Report a concern')); if (!a || !c) return false; const r1 = a.getBoundingClientRect(), r2 = c.getBoundingClientRect(); return r1.bottom <= r2.top || r2.bottom <= r1.top })()`))
await ev(`document.querySelector('[data-cross-sell]').scrollIntoView({block:'center'})`); await sleep(400)
await shot('4-cross-sell.jpg')
await click('[data-cross-sell] a[href="/catalog/private-services#dining"]')
check('tapping Private Dining opens the services page', await waitFor(`location.pathname === '/catalog/private-services' && location.hash === '#dining'`, 10000), await ev('location.href'))

console.log('4. "At my Lux Catalog stay" fills the address (phone)')
await load(`${BASE}/catalog/private-services/${slug}`)
await waitFor(`!!document.querySelector('[data-session-panel] [data-package]')`, 15000)
await click('[data-package]')
const target = addDays(STAY_FROM, 2)
for (let i = 0; i < 3 && !(await ev(`!!document.querySelector('[data-day="${target}"]')`)); i++) { await click('[data-session-panel] button[aria-label="Next month"]'); await sleep(600) }
await waitFor(`document.querySelector('[data-day="${target}"]')?.disabled === false`, 8000)
await click(`[data-day="${target}"]`)
check('stay suggestion offered for a day of the stay', await waitFor(`[...document.querySelectorAll('[data-session-panel] button')].some(b => b.textContent.includes('At my Lux Catalog stay') && b.textContent.includes('Ikoyi Loft UI'))`, 8000))
await clickText('[data-session-panel] button', 'At my Lux Catalog stay')
check('address filled with the stay', await waitFor(`document.querySelector('[data-session-panel] textarea[name=address]').value.includes('Ikoyi Loft UI') && document.querySelector('[data-session-panel] textarea[name=address]').value.includes(${JSON.stringify(STAY)})`, 3000), await ev(`document.querySelector('[data-session-panel] textarea[name=address]').value`))
check('area chosen from the stay (Ikoyi)', await ev(`document.querySelector('[data-session-panel] select[name=area]').value === 'Ikoyi'`))
check('panel fits the phone', await fits())
await ev(`document.querySelector('[data-session-panel] textarea[name=address]').scrollIntoView({block:'center'})`); await sleep(300)
await shot('5-stay-prefill.jpg')
const outside = addDays(STAY_FROM, 5)
for (let i = 0; i < 2 && !(await ev(`!!document.querySelector('[data-day="${outside}"]')`)); i++) { await click('[data-session-panel] button[aria-label="Next month"]'); await sleep(600) }
await waitFor(`document.querySelector('[data-day="${outside}"]')?.disabled === false`, 8000)
await click(`[data-day="${outside}"]`)
await sleep(1500)
check('no stay suggestion on a day outside the stay', !(await ev(`[...document.querySelectorAll('[data-session-panel] button')].some(b => b.textContent.includes('At my Lux Catalog stay'))`)))

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
