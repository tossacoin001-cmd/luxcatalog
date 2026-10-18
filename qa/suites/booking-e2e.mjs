// End-to-end: Phase 4a booking settings, calendar, availability and quotes.
import { createHmac } from 'node:crypto'
import pg from 'pg'

const BASE = 'http://localhost:3300'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)))

class Browser {
  constructor() { this.jar = new Map() }
  async req(path, { method = 'GET', body } = {}) {
    const headers = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') }
    if (body) headers['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const text = (await res.text()).replaceAll('<!-- -->', '')
    let json = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text, location: res.headers.get('location') }
  }
}
function totp(secret) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) bits += alpha.indexOf(ch).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const h = createHmac('sha1', key).update(buf).digest(); const o = h[h.length - 1] & 0xf
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0')
}
const stamp = Date.now(), pw = 'correct-horse-battery-9'
async function staff(name, email, role, perms = []) {
  await q('delete from "RateLimit"')
  const b = new Browser()
  await b.req('/api/auth/sign-up/email', { method: 'POST', body: { name, email, password: pw } })
  await q(`update "User" set role=$2, permissions=$3 where email=$1`, [email, role, perms])
  const en = await b.req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
  await b.req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
  b.id = (await q(`select id from "User" where email=$1`, [email]))[0].id
  return b
}
const day = (n) => { const d = new Date(Date.now() + 3600_000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const anon = new Browser()
let r0

console.log('1. Setup')
const P = await staff('Funmi Host', `funmi.host${stamp}@test.local`, 'partner')
const O = await staff('Other Partner', `other.p${stamp}@test.local`, 'partner')
const A = await staff('Ada Admin', `ada.book${stamp}@test.local`, 'admin')
const T = await staff('Tobi Team', `tobi.t${stamp}@test.local`, 'team', ['enquiries'])
// Partners must have signed their agreements to reach listings; record that directly.
for (const u of [P, O]) {
  await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","updatedAt") values (gen_random_uuid(),$1,'property_host','approved','Test Host',now())`, [u.id])
}
const slug = `ikoyi-penthouse-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),'Ikoyi Penthouse Test',$1,'real_estate','Test stay.',450000,'₦450,000','Ikoyi, Lagos','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],'booking','luxury_shortlets',$2,true,now())`, [slug, P.id])
const L = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
const carSlug = `maybach-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"hireRatePerDay","updatedAt") values (gen_random_uuid(),'Maybach Test',$1,'supercar','Test car.',null,'POA','Lekki, Lagos','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],'booking','car_rental',$2,true,350000,now())`, [carSlug, P.id])
const C = (await q(`select id from "Listing" where slug=$1`, [carSlug]))[0].id
check('listings ready', !!L && !!C)

console.log('1b. Agreement comes first')
r0 = await P.req(`/admin/listings/${L}/booking`)
check('unsigned partner sent to sign the agreement', r0.status >= 300 && /partners\/agreement/.test(r0.location ?? ''), `${r0.status} ${r0.location}`)
r0 = await P.req(`/api/admin/listings/${L}/booking`, { method: 'PUT', body: { enabled: true, unit: 'night', rate: 450000, cleaningFee: 0, cautionDeposit: 0, minUnits: 1, maxUnits: 30, cancellationPolicy: 'moderate', checkInTime: '14:00', checkOutTime: '11:00', advanceNoticeHours: 24 } })
check('unsigned partner cannot turn on bookings', r0.status === 403, `${r0.status}`)
const page = (await P.req('/partners/agreement')).text
const hashes = [...page.matchAll(/hash\\?":\\?"([0-9a-f]{64})/g)].map((m) => m[1])
for (const [i, key] of ['master', 'schedule_property'].entries()) {
  await P.req('/api/partner-agreements', { method: 'POST', body: { key, hash: hashes[i], signedName: 'Funmi Host', agree: true } })
}
check('partner signs agreement and property schedule', (await q(`select count(*)::int n from "PartnerAgreement" where "userId"=$1`, [P.id]))[0].n === 2)

