// Private Services S2 in headless Chrome:
// - partner (phone) sets up packages, weekly hours, areas and switches online
//   booking on; a below-floor package is explained in plain words;
// - guest (phone and desktop) picks a package, guests, a day, a time, an
//   area and an address; the live total includes travel; signed-out guests
//   keep their choice through sign-up; signed-in guests reach Paystack with
//   the session held exactly as chosen;
// - after payment the booking page shows the session and who's coming.
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
const utc = (day, time) => new Date(`${day}T${time}:00+01:00`).toISOString()
function dayOn(weekday, minDays) {
  const d = new Date(Date.now() + 3_600_000); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + minDays)
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

await q('delete from "RateLimit"')
const P = makeJar(); const pEmail = `amaka.sui${stamp}@test.local`
await P.api('/api/auth/sign-up/email', { name: 'Amaka Obi', email: pEmail, password })
const pid = (await q(`select id from "User" where email=$1`, [pEmail]))[0].id
await q(`update "User" set role='partner' where id=$1`, [pid])
const en = await P.api('/api/auth/two-factor/enable', { password })
await P.api('/api/auth/two-factor/verify-totp', { code: totp(new URL(en.totpURI).searchParams.get('secret')) })
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","contactName",collections,"updatedAt") values (gen_random_uuid(),$1,'service_professional','approved','Chef Amaka Kitchen','Amaka Obi',ARRAY['private_chef'],now())`, [pid])
await q(`insert into "PartnerProfile" (id,"userId","brandName","updatedAt") values (gen_random_uuid(),$1,'Chef Amaka Kitchen',now())`, [pid])
for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x','Amaka Obi',$5,'Chef Amaka Kitchen')`, [pid, a.key, a.version, a.title, pEmail])
const slug = `chef-amaka-ui-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),'Chef Amaka Private Dining',$1,'private_services','Private dinners at home.',45000,'₦45,000','Ikoyi, Lagos','Nigeria',ARRAY['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80'],'{}',ARRAY[]::text[],'booking','private_chef',$2,true,now())`, [slug, pid])
const L = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
await q('delete from "RateLimit"')
const G = makeJar(); const gEmail = `grace.sui${stamp}@example.com` // Paystack rejects @test.local
await G.api('/api/auth/sign-up/email', { name: 'Grace Guest', email: gEmail, password })

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9346', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'sb-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9346/json')).json(); break } catch { await sleep(500) } }
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
const text = () => ev('document.body.textContent')
// Set a form control the way a person would (React sees the change).
const setVal = (sel, value) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const click = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || el.disabled) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const clickText = (sel, txt) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().includes(${JSON.stringify(txt)}) && !e.disabled); if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const toast = () => ev(`[...document.querySelectorAll('[data-sonner-toast]')].map(t => t.textContent).join(' | ')`)
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }

