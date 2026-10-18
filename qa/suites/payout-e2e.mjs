// End-to-end: 4c-2 partner payouts (Paystack TEST mode).
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
const payoutOf = (ref) => q(`select p.* from "Payout" p join "Booking" b on b.id=p."bookingId" where b.reference=$1`, [ref]).then((r) => r[0])
async function book(guest, listingId, start, end) {
  const r = await guest.req('/api/bookings', { method: 'POST', body: { listingId, start, end } })
  const b = await bk(r.json?.reference)
  await signed('charge.success', { status: 'success', reference: b.reference, amount: Math.round(Number(b.amountDue) * 100), currency: 'NGN', channel: 'card', paid_at: new Date().toISOString() })
  return b.reference
}

console.log('1. Setup')
async function partner(name, email) {
  const p = await account(name, email, 'partner')
  await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","updatedAt") values (gen_random_uuid(),$1,'property_host','approved',$2,now())`, [p.id, `${name} Stays`])
  await q(`insert into "PartnerProfile" (id,"userId","brandName","updatedAt") values (gen_random_uuid(),$1,$2,now())`, [p.id, `${name} Stays`])
  for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x',$5,$6,'x')`, [p.id, a.key, a.version, a.title, name, email])
  return p
}
const P = await partner('Yemi Host', `yemi.host${stamp}@test.local`)
const V = await partner('Vip Host', `vip.host${stamp}@test.local`)
await q(`insert into "CommissionRule" (id,"partnerId",subcategory,"ratePercent","payoutTiming",active,"updatedAt") values (gen_random_uuid(),$1,'luxury_shortlets',10,'after_checkin',true,now())`, [V.id])
const A = await account('Ada Admin', `ada.po${stamp}@test.local`, 'admin')
const TP = await account('Tomi Payouts', `tomi.po${stamp}@test.local`, 'team', ['payouts'])
const TB = await account('Tobi Bookings', `tobi.bk${stamp}@test.local`, 'team', ['bookings'])
const G = await account('Grace Guest', `grace.po${stamp}@example.com`)
async function listing(name, owner, policy = 'moderate') {
  const slug = `${name}-${stamp}`
  await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),$3,$1,'real_estate','Test.',200000,'x','Ikoyi','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],'booking','luxury_shortlets',$2,true,now())`, [slug, owner, `Villa ${name}`])
  const id = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
  await q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","instantBook","cancellationPolicy","advanceNoticeHours","updatedAt") values ($1,true,'night',200000,30000,100000,1,true,$2,0,now())`, [id, policy])
  return id
}
const LP = await listing('yemi', P.id)
const LV = await listing('vip', V.id)
const LH = await listing('house', null)
const LS = await listing('yemistrict', P.id, 'strict')
check('setup ready', !!LP && !!LV && !!LH)

console.log('2. Payouts are scheduled when bookings are confirmed')
const r1 = await book(G, LP, day(20), day(23)) // 600k + 30k = 630k total; deposit excluded
let p1 = await payoutOf(r1)
check('payout created for the partner', p1?.partnerId === P.id && p1.status === 'scheduled')
check('gross = booking total (deposit excluded), 15% default commission', Number(p1?.gross) === 630000 && Number(p1?.commissionRate) === 15 && Number(p1?.commission) === 94500 && Number(p1?.amount) === 535500, JSON.stringify({ g: p1?.gross, c: p1?.commission, a: p1?.amount }))
const b1 = await bk(r1)
const dueH = Number((await q(`select round(extract(epoch from (p."dueAt" - b."startDate"))/3600) h from "Payout" p join "Booking" b on b.id=p."bookingId" where b.reference=$1`, [r1]))[0].h)
check('due about a day after check-in (36h)', dueH === 36, `${dueH}h`)
check('reference is unique and transfer-safe', p1.reference === `payout-${r1.toLowerCase()}`)
const r2 = await book(G, LV, day(20), day(22)) // 400k+30k=430k at 10%
const p2 = await payoutOf(r2)
check('partner-specific rate wins (10%)', Number(p2?.commissionRate) === 10 && Number(p2?.amount) === 387000, JSON.stringify({ r: p2?.commissionRate, a: p2?.amount }))
const r3 = await book(G, LH, day(20), day(21))
check('house listing (no partner): no payout', !(await payoutOf(r3)))