console.log('2. Before booking is set up')
let r = await anon.req(`/api/listings/${L}/availability`)
check('not bookable yet: availability 404', r.status === 404, `${r.status}`)
r = await anon.req(`/api/listings/${L}/quote?start=${day(40)}&end=${day(43)}`)
check('not bookable yet: quote 404', r.status === 404, `${r.status}`)
r = await anon.req(`/catalog/real-estate/${slug}`)
check('listing page shows asking price, no booking panel', r.status === 200 && /Asking Price|Nightly rate/.test(r.text) && !/Questions before you book/.test(r.text), `${r.status}`)

console.log('3. Who can manage booking')
check('signed-out: 401', (await anon.req(`/api/admin/listings/${L}/booking`)).status === 401)
check('another partner: 404', (await O.req(`/api/admin/listings/${L}/booking`)).status === 404)
check('team without Listings: 401', (await T.req(`/api/admin/listings/${L}/booking`)).status === 401)
check('another partner cannot close dates', (await O.req(`/api/admin/listings/${L}/blocks`, { method: 'POST', body: { first: day(40), last: day(41) } })).status === 404)
r = await P.req(`/api/admin/listings/${L}/booking`)
check('owner gets defaults prefilled from the listing', r.status === 200 && r.json?.settings?.unit === 'night' && r.json.settings.rate === 450000 && r.json.settings.enabled === false, JSON.stringify(r.json))
r = await P.req(`/api/admin/listings/${C}/booking`)
check('car defaults to per-day with 10 hours and hire rate', r.json?.settings?.unit === 'day' && r.json.settings.rate === 350000 && r.json.settings.hoursPerDay === 10, JSON.stringify(r.json))
check('admin can open it', (await A.req(`/api/admin/listings/${L}/booking`)).status === 200)
check('booking page opens for owner', (await P.req(`/admin/listings/${L}/booking`)).status === 200)
check('booking page sends another partner away', (await O.req(`/admin/listings/${L}/booking`)).status >= 300)

console.log('4. Saving settings')
const good = { enabled: true, unit: 'night', rate: 450000, cleaningFee: 50000, cautionDeposit: 200000, minUnits: 2, maxUnits: 14, maxGuests: 6, instantBook: true, cancellationPolicy: 'moderate', checkInTime: '14:00', checkOutTime: '11:00', hoursPerDay: null, advanceNoticeHours: 24 }
check('turning on with no price refused', (await P.req(`/api/admin/listings/${L}/booking`, { method: 'PUT', body: { ...good, rate: 0 } })).status === 400)
check('minimum above maximum refused', (await P.req(`/api/admin/listings/${L}/booking`, { method: 'PUT', body: { ...good, minUnits: 20 } })).status === 400)
check('bad time refused', (await P.req(`/api/admin/listings/${L}/booking`, { method: 'PUT', body: { ...good, checkInTime: '25:00' } })).status === 400)
check('unknown policy refused', (await P.req(`/api/admin/listings/${L}/booking`, { method: 'PUT', body: { ...good, cancellationPolicy: 'lenient' } })).status === 400)
r = await P.req(`/api/admin/listings/${L}/booking`, { method: 'PUT', body: good })
check('valid settings saved', r.status === 200, `${r.status} ${r.text.slice(0, 200)}`)
r = await P.req(`/api/admin/listings/${C}/booking`, { method: 'PUT', body: { ...good, unit: 'day', rate: 350000, cleaningFee: 0, cautionDeposit: 0, minUnits: 1, maxGuests: null, hoursPerDay: 10, checkInTime: '09:00', checkOutTime: '19:00' } })
check('car settings saved', r.status === 200)

