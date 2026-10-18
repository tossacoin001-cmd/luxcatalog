// End-to-end: 4c-1 cancellations, refunds queue, damage claims, daily jobs.
// Includes one REAL Paystack test-mode refund of a real test payment.
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
const refundsOf = (ref) => q(`select r.* from "Refund" r join "Booking" b on b.id=r."bookingId" where b.reference=$1 order by r."createdAt"`, [ref])
async function book(guest, listingId, start, end) {
  const r = await guest.req('/api/bookings', { method: 'POST', body: { listingId, start, end } })
  const b = await bk(r.json?.reference)
  await signed('charge.success', { status: 'success', reference: b.reference, amount: Math.round(Number(b.amountDue) * 100), currency: 'NGN', channel: 'card', paid_at: new Date().toISOString() })
  return b.reference
}

console.log('1. Setup')
const P = await account('Kunle Host', `kunle.host${stamp}@test.local`, 'partner')
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","updatedAt") values (gen_random_uuid(),$1,'property_host','approved','Kunle Stays',now())`, [P.id])
for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x','Kunle Host',$5,'Kunle Stays')`, [P.id, a.key, a.version, a.title, P.email])
const O = await account('Other Host', `other.h${stamp}@test.local`, 'partner')
const A = await account('Ada Admin', `ada.ref${stamp}@test.local`, 'admin')
const TB = await account('Tolu Bookings', `tolu.b${stamp}@test.local`, 'team', ['bookings'])
const TL = await account('Tari Listings', `tari.l${stamp}@test.local`, 'team', ['listings'])
const G = await account('Gift Guest', `gift.guest${stamp}@example.com`)
async function listing(name, policy) {
  const slug = `${name}-${stamp}`
  await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),$3,$1,'real_estate','Test.',300000,'x','Lekki','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],'booking','luxury_shortlets',$2,true,now())`, [slug, P.id, `Villa ${name}`])
  const id = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
  await q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","instantBook","cancellationPolicy","advanceNoticeHours","updatedAt") values ($1,true,'night',300000,40000,150000,1,true,$2,0,now())`, [id, policy])
  return id
}
const LM = await listing('moderate', 'moderate')
const LS = await listing('strict', 'strict')
check('setup ready', !!LM && !!LS)

console.log('2. Guest cancels')
const r1 = await book(G, LM, day(30), day(33)) // 3 nights: 900k + 40k cleaning + 150k deposit = 1,090,000
let r = await G.req(`/bookings/${r1}`)
check('booking page offers cancellation', /Cancel this booking/.test(r.text))
r = await G.req(`/api/bookings/${r1}/cancel`, { method: 'POST' })
check('moderate, 30 days out: everything back', r.status === 200 && r.json?.refund === 1090000, `${r.status} ${JSON.stringify(r.json)}`)
let b = await bk(r1)
check('booking cancelled by guest', b.status === 'cancelled' && b.cancelledBy === 'guest')
r = await new Browser().req(`/api/listings/${LM}/quote?start=${day(30)}&end=${day(33)}`)
check('dates reopen immediately', r.status === 200)
let rf = await refundsOf(r1)
check('refund queued, not sent', rf.length === 1 && rf[0].status === 'pending_approval' && Number(rf[0].amount) === 1090000)
check('cancelling twice refused', (await G.req(`/api/bookings/${r1}/cancel`, { method: 'POST' })).status === 409)
const r2 = await book(G, LS, day(3), day(5)) // strict, 3 days out: no stay refund
r = await G.req(`/api/bookings/${r2}/cancel`, { method: 'POST' })
check('strict, 3 days out: only cleaning + deposit back', r.status === 200 && r.json?.refund === 190000, JSON.stringify(r.json))
const H = await account('Hal Guest', `hal.guest${stamp}@example.com`)
const r3 = await book(H, LM, day(40), day(42))
check('another guest cannot cancel it', (await G.req(`/api/bookings/${r3}/cancel`, { method: 'POST' })).status === 404)

