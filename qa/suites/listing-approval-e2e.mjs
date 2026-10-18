// Listing approval: who may put a listing in front of customers, and what an
// edit is allowed to change. Real sessions (with 2FA, as staff need), the
// real API, the real database. Run from the repo root with the app on :3300.
//
// POLICY under test (decisions D1-D4 in docs/DECISIONS.md, recommended
// answers shown here; change the test with the decision, never the reverse):
//   D1  Only an admin publishes, unpublishes, features, or sets hire terms.
//       Team members with Listings create drafts and edit; a draft stays
//       unpublished until an admin approves it.
//   D2  Anything a team member or partner changes goes back to an admin
//       before customers see it (Founder, 2026-10-18: "there must be a
//       gate"). Every change is written to the audit log.
//   D3  Only an admin deletes a LIVE listing; a team member may remove a draft.
//   D4  An edit only changes the fields it sends. (Today "Publish" wipes
//       featured and hire terms: a data-loss bug found while checking this.)
import { createHmac } from 'node:crypto'
import pg from 'pg'

const BASE = process.env.BASE ?? 'http://localhost:3300'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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
const staff = async (name, role, permissions = []) => {
  const email = `${name.toLowerCase().replace(/\W+/g, '.')}.${stamp}@test.local`
  const b = await signUp(name, email)
  await q(`update "User" set role=$2, permissions=$3 where email=$1`, [email, role, permissions])
  await enable2fa(b)
  b.email = email; b.id = (await q(`select id from "User" where email=$1`, [email]))[0].id
  return b
}
const row = (id) => q(`select published, featured, "hireAvailable", "hireRatePerDay"::text hire, title, description, status, "ownerId" from "Listing" where id=$1`, [id]).then((r) => r[0])
const draft = (title, extra = {}) => ({ title, category: 'real_estate', subcategory: 'for_sale', description: 'A grand residence with sea views and a private jetty.', location: 'Ikoyi, Lagos', country: 'Nigeria', price: 900000000, images: ['https://example.com/a.jpg'], ...extra })
const idByTitle = async (title) => (await q(`select id, slug from "Listing" where title=$1`, [title]))[0]
const publicStatus = async (slug) => (await fetch(`${BASE}/catalog/real-estate/${slug}`, { redirect: 'manual' })).status
const waitPublic = async (slug, want) => { for (let i = 0; i < 20; i++) { if ((await publicStatus(slug)) === want) return true; await sleep(1000) } return false }
await q('delete from "RateLimit"')

console.log('1. People')
const admin = await staff('Ada Approver', 'admin')
const tLeader = await staff('Tola Listings', 'team', ['listings'])
const tOther = await staff('Tunde Enquiries', 'team', ['enquiries'])
const customer = await signUp('Chi Customer', `chi.customer.${stamp}@test.local`)
const anon = new Browser()
check('admin, a team member with Listings, a team member without, a customer and a visitor exist', !!admin.id && !!tLeader.id && !!tOther.id)

console.log('2. Who can create at all')
for (const [who, b] of [['a visitor', anon], ['a customer', customer], ['a team member without Listings', tOther]]) {
  const r = await b.req('/api/admin/listings', { method: 'POST', body: draft(`Nope ${who}`) })
  check(`${who} cannot create a listing`, r.status === 401 || r.status === 403, `${r.status}`)
}
check('nothing was created by those attempts', (await q(`select count(*)::int n from "Listing" where title like 'Nope %'`))[0].n === 0)

console.log('3. An admin’s own listing goes live as before')
let r = await admin.req('/api/admin/listings', { method: 'POST', body: draft('Approval House Listing') })
check('admin creates', r.status === 200 && r.json?.success, `${r.status}`)
const house = await idByTitle('Approval House Listing')
check('an admin listing is live at once', (await row(house.id)).published === true)
check('and visible to the public', await waitPublic(house.slug, 200))