console.log('1. Partner sets up online booking (phone)')
await send('Emulation.setDeviceMetricsOverride', PHONE)
await signInAs(P)
await load(`${BASE}/admin/listings/${L}/booking`)
check('service booking manager opens', await waitFor(`!!document.querySelector('[data-service-manager]')`, 15000), (await text()).slice(0, 200))
check('starts with no packages', await ev(`document.querySelectorAll('[data-package-row]').length === 0`))
check('add a package', await clickText('button', 'Add package'))
await sleep(300)
await setVal('[data-package-row] input[name=name]', 'Seven-course dinner')
await setVal('[data-package-row] textarea[name=description]', 'Modern Nigerian tasting menu, served and cleared.')
await setVal('[data-package-row] select[name=duration]', '240')
await setVal('[data-package-row] select[name=pricing]', 'per_guest')
await setVal('[data-package-row] input[name=price]', '20000')
await setVal('[data-package-row] input[name=minGuests]', '4')
await setVal('[data-package-row] input[name=maxGuests]', '10')
check('the floor is shown on the package', (await text()).includes('Minimum ₦35,000'))
// Hours: Mon–Sat 10:00–22:00, Sunday off.
for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
  await ev(`(() => { const box = document.querySelector('[data-day-row="${d}"] input[type=checkbox]'); if (!box.checked) box.click() })()`)
  await sleep(80)
  await setVal(`[data-day-row="${d}"] select[name=from]`, '10:00')
  await setVal(`[data-day-row="${d}"] select[name=to]`, '22:00')
}
await ev(`(() => { const box = document.querySelector('[data-day-row="sun"] input[type=checkbox]'); if (box.checked) box.click() })()`)
for (const [area, fee] of [['Ikoyi', 0], ['Victoria Island', 5000]]) {
  await ev(`(() => { const box = document.querySelector('[data-area="${area}"] input[type=checkbox]'); if (!box.checked) box.click() })()`)
  await sleep(80)
  await setVal(`[data-area="${area}"] input[name=fee]`, fee)
}
await setVal('select[name=policy]', 'moderate')
await setVal('select[name=notice]', '24')
await setVal('select[name=buffer]', '60')
await ev(`(() => { const box = document.querySelector('input[name=enabled]'); if (!box.checked) box.click() })()`)
check('manager fits the phone', await fits())
await shot('1-manager.jpg')
await clickText('button', 'Save')
check('below-floor package explained in plain words', await waitFor(`[...document.querySelectorAll('[data-sonner-toast], [role=alert]')].some(t => t.textContent.includes('₦35,000'))`, 10000), await toast())
check('nothing saved yet', (await q(`select count(*)::int n from "ServicePackage" where "listingId"=$1`, [L]))[0].n === 0)
await setVal('[data-package-row] input[name=price]', '45000')
await clickText('button', 'Save')
check('saved', await waitFor(`[...document.querySelectorAll('[data-sonner-toast]')].some(t => /saved/i.test(t.textContent))`, 10000), await toast())
await sleep(800)
const st = (await q(`select enabled, unit, "bufferMinutes", "workingHours", areas from "BookingSettings" where "listingId"=$1`, [L]))[0]
const pk = (await q(`select name, "durationMinutes", pricing, price::text, "minGuests", "maxGuests" from "ServicePackage" where "listingId"=$1 and active`, [L]))
check('settings stored: on, session, 60-min buffer', st?.enabled === true && st.unit === 'session' && st.bufferMinutes === 60, JSON.stringify(st))
check('hours stored: Saturday 10–22, Sunday off', st?.workingHours?.sat?.from === '10:00' && st.workingHours.sat.to === '22:00' && !st.workingHours.sun, JSON.stringify(st?.workingHours))
check('areas stored with fees', JSON.stringify((st?.areas ?? []).map((a) => [a.area, a.fee])) === JSON.stringify([['Ikoyi', 0], ['Victoria Island', 5000]]), JSON.stringify(st?.areas))
check('package stored', pk.length === 1 && pk[0].durationMinutes === 240 && pk[0].pricing === 'per_guest' && Number(pk[0].price) === 45000 && pk[0].minGuests === 4 && pk[0].maxGuests === 10, JSON.stringify(pk))
await load(`${BASE}/admin/listings/${L}/booking`)
check('saved values shown after reload', await waitFor(`document.querySelector('[data-package-row] input[name=name]')?.value === 'Seven-course dinner' && document.querySelector('input[name=enabled]')?.checked === true`, 15000))
await shot('2-manager-saved.jpg')

const D = dayOn(6, 10) // a Saturday at least 10 days out
const SUN = dayOn(0, 10)
await fetch(`${BASE}/catalog/private-services/${slug}`)