console.log('3. Partner / team cancels')
check('other partner cannot cancel', (await O.req(`/api/admin/bookings/${(await bk(r3)).id}`, { method: 'POST', body: { action: 'cancel', reason: 'Not mine but trying' } })).status === 404)
check('listings-only team cannot cancel', (await TL.req(`/api/admin/bookings/${(await bk(r3)).id}`, { method: 'POST', body: { action: 'cancel', reason: 'No access here' } })).status === 401)
check('a reason is required', (await P.req(`/api/admin/bookings/${(await bk(r3)).id}`, { method: 'POST', body: { action: 'cancel', reason: '' } })).status === 400)
r = await P.req(`/api/admin/bookings/${(await bk(r3)).id}`, { method: 'POST', body: { action: 'cancel', reason: 'Burst pipe, villa unusable' } })
check('partner cancels: guest gets everything back', r.status === 200 && r.json?.refund === Number((await bk(r3)).amountDue), JSON.stringify(r.json))
check('recorded as cancelled by partner', (await bk(r3)).cancelledBy === 'partner')
const mails = await q(`select kind,"to" from "EmailLog" where subject like $1`, [`%${r3}%`])
check('guest told, with refund', mails.some((m) => m.kind === 'booking_cancelled' && m.to === H.email))
check('partner and team told', mails.some((m) => m.kind === 'booking_cancelled_staff' && m.to === P.email) && mails.some((m) => m.to === TB.email))

console.log('4. Refund queue')
check('listings-only team turned away from refunds', (await TL.req('/admin/refunds')).status >= 300)
check('partner cannot approve refunds', (await P.req(`/api/admin/refunds/${rf[0].id}`, { method: 'POST', body: { action: 'approve' } })).status === 401)
r = await TB.req('/admin/refunds')
check('bookings team sees the queue', r.status === 200 && r.text.includes(r1) && r.text.includes(r3))
r = await TB.req(`/api/admin/refunds/${rf[0].id}`, { method: 'POST', body: { action: 'approve' } })
check('refund of a simulated payment: Paystack refuses, marked failed', r.status === 502 && (await refundsOf(r1))[0].status === 'failed', `${r.status} ${JSON.stringify(r.json)}`)
check('approving again is blocked', (await TB.req(`/api/admin/refunds/${rf[0].id}`, { method: 'POST', body: { action: 'approve' } })).status === 409)
check('reject needs a reason', (await A.req(`/api/admin/refunds/${rf[0].id}`, { method: 'POST', body: { action: 'reject', reason: '' } })).status === 400)
r = await A.req(`/api/admin/refunds/${rf[0].id}`, { method: 'POST', body: { action: 'reject', reason: 'Test payment, nothing to return' } })
check('failed refund can be rejected with a reason', r.status === 200 && (await refundsOf(r1))[0].status === 'rejected')
check('every decision audited', (await q(`select count(*)::int n from "AuditLog" where target=$1 and action like 'refund.%'`, [rf[0].id]))[0].n >= 2)

