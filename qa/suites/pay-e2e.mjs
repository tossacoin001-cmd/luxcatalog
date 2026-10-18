// End-to-end: Phase 4b instant booking + Paystack (TEST mode).
// Starts real Paystack test transactions; payment outcomes are delivered as
// webhooks signed with the test secret, exactly as Paystack signs them.
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
  async req(path, { method = 'GET', body, headers = {}, raw } = {}) {
    const h = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers }
    if (body) h['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: h, body: raw ?? (body ? JSON.stringify(body) : undefined) })
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
async function account(name, email, role = null, perms = [], twofa = !!role) {
  await q('delete from "RateLimit"')
  const b = new Browser()
  await b.req('/api/auth/sign-up/email', { method: 'POST', body: { name, email, password: pw } })
  if (role) await q(`update "User" set role=$2, permissions=$3 where email=$1`, [email, role, perms])
  if (twofa) {
    const en = await b.req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
    await b.req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
  }
  b.id = (await q(`select id from "User" where email=$1`, [email]))[0].id
  b.email = email
  return b
}
const day = (n) => { const d = new Date(Date.now() + 3600_000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const webhook = (data, sign = true, secret = SK) => {
  const raw = JSON.stringify({ event: 'charge.success', data })
  const sig = createHmac('sha512', secret).update(raw).digest('hex')
  return new Browser().req('/api/paystack/webhook', { method: 'POST', raw, headers: { 'content-type': 'application/json', ...(sign ? { 'x-paystack-signature': sig } : {}) } })
}
const booking = (ref) => q(`select * from "Booking" where reference=$1`, [ref]).then((r) => r[0])
const anon = new Browser()

console.log('1. Setup')
const P = await account('Bola Host', `bola.host${stamp}@test.local`, 'partner')
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","updatedAt") values (gen_random_uuid(),$1,'property_host','approved','Bola Stays',now())`, [P.id])
for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x','Bola Host',$5,'Bola Stays')`, [P.id, a.key, a.version, a.title, P.email])
const O = await account('Other Host', `other.host${stamp}@test.local`, 'partner')
const A = await account('Ada Admin', `ada.pay${stamp}@test.local`, 'admin')
const TB = await account('Tunde Bookings', `tunde.tb${stamp}@test.local`, 'team', ['bookings'])
const TX = await account('Tari Listings', `tari.tl${stamp}@test.local`, 'team', ['listings'])
const G = await account('Grace Guest', `grace.guest${stamp}@example.com`)
const H = await account('Henry Guest', `henry.guest${stamp}@example.com`)
const slug = `banana-island-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),'Banana Island Villa Test',$1,'real_estate','Test.',450000,'₦450,000','Banana Island, Lagos','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],'booking','luxury_shortlets',$2,true,now())`, [slug, P.id])
const L = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
await q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","maxUnits","maxGuests","instantBook","updatedAt") values ($1,true,'night',450000,50000,200000,2,14,6,true,now())`, [L])
check('setup ready', !!L)

console.log('2. Starting a booking')
let r = await anon.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(30), end: day(33) } })
check('signed-out guest asked to sign in (401)', r.status === 401, `${r.status}`)
r = await G.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(30), end: day(31) } })
check('below minimum stay refused', r.status === 409 && /Minimum/.test(r.json?.error), `${r.status} ${JSON.stringify(r.json)}`)
r = await P.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(30), end: day(33) } })
check('partner cannot book their own listing', r.status === 403, `${r.status}`)
r = await G.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(30), end: day(33), guests: 2 } })
check('guest gets a Paystack checkout link', r.status === 200 && /^https:\/\/checkout\.paystack\.com\//.test(r.json?.url ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
const ref1 = r.json?.reference
let b1 = await booking(ref1)
const holdMin = b1 ? (b1.holdExpiresAt - b1.createdAt) / 60000 : 0
check('booking held for 15 minutes while paying', b1?.status === 'pending_payment' && holdMin > 14.5 && holdMin < 15.5, `${b1?.status} ${holdMin}`)
check('price snapshotted: 3 nights + cleaning + deposit', Number(b1?.total) === 1400000 && Number(b1?.amountDue) === 1600000 && b1?.units === 3 && b1?.guests === 2, JSON.stringify({ total: b1?.total, due: b1?.amountDue }))
check('reference looks like LUX-XXXXXX', /^LUX-[2-9A-HJ-NP-Z]{6}$/.test(ref1 ?? ''), ref1)
r = await anon.req(`/api/listings/${L}/availability`)
check('held dates shown as taken', r.json?.blocked?.some((x) => x.start === day(30) && x.end === day(33)))
r = await H.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(31), end: day(34) } })
check('second guest cannot take overlapping dates', r.status === 409 && /no longer available/.test(r.json?.error), `${r.status} ${JSON.stringify(r.json)}`)
const [c1, c2] = await Promise.all([
  H.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(40), end: day(43) } }),
  G.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(41), end: day(44) } }),
])
check('two guests racing for the same dates: exactly one wins', [c1.status, c2.status].filter((s) => s === 200).length === 1 && [c1.status, c2.status].includes(409), `${c1.status} ${c2.status}`)

