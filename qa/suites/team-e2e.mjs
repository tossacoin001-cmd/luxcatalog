// End-to-end: team roles and per-area access. Run from the repo dir (needs pg).
import { createHmac } from 'node:crypto'
import pg from 'pg'

const BASE = process.env.BASE ?? 'http://localhost:3300'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
await q('delete from "RateLimit"')
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${x}`)))

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
const denied = (r) => r.status >= 300 && /\/admin\?denied=1/.test(r.location ?? '')
const idOf = async (email) => (await q(`select id from "User" where email=$1`, [email]))[0].id

console.log('1. Admin invites a team member with chosen areas')
const adminEmail = `ada.team${stamp}@test.local`
const A = await signUp('Ada Admin', adminEmail)
await q(`update "User" set role='admin' where email=$1`, [adminEmail])
await enable2fa(A)
let r = await A.req('/api/admin/team', { method: 'POST', body: { email: `partner-role${stamp}@test.local`, role: 'partner' } })
check('team page can no longer invite "partner" (brands apply instead)', r.status === 400, `${r.status}`)
const tEmail = `tola.team${stamp}@test.local`
r = await A.req('/api/admin/team', { method: 'POST', body: { email: tEmail, role: 'team', permissions: ['enquiries', 'orders', 'not-a-real-area'] } })
check('team invite created', r.status === 200 && !!r.json?.link, `${r.status}`)
const inv = (await q(`select role, permissions from "StaffInvitation" where email=$1 and "revokedAt" is null`, [tEmail]))[0]
check('invite stores role and only real areas', inv?.role === 'team' && JSON.stringify(inv.permissions) === '["enquiries","orders"]', JSON.stringify(inv))
const token = new URL(r.json.link).searchParams.get('token')

console.log('2. Team member accepts')
const T = await signUp('Tola Ojo', tEmail)
r = await T.req('/api/invitations/accept', { method: 'POST', body: { token } })
check('invitation accepted as team', r.status === 200 && r.json?.role === 'team', `${r.status} ${JSON.stringify(r.json)}`)
const tId = await idOf(tEmail)
check('account gets the invited areas', JSON.stringify((await q(`select permissions from "User" where id=$1`, [tId]))[0].permissions) === '["enquiries","orders"]')
r = await T.req('/admin')
check('team must set up 2FA first like all staff', r.status >= 300 && /setup=2fa/.test(r.location ?? ''), `${r.status} ${r.location}`)
await enable2fa(T)

console.log('3. Team member reaches only their areas')
r = await T.req('/admin')
check('dashboard opens (no partner agreement, no application)', r.status === 200 && /Team Dashboard/.test(r.text), `${r.status} ${r.location}`)
check('menu shows Enquiries and Orders only', /href="\/admin\/inquiries"/.test(r.text) && /href="\/admin\/orders"/.test(r.text) && !/href="\/admin\/listings"/.test(r.text) && !/href="\/admin\/team"/.test(r.text) && !/href="\/admin\/applications"/.test(r.text))
check('no bulk email tools for team', !/Send digests|Email tools|Run the Watchdog/i.test(r.text))
check('enquiries page opens', (await T.req('/admin/inquiries')).status === 200)
check('orders page opens', (await T.req('/admin/orders')).status === 200)
for (const p of ['/admin/listings', '/admin/listings/new', '/admin/applications', '/admin/partners', '/admin/agreements', '/admin/team']) {
  r = await T.req(p)
  check(`${p} blocked`, denied(r), `${r.status} ${r.location}`)
}
r = await T.req('/admin?denied=1')
check('blocked page explains why', /don't have access to that page|don&#x27;t have access to that page/.test(r.text))
r = await T.req('/api/admin/listings', { method: 'POST', body: { title: 'x', category: 'car', description: 'x', location: 'Lagos', country: 'Nigeria' } })
check('listing API refuses', r.status === 401, `${r.status}`)
check('team API refuses', (await T.req('/api/admin/team')).status === 401)
check('team member cannot change access (own or others)', (await T.req('/api/admin/team', { method: 'PATCH', body: { userId: tId, role: 'admin' } })).status === 401)
check('bulk email tools refuse', (await T.req('/api/admin/email-tools', { method: 'POST', body: { action: 'digests' } })).status === 401)
check('application decisions refuse', (await T.req('/api/admin/applications/x', { method: 'POST', body: { action: 'approve' } })).status === 401)
check('lawyer review PDFs refuse', (await T.req('/api/admin/agreements/master/pdf')).status === 401)
r = await T.req('/partners/agreement')
check('never sent through the partner agreement', !(r.location ?? '').includes('/partners/agreement') && r.status !== 200, `${r.status} ${r.location}`)

console.log('4. Admin changes access; it applies at once')
r = await A.req('/api/admin/team', { method: 'PATCH', body: { userId: tId, role: 'team', permissions: ['listings', 'orders'] } })
check('admin updates areas', r.status === 200, `${r.status}`)
check('listings now open', (await T.req('/admin/listings')).status === 200)
check('enquiries now blocked', denied(await T.req('/admin/inquiries')))
r = await T.req('/api/admin/listings', { method: 'POST', body: { title: `Team listing ${stamp}`, category: 'car', description: 'Test.', location: 'Lagos', country: 'Nigeria' } })
check('listing API now lets them in', r.status !== 401 && r.status !== 403, `${r.status}`)
r = await A.req('/api/admin/team', { method: 'PATCH', body: { userId: (await idOf(adminEmail)), role: 'team', permissions: [] } })
check('admin cannot demote themselves', r.status === 400, `${r.status}`)

console.log('5. People invited as partners by mistake')
const pEmail = `wrongly.partner${stamp}@test.local`
const W = await signUp('Bisi Wrong', pEmail)
await q(`update "User" set role='partner' where email=$1`, [pEmail])
await enable2fa(W)
const wId = await idOf(pEmail)
r = await A.req('/admin/team')
check('team page lists them under "Invited as partners"', r.status === 200 && /Invited as partners/.test(r.text) && r.text.includes(pEmail))
r = await A.req('/api/admin/team', { method: 'PATCH', body: { userId: wId, role: 'team', permissions: ['applications', 'partners'] } })
check('moved to the team with chosen areas', r.status === 200, `${r.status}`)
r = await W.req('/admin')
check('they now get the team dashboard, no agreement', r.status === 200 && /Team Dashboard/.test(r.text), `${r.status} ${r.location}`)
check('applications open for them', (await W.req('/admin/applications')).status === 200)
check('agreements admin page open for them', (await W.req('/admin/agreements')).status === 200)
const bEmail = `real.brand${stamp}@test.local`
await signUp('Real Brand', bEmail)
const bId = await idOf(bEmail)
await q(`update "User" set role='partner' where id=$1`, [bId])
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"businessName","updatedAt") values (gen_random_uuid(),$1,'fleet_owner','approved','Real Brand Cars',now())`, [bId])
r = await A.req('/api/admin/team', { method: 'PATCH', body: { userId: bId, role: 'team', permissions: ['listings'] } })
check('a real brand partner (with application) cannot be moved', r.status === 409, `${r.status}`)
r = await A.req('/admin/team')
check('real brand partners are not listed on the team page', !r.text.includes(bEmail))