console.log('5. Damage claims')
const r4 = await book(G, LM, day(50), day(52))
const b4 = await bk(r4)
check('no claim before check-out', (await P.req(`/api/admin/bookings/${b4.id}`, { method: 'POST', body: { action: 'claim', amount: 50000, note: 'Broken glass table in lounge' } })).status === 409)
// Move the stay into the past: checked out yesterday.
await q(`update "Booking" set "startDate"=$2, "endDate"=$3 where id=$1`, [b4.id, `${day(-3)}T00:00:00Z`, `${day(-1)}T00:00:00Z`])
check('claim above the deposit refused', (await P.req(`/api/admin/bookings/${b4.id}`, { method: 'POST', body: { action: 'claim', amount: 999999, note: 'Broken glass table in lounge' } })).status === 400)
check('claim needs a description', (await P.req(`/api/admin/bookings/${b4.id}`, { method: 'POST', body: { action: 'claim', amount: 50000, note: 'bad' } })).status === 400)
check('other partner cannot claim', (await O.req(`/api/admin/bookings/${b4.id}`, { method: 'POST', body: { action: 'claim', amount: 50000, note: 'Broken glass table in lounge' } })).status === 404)
r = await P.req(`/api/admin/bookings/${b4.id}`, { method: 'POST', body: { action: 'claim', amount: 60000, note: 'Broken glass table in the lounge, replacement quote attached' } })
check('partner files a claim within 48h', r.status === 200 && (await bk(r4)).cautionStatus === 'claimed', `${r.status} ${JSON.stringify(r.json)}`)
check('team alerted', (await q(`select count(*)::int n from "EmailLog" where kind='caution_claim' and subject like $1`, [`%${r4}%`]))[0].n >= 1)
r = await TB.req('/admin/bookings?view=attention')
check('claim shown under Needs attention', r.text.includes(r4) && /Damage claim/.test(r.text))
check('partner cannot decide their own claim', (await P.req(`/api/admin/bookings/${b4.id}`, { method: 'POST', body: { action: 'decide_claim', keep: 60000 } })).status === 401)
r = await TB.req(`/api/admin/bookings/${b4.id}`, { method: 'POST', body: { action: 'decide_claim', keep: 40000 } })
check('team keeps 40k, refunds the rest', r.status === 200 && r.json?.kept === 40000 && r.json?.back === 110000, JSON.stringify(r.json))
rf = await refundsOf(r4)
check('caution refund queued for the remainder', rf.some((x) => x.kind === 'caution' && Number(x.amount) === 110000 && x.status === 'pending_approval'))
r = await TB.req(`/api/admin/bookings/${b4.id}`, { method: 'POST', body: { action: 'decide_claim', keep: 0 } })
check('a claim is decided only once', r.status === 409)

console.log('6. Daily jobs')
const r5 = await book(G, LS, day(60), day(61))
await q(`update "Booking" set "startDate"=$2, "endDate"=$3 where reference=$1`, [r5, `${day(-5)}T00:00:00Z`, `${day(-4)}T00:00:00Z`])
r = await new Browser().req('/api/cron/daily', { headers: { authorization: 'Bearer local-cron-secret-0123456789' } })
check('daily job runs', r.status === 200 && r.json?.bookings, `${r.status} ${JSON.stringify(r.json?.bookings)}`)
const b5 = await bk(r5)
check('finished stay marked completed', b5.status === 'completed')
check('deposit refund queued after 48h with no claim', b5.cautionStatus === 'refund_queued' && (await refundsOf(r5)).some((x) => x.kind === 'caution' && Number(x.amount) === 150000))
check('daily job without the secret refused', (await new Browser().req('/api/cron/daily')).status === 401)

console.log('7. A real Paystack test refund')
const real = (await q(`select b.reference, b."userId" from "Booking" b join "Listing" l on l.id=b."listingId" where l.slug='test-villa-paystack' and b.status='confirmed' and b."startDate" > now() order by b."startDate" desc limit 1`))[0]
if (!real) {
  console.log('  (skipped: no real test payment left to refund)')
} else {
  await q('delete from "RateLimit"')
  const T = new Browser()
  await T.req('/api/auth/sign-in/email', { method: 'POST', body: { email: 'paystack.tester@example.com', password: 'LuxTest-2026!' } })
  r = await T.req(`/api/bookings/${real.reference}/cancel`, { method: 'POST' })
  check(`tester cancels real test booking ${real.reference}`, r.status === 200 && r.json?.refund > 0, `${r.status} ${JSON.stringify(r.json)}`)
  const rr = (await refundsOf(real.reference)).at(-1)
  r = await A.req(`/api/admin/refunds/${rr.id}`, { method: 'POST', body: { action: 'approve' } })
  const after = (await refundsOf(real.reference)).at(-1)
  check('Paystack accepts the refund of a real test payment', r.status === 200 && ['processing', 'completed'].includes(after.status), `${r.status} ${JSON.stringify(r.json)} ${after.status} ${after.failureReason ?? ''}`)
  if (after.paystackRefund) {
    await signed('refund.processed', { id: Number(after.paystackRefund), transaction_reference: real.reference, amount: Math.round(Number(after.amount) * 100) })
    check('Paystack "refund processed" notification marks it refunded', (await refundsOf(real.reference)).at(-1).status === 'completed')
  }
  r = await T.req(`/bookings/${real.reference}`)
  check('guest sees the refund on their booking page', /Refund/.test(r.text) && /(sent|on its way)/.test(r.text))
}

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