console.log('5. Public availability and price')
r = await anon.req(`/api/listings/${L}/availability`)
check('availability public once on', r.status === 200 && r.json?.rules?.rate === 450000 && Array.isArray(r.json.blocked), `${r.status}`)
check('earliest start respects 24h notice', r.json?.earliestStart === day(1), `${r.json?.earliestStart} vs ${day(1)}`)
r = await anon.req(`/api/listings/${L}/quote?start=${day(40)}&end=${day(43)}&guests=4`)
check('3 nights quoted exactly', r.status === 200 && r.json.units === 3 && r.json.base === 1350000 && r.json.total === 1400000 && r.json.dueNow === 1600000, JSON.stringify(r.json))
r = await anon.req(`/api/listings/${L}/quote?start=${day(40)}&end=${day(41)}`)
check('1 night refused (minimum 2)', r.status === 409 && /Minimum/.test(r.json?.error), JSON.stringify(r.json))
r = await anon.req(`/api/listings/${L}/quote?start=${day(40)}&end=${day(43)}&guests=9`)
check('9 guests refused (max 6)', r.status === 409 && /6 guests/.test(r.json?.error))
r = await anon.req(`/api/listings/${L}/quote?start=nonsense&end=${day(43)}`)
check('bad date refused', r.status === 400)
r = await anon.req(`/api/listings/${C}/quote?start=${day(40)}&end=${day(42)}`)
check('car: 3 days inclusive', r.status === 200 && r.json.units === 3 && r.json.total === 1050000, JSON.stringify(r.json))

console.log('6. Closing dates')
r = await P.req(`/api/admin/listings/${L}/blocks`, { method: 'POST', body: { first: day(50), last: day(52), note: 'Owner stay - private' } })
check('owner closes 3 days', r.status === 200 && r.json?.block?.end === day(53), JSON.stringify(r.json))
const blockId = r.json?.block?.id
check('closing past dates refused', (await P.req(`/api/admin/listings/${L}/blocks`, { method: 'POST', body: { first: day(-3), last: day(-1) } })).status === 400)
check('last before first refused', (await P.req(`/api/admin/listings/${L}/blocks`, { method: 'POST', body: { first: day(60), last: day(58) } })).status === 400)
r = await anon.req(`/api/listings/${L}/availability`)
check('guests see the closed range', r.json?.blocked?.some((b) => b.start === day(50) && b.end === day(53)))
check('guests never see the private reason', !r.text.includes('Owner stay'))
r = await anon.req(`/api/listings/${L}/quote?start=${day(49)}&end=${day(51)}`)
check('stay overlapping closed dates refused', r.status === 409 && /no longer available/.test(r.json?.error))
r = await anon.req(`/api/listings/${L}/quote?start=${day(48)}&end=${day(50)}`)
check('check-out on the first closed day is fine', r.status === 200)
r = await anon.req(`/api/listings/${L}/quote?start=${day(53)}&end=${day(55)}`)
check('check-in the day after the closed range is fine', r.status === 200)
check('another partner cannot reopen', (await O.req(`/api/admin/listings/${L}/blocks`, { method: 'DELETE', body: { blockId } })).status === 404)
check('owner reopens', (await P.req(`/api/admin/listings/${L}/blocks`, { method: 'DELETE', body: { blockId } })).status === 200)
r = await anon.req(`/api/listings/${L}/quote?start=${day(49)}&end=${day(51)}`)
check('reopened dates bookable again', r.status === 200)
const audits = (await q(`select action from "AuditLog" where target=$1`, [L])).map((x) => x.action)
check('changes are audited', audits.includes('listing.booking_settings') && audits.includes('listing.dates_closed') && audits.includes('listing.dates_reopened'), audits.join(','))

console.log('7. Listing page and admin list')
// The first visit after a change triggers the refresh (and may still get the
// previous copy); the next visit gets the new page.
await anon.req(`/catalog/real-estate/${slug}`)
await new Promise((res) => setTimeout(res, 2500))
r = await anon.req(`/catalog/real-estate/${slug}`)
check('listing page now shows the booking panel', r.status === 200 && /Questions before you book/.test(r.text) && r.text.includes('min-h-[420px]') && !/Asking Price/.test(r.text), `${r.status}`)
r = await P.req('/admin/listings')
check('partner list shows the calendar link', r.text.includes(`/admin/listings/${L}/booking`) && /Calendar · online/.test(r.text))

console.log('8. Turning it off')
await P.req(`/api/admin/listings/${L}/booking`, { method: 'PUT', body: { ...good, enabled: false } })
check('availability closed again', (await anon.req(`/api/listings/${L}/availability`)).status === 404)

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
