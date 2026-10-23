// A sweep for loopholes through the real API on the local build (T-015),
// written 2026-10-23. For every private route: signed-out visitors, customers,
// partners and team members without the right area are turned away (never a
// 200, never a crash); scheduled jobs and the payment webhook refuse callers
// without the secret; private files stay private; sign-up cannot grant a role;
// pages carry basic protective headers; markup in the address is never echoed;
// repeated wrong passwords are slowed down; and a wrong email and a wrong
// password look the same.
import { createHmac } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import pg from 'pg'

const BASE = process.env.BASE ?? 'http://localhost:3300'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x).slice(0, 300)}`)))

class Browser {
  constructor() { this.jar = new Map() }
  async req(path, { method = 'GET', body, headers = {}, ip } = {}) {
    const h = { origin: BASE, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '), ...headers }
    if (ip) h['x-forwarded-for'] = ip
    if (body !== undefined) h['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: h, body: body !== undefined ? JSON.stringify(body) : undefined })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const text = Buffer.from(await res.arrayBuffer()).toString('utf8')
    let json = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text, headers: res.headers, location: res.headers.get('location') }
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
const signUp = async (name, email, extra = {}) => { await q('delete from "RateLimit"'); const b = new Browser(); const r = await b.req('/api/auth/sign-up/email', { method: 'POST', body: { name, email, password: pw, ...extra } }); b.signup = r; return b }
const secure = async (b) => {
  const en = await b.req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
  await b.req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
}
const denied = (r) => r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400)

console.log('Setup: a signed-out visitor, a customer, a partner, a team member with only the Orders area, an administrator')
const anon = new Browser()
const customer = await signUp('Chi Customer', `chi.sec${stamp}@test.local`)
const partnerEmail = `pat.sec${stamp}@test.local`
const partner = await signUp('Pat Partner', partnerEmail); await q(`update "User" set role='partner' where email=$1`, [partnerEmail])
const teamEmail = `tim.sec${stamp}@test.local`
const team = await signUp('Tim Team', teamEmail); await q(`update "User" set role='team', permissions=ARRAY['orders'] where email=$1`, [teamEmail]); await secure(team)
const adminEmail = `ada.sec${stamp}@test.local`
const admin = await signUp('Ada Admin', adminEmail); await q(`update "User" set role='admin' where email=$1`, [adminEmail]); await secure(admin)

// ---- Every private route, from the files themselves, so a new route cannot be forgotten ----
const root = join(process.cwd(), 'src/app/api')
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : n === 'route.ts' ? [p] : [] })
const routes = walk(root).map((f) => {
  const src = readFileSync(f, 'utf8')
  const path = '/' + relative(join(process.cwd(), 'src/app'), f).replace(/\\/g, '/').replace(/\/route\.ts$/, '')
  const methods = [...new Set([...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]).concat([...src.matchAll(/export const \{([^}]*)\}/g)].flatMap((m) => m[1].match(/GET|POST|PUT|PATCH|DELETE/g) ?? [])))]
  return { path: path.replace(/\[\.\.\.all\]/, 'x').replace(/\[[^\]]+\]/g, '00000000-0000-4000-8000-000000000000'), raw: path, methods }
})
check(`found the API routes to sweep (${routes.length})`, routes.length >= 40, routes.length)
const PUBLIC = [/^\/api\/auth\//, /^\/api\/health$/, /^\/api\/fx-rate$/, /^\/api\/turnstile-config$/, /^\/api\/lux$/, /^\/api\/ai\/match$/, /^\/api\/track\/view$/, /^\/api\/unsubscribe$/, /^\/api\/inquiries$/, /^\/api\/listings\//, /^\/api\/cron\//, /^\/api\/paystack\/webhook$/, /^\/api\/invitations\/accept$/, /^\/api\/bookings$/, /^\/api\/bookings\/stays$/, /^\/api\/orders$/]
const privateRoutes = routes.filter((r) => !PUBLIC.some((p) => p.test(r.raw)))
const body = { x: 1 }

console.log('1. Signed-out visitors are turned away from every private route')
const bad1 = []
// A few routes are open by design and safe: the saved list answers a visitor with an empty list (hearts ask for sign-in), and the document upload route does not exist when storage is not set up (404).
const OPEN_BY_DESIGN = (r, m, x) => (r.raw === '/api/saved' && m === 'GET' && x.status === 200 && Array.isArray(x.json?.savedIds) && x.json.savedIds.length === 0) || (/presign/.test(r.raw) && x.status === 404)
for (const r of privateRoutes) for (const m of r.methods) {
  const x = await anon.req(r.path, { method: m, body: m === 'GET' || m === 'DELETE' ? undefined : body })
  if (!denied(x) && !OPEN_BY_DESIGN(r, m, x)) bad1.push(`${m} ${r.raw} -> ${x.status} ${JSON.stringify(x.json ?? x.text.slice(0, 80)).slice(0, 80)}`)
}
check(`all ${privateRoutes.length} private routes refuse a signed-out visitor`, bad1.length === 0, bad1.slice(0, 8))

console.log('2. Customers are turned away from admin, team and partner routes')
const bad2 = []
for (const r of privateRoutes.filter((r) => /^\/api\/(admin|team|partner(?=\/)|partner-agreements)/.test(r.raw))) for (const m of r.methods) {
  const x = await customer.req(r.path, { method: m, body: m === 'GET' || m === 'DELETE' ? undefined : body })
  if (!denied(x) && !(x.status === 404)) bad2.push(`${m} ${r.raw} -> ${x.status}`)
}
check('every admin, team and partner route refuses a customer', bad2.length === 0, bad2.slice(0, 8))

console.log('3. Partners cannot reach what is only for the team')
const TEAM_ONLY = [/^\/api\/admin\/team/, /^\/api\/admin\/inquiries/, /^\/api\/admin\/email-tools/, /^\/api\/admin\/applications/, /^\/api\/admin\/partners/, /^\/api\/admin\/orders/, /^\/api\/admin\/payouts/, /^\/api\/admin\/refunds/, /^\/api\/admin\/bookings/, /^\/api\/admin\/agreements/, /^\/api\/team\//]
const bad3 = []
for (const r of privateRoutes.filter((r) => TEAM_ONLY.some((p) => p.test(r.raw)))) for (const m of r.methods) {
  const x = await partner.req(r.path, { method: m, body: m === 'GET' || m === 'DELETE' ? undefined : body })
  if (!denied(x)) bad3.push(`${m} ${r.raw} -> ${x.status}`)
}
check('a partner is refused on every team-only route', bad3.length === 0, bad3.slice(0, 8))
const inqGet = await partner.req('/api/inquiries'), inqPatch = await partner.req('/api/inquiries/00000000-0000-4000-8000-000000000000', { method: 'PATCH', body: { status: 'closed' } })
check('a partner cannot read or change enquiries', denied(inqGet) && denied(inqPatch), [inqGet.status, inqPatch.status])

console.log('4. A team member sees only the areas they were given (Orders only here)')
const bad4 = []
for (const [path, method, b] of [
  ['/api/admin/team', 'GET'], ['/api/admin/team', 'POST', { email: 'x@y.com', role: 'team' }], ['/api/admin/team', 'PATCH', { userId: 'x', role: 'team' }], ['/api/admin/team', 'DELETE', { type: 'member', id: 'x' }],
  ['/api/admin/inquiries', 'DELETE', { status: 'closed' }], ['/api/inquiries', 'GET'], ['/api/inquiries/00000000-0000-4000-8000-000000000000', 'PATCH', { status: 'closed' }],
  ['/api/admin/email-tools', 'POST', { action: 'consent_preview' }], ['/api/admin/applications/00000000-0000-4000-8000-000000000000', 'POST', { action: 'approve' }],
  ['/api/admin/partners/00000000-0000-4000-8000-000000000000', 'PATCH', {}], ['/api/admin/payouts/00000000-0000-4000-8000-000000000000', 'POST', { action: 'approve' }],
  ['/api/admin/refunds/00000000-0000-4000-8000-000000000000', 'POST', { action: 'approve' }], ['/api/admin/bookings/00000000-0000-4000-8000-000000000000', 'POST', { action: 'cancel', reason: 'a long enough reason' }],
  ['/api/admin/listings', 'POST', { title: 'x' }], ['/api/admin/upload', 'POST', {}],
]) {
  const x = await team.req(path, { method, body: b })
  if (!denied(x)) bad4.push(`${method} ${path} -> ${x.status}`)
}
check('a team member is refused everywhere outside their areas', bad4.length === 0, bad4)
const ordersOk = await team.req('/api/admin/orders/00000000-0000-4000-8000-000000000000', { method: 'PATCH', body: { status: 'cancelled' } })
check('and is not locked out of their own area (Orders: reaches the handler, not a refusal)', !(ordersOk.status === 401 || ordersOk.status === 403), ordersOk.status)
const t1 = await team.req('/admin/team'), t2 = await team.req('/admin/listings'), t3 = await team.req('/admin/inquiries')
check('the admin pages outside their areas redirect them away', denied(t1) && denied(t2) && denied(t3), [t1.status, t2.status, t3.status])

console.log('5. Pages: signed-out and customers are sent away from private pages')
const pages = ['/admin', '/admin/team', '/admin/inquiries', '/admin/listings', '/admin/orders', '/admin/payouts', '/admin/profile', '/dashboard', '/account', '/saved']
const badPages = []
for (const p of pages) { const a = await anon.req(p); if (!(a.status >= 300 && a.status < 400)) badPages.push(`anon ${p} ${a.status}`) }
for (const p of pages.filter((x) => x.startsWith('/admin'))) { const c = await customer.req(p); if (!(c.status >= 300 && c.status < 400)) badPages.push(`customer ${p} ${c.status}`) }
check('private pages redirect visitors who are not allowed', badPages.length === 0, badPages)

console.log('6. Scheduled jobs and the payment webhook refuse strangers')
for (const m of ['GET', 'POST']) {
  const a = await anon.req('/api/cron/daily', { method: m, body: m === 'POST' ? {} : undefined }), b = await anon.req('/api/cron/daily', { method: m, headers: { authorization: 'Bearer wrong-secret' }, body: m === 'POST' ? {} : undefined })
  check(`${m} /api/cron/daily: no secret and a wrong secret are both refused`, denied(a) && denied(b), [a.status, b.status])
}
const w1 = await anon.req('/api/paystack/webhook', { method: 'POST', body: { event: 'charge.success', data: { reference: 'x', amount: 1 } } })
const w2 = await anon.req('/api/paystack/webhook', { method: 'POST', headers: { 'x-paystack-signature': 'deadbeef' }, body: { event: 'charge.success', data: { reference: 'x', amount: 1 } } })
check('the webhook refuses a call with no signature and a wrong one', w1.status >= 400 && w1.status < 500 && w2.status >= 400 && w2.status < 500, [w1.status, w2.status])
const w3 = await anon.req('/api/paystack/webhook', { method: 'POST', headers: { 'x-paystack-signature': createHmac('sha512', 'not-the-secret').update(JSON.stringify({ event: 'charge.success', data: { reference: 'x' } })).digest('hex') }, body: { event: 'charge.success', data: { reference: 'x' } } })
check('a signature made with the wrong secret is refused', w3.status >= 400 && w3.status < 500, w3.status)

console.log('7. Private files stay private')
for (const [label, path] of [['a guest ID document', '/api/bookings/ZZZZZZ/guest-id'], ['a partner document', '/api/partner-documents/00000000-0000-4000-8000-000000000000'], ['a partner agreement PDF', '/api/partner-agreements/00000000-0000-4000-8000-000000000000/pdf'], ['an agreement template PDF', '/api/admin/agreements/partner/pdf']]) {
  const a = await anon.req(path), c = await customer.req(path)
  check(`${label}: not given to a signed-out visitor or an unrelated customer`, (denied(a) || a.status === 404) && (denied(c) || c.status === 404), [a.status, c.status])
}

console.log('8. Sign-up cannot grant power')
const grabEmail = `grab.sec${stamp}@test.local`
const grab = await signUp('Grab Role', grabEmail, { role: 'admin', permissions: ['listings', 'payouts'], emailVerified: true, twoFactorEnabled: true })
const gu = (await q(`select role, permissions, "emailVerified" from "User" where email=$1`, [grabEmail]))[0]
check('a sign-up that asks to be admin is a customer with no areas', gu?.role === 'customer' && (gu.permissions ?? []).length === 0, gu)
const upd = await grab.req('/api/auth/update-user', { method: 'POST', body: { role: 'admin', permissions: ['listings'], name: 'Grab Role' } })
const gu2 = (await q(`select role, permissions from "User" where email=$1`, [grabEmail]))[0]
check('updating one’s own profile cannot change the role or areas', gu2.role === 'customer' && (gu2.permissions ?? []).length === 0, [upd.status, gu2])

console.log('9. Headers and reflection')
const home = await anon.req('/')
check('pages say not to guess the file type (nosniff)', /nosniff/i.test(home.headers.get('x-content-type-options') ?? ''), home.headers.get('x-content-type-options'))
check('pages cannot be framed by other sites', /deny|sameorigin/i.test(home.headers.get('x-frame-options') ?? '') || /frame-ancestors/i.test(home.headers.get('content-security-policy') ?? ''), [home.headers.get('x-frame-options'), home.headers.get('content-security-policy')])
check('a referrer policy is set', !!home.headers.get('referrer-policy'), home.headers.get('referrer-policy'))
check('the server does not announce its software version', !/express|php|asp\.net/i.test(home.headers.get('x-powered-by') ?? ''), home.headers.get('x-powered-by'))
const evil = '<img src=x onerror=alert(1)>'
for (const p of [`/catalog?q=${encodeURIComponent(evil)}`, `/catalog/real-estate?view=${encodeURIComponent(evil)}`, `/sign-in?redirect_url=${encodeURIComponent(evil)}`, `/discover?x=${encodeURIComponent(evil)}`, `/${encodeURIComponent(evil)}`]) {
  const r = await anon.req(p)
  check(`markup in the address is not echoed unescaped (${p.slice(0, 30)}…)`, !r.text.includes(evil) && !/<img src=x onerror/i.test(r.text), r.status)
}
const open = await anon.req(`/sign-in?redirect_url=${encodeURIComponent('https://evil.example/steal')}`)
check('a sign-in link cannot be told to send people to another website', !/https:\/\/evil\.example/.test(open.location ?? '') && !/href="https:\/\/evil\.example/.test(open.text), open.location)

console.log('10. Sign-in cannot be guessed at, and does not reveal who has an account')
await q('delete from "RateLimit"')
const victim = `victim.sec${stamp}@test.local`
await signUp('Victim', victim)
await q('delete from "RateLimit"')
const a1 = await anon.req('/api/auth/sign-in/email', { method: 'POST', body: { email: victim, password: 'wrong-password-1' }, ip: '10.55.0.1' })
const a2 = await anon.req('/api/auth/sign-in/email', { method: 'POST', body: { email: `nobody${stamp}@test.local`, password: 'wrong-password-1' }, ip: '10.55.0.2' })
check('a wrong password and an unknown email give the same message', a1.status === a2.status && (a1.json?.message ?? '') === (a2.json?.message ?? ''), [a1.status, a1.json, a2.status, a2.json])
let slowed = 0
for (let i = 0; i < 25; i++) { const x = await anon.req('/api/auth/sign-in/email', { method: 'POST', body: { email: victim, password: `guess-${i}-wrong` }, ip: '10.55.0.9' }); if (x.status === 429) slowed++ }
check('25 wrong passwords in a row are slowed down (429) at some point', slowed >= 1, slowed)
await q('delete from "RateLimit"')

await db.end()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
