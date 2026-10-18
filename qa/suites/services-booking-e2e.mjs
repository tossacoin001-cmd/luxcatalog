// Private Services S2, end to end against a local build on :3300:
// partner session settings (packages, hours, areas, buffer, capacity, floors),
// public availability, booking a session (price, travel fee, validation,
// double-booking race), Paystack confirmation, address privacy, payout,
// on-request flow, guest cancellation (hour-based windows), closed days.
import { createHmac } from 'node:crypto'
import pg from 'pg'
import { AGREEMENTS } from './.agreements-list.generated.mjs'

const BASE = 'http://localhost:3300'
const SK = process.env.PAYSTACK_SECRET_KEY
if (!SK?.startsWith('sk_test_')) throw new Error('Test secret key required')
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))

class Browser {
  constructor() { this.jar = new Map() }
  async req(path, { method = 'GET', body, headers = {}, raw } = {}) {
    const h = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers }
    if (body) h['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: h, body: raw ?? (body ? JSON.stringify(body) : undefined) })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const buf = Buffer.from(await res.arrayBuffer())
    let json = null; try { json = JSON.parse(buf.toString()) } catch {}
    return { status: res.status, json, html: buf.toString(), location: res.headers.get('location') }
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
async function account(name, email, role, perms = []) {
  await q('delete from "RateLimit"')
  const b = new Browser()
  await b.req('/api/auth/sign-up/email', { method: 'POST', body: { name, email, password: pw } })
  if (role) {
    await q(`update "User" set role=$2, permissions=$3 where email=$1`, [email, role, perms])
    const en = await b.req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
    await b.req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
  }
  b.id = (await q(`select id from "User" where email=$1`, [email]))[0].id
  b.email = email
  return b
}
const webhook = (data) => {
  const raw = JSON.stringify({ event: 'charge.success', data })
  const sig = createHmac('sha512', SK).update(raw).digest('hex')
  return new Browser().req('/api/paystack/webhook', { method: 'POST', raw, headers: { 'content-type': 'application/json', 'x-paystack-signature': sig } })
}
// Timestamps read as text in SQL: the pg driver would shift them by the
// machine's own time zone.
const booking = (ref) => q(`select *, total::text t, base::text b, "travelFee"::text tf, "amountDue"::text due, to_char("startDate", 'YYYY-MM-DD"T"HH24:MI') s_at, to_char("endDate", 'YYYY-MM-DD"T"HH24:MI') e_at from "Booking" where reference=$1`, [ref]).then((r) => r[0])
const paid = (b) => ({ reference: b.reference, status: 'success', amount: Math.round(Number(b.amountDue) * 100), currency: 'NGN', paid_at: new Date().toISOString(), channel: 'card' })
// A Lagos date n+ days ahead that falls on the given weekday (0 Sun … 6 Sat).
function dayOn(weekday, minDays) {
  const d = new Date(Date.now() + 3_600_000); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + minDays)
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const utc = (day, time) => new Date(`${day}T${time}:00+01:00`).toISOString()
const anon = new Browser()
let r

console.log('1. Setup')
const P = await account('Amaka Obi', `amaka.s2${stamp}@test.local`, 'partner')
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","contactName",collections,"updatedAt") values (gen_random_uuid(),$1,'service_professional','approved','Chef Amaka Kitchen','Amaka Obi',ARRAY['private_chef','massage_spa'],now())`, [P.id])
await q(`insert into "PartnerProfile" (id,"userId","brandName","updatedAt") values (gen_random_uuid(),$1,'Chef Amaka Kitchen',now())`, [P.id])
for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x','Amaka Obi',$5,'Chef Amaka Kitchen')`, [P.id, a.key, a.version, a.title, P.email])
const O = await account('Other Pro', `other.s2${stamp}@test.local`, 'partner')
const A = await account('Ada Admin', `ada.s2${stamp}@test.local`, 'admin')
const TE = await account('Tobi Enquiries', `tobi.s2${stamp}@test.local`, 'team', ['enquiries'])
const G = await account('Grace Guest', `grace.s2${stamp}@example.com`)
const H = await account('Henry Guest', `henry.s2${stamp}@example.com`)
const slug = `chef-amaka-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),'Chef Amaka Private Dining',$1,'private_services','Private dinners at home.',45000,'₦45,000','Ikoyi, Lagos','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],'booking','private_chef',$2,true,now())`, [slug, P.id])
const L = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
check('setup ready', !!L)

console.log('2. Partner session settings')
r = await P.req(`/api/admin/listings/${L}/services`)
check('partner reads defaults (off, no packages, all Lagos areas offered)', r.status === 200 && r.json?.settings?.enabled === false && r.json.settings.packages.length === 0 && r.json.areasAll?.includes('Ikoyi'), `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
check('floor for the service shown to the partner', r.json?.floor === 35000, r.json?.floor)
r = await O.req(`/api/admin/listings/${L}/services`)
check('another partner cannot read it', r.status === 404, r.status)
r = await TE.req(`/api/admin/listings/${L}/services`)
check('team without Listings cannot read it', r.status === 401 || r.status === 403, r.status)
const hours = { mon: { from: '10:00', to: '22:00' }, tue: { from: '10:00', to: '22:00' }, wed: { from: '10:00', to: '22:00' }, thu: { from: '10:00', to: '22:00' }, fri: { from: '10:00', to: '22:00' }, sat: { from: '10:00', to: '22:00' }, sun: null }
const dinner = { name: 'Seven-course dinner', description: 'Modern Nigerian tasting menu, served and cleared.', durationMinutes: 240, pricing: 'per_guest', price: 45000, minGuests: 4, maxGuests: 10 }
const brunch = { name: 'Sunday-style brunch', description: 'Brunch for family and friends.', durationMinutes: 180, pricing: 'per_guest', price: 35000, minGuests: 2, maxGuests: 8 }
const areas = [{ area: 'Ikoyi', fee: 0 }, { area: 'Victoria Island', fee: 5000 }, { area: 'Lekki Phase 1', fee: 15000 }]
const settings = (o = {}) => ({ enabled: true, instantBook: true, cancellationPolicy: 'moderate', advanceNoticeHours: 24, bufferMinutes: 60, capacity: 1, workingHours: hours, areas, packages: [dinner, brunch], ...o })
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: settings({ packages: [{ ...dinner, price: 20000 }] }) })
check('package below the floor refused with the minimum', r.status === 400 && /₦35,000/.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: settings({ packages: [{ ...dinner, durationMinutes: 10 }] }) })
check('impossible duration refused', r.status === 400, r.status)
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: settings({ workingHours: { mon: { from: '22:00', to: '10:00' } } }) })
check('closing before opening refused', r.status === 400, r.status)
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: settings({ areas: [] }) })
check('switching on needs at least one area', r.status === 400 && /area/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: settings({ areas: [{ area: 'Atlantis', fee: 0 }] }) })
check('unknown area refused', r.status === 400, r.status)
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: settings({ packages: [] }) })
check('switching on needs at least one package', r.status === 400 && /package/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: settings({ capacity: 0 }) })
check('capacity must be at least 1', r.status === 400, r.status)
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: settings() })
check('valid settings saved', r.status === 200 && r.json?.settings?.enabled === true && r.json.settings.packages.length === 2, `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
const pkgs = r.json?.settings?.packages ?? []
const DIN = pkgs.find((p) => p.name === dinner.name)?.id, BRU = pkgs.find((p) => p.name === brunch.name)?.id
check('packages get ids', !!DIN && !!BRU)
const row = (await q(`select unit, enabled, "bufferMinutes", capacity from "BookingSettings" where "listingId"=$1`, [L]))[0]
check('stored as a session listing', row?.unit === 'session' && row.enabled && row.bufferMinutes === 60 && row.capacity === 1, JSON.stringify(row))
const lp = (await q(`select price::text from "Listing" where id=$1`, [L]))[0]
check('listing "From" price follows the cheapest package', Number(lp.price) === 35000, lp)
r = await P.req(`/api/admin/listings/${L}/booking`, { method: 'PUT', body: { enabled: true, unit: 'day', rate: 1 } })
check('the night/day settings route still refuses services', r.status === 409, r.status)
r = await A.req(`/api/admin/listings/${L}/services`)
check('admin can read it too', r.status === 200 && r.json?.settings?.packages?.length === 2, r.status)

console.log('3. Public availability')
const D = dayOn(6, 10) // a Saturday at least 10 days out
const SUNDAY = dayOn(0, 10)
r = await anon.req(`/api/listings/${L}/sessions`)
check('public info: packages, areas, policy, instant', r.status === 200 && r.json?.info?.packages?.length === 2 && r.json.info.areas.length === 3 && r.json.info.instantBook === true && /48 hours/.test(r.json.info.policy?.summary ?? ''), `${r.status} ${JSON.stringify(r.json).slice(0, 300)}`)
check('public info never shows the partner’s settings internals', !JSON.stringify(r.json).includes('bufferMinutes') && !JSON.stringify(r.json).includes('ownerId'))
r = await anon.req(`/api/listings/${L}/sessions?package=${DIN}&from=${D}&to=${D}`)
const sat = r.json?.days?.[D] ?? []
check('Saturday slots: 10:00 to 18:00 for a 4-hour dinner', sat[0] === '10:00' && sat[sat.length - 1] === '18:00' && sat.length === 17, JSON.stringify(sat))
r = await anon.req(`/api/listings/${L}/sessions?package=${DIN}&from=${SUNDAY}&to=${SUNDAY}`)
check('Sunday (day off) has no slots', (r.json?.days?.[SUNDAY] ?? ['x']).length === 0, JSON.stringify(r.json?.days))
const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)
r = await anon.req(`/api/listings/${L}/sessions?package=${DIN}&from=${today}&to=${today}`)
check('today is inside the 24h notice: no slots', (r.json?.days?.[today] ?? ['x']).length === 0)
r = await anon.req(`/api/listings/${L}/sessions?package=${DIN}&from=${D}&to=2099-01-01`)
check('range is capped (no huge scans)', r.status === 400 || Object.keys(r.json?.days ?? {}).length <= 62, r.status)
r = await anon.req(`/api/listings/${L}/sessions?package=nope&from=${D}&to=${D}`)
check('unknown package refused', r.status === 400 || r.status === 404, r.status)

console.log('4. Booking a session')
const sess = (o = {}) => ({ listingId: L, session: { packageId: DIN, date: D, time: '18:00', guests: 6, area: 'Victoria Island', address: '12 Ozumba Mbadiwe Avenue, Flat 4B, Victoria Island', notes: 'One guest has a nut allergy.', ...o } })
r = await anon.req('/api/bookings', { method: 'POST', body: sess() })
check('signed-out guest must sign in', r.status === 401, r.status)
r = await G.req('/api/bookings', { method: 'POST', body: sess({ time: '19:00' }) })
check('a time that runs past closing is refused', r.status === 409, `${r.status} ${JSON.stringify(r.json)}`)
r = await G.req('/api/bookings', { method: 'POST', body: sess({ time: '18:10' }) })
check('an off-grid time is refused', r.status === 409 || r.status === 400, r.status)
r = await G.req('/api/bookings', { method: 'POST', body: sess({ guests: 3 }) })
check('fewer guests than the package minimum refused', (r.status === 409 || r.status === 400) && /at least 4 guests/.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await G.req('/api/bookings', { method: 'POST', body: sess({ area: 'Ikeja GRA' }) })
check('an area the chef doesn’t cover is refused', (r.status === 409 || r.status === 400) && /Ikeja GRA/.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await G.req('/api/bookings', { method: 'POST', body: sess({ address: 'VI' }) })
check('a proper address is required', r.status === 400 && /address/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await P.req('/api/bookings', { method: 'POST', body: sess() })
check('a partner cannot book their own service', r.status === 403, r.status)
r = await G.req('/api/bookings', { method: 'POST', body: sess() })
check('valid booking goes to Paystack', r.status === 200 && /paystack/.test(r.json?.url ?? '') && /^LUX-/.test(r.json?.reference ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
const ref1 = r.json?.reference
let b1 = await booking(ref1)
check('held as a session awaiting payment', b1?.unit === 'session' && b1.status === 'pending_payment' && b1.units === 1, JSON.stringify(b1 && { unit: b1.unit, status: b1.status }))
check('exact start and end in Lagos time (18:00–22:00)', b1 && b1.s_at === utc(D, '18:00').slice(0, 16) && b1.e_at === utc(D, '22:00').slice(0, 16), b1 && `${b1.s_at} ${b1.e_at}`)
check('price: 6 × ₦45,000 + ₦5,000 travel = ₦275,000', b1 && Number(b1.b) === 270000 && Number(b1.tf) === 5000 && Number(b1.t) === 275000 && Number(b1.due) === 275000 && Number(b1.cautionDeposit) === 0, b1 && { b: b1.b, tf: b1.tf, t: b1.t, due: b1.due })
check('package, guests, area, address and notes stored', b1 && b1.packageName === dinner.name && b1.guests === 6 && b1.area === 'Victoria Island' && /Ozumba/.test(b1.address ?? '') && /nut allergy/.test(b1.serviceNotes ?? ''), b1 && { pkg: b1.packageName, area: b1.area, address: b1.address, notes: b1.serviceNotes })
r = await anon.req(`/api/listings/${L}/sessions?package=${DIN}&from=${D}&to=${D}`)
let after = r.json?.days?.[D] ?? []
check('the held time and its travel buffer are no longer offered (last 4-hour slot now 13:00)', after[after.length - 1] === '13:00' && !after.includes('14:00'), JSON.stringify(after))
r = await anon.req(`/api/listings/${L}/sessions?package=${BRU}&from=${D}&to=${D}`)
after = r.json?.days?.[D] ?? []
check('shorter brunch can still fit before it (last slot 14:00)', after[after.length - 1] === '14:00', JSON.stringify(after))
r = await H.req('/api/bookings', { method: 'POST', body: sess({ time: '16:00' }) })
check('an overlapping booking by someone else is refused', r.status === 409, `${r.status} ${JSON.stringify(r.json)}`)

// Two guests racing for the same slot on another day: exactly one wins.
const D2 = dayOn(5, 10) // a Friday
const race = await Promise.all([G.req('/api/bookings', { method: 'POST', body: sess({ date: D2, time: '12:00' }) }), H.req('/api/bookings', { method: 'POST', body: sess({ date: D2, time: '12:00' }) })])
check('race for one slot: exactly one booking', race.filter((x) => x.status === 200).length === 1 && race.filter((x) => x.status === 409).length === 1, race.map((x) => x.status).join(','))

console.log('5. Address privacy before payment')
r = await P.req('/admin/bookings')
check('partner sees the booking request', r.status === 200 && r.html.includes(ref1), r.status)
check('…but not the address before payment', !r.html.includes('Ozumba'))
check('…and sees the area and time', r.html.includes('Victoria Island') && r.html.includes('18:00'))

console.log('6. Paid and confirmed')
r = await webhook(paid(b1))
check('Paystack confirmation accepted', r.status === 200, r.status)
b1 = await booking(ref1)
check('booking confirmed', b1.status === 'confirmed' && !!b1.paidAt, b1.status)
const po = (await q(`select gross::text, commission::text, amount::text, "commissionRate"::text rate, to_char("dueAt", 'YYYY-MM-DD"T"HH24:MI') due_at from "Payout" where "bookingId"=$1`, [b1.id]))[0]
check('payout scheduled at 20% of ₦275,000', po && Number(po.gross) === 275000 && Number(po.commission) === 55000 && Number(po.amount) === 220000 && Number(po.rate) === 20, JSON.stringify(po))
check('payout due 12 hours after the session ends', po && po.due_at === new Date(new Date(utc(D, '22:00')).getTime() + 12 * 3_600_000).toISOString().slice(0, 16), po && po.due_at)
r = await P.req('/admin/bookings')
check('partner now sees the address', r.html.includes('Ozumba Mbadiwe'), 'address hidden')
check('partner sees the guest’s notes', r.html.includes('nut allergy'))
r = await O.req('/admin/bookings')
check('another partner sees nothing of it', !r.html.includes(ref1) && !r.html.includes('Ozumba'))
r = await G.req(`/bookings/${ref1}`)
check('guest page: date and time in Lagos', r.status === 200 && r.html.includes('18:00') && r.html.includes('22:00'), r.status)
check('guest page: package, guests, area and address', r.html.includes(dinner.name) && r.html.includes('6 guests') && r.html.includes('Victoria Island') && r.html.includes('Ozumba'))
check('guest page: travel fee line', r.html.includes('Travel') && r.html.includes('₦5,000'))
check('guest page: who’s coming (vetted professional)', r.html.includes('Who’s coming') && r.html.includes('Chef Amaka Kitchen') && /police/i.test(r.html))
check('guest page: hour-based cancellation wording', r.html.includes('48 hours'))
check('guest page: no shortlet ID upload for a service', !r.html.includes('Add your ID before arrival'))
const mails = await q(`select kind, "to", subject from "EmailLog" where kind in ('booking_confirmed','booking_new_partner') and subject like $1`, [`%${ref1}%`])
check('guest and partner both emailed', mails.some((m) => m.kind === 'booking_confirmed' && m.to === G.email) && mails.some((m) => m.kind === 'booking_new_partner' && m.to === P.email), JSON.stringify(mails))

console.log('7. Guest cancels (moderate: free until 48 hours before)')
r = await G.req(`/bookings/${ref1}`)
check('cancel offer shows a full refund of ₦275,000', r.html.includes('₦275,000') && /Cancel/i.test(r.html))
r = await G.req(`/api/bookings/${ref1}/cancel`, { method: 'POST', body: {} })
check('guest cancels', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
const rf = (await q(`select amount::text, kind from "Refund" where "bookingId"=$1`, [b1.id]))[0]
check('full refund queued (package + travel)', rf && Number(rf.amount) === 275000 && rf.kind === 'cancellation', JSON.stringify(rf))
check('payout cancelled', (await q(`select status from "Payout" where "bookingId"=$1`, [b1.id]))[0]?.status === 'cancelled')
r = await anon.req(`/api/listings/${L}/sessions?package=${DIN}&from=${D}&to=${D}`)
check('the time is offered again', (r.json?.days?.[D] ?? []).includes('18:00'), JSON.stringify(r.json?.days?.[D]))

console.log('8. On request, capacity and closed days')
r = await P.req(`/api/admin/listings/${L}/services`)
const cur = r.json.settings
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: { ...cur, instantBook: false, capacity: 2, packages: cur.packages } })
check('switch to on-request with a team of two', r.status === 200 && r.json?.settings?.instantBook === false && r.json.settings.capacity === 2, `${r.status} ${JSON.stringify(r.json).slice(0, 150)}`)
check('packages kept their ids on save', JSON.stringify(r.json?.settings?.packages?.map((p) => p.id).sort()) === JSON.stringify([DIN, BRU].sort()))
const D3 = dayOn(4, 10) // a Thursday
r = await G.req('/api/bookings', { method: 'POST', body: sess({ date: D3, time: '12:00' }) })
check('on-request booking: no payment yet', r.status === 200 && r.json?.requested === true, `${r.status} ${JSON.stringify(r.json)}`)
const ref3 = r.json?.reference
const reqMail = (await q(`select count(*)::int n from "EmailLog" where kind='booking_request_new' and "to"=$1 and subject like $2`, [P.email, `%${ref3}%`]))[0].n
check('partner asked to accept', reqMail === 1)
r = await H.req('/api/bookings', { method: 'POST', body: sess({ date: D3, time: '12:00' }) })
check('capacity 2: a second booking at the same time is fine', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
const G2 = await account('Gina Guest', `gina.s2${stamp}@example.com`)
r = await G2.req('/api/bookings', { method: 'POST', body: sess({ date: D3, time: '12:00' }) })
check('capacity 2: a third is refused', r.status === 409, `${r.status} ${JSON.stringify(r.json)}`)
const b3 = await booking(ref3)
r = await P.req(`/api/admin/bookings/${b3.id}`, { method: 'POST', body: { action: 'accept' } })
check('partner accepts', r.status === 200 && (await booking(ref3)).status === 'pending_payment', `${r.status} ${JSON.stringify(r.json)}`)
r = await P.req('/admin/bookings')
check('still no address for an accepted-but-unpaid request', r.html.includes(ref3) && !r.html.includes('Ozumba'))
const D4 = dayOn(3, 10) // a Wednesday
r = await P.req(`/api/admin/listings/${L}/blocks`, { method: 'POST', body: { first: D4, last: D4, note: 'Family event' } })
check('partner closes a day', r.status === 200, r.status)
r = await anon.req(`/api/listings/${L}/sessions?package=${DIN}&from=${D4}&to=${D4}`)
check('closed day has no slots', (r.json?.days?.[D4] ?? ['x']).length === 0)

console.log('9. Switching off')
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: { ...cur, enabled: false, packages: cur.packages } })
check('partner switches online booking off', r.status === 200 && r.json?.settings?.enabled === false, r.status)
r = await G.req('/api/bookings', { method: 'POST', body: sess({ date: dayOn(2, 12), time: '12:00' }) })
check('no new bookings while off', r.status === 404 || r.status === 409, r.status)

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
