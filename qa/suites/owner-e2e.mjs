// One administrator: the owner. This suite starts a SECOND copy of the built
// app on :3301 with OWNER_EMAIL set (as production will have), then tries every
// way someone could become, or act as, a second admin.
// Needs the app built (qa/serve.sh) and the test database running.
import { createHmac } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const PORT = 3301
const BASE = `http://localhost:${PORT}`
const DEFAULT_BASE = process.env.BASE ?? 'http://localhost:3300'
const DB = process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable'
const db = new pg.Client({ connectionString: DB })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const stamp = Date.now()
const OWNER_EMAIL = `owner.${stamp}@test.local`
const root = fileURLToPath(new URL('../../', import.meta.url))

console.log('1. Start a second copy of the app with the owner address set')
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
  cwd: root,
  stdio: 'ignore',
  env: {
    ...process.env, OWNER_EMAIL, DATABASE_URL: DB, DIRECT_URL: DB, DATABASE_POOL_MAX: '1',
    BETTER_AUTH_SECRET: 'local-test-secret-0123456789abcdef0123', BETTER_AUTH_URL: BASE, NEXT_PUBLIC_APP_URL: BASE, CRON_SECRET: 'local-cron-secret-0123456789',
    EMAIL_DEBUG_DIR: fileURLToPath(new URL('../mail', import.meta.url)),
  },
})
const stop = () => { try { server.kill() } catch {} }
process.on('exit', stop)
let up = false
for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(`${BASE}/robots.txt`)).status === 200 } catch { await sleep(1000) } }
check('the second copy is running', up)
if (!up) { stop(); await db.end(); console.log('\n0 passed, 1 failed'); process.exit(1) }