console.log('4. A team member’s listing waits for approval (D1)')
r = await tLeader.req('/api/admin/listings', { method: 'POST', body: draft('Approval Team Draft', { published: true, featured: true, hireAvailable: true, hireRatePerDay: 120000, status: 'sold' }) })
check('a team member with Listings can create', r.status === 200 && r.json?.success, `${r.status} ${JSON.stringify(r.json)}`)
const td = await idByTitle('Approval Team Draft')
let t = await row(td.id)
check('it is saved as a draft (not published)', t.published === false, JSON.stringify(t))
check('asking for "published: true" in the request changes nothing', t.published === false)
check('asking to feature it is ignored', t.featured === false, JSON.stringify(t))
check('asking for hire terms is ignored', t.hireAvailable === false && t.hire === null, JSON.stringify(t))
check('a made-up "sold" status is not accepted on a new listing', t.status === 'available', t.status)
check('the response tells the team member it is awaiting approval', r.json?.listing?.published === false && /approval|review/i.test(JSON.stringify(r.json)), JSON.stringify(r.json).slice(0, 200))
check('the public cannot see the draft', await waitPublic(td.slug, 404), `${await publicStatus(td.slug)}`)
check('the public catalogue page does not list it', !(await (await fetch(`${BASE}/catalog/real-estate`)).text()).includes('Approval Team Draft'))
check('the sitemap and search do not list it', !(await (await fetch(`${BASE}/api/ai/match`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.88.0.1' }, body: JSON.stringify({ brief: { needs: [{ kind: 'home_buy' }] } }) })).text()).includes(td.slug))
r = await admin.req('/admin/listings')
check('an admin sees it waiting in the Listings page', r.status === 200 && /Approval Team Draft/.test(r.text) && /Pending Review/.test(r.text))

console.log('5. Only an admin approves')
r = await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { published: true } })
check('a team member cannot publish (clear refusal)', r.status === 403 && /admin/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
check('the draft is still a draft', (await row(td.id)).published === false)
r = await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { title: 'Approval Team Draft', description: 'Edited by Tola.', published: true } })
check('publishing hidden inside a normal edit is also refused', r.status === 403 || (await row(td.id)).published === false, `${r.status}`)
check('a team member cannot feature it', (await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { featured: true } })).status === 403 && (await row(td.id)).featured === false)
check('a team member cannot set hire terms', (await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { hireAvailable: true, hireRatePerDay: 90000 } })).status === 403 && (await row(td.id)).hireAvailable === false)
r = await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { description: 'Improved description by Tola, now longer and clearer for buyers.' } })
check('a team member can still improve a draft’s text', r.status === 200 && /Improved description/.test((await row(td.id)).description), `${r.status}`)
check('and the draft is still unpublished after that edit', (await row(td.id)).published === false)
r = await admin.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { published: true } })
check('an admin approves with one click (the Approve button’s request)', r.status === 200, `${r.status}`)
check('now it is live', (await row(td.id)).published === true && (await waitPublic(td.slug, 200)))

console.log('6. An edit changes only what it sends (D4: the data-loss bug)')
r = await admin.req(`/api/admin/listings/${house.id}`, { method: 'PATCH', body: { featured: true, hireAvailable: true, hireRatePerDay: 150000, hireRateDisplay: '₦150,000 / day' } })
check('admin features the house listing and sets hire terms', r.status === 200)
let h = await row(house.id)
check('they are saved', h.featured === true && h.hireAvailable === true && Number(h.hire) === 150000, JSON.stringify(h))
await admin.req(`/api/admin/listings/${house.id}`, { method: 'PATCH', body: { published: false } })
await admin.req(`/api/admin/listings/${house.id}`, { method: 'PATCH', body: { published: true } })
h = await row(house.id)
check('unpublishing and re-publishing keeps it featured', h.featured === true, JSON.stringify(h))
check('and keeps the hire terms', h.hireAvailable === true && Number(h.hire) === 150000, JSON.stringify(h))
await admin.req(`/api/admin/listings/${house.id}`, { method: 'PATCH', body: { title: 'Approval House Listing' } })
h = await row(house.id)
check('a title-only edit keeps featured and hire terms', h.featured === true && h.hireAvailable === true, JSON.stringify(h))
check('and does not change the publish state', h.published === true)
check('the price survives edits that do not send one', Number((await q(`select price::text p from "Listing" where id=$1`, [house.id]))[0].p) === 900000000)

console.log('7. A team member edits a live listing: it goes back to review (D2)')
const before = await row(td.id)
r = await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { title: 'Approval Team Draft', description: 'A correction to a typo on a live listing, made by Tola.' } })
check('a team member can correct a live listing', r.status === 200, `${r.status}`)
check('the response says it is waiting for approval', r.json?.needsApproval === true, JSON.stringify(r.json).slice(0, 160))
const after = await row(td.id)
check('it was live before and is now waiting for an admin', before.published === true && after.published === false, JSON.stringify({ before: before.published, after: after.published }))
check('customers no longer see the unreviewed version', await waitPublic(td.slug, 404), `${await publicStatus(td.slug)}`)
const audit = await q(`select action, "actorId", target from "AuditLog" where target=$1 and action='listing.edit' order by "createdAt" desc limit 1`, [td.id])
check('the edit is recorded in the audit log with who made it', audit[0]?.actorId === tLeader.id, JSON.stringify(audit))
const alerts = await (async () => { for (let i = 0; i < 20; i++) { const m = await q(`select "to", kind from "EmailLog" where kind='listing_pending' and "createdAt" > now() - interval '5 minutes'`); if (m.some((x) => x.to === admin.email)) return m; await sleep(1000) } return [] })()
check('an admin is emailed that a listing is waiting', alerts.some((x) => x.to === admin.email), JSON.stringify(alerts))
check('a team member cannot put it back live', (await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { published: true } })).status === 403 && (await row(td.id)).published === false)
check('an admin approves it again', (await admin.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { published: true } })).status === 200 && (await waitPublic(td.slug, 200)))
check('a team member cannot take a live listing offline', (await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { published: false } })).status === 403 && (await row(td.id)).published === true)
check('a price change by a team member also goes to review (never silently live)', (await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { price: 100 } })).status === 200 && (await row(td.id)).published === false)
await admin.req(`/api/admin/listings/${td.id}`, { method: 'PATCH', body: { price: 900000000, published: true } })