console.log('6. A pending invite sent as "partner"')
const oEmail = `old.invite${stamp}@test.local`
await q(`insert into "StaffInvitation" (id,email,role,"tokenHash","invitedById","expiresAt") values (gen_random_uuid(),$1,'partner',$2,$3,now() + interval '7 days')`, [oEmail, `hash-${stamp}`, await idOf(adminEmail)])
const oldInv = (await q(`select id from "StaffInvitation" where email=$1`, [oEmail]))[0]
r = await A.req('/admin/team')
check('shown with "Change to team"', /Change to team/.test(r.text) && r.text.includes(oEmail))
r = await A.req('/api/admin/team', { method: 'POST', body: { resendId: oldInv.id, role: 'team', permissions: ['enquiries'] } })
check('re-sent as a team invite', r.status === 200, `${r.status}`)
const rows = await q(`select role, permissions, "revokedAt" from "StaffInvitation" where email=$1 order by "createdAt"`, [oEmail])
check('old partner link retired, new team invite live', rows.length === 2 && rows[0].revokedAt && rows[1].role === 'team' && JSON.stringify(rows[1].permissions) === '["enquiries"]', JSON.stringify(rows))

console.log('7. Promote and remove')
r = await A.req('/api/admin/team', { method: 'PATCH', body: { userId: tId, role: 'admin' } })
check('team member promoted to admin', r.status === 200)
check('as admin they reach the team page', (await T.req('/admin/team')).status === 200)
await A.req('/api/admin/team', { method: 'PATCH', body: { userId: tId, role: 'team', permissions: ['orders'] } })
check('demoted again: team page blocked', denied(await T.req('/admin/team')))
r = await A.req('/api/admin/team', { method: 'DELETE', body: { type: 'member', id: tId } })
check('removed from the team', r.status === 200)
r = await T.req('/admin')
check('their session ends at once', r.status >= 300 && !/denied/.test(r.location ?? ''), `${r.status} ${r.location}`)
check('removal clears their areas', JSON.stringify((await q(`select role, permissions from "User" where id=$1`, [tId]))[0]) === '{"role":"customer","permissions":[]}')

console.log('8. Admin keeps full access')
for (const p of ['/admin', '/admin/listings', '/admin/inquiries', '/admin/orders', '/admin/applications', '/admin/partners', '/admin/agreements', '/admin/team']) {
  check(`admin opens ${p}`, (await A.req(p)).status === 200)
}

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