console.log('3. Returning from Paystack without paying')
r = await G.req(`/bookings/${ref1}`)
check('booking page asks Paystack and shows waiting', r.status === 200 && /Waiting for your payment/.test(r.text), `${r.status}`)
check('another guest cannot see it', (await H.req(`/bookings/${ref1}`)).status === 404)
check('signed-out visitor sent to sign in', (await anon.req(`/bookings/${ref1}`)).status >= 300)

console.log('4. Payment notifications')
const paid = (b, extra = {}) => ({ status: 'success', reference: b.reference, amount: Math.round(Number(b.amountDue) * 100), currency: 'NGN', channel: 'card', paid_at: new Date().toISOString(), ...extra })
check('unsigned notification rejected', (await webhook(paid(b1), false)).status === 401)
check('notification signed with another key rejected', (await webhook(paid(b1), true, 'sk_test_not_ours')).status === 401)
check('still pending after rejected notifications', (await booking(ref1)).status === 'pending_payment')
r = await webhook(paid(b1))
check('genuine notification confirms the booking', r.status === 200 && r.json?.outcome === 'confirmed', JSON.stringify(r.json))
b1 = await booking(ref1)
check('booking confirmed and paid', b1.status === 'confirmed' && !!b1.paidAt && b1.paymentChannel === 'card' && b1.holdExpiresAt === null)
r = await webhook(paid(b1))
check('repeat notification changes nothing', r.json?.outcome === 'already')
const mails = await q(`select kind, "to" from "EmailLog" where kind like 'booking_%' and subject like $1`, [`%${ref1}%`])
check('guest emailed once', mails.filter((m) => m.kind === 'booking_confirmed' && m.to === G.email).length === 1, JSON.stringify(mails))
check('partner emailed', mails.some((m) => m.kind === 'booking_new_partner' && m.to === P.email))
check('admin and bookings team emailed', mails.some((m) => m.to === A.email) && mails.some((m) => m.to === TB.email))
check('listings-only team not emailed', !mails.some((m) => m.to === TX.email))
r = await G.req(`/bookings/${ref1}`)
check('booking page shows confirmed', /Your booking is confirmed/.test(r.text) && /₦1,400,000/.test(r.text))

console.log('5. Wrong amount')
r = await H.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(60), end: day(62) } })
check('second booking started', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
const ref2 = r.json?.reference
const b2 = await booking(ref2)
r = await webhook(paid(b2, { amount: 100 }))
check('underpayment not confirmed, flagged for refund', r.json?.outcome === 'mismatch' && (await booking(ref2)).needsRefund === true && (await booking(ref2)).status !== 'confirmed', JSON.stringify(r.json))

console.log('6. Paid after the hold lapsed')
r = await H.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(70), end: day(73) } })
const ref3 = r.json?.reference
await q(`update "Booking" set "holdExpiresAt"=now() - interval '1 minute' where reference=$1`, [ref3])
r = await anon.req(`/api/listings/${L}/quote?start=${day(70)}&end=${day(73)}`)
check('lapsed hold frees the dates', r.status === 200)
r = await G.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(71), end: day(74) } })
const ref4 = r.json?.reference
await webhook(paid(await booking(ref4)))
check('second guest booked and paid for those dates', (await booking(ref4)).status === 'confirmed')
r = await webhook(paid(await booking(ref3)))
const b3 = await booking(ref3)
check('late payment for taken dates: cancelled and refund flagged', r.json?.outcome === 'needs_refund' && b3.status === 'cancelled' && b3.needsRefund, JSON.stringify(r.json))
check('admin alerted to refund', (await q(`select count(*)::int n from "EmailLog" where kind='booking_refund_needed' and subject like $1`, [`%${ref3}%`]))[0].n >= 1)
r = await H.req(`/bookings/${ref3}`)
check('guest told they will be refunded', /refund this payment/.test(r.text))
r = await webhook(paid(await booking(ref3, { status: 'success' })))
check('late payment late-confirmed? never', (await booking(ref3)).status === 'cancelled')
r = await H.req('/api/bookings', { method: 'POST', body: { listingId: L, start: day(80), end: day(82) } })
const ref5 = r.json?.reference
await q(`update "Booking" set "holdExpiresAt"=now() - interval '1 minute' where reference=$1`, [ref5])
r = await webhook(paid(await booking(ref5)))
check('late payment with dates still free: confirmed', r.json?.outcome === 'confirmed' && (await booking(ref5)).status === 'confirmed', JSON.stringify(r.json))

console.log('7. Who sees which bookings')
r = await G.req('/bookings')
check('guest sees their bookings', r.status === 200 && r.text.includes(ref1) && !r.text.includes(ref3))
r = await P.req('/admin/bookings?view=all')
check('partner sees bookings on their listing', r.status === 200 && r.text.includes(ref1))
r = await O.req('/admin/bookings?view=all')
check('other partner sees none of them', r.status === 200 && !r.text.includes(ref1))
r = await TB.req('/admin/bookings?view=attention')
check('bookings team sees refunds needing attention', r.status === 200 && r.text.includes(ref3) && r.text.includes(ref2))
r = await TX.req('/admin/bookings')
check('team without Bookings access is turned away', r.status >= 300 && /denied/.test(r.location ?? ''), `${r.status} ${r.location}`)
r = await TB.req(`/bookings/${ref1}`)
check('bookings team can open a booking', r.status === 200)

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
