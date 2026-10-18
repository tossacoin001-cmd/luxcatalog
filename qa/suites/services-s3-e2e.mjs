// Private Services S3, end to end against a local build on :3300:
// session reminders from the daily job (once, paid sessions only, partner
// gets the address), "report a concern" (who is told, limits, resolving,
// partner never sees it), the stays lookup for the address prefill, and the
// shortlet cross-sell on stay pages and confirmation emails.
import { createHmac } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { AGREEMENTS } from './.agreements-list.generated.mjs'

const BASE = 'http://localhost:3300'
const SK = process.env.PAYSTACK_SECRET_KEY
if (!SK?.startsWith('sk_test_')) throw new Error('Test secret key required')
const MAIL = process.env.MAIL_DIR ?? fileURLToPath(new URL('../mail', import.meta.url))
const CRON = 'local-cron-secret-0123456789'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class Browser {
  constructor() { this.jar = new Map() }
  async req(path, { method = 'GET', body, headers = {}, raw } = {}) {
    const h = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers }
    if (body) h['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: h, body: raw ?? (body ? JSON.stringify(body) : undefined) })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const buf = Buffer.from(await res.arrayBuffer())
    let json = null; try { json = JSON.parse(buf.toString()) } catch {}
    return { status: res.status, json, html: buf.toString() }
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
  await sleep(600) // let the server finish its own sign-up writes first
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
const booking = (ref) => q(`select id, reference, status, "amountDue"::text due, "remindedAt" from "Booking" where reference=$1`, [ref]).then((r) => r[0])
const pay = async (ref) => { const b = await booking(ref); return webhook({ reference: ref, status: 'success', amount: Math.round(Number(b.due) * 100), currency: 'NGN', paid_at: new Date().toISOString(), channel: 'card' }) }
const lagosDay = (ms) => new Date(ms + 3_600_000).toISOString().slice(0, 10)
const addDays = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const instant = (day, time) => new Date(`${day}T${time}:00+01:00`).getTime()
// Newest debug email to a recipient (the local server writes each one to a file).
const mailTo = (email) => { const tag = email.replace(/[^a-z0-9]/gi, '_'); const f = readdirSync(MAIL).filter((n) => n.endsWith(`${tag}.html`)).sort(); return f.map((n) => readFileSync(`${MAIL}/${n}`, 'utf8')) }
const anon = new Browser()
let r

console.log('1. Setup')
const P = await account('Amaka Obi', `amaka.s3${stamp}@test.local`, 'partner')
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","contactName",collections,"updatedAt") values (gen_random_uuid(),$1,'service_professional','approved','Chef Amaka Kitchen','Amaka Obi',ARRAY['private_chef'],now())`, [P.id])
await q(`insert into "PartnerProfile" (id,"userId","brandName","updatedAt") values (gen_random_uuid(),$1,'Chef Amaka Kitchen',now())`, [P.id])
for (const a of AGREEMENTS) await q(`insert into "PartnerAgreement" (id,"userId","agreementKey",version,title,content,"contentHash","signedName","signerEmail","businessName") values (gen_random_uuid(),$1,$2,$3,$4,'{}','x','Amaka Obi',$5,'Chef Amaka Kitchen')`, [P.id, a.key, a.version, a.title, P.email])
const A = await account('Ada Admin', `ada.s3${stamp}@test.local`, 'admin')
const TB = await account('Tunde Bookings', `tunde.s3${stamp}@test.local`, 'team', ['bookings'])
const G = await account('Grace Guest', `grace.s3${stamp}@example.com`)
const H = await account('Henry Guest', `henry.s3${stamp}@example.com`)
const slug = `chef-amaka-s3-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),'Chef Amaka Private Dining',$1,'private_services','Private dinners at home.',45000,'₦45,000','Ikoyi, Lagos','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],'booking','private_chef',$2,true,now())`, [slug, P.id])
const L = (await q(`select id from "Listing" where slug=$1`, [slug]))[0].id
const allDay = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, { from: '00:00', to: '23:59' }]))
r = await P.req(`/api/admin/listings/${L}/services`, { method: 'PUT', body: { enabled: true, instantBook: true, cancellationPolicy: 'flexible', advanceNoticeHours: 0, bufferMinutes: 0, capacity: 5, workingHours: allDay, areas: [{ area: 'Ikoyi', fee: 0 }, { area: 'Victoria Island', fee: 5000 }], packages: [{ name: 'Dinner for two', description: 'Three courses.', durationMinutes: 60, pricing: 'fixed', price: 60000, minGuests: 1, maxGuests: 2 }] } })
const PKG = r.json?.settings?.packages?.[0]?.id
check('service set up for same-day booking', r.status === 200 && !!PKG, `${r.status} ${JSON.stringify(r.json).slice(0, 150)}`)
// A shortlet the guest will stay in.
const sslug = `ikoyi-loft-s3-${stamp}`
await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,"ownerId",published,"updatedAt") values (gen_random_uuid(),'Ikoyi Loft S3',$1,'real_estate','Test stay.',300000,'₦300,000','Ikoyi, Lagos','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],'booking','luxury_shortlets',null,true,now())`, [sslug])
const SL = (await q(`select id from "Listing" where slug=$1`, [sslug]))[0].id
await q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","maxUnits","maxGuests","instantBook","advanceNoticeHours","updatedAt") values ($1,true,'night',300000,0,0,1,14,4,true,0,now())`, [SL])

// Pick real free times: one 2–30 hours from now, one 3+ days out.
const today = lagosDay(Date.now())
r = await anon.req(`/api/listings/${L}/sessions?package=${PKG}&from=${today}&to=${addDays(today, 4)}`)
const all = Object.entries(r.json?.days ?? {}).flatMap(([d, ts]) => ts.map((t) => ({ d, t, at: instant(d, t) })))
const soon = all.filter((x) => x.at >= Date.now() + 2 * 3_600_000 && x.at <= Date.now() + 30 * 3_600_000)
const later = all.filter((x) => x.at >= Date.now() + 72 * 3_600_000)
check('free times found for the test', soon.length >= 4 && later.length >= 1, `${soon.length} ${later.length}`)
const sess = (slot, o = {}) => ({ listingId: L, session: { packageId: PKG, date: slot.d, time: slot.t, guests: 2, area: 'Victoria Island', address: '12 Ozumba Mbadiwe Avenue, Flat 4B, Victoria Island', notes: 'Shellfish allergy.', ...o } })
const book = async (who, slot, o) => (await who.req('/api/bookings', { method: 'POST', body: sess(slot, o) })).json?.reference
const NEAR = await book(G, soon[0]); await pay(NEAR)
const FAR = await book(G, later[0]); await pay(FAR)
const UNPAID = await book(H, soon[1])
const CANC = await book(H, soon[2]); await pay(CANC)
r = await H.req(`/api/bookings/${CANC}/cancel`, { method: 'POST', body: {} })
check('four sessions set up (near paid, far paid, unpaid, cancelled)', (await booking(NEAR))?.status === 'confirmed' && (await booking(FAR))?.status === 'confirmed' && (await booking(UNPAID))?.status === 'pending_payment' && (await booking(CANC))?.status === 'cancelled', [NEAR, FAR, UNPAID, CANC].join(','))

console.log('2. Reminders from the daily job')
r = await anon.req('/api/cron/daily')
check('the daily job needs its secret', r.status === 401, r.status)
r = await anon.req('/api/cron/daily', { headers: { authorization: `Bearer ${CRON}` } })
check('daily job runs', r.status === 200, `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
check('reports how many reminders went out', (r.json?.bookings?.remindersSent ?? 0) >= 1, JSON.stringify(r.json?.bookings))
const sent = await q(`select kind, "to", subject from "EmailLog" where kind in ('session_reminder','session_reminder_partner') and (subject like $1 or subject like $2 or subject like $3 or subject like $4)`, [`%${NEAR}%`, `%${FAR}%`, `%${UNPAID}%`, `%${CANC}%`])
check('guest reminded about the near session', sent.some((m) => m.kind === 'session_reminder' && m.to === G.email && m.subject.includes(NEAR)), JSON.stringify(sent))
check('partner reminded about it too', sent.some((m) => m.kind === 'session_reminder_partner' && m.to === P.email && m.subject.includes(NEAR)))
check('no reminder for the session 3+ days away (yet)', !sent.some((m) => m.subject.includes(FAR)))
check('no reminder for an unpaid or cancelled session', !sent.some((m) => m.subject.includes(UNPAID) || m.subject.includes(CANC)))
check('reminded time recorded on the booking', !!(await booking(NEAR)).remindedAt && !(await booking(FAR)).remindedAt)
const pMail = mailTo(P.email).find((h) => h.includes(NEAR) && /tomorrow|today|coming up/i.test(h))
check('partner reminder carries the address and notes', !!pMail && pMail.includes('Ozumba Mbadiwe') && pMail.includes('Shellfish allergy'))
const gMail = mailTo(G.email).find((h) => h.includes(NEAR) && /tomorrow|today|coming up/i.test(h))
check('guest reminder names who is coming and the time', !!gMail && gMail.includes('Chef Amaka Kitchen') && gMail.includes(soon[0].t), soon[0].t)
r = await anon.req('/api/cron/daily', { headers: { authorization: `Bearer ${CRON}` } })
const again = (await q(`select count(*)::int n from "EmailLog" where kind in ('session_reminder','session_reminder_partner') and subject like $1`, [`%${NEAR}%`]))[0].n
check('running the job again sends nothing twice', r.status === 200 && again === 2, again)

console.log('3. Report a concern')
const nb = await booking(NEAR)
const concern = (who, body, ref = NEAR) => who.req(`/api/bookings/${ref}/concern`, { method: 'POST', body })
r = await concern(anon, { kind: 'quality', message: 'The food arrived cold and late tonight.' })
check('signed-out visitors cannot report', r.status === 401, r.status)
r = await concern(H, { kind: 'quality', message: 'The food arrived cold and late tonight.' })
check('someone else’s booking: not found', r.status === 404, r.status)
r = await concern(G, { kind: 'rude', message: 'The food arrived cold and late tonight.' })
check('unknown kind refused', r.status === 400, r.status)
r = await concern(G, { kind: 'quality', message: 'bad' })
check('too short refused', r.status === 400, r.status)
const t0 = Date.now()
r = await concern(G, { kind: 'safety', message: 'The professional made inappropriate comments and I felt unsafe.' })
const took = Date.now() - t0
check('guest reports a safety concern', r.status === 200 && r.json?.ok === true, `${r.status} ${JSON.stringify(r.json)}`)
check('the guest gets an answer at once (alerts are sent after)', took < 5000, `${took}ms`)
const row = (await q(`select kind, status, message, "userId" from "BookingConcern" where "bookingId"=$1`, [nb.id]))[0]
check('stored as open', row?.kind === 'safety' && row.status === 'open' && row.userId === G.id && /unsafe/.test(row.message), JSON.stringify(row))
// Alerts go out just after the reply: wait for them (up to a minute).
let cm = []
for (let i = 0; i < 120; i++) {
  cm = await q(`select "to", subject from "EmailLog" where kind='booking_concern' and subject like $1`, [`%${NEAR}%`])
  if (cm.some((m) => m.to === A.email) && cm.some((m) => m.to === TB.email) && (await q(`select count(*)::int n from "EmailLog" where kind='booking_concern_received' and "to"=$1`, [G.email]))[0].n >= 1) break
  await sleep(500)
}
check('admin and bookings team told at once', cm.some((m) => m.to === A.email) && cm.some((m) => m.to === TB.email), JSON.stringify(cm))
check('safety reports are marked urgent', cm.every((m) => /urgent/i.test(m.subject)), JSON.stringify(cm))
check('the professional is not told', !cm.some((m) => m.to === P.email))
check('guest gets a receipt', (await q(`select count(*)::int n from "EmailLog" where kind='booking_concern_received' and "to"=$1`, [G.email]))[0].n === 1)
for (let i = 0; i < 4; i++) await concern(G, { kind: 'other', message: `Follow-up number ${i + 1} about this booking.` })
r = await concern(G, { kind: 'other', message: 'One more follow-up about this booking.' })
check('at most five reports per booking', r.status === 429, r.status)
r = await G.req(`/bookings/${NEAR}`)
check('guest page offers "Report a concern"', r.html.includes('Report a concern'))
r = await A.req('/admin/bookings?view=attention')
check('admin “needs attention” shows the concern', r.status === 200 && r.html.includes(NEAR) && r.html.includes('felt unsafe'), r.status)
r = await A.req('/admin/bookings')
check('admin sees an open-concerns banner', /open concern/i.test(r.html))
r = await P.req('/admin/bookings')
check('the professional never sees the report', r.html.includes(NEAR) && !r.html.includes('felt unsafe') && !/concern/i.test(r.html.replace(/Report a concern/g, '')))
const cid = (await q(`select id from "BookingConcern" where "bookingId"=$1 and kind='safety'`, [nb.id]))[0].id
r = await P.req(`/api/admin/bookings/${nb.id}`, { method: 'POST', body: { action: 'resolve_concern', concernId: cid, note: 'x' } })
check('the professional cannot resolve it', r.status === 403 || r.status === 404, r.status)
r = await TB.req(`/api/admin/bookings/${nb.id}`, { method: 'POST', body: { action: 'resolve_concern', concernId: cid, note: 'Called the guest; partner suspended pending review.' } })
check('bookings team resolves it with a note', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
const res = (await q(`select status, "resolvedById", "resolutionNote" from "BookingConcern" where id=$1`, [cid]))[0]
check('stored as resolved, by whom and why', res?.status === 'resolved' && res.resolvedById === TB.id && /suspended/.test(res.resolutionNote ?? ''), JSON.stringify(res))
check('resolution audited', (await q(`select count(*)::int n from "AuditLog" where action='booking.concern_resolved' and target=$1`, [cid]))[0].n === 1)

console.log('4. Stays lookup and cross-sell')
const stayStart = later[0].d
r = await G.req('/api/bookings', { method: 'POST', body: { listingId: SL, start: addDays(stayStart, -1), end: addDays(stayStart, 2) } })
const STAY = r.json?.reference
await pay(STAY)
check('guest has a confirmed stay', (await booking(STAY))?.status === 'confirmed', `${r.status} ${JSON.stringify(r.json)}`)
r = await G.req(`/api/bookings/stays?date=${stayStart}`)
check('stays lookup finds the stay covering that day', r.status === 200 && r.json?.stays?.length === 1 && r.json.stays[0].reference === STAY && r.json.stays[0].title === 'Ikoyi Loft S3' && r.json.stays[0].location === 'Ikoyi, Lagos', `${r.status} ${JSON.stringify(r.json)}`)
r = await G.req(`/api/bookings/stays?date=${addDays(stayStart, 2)}`)
check('check-out day is not a stay night', r.json?.stays?.length === 0, JSON.stringify(r.json))
r = await H.req(`/api/bookings/stays?date=${stayStart}`)
check('other guests see only their own stays', r.status === 200 && r.json?.stays?.length === 0)
r = await anon.req(`/api/bookings/stays?date=${stayStart}`)
check('signed out: refused', r.status === 401, r.status)
r = await G.req('/api/bookings/stays?date=nope')
check('bad date refused', r.status === 400, r.status)
r = await G.req(`/bookings/${STAY}`)
check('stay page: "Make your stay effortless" with Private Services', r.html.includes('Make your stay effortless') && r.html.includes('/catalog/private-services'))
r = await G.req(`/bookings/${NEAR}`)
check('session page does not cross-sell', !r.html.includes('Make your stay effortless'))
const stayMail = mailTo(G.email).find((h) => h.includes(STAY) && /confirmed/i.test(h))
check('stay confirmation email offers Private Services', !!stayMail && stayMail.includes('/catalog/private-services'))

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
