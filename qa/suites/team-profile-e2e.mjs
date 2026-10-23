// End-to-end: a team member keeps their own details (name, phone, payment
// method) and can change nothing else; the administrator can correct a
// member's details; only the administrator deletes enquiries.
// Written before the build (2026-10-22). Run from the repo dir (needs pg).
import { createHmac } from 'node:crypto'
import pg from 'pg'

const BASE = process.env.BASE ?? 'http://localhost:3300'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))

class Browser {
  constructor() { this.jar = new Map() }
  async req(path, { method = 'GET', body } = {}) {
    const headers = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') }
    if (body) headers['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers, body: body ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const text = Buffer.from(await res.arrayBuffer()).toString('utf8').replaceAll('<!-- -->', '')
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
const signUp = async (name, email) => { await q('delete from "RateLimit"'); const b = new Browser(); await b.req('/api/auth/sign-up/email', { method: 'POST', body: { name, email, password: pw } }); return b }
const enable2fa = async (b) => {
  const en = await b.req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
  await b.req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
}
const idOf = async (email) => (await q(`select id from "User" where email=$1`, [email]))[0].id
const row = async (email) => (await q(`select name, phone, role, permissions, email from "User" where email=$1`, [email]))[0]

console.log('Setup: an administrator, a team member (enquiries and orders), a partner, a customer')
await q('delete from "RateLimit"')
const adminEmail = `ada.tp${stamp}@test.local`
const A = await signUp('Ada Admin', adminEmail)
await q(`update "User" set role='admin' where email=$1`, [adminEmail]); await enable2fa(A)
const tEmail = `tola.tp${stamp}@test.local`
let r = await A.req('/api/admin/team', { method: 'POST', body: { email: tEmail, role: 'team', permissions: ['enquiries', 'orders'] } })
const T = await signUp('Tola Ojo', tEmail)
await T.req('/api/invitations/accept', { method: 'POST', body: { token: new URL(r.json.link).searchParams.get('token') } }); await enable2fa(T)
const tId = await idOf(tEmail)
const pEmail = `pat.tp${stamp}@test.local`
const P = await signUp('Pat Partner', pEmail); await q(`update "User" set role='partner' where email=$1`, [pEmail])
const C = await signUp('Chi Customer', `chi.tp${stamp}@test.local`)
const T2email = `femi.tp${stamp}@test.local`
const T2 = await signUp('Femi Other', T2email); await q(`update "User" set role='team', permissions=ARRAY['enquiries'] where email=$1`, [T2email]); await enable2fa(T2)

console.log('1. A team member edits their own name and phone')
r = await T.req('/api/team/profile')
check('can read their own profile', r.status === 200 && r.json?.profile?.name === 'Tola Ojo' && r.json.profile.email === tEmail, r)
r = await T.req('/api/team/profile', { method: 'PATCH', body: { name: '  Tola  Adeyemi ', phone: '0803 123 4567' } })
check('saves a corrected name and phone', r.status === 200 && r.json?.profile?.name === 'Tola Adeyemi', r)
let u = await row(tEmail)
check('the name is tidied (spaces) and stored', u.name === 'Tola Adeyemi', u)
check('the phone is stored in one standard form (+234…)', u.phone === '+2348031234567', u.phone)
r = await T.req('/api/team/profile', { method: 'PATCH', body: { phone: '+44 7700 900123' } })
check('an international number is accepted', r.status === 200 && (await row(tEmail)).phone === '+447700900123', r)
check('only the phone changed (name kept)', (await row(tEmail)).name === 'Tola Adeyemi')
r = await T.req('/api/team/profile', { method: 'PATCH', body: { phone: '12345' } })
check('a short or invalid phone is refused with a plain message', r.status === 400 && /phone/i.test(r.json?.error ?? ''), r)
r = await T.req('/api/team/profile', { method: 'PATCH', body: { name: 'A' } })
check('a one-letter name is refused', r.status === 400, r)
r = await T.req('/api/team/profile', { method: 'PATCH', body: { name: '<script>alert(1)</script>' } })
check('markup in a name is refused', r.status === 400, r)
r = await T.req('/api/team/profile', { method: 'PATCH', body: { name: 'x'.repeat(200) } })
check('an absurdly long name is refused', r.status === 400, r)
r = await T.req('/api/team/profile', { method: 'PATCH', body: {} })
check('an empty change is refused', r.status === 400, r)
check('every accepted change is in the audit log', (await q(`select count(*)::int n from "AuditLog" where "actorId"=$1 and action='team.profile.update'`, [tId]))[0].n >= 2)

console.log('2. Nothing else can be changed through it')
for (const [label, body] of [
  ['role', { name: 'Tola Adeyemi', role: 'admin' }],
  ['permissions', { permissions: ['listings', 'payouts'] }],
  ['email', { email: `evil${stamp}@test.local` }],
  ['id', { id: 'someone-else' }],
  ['emailVerified', { emailVerified: true }],
  ['twoFactorEnabled', { twoFactorEnabled: false }],
]) {
  r = await T.req('/api/team/profile', { method: 'PATCH', body })
  check(`${label} cannot be sent (refused)`, r.status === 400, r)
}
u = await row(tEmail)
check('role, areas and email are exactly as the administrator set them', u.role === 'team' && JSON.stringify(u.permissions) === '["enquiries","orders"]' && u.email === tEmail, u)
r = await T.req('/api/team/profile', { method: 'PATCH', body: { userId: await idOf(T2email), name: 'Hijacked' } })
check('cannot edit another person by sending their id', r.status === 400, r)
check('the other member is unchanged', (await row(T2email)).name === 'Femi Other')
r = await T.req('/api/admin/team', { method: 'PATCH', body: { userId: tId, role: 'admin' } })
check('cannot promote themselves through the admin route', r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400), `${r.status}`)
check('still a team member after the attempt', (await row(tEmail)).role === 'team')

console.log('3. Who may use it')
r = await new Browser().req('/api/team/profile', { method: 'PATCH', body: { name: 'Nobody Here' } })
check('signed-out visitors cannot', r.status === 401, `${r.status}`)
r = await C.req('/api/team/profile', { method: 'PATCH', body: { name: 'Customer Edit' } })
check('a customer cannot use the team route', r.status === 401 || r.status === 403, `${r.status}`)
r = await P.req('/api/team/profile', { method: 'PATCH', body: { name: 'Partner Edit' } })
check('a partner cannot use the team route (partners have their own brand profile)', r.status === 401 || r.status === 403, `${r.status}`)
r = await A.req('/api/team/profile', { method: 'PATCH', body: { name: 'Ada Administrator' } })
check('the administrator can edit their own details too', r.status === 200 && (await row(adminEmail)).name === 'Ada Administrator', r)

console.log('4. A team member adds a payment method (same bank check as partners)')
r = await T.req('/api/team/payout-account')
check('starts with none', r.status === 200 && r.json?.account === null, r)
r = await T.req('/api/team/payout-account', { method: 'POST', body: { bankCode: '', accountNumber: '123' } })
check('a bad account number is refused before asking the bank', r.status === 400, r)
r = await T.req('/api/team/payout-account', { method: 'PUT', body: { bankCode: '058', bankName: 'GTBank', accountNumber: 'abc' } })
check('saving a bad account is refused', r.status >= 400 && r.status < 500, r)
check('nothing was saved', (await q(`select 1 from "PayoutAccount" where "userId"=$1`, [tId])).length === 0)
r = await C.req('/api/team/payout-account')
check('a customer cannot read or set a payment method here', r.status === 401 || r.status === 403, `${r.status}`)
r = await new Browser().req('/api/team/payout-account')
check('signed-out visitors cannot', r.status === 401, `${r.status}`)
// A real bank check needs Paystack; it runs only when the test recipient is supplied.
if (process.env.TEST_BANK_CODE && process.env.TEST_ACCOUNT) {
  r = await T.req('/api/team/payout-account', { method: 'PUT', body: { bankCode: process.env.TEST_BANK_CODE, bankName: 'Test bank', accountNumber: process.env.TEST_ACCOUNT } })
  check('a real account is checked with the bank and saved, shown masked', r.status === 200 && /\*{4}|•/.test(JSON.stringify(r.json?.account ?? '')) && !JSON.stringify(r.json).includes(process.env.TEST_ACCOUNT), r)
} else console.log('  (skipped: set TEST_BANK_CODE and TEST_ACCOUNT to run the real bank check)')

console.log('5. The administrator can correct a member’s details (no need to remove and re-invite)')
await q(`update "User" set name='Tolla Ojo', phone='080' where email=$1`, [tEmail])
r = await A.req('/api/admin/team', { method: 'PATCH', body: { userId: tId, details: { name: 'Tola Ojo-Bello', phone: '07031234567' } } })
check('admin corrects name and phone', r.status === 200, r)
u = await row(tEmail)
check('stored (name and +234 phone)', u.name === 'Tola Ojo-Bello' && u.phone === '+2347031234567', u)
check('role and areas untouched by a details edit', u.role === 'team' && JSON.stringify(u.permissions) === '["enquiries","orders"]', u)
r = await A.req('/api/admin/team', { method: 'PATCH', body: { userId: tId, details: { name: '' } } })
check('an empty name is refused', r.status === 400, r)
r = await T2.req('/api/admin/team', { method: 'PATCH', body: { userId: tId, details: { name: 'Nope Nope' } } })
check('another team member cannot edit someone’s details', r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400), `${r.status}`)
check('audit log shows the administrator’s correction', (await q(`select count(*)::int n from "AuditLog" where action='team.member.details' and target=$1`, [tId]))[0].n >= 1)

console.log('6. Team members make no direct change to the platform')
r = await T.req('/api/admin/team', { method: 'POST', body: { email: `x${stamp}@test.local`, role: 'team' } })
check('cannot invite anyone', r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400), `${r.status}`)
r = await T.req('/api/admin/team', { method: 'DELETE', body: { type: 'member', id: await idOf(T2email) } })
check('cannot remove anyone', r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400), `${r.status}`)
check('the other member is still on the team', (await row(T2email)).role === 'team')
r = await T.req('/api/admin/listings', { method: 'POST', body: { title: 'Team sneaks a listing', category: 'decor', description: 'x', location: 'Lagos', country: 'Nigeria', price: 1000, images: ['https://example.com/a.jpg'] } })
check('without the Listings area cannot create a listing', r.status === 401 || r.status === 403, `${r.status}`)