class Browser {
  constructor(base = BASE) { this.base = base; this.jar = new Map() }
  async req(path, { method = 'GET', body } = {}) {
    const headers = { origin: this.base, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') }
    if (body) headers['content-type'] = 'application/json'
    const res = await fetch(this.base + path, { method, redirect: 'manual', headers, body: body ? JSON.stringify(body) : undefined })
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
const pw = 'correct-horse-battery-9'
const person = async (name, email, role, base = BASE) => {
  await q('delete from "RateLimit"')
  const b = new Browser(base)
  await b.req('/api/auth/sign-up/email', { method: 'POST', body: { name, email, password: pw } })
  if (role !== 'customer') await q(`update "User" set role=$2 where email=$1`, [email, role])
  if (role !== 'customer') {
    const en = await b.req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
    await b.req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
  }
  b.id = (await q(`select id from "User" where email=$1`, [email]))[0].id
  b.email = email
  return b
}
const gone = (r) => r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400 && !/\/admin\/?(\?|$)/.test(r.location ?? '/x'))

console.log('2. The owner works as before')
const owner = await person('Owner Founder', OWNER_EMAIL, 'admin')
let r = await owner.req('/admin')
check('the owner opens the admin dashboard', r.status === 200 && /Admin Dashboard/.test(r.text), `${r.status} ${r.location}`)
check('the owner reads the team list', (await owner.req('/api/admin/team')).status === 200)
check('the owner can invite a team member', (await owner.req('/api/admin/team', { method: 'POST', body: { email: `tola.${stamp}@test.local`, role: 'team', permissions: ['enquiries'] } })).status === 200)
check('the owner does not see the "owner not set" warning', !/OWNER_EMAIL/.test(r.text))

console.log('3. Nobody else can be an administrator')
const extra = await person('Second Admin', `second.admin.${stamp}@test.local`, 'admin')
check('a second account with the admin role cannot open the admin dashboard', gone(await extra.req('/admin')) , JSON.stringify(await extra.req('/admin').then((x) => [x.status, x.location])))
check('nor the team page', gone(await extra.req('/admin/team')))
check('nor payouts, refunds or applications', (await Promise.all(['/admin/payouts', '/admin/refunds', '/admin/applications', '/admin/partners'].map((p) => extra.req(p)))).every(gone))
check('its team API calls are refused', (await extra.req('/api/admin/team')).status === 401)
check('it cannot invite anyone', (await extra.req('/api/admin/team', { method: 'POST', body: { email: `x.${stamp}@test.local`, role: 'team' } })).status === 401)
check('it cannot create or publish a listing', (await extra.req('/api/admin/listings', { method: 'POST', body: { title: 'x', category: 'decor', description: 'x', location: 'x', country: 'Nigeria' } })).status === 401)
check('it cannot touch a payout or a refund', (await extra.req('/api/admin/payouts/none', { method: 'POST', body: { action: 'approve' } })).status === 401 && (await extra.req('/api/admin/refunds/none', { method: 'POST', body: { action: 'approve' } })).status === 401)
check('it is told nothing about the owner', !/owner|OWNER_EMAIL/i.test((await extra.req('/api/admin/team')).text))
const audit = await (async () => { for (let i = 0; i < 10; i++) { const a = await q(`select action from "AuditLog" where target=$1 or "actorId"=$1`, [extra.id]); if (a.some((x) => x.action === 'security.extra_admin_blocked')) return a; await sleep(500) } return [] })()
check('the attempt is written to the audit trail', audit.some((x) => x.action === 'security.extra_admin_blocked'), audit)

console.log('4. The doors that could grant admin are shut')
r = await owner.req('/api/admin/team', { method: 'POST', body: { email: `new.admin.${stamp}@test.local`, role: 'admin', permissions: [] } })
check('inviting someone as admin is refused, with the reason', r.status === 400 && /one administrator/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
check('no invitation was created for it', (await q(`select count(*)::int n from "StaffInvitation" where email=$1`, [`new.admin.${stamp}@test.local`]))[0].n === 0)
const tolaId = (await person('Tola Team', `tola.team.${stamp}@test.local`, 'team')).id
await q(`update "User" set permissions='{"enquiries"}' where id=$1`, [tolaId])
r = await owner.req('/api/admin/team', { method: 'PATCH', body: { userId: tolaId, role: 'admin' } })
check('promoting a team member to admin is refused', r.status === 400 && /one administrator/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
check('their role did not change', (await q(`select role from "User" where id=$1`, [tolaId]))[0].role === 'team')
const stale = (await q(`insert into "StaffInvitation" (id,email,role,permissions,"tokenHash","expiresAt","invitedById") values (gen_random_uuid(),$1,'admin','{}',$2,now() + interval '3 days',$3) returning id`, [`stale.admin.${stamp}@test.local`, `hash-${stamp}`, owner.id]).catch(() => []))[0]
r = await owner.req('/api/admin/team', { method: 'POST', body: { resendId: stale?.id ?? 'none' } })
check('re-sending an old admin invitation is refused or made a team invitation, never admin', stale ? (r.status === 400 || (r.status === 200 && (await q(`select role from "StaffInvitation" where email=$1 and "revokedAt" is null`, [`stale.admin.${stamp}@test.local`]))[0]?.role === 'team')) : true, `${r.status} ${JSON.stringify(r.json)}`)
check('the owner cannot change their own access', (await owner.req('/api/admin/team', { method: 'PATCH', body: { userId: owner.id, role: 'team' } })).status === 400)
check('the owner cannot remove themselves', (await owner.req('/api/admin/team', { method: 'DELETE', body: { type: 'member', id: owner.id } })).status === 400)

console.log('5. An old admin invitation cannot be redeemed')
const rawToken = `raw-token-${stamp}`
const { createHash } = await import('node:crypto')
const planted = (await q(`insert into "StaffInvitation" (id,email,role,permissions,"tokenHash","expiresAt","invitedById") values (gen_random_uuid(),$1,'admin','{}',$2,now() + interval '3 days',$3) returning id`, [`redeem.admin.${stamp}@test.local`, createHash('sha256').update(rawToken).digest('hex'), owner.id]))[0]
const redeemer = await person('Redeemer', `redeem.admin.${stamp}@test.local`, 'customer')
r = await redeemer.req('/api/invitations/accept', { method: 'POST', body: { token: rawToken } })
check('redeeming it does not make the person an admin', (await q(`select role from "User" where id=$1`, [redeemer.id]))[0].role !== 'admin', `${r.status} ${JSON.stringify(r.json)}`)
check('and the answer is a refusal', !!planted && (r.status === 403 || r.status === 404 || r.status === 400), `${r.status} ${JSON.stringify(r.json)}`)

console.log('6. Teams and partners are unaffected')
const team = await person('Real Team', `real.team.${stamp}@test.local`, 'team')
await q(`update "User" set permissions='{"enquiries"}' where id=$1`, [team.id])
check('a team member still reaches their own area', (await team.req('/admin/inquiries')).status === 200)
{ const t = await team.req('/admin/team'); check('and still cannot reach the team page', gone(t) || /denied=1/.test(t.location ?? ''), `${t.status} ${t.location}`) }

console.log('7. The default build (no owner set) still blocks granting admin')
const defaultAdmin = await person('Default Admin', `default.admin.${stamp}@test.local`, 'admin', DEFAULT_BASE)
r = await defaultAdmin.req('/api/admin/team', { method: 'POST', body: { email: `zzz.${stamp}@test.local`, role: 'admin' } })
check('the role cannot be granted even where no owner is configured', r.status === 400 && /one administrator/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
check('and the admin page warns that the owner address is not set', /OWNER_EMAIL/.test((await defaultAdmin.req('/admin')).text))

stop()
console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