console.log('3. Cancellations adjust payouts')
const r4 = await book(G, LP, day(40), day(42))
await G.req(`/api/bookings/${r4}/cancel`, { method: 'POST' })
check('full refund to guest: payout cancelled', (await payoutOf(r4)).status === 'cancelled')
const r5 = await book(G, LS, day(3), day(5)) // strict, 3 days out: stay kept (400k)
await G.req(`/api/bookings/${r5}/cancel`, { method: 'POST' })
const p5 = await payoutOf(r5)
check('strict late cancellation: partner keeps share of the stay', p5.status === 'scheduled' && Number(p5.gross) === 400000 && Number(p5.amount) === 340000, JSON.stringify({ s: p5.status, g: p5.gross, a: p5.amount }))
const r6 = await book(G, LP, day(50), day(51))
await P.req(`/api/admin/bookings/${(await bk(r6)).id}`, { method: 'POST', body: { action: 'cancel', reason: 'Owner emergency' } })
check('partner cancels: payout cancelled', (await payoutOf(r6)).status === 'cancelled')

console.log('4. Bank details')
check('guest cannot see the payout account API', (await G.req('/api/partner/payout-account')).status === 401)
check('team cannot use partner bank details API', (await TP.req('/api/partner/payout-account')).status === 401)
let r = await P.req('/api/partner/payout-account?banks=1')
check('partner gets the list of Nigerian banks', r.status === 200 && r.json?.banks?.length > 50, `${r.status} ${r.json?.banks?.length}`)
r = await P.req('/api/partner/payout-account', { method: 'POST', body: { bankCode: '058', accountNumber: '0001234567' } })
check('wrong account refused by the bank check', r.status === 400)
r = await P.req('/api/partner/payout-account', { method: 'POST', body: { bankCode: '001', accountNumber: '123' } })
check('short account number refused', r.status === 400)
if (process.env.TEST_RECIPIENT) {
  // Paystack test mode allows 3 real bank checks a day; when spent, attach a
  // pre-made test recipient so the transfer path can still be exercised.
  console.log('     (bank check skipped: Paystack test-mode daily limit; using a pre-made test recipient)')
  await q(`insert into "PayoutAccount" ("userId","bankCode","bankName","accountNumber","accountName","recipientCode","updatedAt") values ($1,'057','Zenith Bank','0000000000','Test',$2,now())`, [P.id, process.env.TEST_RECIPIENT])
} else {
r = await P.req('/api/partner/payout-account', { method: 'POST', body: { bankCode: '057', accountNumber: '0000000000' } })
check('bank returns the account holder name', r.status === 200 && /test/i.test(r.json?.accountName ?? ''), JSON.stringify(r.json))
r = await P.req('/api/partner/payout-account', { method: 'PUT', body: { bankCode: '057', bankName: 'Zenith Bank', accountNumber: '0000000000' } })
check('account saved as a Paystack transfer recipient', r.status === 200 && r.json?.account?.account === '••••0000', JSON.stringify(r.json))
const acct = (await q(`select * from "PayoutAccount" where "userId"=$1`, [P.id]))[0]
check('name stored is the bank’s, recipient code stored', /test/i.test(acct?.accountName ?? '') && /^RCP_/.test(acct?.recipientCode ?? ''), JSON.stringify(acct))
}
r = await P.req('/admin/payouts')
check('partner payouts page shows masked account and earnings', r.status === 200 && r.text.includes('••••0000') && r.text.includes('535,500'))
check('other partner does not see Yemi’s payouts', !(await V.req('/admin/payouts')).text.includes(r1))

