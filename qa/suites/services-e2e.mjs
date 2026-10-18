// Private Services S1, end to end against a local build on :3300:
// public pages, Service Professional application + vetting, agreement
// schedule, listing gate (approved type + collection), price floors, content
// filter, admin floors page, booking settings held back until S2, and the
// publish-keeps-price regression.
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
    const headers = { origin: BASE, 'user-agent': 'services-e2e/1.0', cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ') }
    if (body) headers['content-type'] = 'application/json'
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); this.jar.set(p.slice(0, i), p.slice(i + 1)) }
    const buf = Buffer.from(await res.arrayBuffer())
    let json = null; try { json = JSON.parse(buf.toString()) } catch {}
    return { status: res.status, json, buf, html: buf.toString(), location: res.headers.get('location') }
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
  b.id = (await q(`select id from "User" where email=$1`, [email]))[0].id
  if (role) {
    await q(`update "User" set role=$2, permissions=$3 where email=$1`, [email, role, perms])
    await enable2fa(b)
  }
  return b
}
async function enable2fa(b) {
  const en = await b.req('/api/auth/two-factor/enable', { method: 'POST', body: { password: pw } })
  await b.req('/api/auth/two-factor/verify-totp', { method: 'POST', body: { code: totp(new URL(en.json.totpURI).searchParams.get('secret')) } })
}
const pdf = (label) => new Blob([Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`)], { type: 'application/pdf' })
async function upload(b, kind, expiresAt) {
  const f = new FormData(); f.append('kind', kind); f.append('file', pdf(kind), `${kind}.pdf`); if (expiresAt) f.append('expiresAt', expiresAt)
  return b.req('/api/partner-application/documents', { method: 'POST', form: f })
}
const hashesFrom = (html) => [...html.matchAll(/hash\\?":\\?"([0-9a-f]{64})/g)].map((m) => m[1])
async function signAll(b, name) {
  const page = await b.req('/partners/agreement')
  const keys = [...page.html.matchAll(/key\\?":\\?"(master|schedule_[a-z]+)\\?"/g)].map((m) => m[1]).filter((k, i, a) => a.indexOf(k) === i)
  const hashes = hashesFrom(page.html)
  const out = []
  for (let i = 0; i < keys.length; i++) out.push(await b.req('/api/partner-agreements', { method: 'POST', body: { key: keys[i], hash: hashes[i], signedName: name, agree: true } }))
  return { page, keys, out }
}
const anon = new Browser()
const svc = (o = {}) => ({ title: `Chef Amaka Dinner ${stamp}`, category: 'private_services', subcategory: 'private_chef', description: 'Five-course Nigerian and French tasting menu cooked in your home, with service and clean-up.', price: 45000, location: 'Ikoyi, Lagos', country: 'Nigeria', images: ['https://example.com/chef.jpg'], features: ['Ingredients included', 'Service and clean-up'], specs: { Cuisine: 'Nigerian, French' }, ...o })

let r

console.log('1. Public pages')
r = await anon.req('/catalog/private-services')
r = await anon.req('/catalog/private-services') // second visit: ISR warm
const cat = r.html
check('category page renders', r.status === 200 && /<h1[^>]*>Services<\/h1>/.test(cat), r.status)
check('four groups with anchors', ['dining', 'wellness', 'grooming', 'hosting'].every((g) => cat.includes(`id="${g}"`)) && ['Dining', 'Wellness', 'Grooming &amp; Beauty', 'Home &amp; Hosting'].every((l) => cat.includes(l)))
const labels = ['Chef', 'Mixologist &amp; Bar', 'Butler &amp; Event Staff', 'Massage &amp; Spa', 'Personal Training &amp; Yoga', 'Barber', 'Hair Stylist', 'Makeup Artist', 'Nail Technician', 'Housekeeping', 'Photographer &amp; Content']
check('all 11 services shown', labels.every((l) => cat.includes(l)), labels.filter((l) => !cat.includes(l)).join(', '))
check('services with no providers yet offer an on-site request, not WhatsApp', (cat.match(/data-brief-trigger/g) ?? []).length >= 1 && !/wa\.me\//.test(cat.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<footer[\s\S]*<\/footer>/, '')))
check('professionals are invited to apply', /href="\/partners\/apply"/.test(cat) && /Apply to join/.test(cat))
r = await anon.req('/')
check('homepage shows the Private Services pillar', r.status === 200 && /Private Services/.test(r.html) && /href="\/catalog\/private-services"/.test(r.html))
check('pillar links to each group', ['dining', 'wellness', 'grooming', 'hosting'].every((g) => r.html.includes(`/catalog/private-services#${g}`)))
check('heading says five pillars', /Five pillars/.test(r.html))
check('footer links the category', /href="\/catalog\/private-services"/.test(r.html.slice(r.html.lastIndexOf('<footer'))))
r = await anon.req('/partners')
check('Become a Partner page lists Service professional', r.status === 200 && /Service professional/.test(r.html))
r = await anon.req('/catalog/private-servicez')
check('unknown category still 404', r.status === 404, r.status)

console.log('2. Application and vetting')
const S = await account('Amaka Obi', `amaka.chef${stamp}@test.local`)
r = await S.req('/api/partner-application', { method: 'PUT', body: { partnerType: 'service_professional', legalForm: 'individual', businessName: 'Chef Amaka Kitchen', collections: ['private_chef', 'massage_spa', 'car_rental'] } })
check('draft created as Service professional', r.status === 200 && r.json?.application?.partnerType === 'service_professional', JSON.stringify(r.json).slice(0, 200))
check('collections outside services dropped', JSON.stringify(r.json?.application?.collections) === '["private_chef","massage_spa"]', JSON.stringify(r.json?.application?.collections))
r = await upload(S, 'nscdc_licence')
check('document from another partner type refused', r.status === 400, r.status)
await S.req('/api/partner-application', { method: 'PUT', body: { contactName: 'Amaka Obi', phone: '+234 803 111 2222', city: 'Lagos', about: 'Relaxing nuru massage and private dinners at your home across Lagos, any time of day.' } })
r = await S.req('/api/partner-application/submit', { method: 'POST' })
const miss = r.json?.missing ?? []
check('submit blocked with vetting list', r.status === 400 && ['Government ID', 'Proof of address', 'Police character certificate', 'Portfolio', 'Two references', 'Training or certification'].every((d) => miss.some((m) => m.includes(d))), JSON.stringify(miss))
check('banned word in description reported', miss.some((m) => /Remove/.test(m) && /nuru/.test(m)), JSON.stringify(miss))
for (const kind of ['government_id', 'proof_of_address', 'police_clearance', 'portfolio', 'references', 'trade_certificate']) {
  r = await upload(S, kind)
  check(`upload ${kind}`, r.status === 200 && r.json?.document?.kind === kind, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`)
}
r = await upload(S, 'liability_insurance', '2027-09-30')
check('optional insurance accepted with expiry', r.status === 200, r.status)
await S.req('/api/partner-application', { method: 'PUT', body: { about: 'Private chef and certified massage therapist serving Ikoyi, VI and Lekki. Ten years in five-star hotel kitchens and spas.' } })
r = await S.req('/api/partner-application/submit', { method: 'POST' })
check('only declarations left', r.status === 400 && r.json?.missing?.length > 0 && r.json.missing.every((m) => m.startsWith('Accept')), JSON.stringify(r.json?.missing))
check('the four service declarations are asked', r.json?.missing?.length === 7, r.json?.missing?.length)
await S.req('/api/partner-application', { method: 'PUT', body: { declarations: Object.fromEntries(['accurate', 'standards', 'no_circumvention', 'conduct', 'discretion', 'hygiene', 'in_person'].map((k) => [k, true])) } })
r = await S.req('/api/partner-application/submit', { method: 'POST' })
check('complete application submits', r.status === 200 && r.json?.status === 'submitted', JSON.stringify(r.json))

const A = await account('Ada Admin', `ada.svc${stamp}@test.local`, 'admin')
const appId = (await q(`select id from "PartnerApplication" where "userId"=$1`, [S.id]))[0].id
r = await A.req(`/admin/applications/${appId}`)
check('admin review shows police certificate and portfolio', r.status === 200 && /Police character certificate/.test(r.html) && /Portfolio/.test(r.html), r.status)
r = await A.req(`/api/admin/applications/${appId}`, { method: 'POST', body: { action: 'approve', note: 'Welcome.' } })
check('admin approves', r.status === 200 && r.json?.status === 'approved', JSON.stringify(r.json))
check('applicant is now a partner', (await q(`select role from "User" where id=$1`, [S.id]))[0].role === 'partner')
await enable2fa(S)

console.log('3. Agreement')
r = await S.req('/admin/listings/new')
check('unsigned service partner sent to sign', r.status >= 300 && /partners\/agreement/.test(r.location ?? ''), `${r.status} ${r.location}`)
const signed = await signAll(S, 'Amaka Obi')
check('agreement page shows master + Schedule H only', /Schedule H: Private Services/.test(signed.page.html) && !/Schedule B: Vehicle Rental/.test(signed.page.html) && JSON.stringify(signed.keys) === '["master","schedule_services"]', JSON.stringify(signed.keys))
check('commission 20% for chef and massage, paid after completion', /Private Chef: 20% commission, paid out after the assignment has been completed/.test(signed.page.html) && /Massage &amp; Spa: 20% commission|Massage & Spa: 20% commission/.test(signed.page.html))
check('both signed', signed.out.length === 2 && signed.out.every((x) => x.status === 200), signed.out.map((x) => x.status).join(','))

console.log('4. Listing rules (partner)')
r = await S.req('/api/admin/listings', { method: 'POST', body: svc({ subcategory: 'barber', price: 40000 }) })
check('cannot list a service they were not approved for', r.status === 403 && /approved/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req('/api/admin/listings', { method: 'POST', body: svc({ price: 20000 }) })
check('price below the floor refused with the minimum', r.status === 400 && /₦35,000/.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req('/api/admin/listings', { method: 'POST', body: svc({ price: undefined }) })
check('services must show a price', r.status === 400 && /price/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req('/api/admin/listings', { method: 'POST', body: svc({ subcategory: 'massage_spa', title: `Home spa ${stamp}`, description: 'Body to body massage in the comfort of your home.', price: 60000 }) })
check('banned words in description refused', r.status === 400 && /body to body/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req('/api/admin/listings', { method: 'POST', body: svc({ subcategory: 'massage_spa', title: `Home spa ${stamp}`, description: 'Swedish and deep tissue massage at home.', price: 60000, features: ['Happy ending available'] }) })
check('banned words in highlights refused', r.status === 400, `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req('/api/admin/listings', { method: 'POST', body: svc({ subcategory: 'massage_spa', title: `Home spa ${stamp}`, description: 'Swedish and deep tissue massage at home.', price: 60000, specs: { Treatments: 'Tantric' } }) })
check('banned words in specs refused', r.status === 400, `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req('/api/admin/listings', { method: 'POST', body: svc({ subcategory: 'massage_spa', title: `Nuru Spa ${stamp}`, description: 'Swedish and deep tissue massage at home.', price: 60000 }) })
check('banned words in title refused', r.status === 400, `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req('/api/admin/listings', { method: 'POST', body: svc() })
const chef = r.json?.listing
check('valid chef listing created', r.status === 200 && chef?.category === 'private_services' && chef?.subcategory === 'private_chef' && chef?.mode === 'booking', `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`)
check('it waits for admin review', chef?.published === false)
r = await S.req(`/api/admin/listings/${chef.id}`, { method: 'PATCH', body: { ...svc(), subcategory: 'barber' } })
check('cannot move it to an unapproved service', r.status === 403, `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req(`/api/admin/listings/${chef.id}`, { method: 'PATCH', body: { ...svc(), price: 10000 } })
check('cannot drop below the floor on edit', r.status === 400 && /₦35,000/.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req(`/api/admin/listings/${chef.id}`, { method: 'PATCH', body: { ...svc(), description: 'Dinner, then an erotic show.' } })
check('cannot add banned words on edit', r.status === 400, `${r.status} ${JSON.stringify(r.json)}`)
const after = (await q(`select price, description, subcategory from "Listing" where id=$1`, [chef.id]))[0]
check('refused edits change nothing', Number(after.price) === 45000 && after.subcategory === 'private_chef' && !/erotic/.test(after.description), JSON.stringify(after))

console.log('5. Other partner types and admin')
const F = await account('Femi Fleet', `femi.svc${stamp}@test.local`, 'partner')
await q(`insert into "PartnerApplication" (id,"userId","partnerType",status,"legalForm","businessName","contactName",phone,city,country,collections,about,"updatedAt") values (gen_random_uuid(),$1,'fleet_owner','approved','company','Femi Cars','Femi Fleet','+2348000000000','Lagos','Nigeria',ARRAY['car_rental'],'Fleet of chauffeur-driven luxury cars.',now())`, [F.id])
await signAll(F, 'Femi Fleet')
r = await F.req('/api/admin/listings', { method: 'POST', body: svc({ title: `Fleet chef ${stamp}` }) })
check('a car partner cannot list Private Services', r.status === 403 && /service professional/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await F.req('/api/admin/listings', { method: 'POST', body: { title: `Fleet car ${stamp}`, category: 'supercar', subcategory: 'car_rental', description: 'Chauffeur-driven Maybach.', price: 10, location: 'Lagos', country: 'Nigeria', images: ['https://example.com/a.jpg'] } })
check('car partner can still list cars at any price (no floors outside services)', r.status === 200, `${r.status} ${JSON.stringify(r.json).slice(0, 150)}`)
r = await A.req('/api/admin/listings', { method: 'POST', body: svc({ title: `House barber ${stamp}`, subcategory: 'barber', price: 15000, description: 'In-house grooming for Lux clients.' }) })
check('admin may price below the floor (house listing)', r.status === 200 && r.json?.listing?.published === true, `${r.status} ${JSON.stringify(r.json).slice(0, 150)}`)
const houseBarber = r.json?.listing
r = await A.req('/api/admin/listings', { method: 'POST', body: svc({ title: `House spa ${stamp}`, subcategory: 'massage_spa', description: 'Sensual massage by candlelight.' }) })
check('admin listings are content-filtered too', r.status === 400, `${r.status} ${JSON.stringify(r.json)}`)

console.log('6. Publish keeps the price (regression)')
r = await A.req(`/api/admin/listings/${chef.id}`, { method: 'PATCH', body: { published: true } })
const pub = (await q(`select published, price, "priceDisplay", title from "Listing" where id=$1`, [chef.id]))[0]
check('admin publish succeeds', r.status === 200 && pub.published === true, `${r.status} ${JSON.stringify(r.json)}`)
check('publishing does not wipe the price or other fields', Number(pub.price) === 45000 && pub.title === `Chef Amaka Dinner ${stamp}` && !!pub.priceDisplay, JSON.stringify(pub))
r = await anon.req('/catalog/private-services'); r = await anon.req('/catalog/private-services')
check('published chef appears on the category page', r.html.includes(`Chef Amaka Dinner ${stamp}`))
const chefSection = r.html.slice(r.html.indexOf('id="svc-private_chef"'), r.html.indexOf('id="svc-mixologist"'))
check('…under Private Chef', chefSection.includes(`Chef Amaka Dinner ${stamp}`), chefSection.length)
r = await anon.req(`/catalog/private-services/${chef.slug}`); r = await anon.req(`/catalog/private-services/${chef.slug}`)
check('detail page renders with a From price and enquiry', r.status === 200 && /₦45,000/.test(r.html) && /From/.test(r.html) && !/Questions before you book/.test(r.html), r.status)
check('detail page names the service', /Private Chef/.test(r.html))
const ledgerPrice = (await q(`select price from "Listing" where id=$1`, [houseBarber.id]))[0]
check('house barber kept its price', Number(ledgerPrice.price) === 15000)

console.log('7. Services never use the night/day booking settings')
r = await S.req(`/api/admin/listings/${chef.id}/booking`, { method: 'PUT', body: { enabled: true, unit: 'day', rate: 45000, minUnits: 1, maxUnits: 1, instantBook: true, cancellationPolicy: 'moderate', checkInTime: '09:00', checkOutTime: '19:00', advanceNoticeHours: 24 } })
check('night/day booking settings refused for services', r.status === 409 && /by the session/i.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
check('no settings row written', (await q(`select count(*)::int n from "BookingSettings" where "listingId"=$1`, [chef.id]))[0].n === 0)
r = await S.req(`/admin/listings/${chef.id}/booking`)
check('booking page opens the session setup', r.status === 200 && /Booking &amp; calendar|Booking & calendar/.test(r.html) && !/Nightly rate/i.test(r.html), r.status)
r = await anon.req(`/api/listings/${chef.id}/availability?from=2026-11-01&to=2026-12-01`)
check('public availability has nothing to offer', r.status === 404 || r.json?.bookable === false || r.status === 400, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`)

console.log('8. Price floors (admin)')
const T = await account('Tobi Team', `tobi.svc${stamp}@test.local`, 'team', ['listings'])
r = await A.req('/api/admin/service-floors')
const floors = r.json?.floors ?? []
check('admin sees 11 floors', r.status === 200 && floors.length === 11, `${r.status} ${floors.length}`)
check('pre-filled defaults with labels', floors.find((f) => f.key === 'private_chef')?.minPrice === 35000 && floors.find((f) => f.key === 'private_chef')?.label === 'Private Chef')
r = await T.req('/api/admin/service-floors')
check('team (even with Listings) cannot read floors', r.status === 401 || r.status === 403, r.status)
r = await S.req('/api/admin/service-floors', { method: 'PUT', body: { floors: { private_chef: 1 } } })
check('partner cannot change floors', r.status === 401 || r.status === 403, r.status)
r = await A.req('/api/admin/service-floors', { method: 'PUT', body: { floors: { private_chef: -5 } } })
check('negative floor refused', r.status === 400, r.status)
r = await A.req('/api/admin/service-floors', { method: 'PUT', body: { floors: { yacht_sale: 5 } } })
check('unknown service refused', r.status === 400, r.status)
r = await A.req('/api/admin/service-floors', { method: 'PUT', body: { floors: { private_chef: 50000, barber: 30000 } } })
check('admin updates floors', r.status === 200 && r.json?.floors?.find((f) => f.key === 'private_chef')?.minPrice === 50000, `${r.status} ${JSON.stringify(r.json).slice(0, 150)}`)
check('floor change audited', (await q(`select count(*)::int n from "AuditLog" where action='service_floors.update' and "actorId"=$1`, [A.id]))[0].n === 1)
r = await S.req(`/api/admin/listings/${chef.id}`, { method: 'PATCH', body: { ...svc(), price: 46000 } })
check('new floor applies to partner edits', r.status === 400 && /₦50,000/.test(r.json?.error ?? ''), `${r.status} ${JSON.stringify(r.json)}`)
r = await S.req(`/api/admin/listings/${chef.id}`, { method: 'PATCH', body: { ...svc(), price: 55000 } })
check('edit at or above the floor accepted and sent back to review', r.status === 200 && r.json?.listing?.published === false, `${r.status} ${JSON.stringify(r.json).slice(0, 150)}`)
r = await A.req('/admin/services')
check('admin floors page renders', r.status === 200 && /Price floors/.test(r.html) && /Private Chef/.test(r.html), r.status)
r = await T.req('/admin/services')
check('team cannot open the floors page', r.status >= 300 || r.status === 403 || r.status === 404, r.status)
await A.req('/api/admin/service-floors', { method: 'PUT', body: { floors: { private_chef: 35000, barber: 25000 } } })

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
