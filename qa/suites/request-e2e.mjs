// End-to-end: 4c-3 on-request bookings and 4c-4 guest ID (Paystack TEST mode).
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
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)))

class Browser {
  constructor() { this.jar = new Map() }
  async req(path, { method = 'GET', body, headers = {}, raw, form } = {}) {
    const h = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers }
    if (body) h['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: h, body: form ?? raw ?? (body ? JSON.stringify(body) : undefined) })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const buf = Buffer.from(await res.arrayBuffer())
    const text = buf.toString('utf8').replaceAll('<!-- -->', '')
    let json = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text, buf, headers: res.headers, location: res.headers.get('location') }
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
async function account(name, email, role = null, perms = []) {
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
const day = (n) => { const d = new Date(Date.now() + 3600_000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const signed = (event, data) => { const raw = JSON.stringify({ event, data }); return new Browser().req('/api/paystack/webhook', { method: 'POST', raw, headers: { 'content-type': 'application/json', 'x-paystack-signature': createHmac('sha512', SK).update(raw).digest('hex') } }) }
const bk = (ref) => q(`select * from "Booking" where reference=$1`, [ref]).then((r) => r[0])
const mailsFor = (ref) => q(`select kind,"to" from "EmailLog" where subject like $1`, [`%${ref}%`])
const anon = new Browser()

console.log('1. Setup')
const P = await account('Ife Host', `ife.host${stamp}@test.local`, 'partner')
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","updatedAt") values (gen_random_uuid(),$1,'property_host','approved','Ife Stays',now())`, [P.id])
for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x','Ife Host',$5,'Ife Stays')`, [P.id, a.key, a.version, a.title, P.email])
const O = await account('Other Host', `oth.host${stamp}@test.local`, 'partner')
const TB = await account('Tade Bookings', `tade.b${stamp}@test.local`, 'team', ['bookings'])
const TL = await account('Tola Listings', `tola.l${stamp}@test.local`, 'team', ['listings'])
const G = await account('Gbemi Guest', `gbemi.g${stamp}@example.com`)
const H = await account('Hauwa Guest', `hauwa.g${stamp}@example.com`)
const slug = `request-villa-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),'Request Villa Test',$1,'real_estate','Test.',250000,'x','Ikoyi','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],'booking','luxury_shortlets',$2,true,now())`, [slug, P.id])
const L = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
await q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","instantBook","requireGuestId","advanceNoticeHours","updatedAt") values ($1,true,'night',250000,20000,80000,1,false,true,0,now())`, [L])
check('on-request listing ready', !!L)

console.log('2. Request to book')
let r = await G.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(30), end: day(32) } })
check('request created, no payment link', r.status === 200 && r.json?.requested === true && !r.json?.url, `${r.status} ${JSON.stringify(r.json)}`)
const R1 = r.json?.reference
let b = await bk(R1)
const holdH = (b.holdExpiresAt - b.createdAt) / 3600_000
check('dates held ~12h for the host', b.status === 'requested' && holdH > 11.9 && holdH < 12.1, `${b.status} ${holdH}`)
r = await anon.req(`/api/listings/${L}/availability`)
check('requested dates shown as taken', r.json?.blocked?.some((x) => x.start === day(30)))
r = await H.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(31), end: day(33) } })
check('another guest cannot request overlapping dates', r.status === 409)
let m = await mailsFor(R1)
check('host and bookings team asked to answer', m.some((x) => x.kind === 'booking_request_new' && x.to === P.email) && m.some((x) => x.kind === 'booking_request_new' && x.to === TB.email))
check('guest told the request was sent', (await q(`select count(*)::int n from "EmailLog" where kind='booking_requested' and "to"=$1`, [G.email]))[0].n === 1)
r = await G.req(`/bookings/${R1}`)
check('guest page: waiting for the host, no payment', /Waiting for the host to accept/.test(r.text) && !/Continue to payment/.test(r.text))
r = await G.req('/bookings')
check('My bookings shows it as waiting', /Waiting for host/.test(r.text) && r.text.includes(R1))
r = await P.req('/admin/bookings')
check('host sees the request with Accept', r.text.includes(R1) && /Accept request/.test(r.text))

console.log('3. Who can answer')
check('other partner cannot accept', (await O.req(`/api/admin/bookings/${b.id}`, { method: 'POST', body: { action: 'accept' } })).status === 404)
check('listings-only team cannot accept', (await TL.req(`/api/admin/bookings/${b.id}`, { method: 'POST', body: { action: 'accept' } })).status === 401)
check('guest cannot pay before acceptance', (await G.req(`/api/bookings/${R1}/pay`, { method: 'POST' })).status === 409)

