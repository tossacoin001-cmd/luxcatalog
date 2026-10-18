// Phase A, end to end against a local build on :3300.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class Browser {
  constructor() { this.jar = new Map() }
  async req(path, { method = 'GET', body, headers = {}, raw, form } = {}) {
    const h = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers }
    if (body) h['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: h, body: form ?? raw ?? (body ? JSON.stringify(body) : undefined) })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const buf = Buffer.from(await res.arrayBuffer())
    let json = null; try { json = JSON.parse(buf.toString()) } catch {}
    return { status: res.status, json, html: buf.toString(), headers: res.headers }
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
  await sleep(600)
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
  return new Browser().req('/api/paystack/webhook', { method: 'POST', raw, headers: { 'content-type': 'application/json', 'x-paystack-signature': createHmac('sha512', SK).update(raw).digest('hex') } })
}
const waitMail = async (sql, params, ok, ms = 30000) => { let rows = []; for (let i = 0; i < ms / 500; i++) { rows = await q(sql, params); if (ok(rows)) break; await sleep(500) } return rows }
const day = (n) => { const d = new Date(Date.now() + 3_600_000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const anon = new Browser()
let r

console.log('1. Security headers')
for (const path of ['/', '/api/health', '/admin', '/catalog/real-estate']) {
  r = await anon.req(path)
  const h = r.headers
  check(`${path}: framing blocked`, h.get('x-frame-options') === 'DENY' && (path.startsWith('/api/') || /frame-ancestors 'none'/.test(h.get('content-security-policy') ?? '')), `${h.get('x-frame-options')} | ${h.get('content-security-policy')}`)
  check(`${path}: nosniff, referrer and permissions policies`, h.get('x-content-type-options') === 'nosniff' && /strict-origin/.test(h.get('referrer-policy') ?? '') && /camera=\(\)/.test(h.get('permissions-policy') ?? ''), `${h.get('x-content-type-options')} | ${h.get('referrer-policy')} | ${h.get('permissions-policy')}`)
  check(`${path}: no "X-Powered-By"`, !h.get('x-powered-by'), h.get('x-powered-by'))
}

console.log('2. Setup')
const P = await account('Kemi Interiors', `kemi.pa${stamp}@test.local`, 'partner')
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","contactName",collections,"updatedAt") values (gen_random_uuid(),$1,'brand_retailer','approved','Kemi Interiors','Kemi',ARRAY['for_sale'],now())`, [P.id])
await q(`insert into "PartnerProfile" (id,"userId","brandName","updatedAt") values (gen_random_uuid(),$1,'Kemi Interiors',now())`, [P.id])
for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x','Kemi',$5,'Kemi Interiors')`, [P.id, a.key, a.version, a.title, P.email])
const A = await account('Ada Admin', `ada.pa${stamp}@test.local`, 'admin')
const TE = await account('Tobi Enquiries', `tobi.pa${stamp}@test.local`, 'team', ['enquiries'])
const G = await account('Grace Guest', `grace.pa${stamp}@example.com`)
const ins = async (title, category, sub, price, owner, extra = '') => { const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`; await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,'Test listing.',$4,'Test','Ikoyi, Lagos','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],$5,$6,$7,true,now())`, [title, slug, category, price, sub === 'luxury_shortlets' ? 'booking' : 'sale', sub, owner]); return { slug, id: (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id } }
const VILLA = await ins('Banana Island Villa A', 'real_estate', 'for_sale', 2500000000, P.id)
const CHAIR = await ins('Brass Lounge Chair', 'decor', 'for_sale', 850000, P.id)
const LAMP = await ins('Murano Floor Lamp', 'decor', 'for_sale', 400000, null)
check('setup ready', !!VILLA.id && !!CHAIR.id && !!LAMP.id)

console.log('3. Guest enquiry, no account needed')
const enq = (o = {}, ip = '10.0.0.1') => anon.req('/api/inquiries', { method: 'POST', body: { name: 'Tola Bakare', email: `tola${stamp}@example.com`, phone: '+234 803 000 0000', message: 'Is the villa still available? Please send the full brochure and service charge.', listingId: VILLA.id, ...o }, headers: { 'x-forwarded-for': ip } })
await q('delete from "RateLimit"')
r = await enq()
check('signed-out guest can enquire', r.status === 200 && !!r.json?.id, `${r.status} ${JSON.stringify(r.json)}`)
const e1 = (await q(`select "userId", kind, "listingId" from "Inquiry" where id=$1`, [r.json?.id]))[0]
check('stored as a guest enquiry', e1 && e1.userId === null && e1.kind === 'enquiry' && e1.listingId === VILLA.id, JSON.stringify(e1))
const alerts = await waitMail(`select kind, "to" from "EmailLog" where kind in ('inquiry_new','inquiry_received') and "createdAt" > now() - interval '5 minutes'`, [], (rows) => rows.some((m) => m.kind === 'inquiry_received' && m.to === `tola${stamp}@example.com`) && rows.some((m) => m.kind === 'inquiry_new' && m.to === A.email))
check('team alerted at once (admin)', alerts.some((m) => m.kind === 'inquiry_new' && m.to === A.email), JSON.stringify(alerts.slice(0, 6)))
check('team with Enquiries alerted', alerts.some((m) => m.kind === 'inquiry_new' && m.to === TE.email))
check('the listing’s partner alerted', alerts.some((m) => m.kind === 'inquiry_new' && m.to === P.email))
check('guest gets an acknowledgement', alerts.some((m) => m.kind === 'inquiry_received' && m.to === `tola${stamp}@example.com`))
r = await enq({ email: 'not-an-email' }, '10.0.0.2')
check('invalid email refused', r.status === 400, r.status)
r = await enq({ message: 'x'.repeat(3001) }, '10.0.0.2')
check('very long message refused', r.status === 400, r.status)
const before = (await q(`select count(*)::int n from "Inquiry"`))[0].n
r = await enq({ website: 'http://spam.example' }, '10.0.0.3')
const after = (await q(`select count(*)::int n from "Inquiry"`))[0].n
check('bots filling the hidden field are quietly ignored', r.status === 200 && after === before, `${r.status} ${before}→${after}`)
for (let i = 0; i < 4; i++) await enq({}, '10.0.0.9')
r = await enq({}, '10.0.0.9')
check('more than 5 enquiries an hour from one address: slowed down', (await enq({}, '10.0.0.9')).status === 429 || r.status === 429, r.status)
r = await enq({}, '10.0.0.10')
check('other visitors are unaffected', r.status === 200, r.status)

console.log('4. Viewing request instead of a deposit')
r = await enq({ kind: 'viewing', preferredDate: day(5), preferredTime: 'morning', viewingMode: 'in_person' }, '10.0.1.1')
check('viewing request accepted', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
const vr = (await q(`select kind, to_char("preferredDate",'YYYY-MM-DD') d, "preferredTime", "viewingMode" from "Inquiry" where id=$1`, [r.json?.id]))[0]
check('stored with date, time and mode', vr?.kind === 'viewing' && vr.d === day(5) && vr.preferredTime === 'morning' && vr.viewingMode === 'in_person', JSON.stringify(vr))
r = await enq({ kind: 'viewing', preferredDate: day(-1), preferredTime: 'morning', viewingMode: 'in_person' }, '10.0.1.2')
check('a past date is refused', r.status === 400, r.status)
r = await A.req('/admin/inquiries')
check('admin sees the viewing request with its details', r.html.includes('Viewing') && r.html.includes('Morning') && /in person/i.test(r.html), r.status)
r = await anon.req('/api/checkout', { method: 'POST', body: { listingId: VILLA.id, listingTitle: 'x', listingPrice: 1 } })
check('the old Stripe deposit endpoint is gone', [404, 405, 410].includes(r.status), r.status)
r = await anon.req(`/catalog/real-estate/${VILLA.slug}`); r = await anon.req(`/catalog/real-estate/${VILLA.slug}`)
check('listing page: no holding deposit, offers a viewing', !/Holding Deposit/i.test(r.html) && /Schedule a viewing/i.test(r.html))
check('listing page: no Stripe anywhere', !/stripe/i.test(r.html))
check('sticky bar does not say "Reserve" on a sale listing', !/>Reserve</.test(r.html))

console.log('5. Décor checkout with Paystack')
const order = (who, items, shipping = {}) => who.req('/api/orders', { method: 'POST', body: { items, shipping: { name: 'Grace Guest', email: G.email, phone: '+234 803 111 2222', address: '12 Ozumba Mbadiwe Avenue', city: 'Lagos', state: 'Lagos', country: 'Nigeria', ...shipping } } })
for (const qty of [0, -1, 1.5, 100]) {
  r = await order(G, [{ listingId: CHAIR.id, quantity: qty }])
  check(`quantity ${qty} refused`, r.status === 400, r.status)
}
r = await order(G, [{ listingId: VILLA.id, quantity: 1 }])
check('a non-décor listing cannot be bought in the cart', r.status === 400, r.status)
r = await order(G, [{ listingId: CHAIR.id, quantity: 2 }, { listingId: LAMP.id, quantity: 1 }])
check('order goes to Paystack', r.status === 200 && /paystack/.test(r.json?.url ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
const o = (await q(`select id, "paymentProvider", "paymentRef", total::text, currency, status from "Order" where email=$1 order by "createdAt" desc limit 1`, [G.email]))[0]
check('order stored in Naira, priced from the database', o?.paymentProvider === 'paystack' && /^ORD-/.test(o.paymentRef ?? '') && Number(o.total) === 2 * 850000 + 400000 && o.currency === 'NGN' && o.status === 'pending', JSON.stringify(o))
r = await webhook({ reference: o.paymentRef, status: 'success', amount: 100, currency: 'NGN', paid_at: new Date().toISOString(), channel: 'card' })
check('a payment for the wrong amount does not mark it paid', (await q(`select status from "Order" where id=$1`, [o.id]))[0].status === 'pending')
r = await webhook({ reference: o.paymentRef, status: 'success', amount: Math.round(Number(o.total) * 100), currency: 'NGN', paid_at: new Date().toISOString(), channel: 'card' })
check('the right payment marks the order paid', r.status === 200 && (await q(`select status from "Order" where id=$1`, [o.id]))[0].status === 'paid')
await webhook({ reference: o.paymentRef, status: 'success', amount: Math.round(Number(o.total) * 100), currency: 'NGN', paid_at: new Date().toISOString(), channel: 'card' })
const om = await waitMail(`select kind, "to" from "EmailLog" where kind in ('order_paid','order_new') and subject like $1`, [`%${o.paymentRef}%`], (rows) => rows.some((m) => m.kind === 'order_paid') && rows.some((m) => m.kind === 'order_new'))
check('buyer gets a receipt (once)', om.filter((m) => m.kind === 'order_paid' && m.to === G.email).length === 1, JSON.stringify(om))
check('team and the item’s partner told', om.some((m) => m.kind === 'order_new' && m.to === A.email) && om.some((m) => m.kind === 'order_new' && m.to === P.email))
r = await G.req(`/checkout/success?type=order&orderId=${o.id}&reference=${o.paymentRef}`)
check('success page confirms the paid order', r.status === 200 && /confirmed|thank you/i.test(r.html) && r.html.includes(o.paymentRef), r.status)
r = await anon.req('/checkout')
check('checkout page: no Stripe or USD charging (the Paystack line is checked in the browser test with items)', !/Stripe/.test(r.html) && !/processed in USD/.test(r.html))

console.log('6. Holds, uploads, AI and Discover')
const shorts = []
for (let i = 0; i < 4; i++) {
  const s = await ins(`Hold Test Stay ${i}`, 'real_estate', 'luxury_shortlets', 300000, null)
  await q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","maxUnits","maxGuests","instantBook","advanceNoticeHours","updatedAt") values ($1,true,'night',300000,0,0,1,14,4,true,0,now())`, [s.id])
  shorts.push(s)
}
const holds = []
for (let i = 0; i < 4; i++) holds.push(await G.req('/api/bookings', { method: 'POST', body: { listingId: shorts[i].id, start: day(30 + i * 3), end: day(32 + i * 3) } }))
check('three open holds at once are fine', holds.slice(0, 3).every((h) => h.status === 200), holds.map((h) => h.status).join(','))
check('a fourth open hold is refused with a clear reason', holds[3].status === 429 && /finish|complete|payment/i.test(holds[3].json?.error ?? ''), `${holds[3].status} ${JSON.stringify(holds[3].json)}`)
const f = new FormData(); f.append('file', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'x.html')
r = await P.req('/api/admin/upload', { method: 'POST', form: f })
check('uploading a web page as a photo is refused', r.status === 400, r.status)
const big = new FormData(); big.append('file', new Blob([Buffer.alloc(11 * 1024 * 1024)], { type: 'image/jpeg' }), 'big.jpg')
r = await P.req('/api/admin/upload', { method: 'POST', form: big })
check('photos over 10MB refused', r.status === 400 || r.status === 413, r.status)
await q('delete from "RateLimit"')
r = await anon.req('/api/ai/match', { method: 'POST', body: { preferences: { categories: ['decor'], budget: 'under_100m', location: ['lagos_island'], lifestyle: ['art'] } }, headers: { 'x-forwarded-for': '10.0.2.1' } })
check('Discover works without an AI provider (our own matching)', r.status === 200 && Array.isArray(r.json?.matches) && r.json.matches.length >= 1 && typeof r.json.summary === 'string', `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
check('matches come from the real catalogue', r.json?.matches?.every((m) => typeof m.slug === 'string' && m.category === 'decor'))
let last
for (let i = 0; i < 11; i++) last = await anon.req('/api/ai/match', { method: 'POST', body: { preferences: { categories: ['decor'] } }, headers: { 'x-forwarded-for': '10.0.2.2' } })
check('Discover is rate limited per visitor', last.status === 429, last.status)

console.log('7. Small fixes')
r = await anon.req('/forgot-password')
check('forgot-password has its own title', /<title>Forgot your password/.test(r.html), (r.html.match(/<title>[^<]*/) ?? [''])[0])
await A.req('/admin/agreements') // first visit warms the freshly built page
const t0 = Date.now()
r = await A.req('/admin/agreements')
const ms = Date.now() - t0
check('admin agreements page renders without a per-partner query storm', r.status === 200 && ms < 8000, `${r.status} ${ms}ms`)

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
