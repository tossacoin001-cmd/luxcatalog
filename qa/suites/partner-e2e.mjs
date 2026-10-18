// End-to-end: partner application journey + document privacy + admin review.
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
  async req(path, { method = 'GET', body, form } = {}) {
    const headers = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') }
    if (body) headers['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const buf = Buffer.from(await res.arrayBuffer())
    let json = null; try { json = JSON.parse(buf.toString()) } catch {}
    return { status: res.status, json, buf, location: res.headers.get('location'), headers: res.headers }
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
const pdf = (label) => new Blob([Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`)], { type: 'application/pdf' })
async function upload(b, kind, label, expiresAt) {
  const f = new FormData(); f.append('kind', kind); f.append('file', pdf(label), `${kind}.pdf`); if (expiresAt) f.append('expiresAt', expiresAt)
  return b.req('/api/partner-application/documents', { method: 'POST', form: f })
}

console.log('1. Landing + sign-in gate')
const anon = new Browser()
let r = await anon.req('/partners')
check('Become a Partner page renders', r.status === 200 && /Own something exceptional/.test(r.buf.toString()) && /Security company/.test(r.buf.toString()))
r = await anon.req('/partners/apply')
check('apply page sends signed-out visitors to sign-up', r.status >= 300 && /sign-up\?redirect_url=(%2F|\/)partners(%2F|\/)apply/.test(r.location ?? ''), `${r.status} ${r.location}`)
r = await anon.req('/api/partner-application', { method: 'PUT', body: { partnerType: 'fleet_owner' } })
check('API refuses signed-out saves', r.status === 401)

console.log('2. Draft + validation')
const a = new Browser()
const email = `tunde.fleet${stamp}@test.local`
await a.req('/api/auth/sign-up/email', { method: 'POST', body: { name: 'Tunde Bakare', email, password: pw } })
r = await a.req('/api/partner-application', { method: 'PUT', body: { partnerType: 'fleet_owner', legalForm: 'company', businessName: 'Bakare Prestige Cars', collections: ['car_rental', 'aqua_homes'] } })
check('draft created', r.status === 200 && r.json?.application?.status === 'draft', JSON.stringify(r.json).slice(0, 200))
check('collections outside the partner type are dropped', JSON.stringify(r.json?.application?.collections) === '["car_rental"]', JSON.stringify(r.json?.application?.collections))
r = await a.req('/api/partner-application/submit', { method: 'POST' })
check('incomplete submit rejected with a list of what is missing', r.status === 400 && r.json?.missing?.length >= 5, JSON.stringify(r.json?.missing))
check('missing list includes CAC for companies and hire insurance', r.json?.missing?.some((m) => /CAC/.test(m)) && r.json?.missing?.some((m) => /insurance/i.test(m)))

console.log('3. Documents')
let f = new FormData(); f.append('kind', 'government_id'); f.append('file', new Blob([Buffer.from('MZ fake exe')], { type: 'application/x-msdownload' }), 'id.exe')
r = await a.req('/api/partner-application/documents', { method: 'POST', form: f })
check('non-PDF/photo upload refused', r.status === 400, r.status)
r = await upload(a, 'nscdc_licence', 'wrong kind')
check('document kind from another partner type refused', r.status === 400, r.status)
for (const [kind, exp] of [['government_id'], ['cac_certificate'], ['vehicle_papers'], ['hire_insurance', '2027-06-30'], ['roadworthiness', '2027-01-31']]) {
  r = await upload(a, kind, `${kind} v1`, exp)
  check(`upload ${kind}`, r.status === 200 && r.json?.document?.kind === kind, `${r.status} ${JSON.stringify(r.json).slice(0, 150)}`)
}
r = await upload(a, 'government_id', 'government_id v2')
const govId = r.json?.document?.id
const govCount = (await q(`select count(*)::int n from "PartnerDocument" d join "PartnerApplication" a on a.id=d."applicationId" join "User" u on u.id=a."userId" where u.email=$1 and d.kind='government_id'`, [email]))[0].n
check('re-uploading replaces the previous file (one per kind)', govCount === 1, govCount)
const storage = (await q(`select storage from "PartnerDocument" where id=$1`, [govId]))[0]?.storage
console.log(`     stored via: ${storage} (local has no Blob credentials, so the database fallback is exercised)`)
r = await a.req(`/api/partner-documents/${govId}`)
check('applicant can open their own document', r.status === 200 && r.buf.toString().includes('government_id v2'), r.status)
check('document response is never cached', /no-store/.test(r.headers.get('cache-control') ?? ''))
const stranger = new Browser()
await stranger.req('/api/auth/sign-up/email', { method: 'POST', body: { name: 'Mallory', email: `mallory${stamp}@test.local`, password: pw } })
r = await stranger.req(`/api/partner-documents/${govId}`)
check('another signed-in user cannot open it (404, not even confirming it exists)', r.status === 404, r.status)
r = await anon.req(`/api/partner-documents/${govId}`)
check('signed-out visitor cannot open it', r.status === 401, r.status)

console.log('4. Submit')
await a.req('/api/partner-application', { method: 'PUT', body: { contactName: 'Tunde Bakare', phone: '+234 803 000 0000', city: 'Lagos', cacNumber: 'RC 1234567', about: 'Chauffeur-driven luxury fleet: Range Rover, Maybach and G-Wagon, serving Lagos Island and Lekki since 2019.' } })
r = await a.req('/api/partner-application/submit', { method: 'POST' })
check('still blocked until standards are accepted', r.status === 400 && r.json?.missing?.every((m) => m.startsWith('Accept')), JSON.stringify(r.json?.missing))
await a.req('/api/partner-application', { method: 'PUT', body: { declarations: { accurate: true, standards: true, no_circumvention: true, maintained: true } } })
r = await a.req('/api/partner-application/submit', { method: 'POST' })
check('complete application submits', r.status === 200 && r.json?.status === 'submitted', JSON.stringify(r.json))
const decl = (await q(`select declarations from "PartnerApplication" a join "User" u on u.id=a."userId" where u.email=$1`, [email]))[0].declarations
check('each declaration stored with the time it was accepted', Object.values(decl).every((t) => !Number.isNaN(Date.parse(t))) && Object.keys(decl).length === 4, JSON.stringify(decl))
r = await a.req('/api/partner-application', { method: 'PUT', body: { businessName: 'Changed after submit' } })
check('application locked while under review', r.status === 409, r.status)
r = await upload(a, 'driver_licences', 'late upload', '2027-01-01')
check('documents locked while under review', r.status === 409, r.status)
// Emails go out just after the reply: wait for the receipt (up to 30s).
let mails = []
for (let i = 0; i < 60; i++) {
  mails = await q(`select kind, "to" from "EmailLog" where kind like 'partner_application%' and "createdAt" > now() - interval '5 minutes'`)
  if (mails.some((m) => m.kind === 'partner_application_received' && m.to === email)) break
  await new Promise((res) => setTimeout(res, 500))
}
check('applicant got a "received" email', mails.some((m) => m.kind === 'partner_application_received' && m.to === email), JSON.stringify(mails))

console.log('5. Admin review')
const admin = new Browser()
const adminEmail = `ada.review${stamp}@test.local`
await admin.req('/api/auth/sign-up/email', { method: 'POST', body: { name: 'Ada Admin', email: adminEmail, password: pw } })
await q(`update "User" set role='admin' where email=$1`, [adminEmail])
const en = await admin.req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
await admin.req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
const appId = (await q(`select a.id from "PartnerApplication" a join "User" u on u.id=a."userId" where u.email=$1`, [email]))[0].id
r = await a.req(`/api/admin/applications/${appId}`, { method: 'POST', body: { action: 'approve' } })
check('applicant cannot approve themselves', r.status === 401, r.status)
r = await admin.req('/admin/applications')
check('admin review queue lists the application', r.status === 200 && r.buf.toString().includes('Bakare Prestige Cars'), r.status)
r = await admin.req(`/admin/applications/${appId}`)
check('admin detail page renders documents and declarations', r.status === 200 && /Insurance covering hire/.test(r.buf.toString()) && /Accepted/.test(r.buf.toString()), r.status)
r = await admin.req(`/api/partner-documents/${govId}`)
check('admin can open the document', r.status === 200, r.status)
const viewed = (await q(`select count(*)::int n from "AuditLog" where action='partner_document.view' and target=$1`, [govId]))[0].n
check('admin document view written to the audit log', viewed >= 1)
r = await admin.req(`/api/admin/applications/${appId}`, { method: 'POST', body: { action: 'request_info' } })
check('asking for more info requires a message', r.status === 400)
r = await admin.req(`/api/admin/applications/${appId}`, { method: 'POST', body: { action: 'request_info', note: 'Please upload the roadworthiness certificate for the Maybach as well.' } })
check('admin requests more info', r.status === 200 && r.json?.status === 'info_requested', JSON.stringify(r.json))
r = await a.req('/api/partner-application')
check('applicant sees the request', r.json?.application?.status === 'info_requested' && /Maybach/.test(r.json?.application?.reviewNote ?? ''))
r = await upload(a, 'roadworthiness', 'roadworthiness v2 with Maybach', '2027-03-31')
check('applicant can upload again once info is requested', r.status === 200, r.status)
r = await a.req('/api/partner-application/submit', { method: 'POST' })
check('applicant resubmits', r.status === 200 && r.json?.status === 'submitted')
r = await admin.req(`/api/admin/applications/${appId}`, { method: 'POST', body: { action: 'note', note: 'Called Tunde 10:40, confirmed fleet in Lekki.' } })
check('private admin note saved', r.status === 200)
r = await admin.req(`/api/admin/applications/${appId}`, { method: 'POST', body: { action: 'approve', note: 'Welcome aboard.' } })
check('admin approves', r.status === 200 && r.json?.status === 'approved', JSON.stringify(r.json))
const u = (await q(`select role from "User" where email=$1`, [email]))[0]
check('applicant is now a partner', u.role === 'partner', u.role)
const prof = (await q(`select "brandName" from "PartnerProfile" p join "User" u on u.id=p."userId" where u.email=$1`, [email]))[0]
check('partner profile created with their brand name', prof?.brandName === 'Bakare Prestige Cars', JSON.stringify(prof))
r = await a.req('/api/partner-application')
check('applicant never sees private admin notes', !JSON.stringify(r.json).includes('Called Tunde'))
r = await a.req('/admin')
check('new partner must set up 2FA before the dashboard', /setup=2fa/.test(r.location ?? ''), r.location)
const decisions = await q(`select kind from "EmailLog" where "to"=$1 and kind like 'partner_application_%' order by "createdAt"`, [email])
check('applicant emailed for each step (received, info, received, approved)', decisions.map((d) => d.kind).join(',') === 'partner_application_received,partner_application_info_requested,partner_application_received,partner_application_approved', decisions.map((d) => d.kind).join(','))

await db.end()
console.log(`\n${pass} passed, ${fail} failed`)