console.log('8. Deleting (D3)')
r = await tLeader.req('/api/admin/listings', { method: 'POST', body: draft('Approval Throwaway Draft') })
const thr = await idByTitle('Approval Throwaway Draft')
check('a team member can remove a draft', (await tLeader.req(`/api/admin/listings/${thr.id}`, { method: 'DELETE' })).status === 200 && !(await idByTitle('Approval Throwaway Draft')))
check('a team member cannot delete a live listing', (await tLeader.req(`/api/admin/listings/${td.id}`, { method: 'DELETE' })).status === 403 && !!(await idByTitle('Approval Team Draft')))
check('a team member without Listings cannot delete anything', (await tOther.req(`/api/admin/listings/${td.id}`, { method: 'DELETE' })).status === 401)
check('an admin can delete a live listing', (await admin.req(`/api/admin/listings/${td.id}`, { method: 'DELETE' })).status === 200 && !(await idByTitle('Approval Team Draft')))

console.log('9. Booking on a draft is impossible; no back door to take money early')
r = await tLeader.req('/api/admin/listings', { method: 'POST', body: draft('Approval Stay Draft', { category: 'real_estate', subcategory: 'luxury_shortlets', price: 300000 }) })
const sd = await idByTitle('Approval Stay Draft')
r = await tLeader.req(`/api/admin/listings/${sd.id}/booking`, { method: 'PUT', body: { enabled: true, rate: 300000, unit: 'night', cleaningFee: 0, cautionDeposit: 0, minUnits: 1, maxUnits: 14, advanceNoticeHours: 0, cancellationPolicy: 'moderate', checkInTime: '14:00', checkOutTime: '11:00' } })
check('a team member can prepare booking settings on a draft', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
const d1 = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), d2 = new Date(Date.now() + 22 * 86400000).toISOString().slice(0, 10)
check('but a guest cannot get a quote while it is a draft', (await anon.req(`/api/listings/${sd.id}/quote?start=${d1}&end=${d2}`)).status === 404)
check('nor see its availability', [404, 400].includes((await anon.req(`/api/listings/${sd.id}/availability`)).status))

console.log('10. The portal names the person’s own role (bug B, in the page the person sees)')
r = await tLeader.req('/admin')
check('a team member’s dashboard says Team, not Admin', r.status === 200 && /Team Dashboard/.test(r.text) && !/Admin Dashboard/.test(r.text))
check('its page title says Team', /<title>[^<]*Team[^<]*<\/title>/.test(r.text), (r.text.match(/<title>[^<]*<\/title>/) ?? [''])[0])
r = await admin.req('/admin')
check('an admin’s dashboard says Admin', /Admin Dashboard/.test(r.text) && /<title>[^<]*Admin[^<]*<\/title>/.test(r.text))
r = await tLeader.req('/admin/team')
check('a team member is still kept out of the Team page', r.status >= 300 && /denied=1/.test(r.location ?? ''), `${r.status} ${r.location}`)
check('the Listings page for a team member does not offer Approve', !/>\s*Approve\s*</.test((await tLeader.req('/admin/listings')).text))
check('the Listings page for an admin does offer Approve for a draft', await (async () => { await tLeader.req('/api/admin/listings', { method: 'POST', body: draft('Approval Visible Draft') }); return />\s*Approve\s*</.test((await admin.req('/admin/listings')).text) })())
check('a team member’s draft is labelled as awaiting admin approval', /awaiting|admin approval|pending review/i.test((await tLeader.req('/admin/listings')).text))

console.log('11. Role changes take effect at once (the portal never trusts a stale session)')
await q(`update "User" set role='customer', permissions='{}' where id=$1`, [tLeader.id])
r = await tLeader.req('/admin')
check('after demotion the same session is sent away from /admin', r.status >= 300 && !/Team Dashboard/.test(r.text), `${r.status} ${r.location}`)
check('and cannot create a listing', (await tLeader.req('/api/admin/listings', { method: 'POST', body: draft('Approval After Demotion') })).status === 401)
await q(`update "User" set role='team', permissions='{"listings"}' where id=$1`, [tLeader.id])
check('a restored role works again at once', (await tLeader.req('/api/admin/listings', { method: 'POST', body: draft('Approval After Restore') })).status === 200)
await q(`update "User" set "twoFactorEnabled"=false where id=$1`, [tLeader.id])
r = await tLeader.req('/admin')
check('a team member whose 2FA was switched off is sent to set it up (not shown a confusing denial)', r.status >= 300 && /setup=2fa/.test(r.location ?? ''), `${r.status} ${r.location}`)
check('and cannot use the listings API until 2FA is back', (await tLeader.req('/api/admin/listings', { method: 'POST', body: draft('Approval No 2FA') })).status === 401)

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