for (const [vp, metrics] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  console.log(`2. Guest books (${vp})`)
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await signInAs(vp === 'phone' ? { jar: new Map() } : G)
  await load(`${BASE}/catalog/private-services/${slug}`)
  check(`${vp}: session booking panel shown`, await waitFor(`!!document.querySelector('[data-session-panel]')`, 15000), (await text()).slice(0, 200))
  if (vp === 'phone') {
    // The bar appears once the visitor scrolls past the photo.
    await ev('window.scrollTo(0, innerHeight)')
    const barExpr = `[...document.querySelectorAll('div, aside, nav')].filter(e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().top > innerHeight / 2 && /Book|BOOK/i.test(e.textContent)).map(e => e.textContent).join(' | ')`
    await waitFor(`(${barExpr}).length > 0`, 5000)
    const bar = await ev(barExpr)
    await ev('window.scrollTo(0, 0)')
    check('phone: sticky bar price is a "From" price, not per night', /From ₦45,000/.test(bar) && !/night|day/i.test(bar.replace(/Chef Amaka Private Dining/g, '')), bar)
  }
  check(`${vp}: package shown with per-guest price and length`, await ev(`(() => { const p = document.querySelector('[data-package]'); return !!p && p.textContent.includes('Seven-course dinner') && p.textContent.includes('₦45,000') && /per guest/.test(p.textContent) && /4 hours/.test(p.textContent) })()`))
  await click('[data-package]')
  check(`${vp}: guests start at the package minimum (4)`, await waitFor(`document.querySelector('[data-guests-count]')?.textContent.trim() === '4'`, 3000), await ev(`document.querySelector('[data-guests-count]')?.textContent`))
  await click('[data-guests="inc"]'); await click('[data-guests="inc"]')
  check(`${vp}: guests stepper (6)`, await waitFor(`document.querySelector('[data-guests-count]')?.textContent.trim() === '6'`, 3000))
  // Page the calendar to the right month and pick the Saturday.
  for (let i = 0; i < 3 && !(await ev(`!!document.querySelector('[data-day="${D}"]')`)); i++) { await click('[data-session-panel] button[aria-label="Next month"]'); await sleep(600) }
  check(`${vp}: Sunday (day off) cannot be picked`, await waitFor(`document.querySelector('[data-day="${SUN}"]')?.disabled === true`, 8000) || !(await ev(`!!document.querySelector('[data-day="${SUN}"]')`)), await ev(`document.querySelector('[data-day="${SUN}"]')?.outerHTML?.slice(0, 120)`))
  check(`${vp}: Saturday can be picked`, await waitFor(`document.querySelector('[data-day="${D}"]')?.disabled === false`, 8000))
  await click(`[data-day="${D}"]`)
  check(`${vp}: times appear, 10:00 to 18:00`, await waitFor(`!!document.querySelector('[data-time="10:00"]') && !!document.querySelector('[data-time="18:00"]') && !document.querySelector('[data-time="18:30"]')`, 8000), await ev(`[...document.querySelectorAll('[data-time]')].map(b => b.dataset.time).join(',')`))
  await click('[data-time="18:00"]')
  await setVal('[data-session-panel] select[name=area]', 'Victoria Island')
  await setVal('[data-session-panel] textarea[name=address]', '12 Ozumba Mbadiwe Avenue, Flat 4B, Victoria Island')
  await setVal('[data-session-panel] textarea[name=notes]', 'One guest has a nut allergy.')
  check(`${vp}: live total = 6 × ₦45,000 + ₦5,000 travel`, await waitFor(`(() => { const s = document.querySelector('[data-session-panel]').textContent; return s.includes('₦270,000') && s.includes('₦5,000') && document.querySelector('[data-total]')?.textContent.includes('₦275,000') })()`, 4000), await ev(`document.querySelector('[data-session-panel]').textContent.slice(-400)`))
  check(`${vp}: panel fits`, await fits())
  await ev(`document.querySelector('[data-total]').scrollIntoView({block:'center'})`); await sleep(300)
  await shot(`3-${vp}-panel.jpg`)
  check(`${vp}: reserve button names the amount`, await ev(`[...document.querySelectorAll('[data-session-panel] button')].some(b => b.textContent.includes('Reserve & pay ₦275,000'))`))
  if (vp === 'phone') {
    await clickText('[data-session-panel] button', 'Reserve & pay')
    check('signed-out guest sent to sign-up', await waitFor(`location.pathname.startsWith('/sign-up')`, 10000), await ev('location.href'))
    const back = decodeURIComponent(await ev('location.search'))
    check('their choice is kept for after sign-up', back.includes(`date=${D}`) && (back.includes('time=18:00') || back.includes('time=18%3A00')) && back.includes('guests=6') && (back.includes('area=Victoria Island') || back.includes('area=Victoria+Island')), back)
    // Coming back signed in restores it.
    await signInAs(G)
    const url = new URL(back.split('redirect_url=')[1], BASE)
    await load(url.toString())
    check('choice restored after signing in', await waitFor(`document.querySelector('[data-total]')?.textContent.includes('₦270,000') || document.querySelector('[data-total]')?.textContent.includes('₦275,000') || document.querySelector('[data-time="18:00"][aria-pressed="true"]')`, 10000), await ev(`document.querySelector('[data-session-panel]')?.textContent.slice(-300)`))
  } else {
    await clickText('[data-session-panel] button', 'Reserve & pay')
    check('desktop: signed-in guest sent to Paystack', await waitFor(`location.hostname.includes('paystack')`, 25000), await ev('location.href'))
  }
}

console.log('3. The held booking and the paid booking page')
const b = (await q(`select reference, status, to_char("startDate", 'YYYY-MM-DD"T"HH24:MI') s_at, to_char("endDate", 'YYYY-MM-DD"T"HH24:MI') e_at, guests, area, address, "serviceNotes", total::text, "amountDue"::text due from "Booking" where "listingId"=$1 and "userId"=(select id from "User" where email=$2) order by "createdAt" desc limit 1`, [L, gEmail]))[0]
check('held exactly as chosen', b && b.status === 'pending_payment' && b.s_at === utc(D, '18:00').slice(0, 16) && b.e_at === utc(D, '22:00').slice(0, 16) && b.guests === 6 && b.area === 'Victoria Island' && /Ozumba/.test(b.address) && /nut allergy/.test(b.serviceNotes) && Number(b.total) === 275000, JSON.stringify(b))
if (b) {
  const raw = JSON.stringify({ event: 'charge.success', data: { reference: b.reference, status: 'success', amount: Math.round(Number(b.due) * 100), currency: 'NGN', paid_at: new Date().toISOString(), channel: 'card' } })
  await fetch(`${BASE}/api/paystack/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': createHmac('sha512', SK).update(raw).digest('hex') }, body: raw })
}
await send('Emulation.setDeviceMetricsOverride', PHONE)
await signInAs(G)
await load(`${BASE}/bookings/${b?.reference}`)
check('confirmed page', (await text()).includes('Your booking is confirmed'))
check('session shown in Lagos time with package and guests', await ev(`(() => { const s = document.body.textContent; return s.includes('18:00') && s.includes('22:00') && s.includes('Seven-course dinner') && s.includes('6 guests') })()`))
check('address shown once, without repeating the area', await ev(`!document.body.textContent.includes('Victoria Island (Victoria Island)')`))
check('who’s coming card', await ev(`(() => { const c = document.querySelector('[data-whos-coming]'); return !!c && c.textContent.includes('Chef Amaka Kitchen') && /police/i.test(c.textContent) })()`))
check('booking page fits the phone', await fits())
await shot('4-booking-page.jpg')

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
