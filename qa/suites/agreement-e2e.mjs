// End-to-end: partner agreements (Step 3). Run from the repo dir (needs pg).
import { createHmac, createHash } from 'node:crypto'
import pg from 'pg'

const BASE = process.env.BASE ?? 'http://localhost:3300'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)))

class Browser {
  constructor() { this.jar = new Map() }
  async req(path, { method = 'GET', body } = {}) {
    const headers = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), 'user-agent': 'agreement-e2e/1.0' }
    if (body) headers['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const buf = Buffer.from(Buffer.from(await res.arrayBuffer()).toString('latin1').replaceAll('<!-- -->', ''), 'latin1')
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
async function account(name, email, role) {
  const b = new Browser()
  await b.req('/api/auth/sign-up/email', { method: 'POST', body: { name, email, password: pw } })
  if (role) await q(`update "User" set role=$2 where email=$1`, [email, role])
  if (role) {
    const en = await b.req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
    await b.req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
  }
  return b
}
const hashesFrom = (html) => [...html.matchAll(/hash\\?":\\?"([0-9a-f]{64})/g)].map((m) => m[1])

console.log('1. Setup')
const partnerEmail = `femi.fleet${stamp}@test.local`
const P = await account('Femi Adeyemi', partnerEmail, 'partner')
const uid = (await q(`select id from "User" where email=$1`, [partnerEmail]))[0].id
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"legalForm","businessName","contactName",phone,city,country,collections,about,"updatedAt") values (gen_random_uuid(),$1,'fleet_owner','approved','company','Adeyemi Prestige Cars','Femi Adeyemi','+2348000000000','Lagos','Nigeria',ARRAY['car_rental'],'Fleet of chauffeur-driven luxury cars.',now())`, [uid])
await q(`insert into "PartnerProfile" (id,"userId","brandName","updatedAt") values (gen_random_uuid(),$1,'Adeyemi Prestige Cars',now())`, [uid])
const A = await account('Ada Admin', `ada.agr${stamp}@test.local`, 'admin')
const C = await account('Chi Customer', `chi.cust${stamp}@test.local`, null)
const anon = new Browser()
check('partner, admin and customer accounts ready', true)

console.log('2. Gate before signing')
let r = await P.req('/admin')
check('partner dashboard sends them to sign first', r.status >= 300 && /\/partners\/agreement/.test(r.location ?? ''), `${r.status} ${r.location}`)
r = await P.req('/admin/listings/new')
check('new-listing page sends them to sign first', r.status >= 300 && /\/partners\/agreement/.test(r.location ?? ''), `${r.status} ${r.location}`)
r = await P.req('/api/admin/listings', { method: 'POST', body: { title: 'Maybach S580', category: 'car', description: 'x', location: 'Lagos', country: 'Nigeria', images: ['https://example.com/a.jpg'] } })
check('listing API refuses unsigned partner (403)', r.status === 403 && r.json?.signUrl === '/partners/agreement', `${r.status} ${JSON.stringify(r.json)}`)

console.log('3. Agreement page')
r = await anon.req('/partners/agreement')
check('signed-out visitor sent to sign in', r.status >= 300 && /sign-in/.test(r.location ?? ''), `${r.status} ${r.location}`)
r = await C.req('/partners/agreement')
check('customer (not a partner) sent to apply', r.status >= 300 && /partners\/apply/.test(r.location ?? ''), `${r.status} ${r.location}`)
r = await A.req('/partners/agreement')
check('admin sent to the admin agreements page', r.status >= 300 && /admin\/agreements/.test(r.location ?? ''), `${r.status} ${r.location}`)
r = await P.req('/partners/agreement')
const html = r.buf.toString()
check('partner sees the agreement page', r.status === 200 && /Sign your partner agreement/.test(html), `${r.status}`)
check('master agreement and vehicle schedule shown', /Partner Agreement/.test(html) && /Schedule B: Vehicle Rental/.test(html))
check('no other schedules shown', !/Schedule E: Close Protection/.test(html) && !/Schedule A: Short-let/.test(html))
check('partner and business named in the text', /Adeyemi Prestige Cars, represented by Femi Adeyemi/.test(html))
check('their commission rate is in the text', /Private Car Rental: 18% commission/.test(html))
const [masterHash, scheduleHash] = hashesFrom(html)
check('page carries the text fingerprints', !!masterHash && !!scheduleHash && masterHash !== scheduleHash)

console.log('4. Signing rules')
r = await C.req('/api/partner-agreements', { method: 'POST', body: { key: 'master', hash: masterHash, signedName: 'Chi Customer', agree: true } })
check('customer cannot sign (403)', r.status === 403, `${r.status}`)
r = await anon.req('/api/partner-agreements', { method: 'POST', body: { key: 'master', hash: masterHash, signedName: 'A B', agree: true } })
check('signed-out cannot sign (401)', r.status === 401, `${r.status}`)
r = await P.req('/api/partner-agreements', { method: 'POST', body: { key: 'master', hash: masterHash, signedName: 'Femi Adeyemi' } })
check('must tick "I agree"', r.status === 400, `${r.status}`)
r = await P.req('/api/partner-agreements', { method: 'POST', body: { key: 'master', hash: masterHash, signedName: 'Femi', agree: true } })
check('single name refused (full legal name needed)', r.status === 400, `${r.status}`)
r = await P.req('/api/partner-agreements', { method: 'POST', body: { key: 'master', hash: 'f'.repeat(64), signedName: 'Femi Adeyemi', agree: true } })
check('text changed since it was shown: refused (409)', r.status === 409, `${r.status}`)
r = await P.req('/api/partner-agreements', { method: 'POST', body: { key: 'schedule_security', hash: masterHash, signedName: 'Femi Adeyemi', agree: true } })
check('schedule for another partner type refused', r.status === 404, `${r.status}`)

console.log('5. Sign')
r = await P.req('/api/partner-agreements', { method: 'POST', body: { key: 'master', hash: masterHash, signedName: '  Femi   Adeyemi ', agree: true } })
check('master agreement signed', r.status === 200 && r.json?.signed?.signedName === 'Femi Adeyemi', `${r.status} ${JSON.stringify(r.json)}`)
const masterId = r.json?.signed?.id
r = await P.req('/api/admin/listings', { method: 'POST', body: { title: 'x', category: 'car', description: 'x', location: 'Lagos', country: 'Nigeria', images: ['https://example.com/a.jpg'] } })
check('still gated until the schedule is signed too', r.status === 403, `${r.status}`)
r = await P.req('/api/partner-agreements', { method: 'POST', body: { key: 'schedule_vehicle', hash: scheduleHash, signedName: 'Femi Adeyemi', agree: true } })
check('vehicle schedule signed', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
const schedId = r.json?.signed?.id
r = await P.req('/api/partner-agreements', { method: 'POST', body: { key: 'master', hash: masterHash, signedName: 'Femi Adeyemi', agree: true } })
check('signing twice keeps one record', r.status === 200 && r.json?.signed?.id === masterId)

const rows = await q(`select * from "PartnerAgreement" where "userId"=$1 order by "signedAt"`, [uid])
check('two signature records stored', rows.length === 2, `${rows.length}`)
const m = rows.find((x) => x.agreementKey === 'master')
check('stored text re-hashes to the fingerprint that was signed', m && createHash('sha256').update(m.content).digest('hex') === m.contentHash && m.contentHash === masterHash)
check('record keeps email, business, device', m?.signerEmail === partnerEmail && m?.businessName === 'Adeyemi Prestige Cars' && m?.userAgent === 'agreement-e2e/1.0')
check('IP column present (local requests have none)', m && 'ipAddress' in m)
const audits = await q(`select count(*)::int n from "AuditLog" where action='partner_agreement.sign' and "actorId"=$1`, [uid])
check('each signature written to the audit log', audits[0].n === 2, `${audits[0].n}`)
const mails = await q(`select count(*)::int n from "EmailLog" where kind='partner_agreement_signed' and "userId"=$1`, [uid])
check('signed copy emailed for each', mails[0].n === 2, `${mails[0].n}`)

console.log('6. After signing')
r = await P.req('/partners/agreement')
check('page now shows both signed, with "all set"', /Your partner agreement/.test(r.buf.toString()) && /all set/.test(r.buf.toString()) && /Signed by Femi Adeyemi/.test(r.buf.toString()))
r = await P.req('/admin')
check('dashboard opens', r.status === 200, `${r.status} ${r.location}`)
r = await P.req('/admin/listings/new')
check('new-listing page opens', r.status === 200, `${r.status} ${r.location}`)
r = await P.req('/api/admin/listings', { method: 'POST', body: { title: `Agreement test car ${stamp}`, category: 'car', subcategory: 'car_rental', description: 'Chauffeur-driven Maybach.', location: 'Lagos', country: 'Nigeria', images: ['https://example.com/a.jpg'] } })
check('listing API no longer blocks the partner', r.status !== 403, `${r.status} ${JSON.stringify(r.json)?.slice(0, 200)}`)

console.log('7. Signed copies')
r = await P.req(`/api/partner-agreements/${masterId}/pdf`)
check('partner downloads signed PDF', r.status === 200 && r.headers.get('content-type') === 'application/pdf' && r.buf.subarray(0, 5).toString() === '%PDF-', `${r.status} ${r.headers.get('content-type')}`)
check('PDF never cached', /no-store/.test(r.headers.get('cache-control') ?? ''))
check('PDF is a real document (> 3KB)', r.buf.length > 3000, `${r.buf.length}`)
r = await C.req(`/api/partner-agreements/${masterId}/pdf`)
check('another user cannot open it (404)', r.status === 404, `${r.status}`)
r = await anon.req(`/api/partner-agreements/${masterId}/pdf`)
check('signed-out cannot open it (401)', r.status === 401, `${r.status}`)
r = await A.req(`/api/partner-agreements/${schedId}/pdf`)
check('admin can open it', r.status === 200, `${r.status}`)

console.log('8. Admin')
r = await A.req('/admin/agreements')
const ah = r.buf.toString()
const keys = new Set([...ah.matchAll(/api\/admin\/agreements\/([a-z_]+)\/pdf/g)].map((x) => x[1]))
check('admin agreements page lists every text (8 + Schedule H)', r.status === 200 && keys.size === 9 && keys.has('schedule_services'), `${r.status} ${[...keys]}`)
check('admin sees lawyer-review notice', /awaiting your lawyer/.test(ah))
check('admin sees the partner as all signed', /Adeyemi Prestige Cars/.test(ah) && /All signed/.test(ah))
r = await A.req('/api/admin/agreements/master/pdf')
check('admin downloads review copy for the lawyer', r.status === 200 && r.buf.subarray(0, 5).toString() === '%PDF-', `${r.status}`)
r = await P.req('/api/admin/agreements/master/pdf')
check('partner cannot download review copies', r.status === 401, `${r.status}`)
r = await A.req('/api/admin/agreements/nope/pdf')
check('unknown template 404', r.status === 404, `${r.status}`)

console.log('9. New version must be re-signed')
await q(`update "PartnerAgreement" set version='0.9' where id=$1`, [masterId])
r = await P.req('/admin')
check('after an update the dashboard asks to sign again', r.status >= 300 && /\/partners\/agreement/.test(r.location ?? ''), `${r.status}`)
r = await P.req('/partners/agreement')
check('page explains the agreement was updated', /since you signed version 0.9/.test(r.buf.toString()))
check('old signed record still kept', (await q(`select count(*)::int n from "PartnerAgreement" where id=$1`, [masterId]))[0].n === 1)

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