console.log('5. Due, approval, transfer')
check('payout not yet due', p1.status === 'scheduled')
await q(`update "Payout" set "dueAt"=now() - interval '1 hour' where "bookingId"=(select id from "Booking" where reference=$1)`, [r1])
await q(`update "Payout" set "dueAt"=now() - interval '1 hour' where "bookingId"=(select id from "Booking" where reference=$1)`, [r2])
r = await new Browser().req('/api/cron/daily', { headers: { authorization: 'Bearer local-cron-secret-0123456789' } })
check('daily job moves due payouts to approval', r.status === 200 && (await payoutOf(r1)).status === 'pending_approval' && r.json?.bookings?.payoutsDue >= 2, JSON.stringify(r.json?.bookings))
check('bookings-only team turned away from payouts', (await TB.req('/admin/payouts')).status >= 300)
check('bookings-only team cannot approve', (await TB.req(`/api/admin/payouts/${p1.id}`, { method: 'POST', body: { action: 'approve' } })).status === 401)
check('partner cannot approve their own payout', (await P.req(`/api/admin/payouts/${p1.id}`, { method: 'POST', body: { action: 'approve' } })).status === 401)
r = await TP.req('/admin/payouts')
check('payouts team sees the queue', r.status === 200 && r.text.includes(r1) && /Due for approval/.test(r.text))
r = await TP.req(`/api/admin/payouts/${p2.id}`, { method: 'POST', body: { action: 'approve' } })
check('partner without bank details cannot be paid yet', r.status === 409 && /bank details/.test(r.json?.error ?? ''), JSON.stringify(r.json))
r = await TP.req(`/api/admin/payouts/${p1.id}`, { method: 'POST', body: { action: 'approve' } })
const after = await payoutOf(r1)
console.log(`     Paystack transfer result: HTTP ${r.status} · ${after.status} · ${after.failureReason ?? 'ok'}`)
check('approval sends a Paystack transfer (or records why Paystack refused)', (r.status === 200 && ['processing', 'paid'].includes(after.status)) || (r.status === 502 && after.status === 'failed' && !!after.failureReason))
check('double approval blocked', (await TP.req(`/api/admin/payouts/${p1.id}`, { method: 'POST', body: { action: 'approve' } })).status === 409 || after.status === 'failed')
check('approval attempt audited', (await q(`select count(*)::int n from "AuditLog" where target=$1 and action like 'payout.%'`, [p1.id]))[0].n >= 1)
if ((await payoutOf(r1)).status === 'failed') {
  check('manual payment needs a reference', (await TP.req(`/api/admin/payouts/${p1.id}`, { method: 'POST', body: { action: 'mark_paid', reference: '' } })).status === 400)
  r = await TP.req(`/api/admin/payouts/${p1.id}`, { method: 'POST', body: { action: 'mark_paid', reference: 'GTB-TRF-889201' } })
  check('failed transfer can be recorded as paid manually', r.status === 200 && (await payoutOf(r1)).status === 'paid' && /GTB-TRF-889201/.test((await payoutOf(r1)).note ?? ''))
} else {
  await signed('transfer.success', { reference: p1.reference, transfer_code: 'TRF_test' })
}
check('payout ends up paid', (await payoutOf(r1)).status === 'paid')
r = await P.req('/admin/payouts')
check('partner sees it as paid', /Paid/.test(r.text) && r.text.includes(r1))
check('cancel needs a reason', (await TP.req(`/api/admin/payouts/${p2.id}`, { method: 'POST', body: { action: 'cancel', reason: '' } })).status === 400)
r = await A.req(`/api/admin/payouts/${p2.id}`, { method: 'POST', body: { action: 'cancel', reason: 'Guest dispute under review' } })
check('admin can cancel a payout with a reason', r.status === 200 && (await payoutOf(r2)).status === 'cancelled')
check('a paid payout cannot be cancelled', (await A.req(`/api/admin/payouts/${p1.id}`, { method: 'POST', body: { action: 'cancel', reason: 'Too late to cancel' } })).status === 409)

console.log('6. Damage compensation')
const r7 = await book(G, LP, day(60), day(61))
await q(`update "Booking" set "startDate"=$2, "endDate"=$3 where reference=$1`, [r7, `${day(-2)}T00:00:00Z`, `${day(-1)}T00:00:00Z`])
const b7 = await bk(r7)
await P.req(`/api/admin/bookings/${b7.id}`, { method: 'POST', body: { action: 'claim', amount: 30000, note: 'Stained rug in the master bedroom, cleaning quote' } })
await A.req(`/api/admin/bookings/${b7.id}`, { method: 'POST', body: { action: 'decide_claim', keep: 30000 } })
const p7 = await payoutOf(r7)
check('kept damage money added to the partner’s payout (no commission on it)', Number(p7.amount) === Number(p7.gross) - Number(p7.commission) + 30000, JSON.stringify({ g: p7.gross, c: p7.commission, a: p7.amount }))

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