console.log('4. Accept and pay')
r = await P.req(`/api/admin/bookings/${b.id}`, { method: 'POST', body: { action: 'accept' } })
check('host accepts', r.status === 200, JSON.stringify(r.json))
b = await bk(R1)
const payH = (b.holdExpiresAt - b.respondedAt) / 3600_000
check('guest has 24h to pay', b.status === 'pending_payment' && payH > 23.9 && payH < 24.1, `${b.status} ${payH}`)
check('accepting twice refused', (await P.req(`/api/admin/bookings/${b.id}`, { method: 'POST', body: { action: 'accept' } })).status === 409)
check('guest emailed to pay', (await mailsFor(R1)).some((x) => x.kind === 'booking_accepted' && x.to === G.email) || (await q(`select count(*)::int n from "EmailLog" where kind='booking_accepted' and "to"=$1`, [G.email]))[0].n === 1)
r = await G.req(`/bookings/${R1}`)
check('guest page: accepted, with Pay button', /Accepted: complete your booking/.test(r.text) && /and confirm/.test(r.text))
check('another guest cannot pay it', (await H.req(`/api/bookings/${R1}/pay`, { method: 'POST' })).status === 404)
r = await G.req(`/api/bookings/${R1}/pay`, { method: 'POST' })
check('pay opens Paystack checkout', r.status === 200 && /^https:\/\/checkout\.paystack\.com\//.test(r.json?.url ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
const url1 = r.json?.url
r = await G.req(`/api/bookings/${R1}/pay`, { method: 'POST' })
check('paying again resumes the same checkout', r.status === 200 && r.json?.url === url1)
b = await bk(R1)
await signed('charge.success', { status: 'success', reference: R1, amount: Math.round(Number(b.amountDue) * 100), currency: 'NGN', channel: 'card', paid_at: new Date().toISOString() })
b = await bk(R1)
check('payment confirms the accepted request', b.status === 'confirmed')
check('partner payout scheduled', (await q(`select count(*)::int n from "Payout" where "bookingId"=$1`, [b.id]))[0].n === 1)

console.log('5. Decline')
r = await H.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(40), end: day(42) } })
const R2 = r.json?.reference
const b2 = await bk(R2)
check('decline needs a reason', (await P.req(`/api/admin/bookings/${b2.id}`, { method: 'POST', body: { action: 'decline', reason: '' } })).status === 400)
r = await TB.req(`/api/admin/bookings/${b2.id}`, { method: 'POST', body: { action: 'decline', reason: 'Booked privately for those dates' } })
check('bookings team can decline', r.status === 200)
check('declined, dates reopen', (await bk(R2)).status === 'declined' && (await anon.req(`/api/listings/${L}/quote?start=${day(40)}&end=${day(42)}`)).status === 200)
check('guest told, with the reason', (await q(`select count(*)::int n from "EmailLog" where kind='booking_declined' and "to"=$1`, [H.email]))[0].n === 1)
r = await H.req(`/bookings/${R2}`)
check('guest page explains the decline', /can’t accept this request/.test(r.text) && /Booked privately/.test(r.text))

console.log('6. No answer in time')
r = await H.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(50), end: day(52) } })
const R3 = r.json?.reference
await q(`update "Booking" set "holdExpiresAt"=now() - interval '1 minute' where reference=$1`, [R3])
check('lapsed request frees the dates', (await anon.req(`/api/listings/${L}/quote?start=${day(50)}&end=${day(52)}`)).status === 200)
check('host can no longer accept it', (await P.req(`/api/admin/bookings/${(await bk(R3)).id}`, { method: 'POST', body: { action: 'accept' } })).status === 409)
await new Browser().req('/api/cron/daily', { headers: { authorization: 'Bearer local-cron-secret-0123456789' } })
check('daily job marks it expired', (await bk(R3)).status === 'expired')
check('guest told it expired', (await q(`select count(*)::int n from "EmailLog" where kind='booking_request_expired' and "to"=$1`, [H.email]))[0].n === 1)

console.log('7. Guest ID')
r = await G.req(`/bookings/${R1}`)
check('confirmed stay asks for ID', /Add your ID before arrival/.test(r.text))
check('confirmation email asks for ID', (await q(`select count(*)::int n from "EmailLog" where kind='booking_confirmed' and "to"=$1`, [G.email]))[0].n === 1)
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(800, 3)])
const fd = (bytes, type, name) => { const f = new FormData(); f.append('file', new Blob([bytes], { type }), name); return f }
check('another guest cannot upload to it', (await H.req(`/api/bookings/${R1}/guest-id`, { method: 'POST', form: fd(png, 'image/png', 'id.png') })).status === 404)
check('text files refused', (await G.req(`/api/bookings/${R1}/guest-id`, { method: 'POST', form: fd(Buffer.from('hello'), 'text/plain', 'id.txt') })).status === 400)
r = await G.req(`/api/bookings/${R1}/guest-id`, { method: 'POST', form: fd(png, 'image/png', 'passport.png') })
check('guest uploads ID', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
r = await G.req(`/bookings/${R1}`)
check('page shows ID received', /ID received/.test(r.text))
r = await P.req(`/api/bookings/${R1}/guest-id`)
check('host can view it, exact bytes, never cached', r.status === 200 && r.buf.equals(png) && /no-store/.test(r.headers.get('cache-control') ?? ''), `${r.status}`)
check('image locked down (sandbox CSP)', /sandbox/.test(r.headers.get('content-security-policy') ?? ''))
check('host view audited', (await q(`select count(*)::int n from "AuditLog" where action='booking.guest_id.view' and "actorId"=$1`, [P.id]))[0].n >= 1)
check('bookings team can view', (await TB.req(`/api/bookings/${R1}/guest-id`)).status === 200)
check('other partner cannot view (404)', (await O.req(`/api/bookings/${R1}/guest-id`)).status === 404)
check('listings-only team cannot view', (await TL.req(`/api/bookings/${R1}/guest-id`)).status === 404)
check('signed-out visitor cannot view', (await anon.req(`/api/bookings/${R1}/guest-id`)).status === 401)
r = await P.req('/admin/bookings?view=all')
check('host bookings list links to the ID', r.text.includes(`/api/bookings/${R1}/guest-id`))
const png2 = Buffer.concat([png, Buffer.alloc(50, 9)])
await G.req(`/api/bookings/${R1}/guest-id`, { method: 'POST', form: fd(png2, 'image/png', 'passport-new.png') })
check('replacing keeps only the new ID', (await P.req(`/api/bookings/${R1}/guest-id`)).buf.equals(png2))
check('cannot upload ID to an unconfirmed booking', (await H.req(`/api/bookings/${R2}/guest-id`, { method: 'POST', form: fd(png, 'image/png', 'id.png') })).status === 409)

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