console.log('7. Only the administrator deletes enquiries')
const mk = async (label) => (await q(`insert into "Inquiry" (id, name, email, message, kind, status) values (gen_random_uuid(), $1, $2, 'Test message for deleting', 'enquiry', $3::"InquiryStatus") returning id`, [label, `${label}${stamp}@example.com`, label.includes('closed') ? 'closed' : 'new']))[0].id
const e1 = await mk('delone'), e2 = await mk('closedone'), e3 = await mk('closedtwo'), e4 = await mk('keepnew')
r = await T.req('/api/admin/inquiries', { method: 'DELETE', body: { ids: [e1] } })
check('a team member with Enquiries access cannot delete', r.status === 401 || r.status === 403, `${r.status}`)
check('the enquiry is still there', (await q(`select 1 from "Inquiry" where id=$1`, [e1])).length === 1)
r = await C.req('/api/admin/inquiries', { method: 'DELETE', body: { ids: [e1] } })
check('a customer cannot delete', r.status === 401 || r.status === 403, `${r.status}`)
r = await A.req('/api/admin/inquiries', { method: 'DELETE', body: { ids: [e1] } })
check('the administrator deletes one', r.status === 200 && (await q(`select 1 from "Inquiry" where id=$1`, [e1])).length === 0, r)
r = await A.req('/api/admin/inquiries', { method: 'DELETE', body: { status: 'closed' } })
check('the administrator clears all closed enquiries', r.status === 200 && r.json?.deleted >= 2, r)
check('closed ones are gone', (await q(`select 1 from "Inquiry" where id = any($1)`, [[e2, e3]])).length === 0)
check('new ones are kept', (await q(`select 1 from "Inquiry" where id=$1`, [e4])).length === 1)
r = await A.req('/api/admin/inquiries', { method: 'DELETE', body: {} })
check('a request that names nothing deletes nothing (400)', r.status === 400, r)
r = await A.req('/api/admin/inquiries', { method: 'DELETE', body: { status: 'new' } })
check('"delete all new" is not allowed (only closed ones in bulk)', r.status === 400, r)
check('the new enquiry survived that request', (await q(`select 1 from "Inquiry" where id=$1`, [e4])).length === 1)
check('each deletion is in the audit log', (await q(`select count(*)::int n from "AuditLog" where action like 'enquiry.delete%'`))[0].n >= 2)

await db.end()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
