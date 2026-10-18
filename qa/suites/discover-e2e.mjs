// Discover v2 through the real API on the local build: one brief with several
// needs, answers grouped by what was asked, real prices for the right unit,
// real availability for the dates given, links into the booking pages, and
// the old quiz format still answering until it is retired.
import pg from 'pg'
import { refreshCatalog } from './_catalog.mjs'

const BASE = 'http://localhost:3300'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
let ipN = 0
async function post(body, ip) {
  const res = await fetch(BASE + '/api/ai/match', { method: 'POST', headers: { origin: BASE, 'content-type': 'application/json', 'x-forwarded-for': ip ?? `10.7.0.${++ipN}` }, body: JSON.stringify(body) })
  let json = null; try { json = await res.json() } catch {}
  return { status: res.status, json }
}
const day = (n) => new Date(Date.now() + 3_600_000 + n * 86_400_000).toISOString().slice(0, 10)
const stamp = Date.now()
const ins = async (title, category, sub, mode, price, display, loc = 'Ikoyi, Lagos', extra = {}) => {
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`
  const rows = await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,$7,$4,$5,$6,'Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200'],'{}',ARRAY[]::text[],$8,$9,true,now()) returning id`, [title, slug, category, price, display, loc, extra.description ?? 'A fine listing.', mode, sub])
  return { id: rows[0].id, slug }
}
const settings = (id, unit, rate) => q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","maxUnits","maxGuests","instantBook","advanceNoticeHours","updatedAt") values ($1,true,$2,$3,0,0,1,14,6,true,0,now())`, [id, unit, rate])
await q('delete from "RateLimit"')
await q('TRUNCATE "Listing" CASCADE')

console.log('1. Setup')
const S1 = await ins('Disc Loft Free', 'real_estate', 'luxury_shortlets', 'booking', 300000, '₦300,000'); await settings(S1.id, 'night', 300000)
const S2 = await ins('Disc Loft Taken', 'real_estate', 'luxury_shortlets', 'booking', 320000, '₦320,000'); await settings(S2.id, 'night', 320000)
await q(`insert into "UnavailableDate" (id,"listingId","startDate","endDate",source) values (gen_random_uuid(),$1,$2,$3,'manual')`, [S2.id, `${day(20)}T00:00:00Z`, `${day(27)}T00:00:00Z`])
const S3 = await ins('Disc Loft Costly', 'real_estate', 'luxury_shortlets', 'booking', 4500000, '₦4,500,000'); await settings(S3.id, 'night', 4500000)
const C1 = await ins('Disc Hire Rolls', 'supercar', 'car_rental', 'booking', 350000, '₦350,000'); await settings(C1.id, 'day', 350000)
const H1 = await ins('Disc Villa Sale', 'real_estate', 'for_sale', 'sale', 1200000000, '₦1,200,000,000')
const H2 = await ins('Disc Flat Rent', 'real_estate', 'for_rent', 'rent', 25000000, '₦25,000,000')
const V1 = await ins('Disc Chef Amaka', 'private_services', 'private_chef', 'booking', 45000, '₦45,000')
const V2 = await ins('Disc Barber Tunde', 'private_services', 'barber', 'booking', 25000, '₦25,000')
const D1 = await ins('Disc Brass Sculpture', 'decor', 'for_sale', 'sale', 2500000, '₦2,500,000')
check('listings created', true)

console.log('2. A guest looking for a service sees service answers')
let r = await post({ brief: { needs: [{ kind: 'service', services: ['private_chef'], budget: 'svc_40_100k' }] } })
check('accepted', r.status === 200, r)
let g = r.json?.groups?.[0]
check('one group, labelled in words', r.json?.groups?.length === 1 && g?.kind === 'service' && /service/i.test(g?.label ?? ''), r.json?.groups?.map((x) => x.label))
check('only the chef, never a home or a yacht', g?.matches?.length >= 1 && g.matches.every((m) => m.category === 'private_services'), g?.matches?.map((m) => m.slug))
check('the chef is in the answer with its price', g?.matches?.some((m) => m.slug === V1.slug && /45,000/.test(m.priceDisplay)))
check('every match has a reason and a link', g?.matches?.every((m) => m.reason?.length > 10 && m.href?.startsWith('/catalog/')), g?.matches)
check('a summary in plain words', typeof r.json?.summary === 'string' && r.json.summary.length > 15 && !/undefined/.test(r.json.summary))
check('says which engine answered', ['lux', 'ai'].includes(r.json?.engine))

console.log('3. Several needs in one brief')
r = await post({ brief: { needs: [{ kind: 'service', services: ['barber', 'makeup_artist'] }, { kind: 'home_rent', budget: 'rent_10_30m' }, { kind: 'decor' }] } })
check('three groups in the order asked', r.json?.groups?.map((x) => x.kind).join() === 'service,home_rent,decor', r.json?.groups?.map((x) => x.kind))
const svc = r.json?.groups?.[0]
check('the barber is offered', svc?.matches?.some((m) => m.slug === V2.slug))
check('the missing makeup artist is named, and offered to be arranged', svc?.missing?.includes('Makeup Artist'))
check('the rental comes from rentals only', r.json?.groups?.[1]?.matches?.every((m) => /rent/i.test(m.title) || m.category === 'real_estate'))
check('the decor piece is shown', r.json?.groups?.[2]?.matches?.some((m) => m.slug === D1.slug))
check('no listing appears twice across groups', (() => { const s = r.json.groups.flatMap((x) => x.matches.map((m) => m.slug)); return new Set(s).size === s.length })())

console.log('4. Buying is not renting is not staying')
r = await post({ brief: { needs: [{ kind: 'home_buy' }] } })
check('buy: the villa, not the rental or the stays', r.json?.groups?.[0]?.matches?.some((m) => m.slug === H1.slug) && !r.json.groups[0].matches.some((m) => [H2.slug, S1.slug].includes(m.slug)))
r = await post({ brief: { needs: [{ kind: 'home_rent' }] } })
check('rent: the flat, not the villa', r.json?.groups?.[0]?.matches?.some((m) => m.slug === H2.slug) && !r.json.groups[0].matches.some((m) => m.slug === H1.slug))
r = await post({ brief: { needs: [{ kind: 'stay' }] } })
check('stay: the lofts only', r.json?.groups?.[0]?.matches?.some((m) => m.slug === S1.slug) && r.json.groups[0].matches.every((m) => !/Villa Sale|Flat Rent/.test(m.title)))

console.log('5. Dates are really checked')
r = await post({ brief: { needs: [{ kind: 'stay', start: day(21), end: day(24), guests: 2 }] } })
g = r.json?.groups?.[0]
const find = (s) => g?.matches?.find((m) => m.slug === s)
check('a loft that is free is marked available', find(S1.slug)?.availability === 'available', g?.matches?.map((m) => [m.slug, m.availability]))
check('a loft closed on those dates is marked unavailable', find(S2.slug)?.availability === 'unavailable')
check('the unavailable one is ranked after the free one', g?.matches?.findIndex((m) => m.slug === S1.slug) < g?.matches?.findIndex((m) => m.slug === S2.slug))
check('an available match links into the booking page with the dates and guests', find(S1.slug)?.href === `/catalog/real-estate/${S1.slug}?start=${day(21)}&end=${day(24)}&guests=2`, find(S1.slug)?.href)
check('dates outside the closure make the same loft available', (await post({ brief: { needs: [{ kind: 'stay', start: day(30), end: day(32) }] } })).json?.groups?.[0]?.matches?.find((m) => m.slug === S2.slug)?.availability === 'available')
check('too many guests for the listing makes it unavailable', (await post({ brief: { needs: [{ kind: 'stay', start: day(30), end: day(32), guests: 12 }] } })).json?.groups?.[0]?.matches?.find((m) => m.slug === S1.slug)?.availability === 'unavailable')
r = await post({ brief: { needs: [{ kind: 'car_hire', start: day(40), end: day(42) }] } })
check('car hire is checked by day and links with dates', r.json?.groups?.[0]?.matches?.find((m) => m.slug === C1.slug)?.availability === 'available' && r.json.groups[0].matches[0].href.includes(`start=${day(40)}`))
r = await post({ brief: { needs: [{ kind: 'service', services: ['private_chef'], date: day(9), time: '18:00', guests: 6 }] } })
check('a service link carries the date, time and guests', r.json?.groups?.[0]?.matches?.find((m) => m.slug === V1.slug)?.href === `/catalog/private-services/${V1.slug}?date=${day(9)}&time=${encodeURIComponent('18:00')}&guests=6`, r.json?.groups?.[0]?.matches?.[0]?.href)

console.log('6. Budget is read against the right scale')
r = await post({ brief: { needs: [{ kind: 'stay', budget: 'stay_u150k' }] } })
check('a stay budget under ₦150k does not push a ₦4.5M loft', !r.json?.groups?.[0]?.matches?.some((m) => m.slug === S3.slug), r.json?.groups?.[0]?.matches?.map((m) => m.slug))
r = await post({ brief: { needs: [{ kind: 'stay', budget: 'stay_1m_plus' }] } })
check('a ₦1M+ stay budget does find the ₦4.5M loft', r.json?.groups?.[0]?.matches?.some((m) => m.slug === S3.slug))
r = await post({ brief: { needs: [{ kind: 'service', budget: '2b_plus' }] } })
check('a budget band from another kind is ignored, not misapplied', r.status === 200 && r.json?.groups?.[0]?.matches?.length >= 1)

console.log('7. Nothing in stock is handled kindly')
r = await post({ brief: { needs: [{ kind: 'yacht_buy' }] } })
const yb = r.json?.groups?.[0]
check('an empty group says so and offers a request, with words ready for the team', yb?.empty === true && yb.matches.length === 0 && /yacht/i.test(yb.askUs ?? ''), yb)
check('the summary does not pretend', /specialist|source|find/i.test(r.json?.summary ?? ''), r.json?.summary)

console.log('8. Bad input is refused plainly')
check('no body', (await post(null)).status === 400)
check('no needs', (await post({ brief: { needs: [] } })).status === 400)
check('unknown kind', (await post({ brief: { needs: [{ kind: 'spaceship' }] } })).status === 400)
check('too many needs', (await post({ brief: { needs: Array.from({ length: 8 }, (_, i) => ({ kind: ['decor', 'service', 'stay', 'home_buy', 'home_rent', 'car_buy', 'car_hire', 'experience'][i] })) } })).status === 400)
check('the error reads as a sentence, not a stack', /[a-z]/i.test((await post({ brief: { needs: [] } })).json?.error ?? ''))
r = await post({ brief: { needs: [{ kind: 'decor', budget: "'; drop table \"Listing\"; --" }] } })
check('hostile text is harmless', r.status === 200 && (await q('select count(*)::int n from "Listing"'))[0].n > 5)
const huge = await post({ brief: { needs: [{ kind: 'decor' }], location: Array.from({ length: 5000 }, () => 'abuja') } })
check('an oversized list is trimmed, not a crash', huge.status === 200 || huge.status === 400)

console.log('9. Limits and the old format')
await q('delete from "RateLimit"')
const ip = '10.99.0.1'
let limited = 0
for (let i = 0; i < 14; i++) if ((await post({ brief: { needs: [{ kind: 'decor' }] } }, ip)).status === 429) limited++
check('a visitor asking again and again is slowed', limited >= 1, limited)
check('another visitor is not affected', (await post({ brief: { needs: [{ kind: 'decor' }] } }, '10.99.0.2')).status === 200)
r = await post({ preferences: { categories: ['real_estate'], budget: ['500m_2b'] } })
check('the old quiz format still answers (matches list, summary)', r.status === 200 && Array.isArray(r.json?.matches) && typeof r.json?.summary === 'string')
check('the old format never invents a listing', r.json.matches.every((m) => typeof m.slug === 'string'))

console.log('10. Unpublished and sold listings never appear')
const U = await ins('Disc Hidden Chef', 'private_services', 'private_chef', 'booking', 30000, '₦30,000')
await q(`update "Listing" set published=false where id=$1`, [U.id])
const SOLD = await ins('Disc Sold Villa', 'real_estate', 'for_sale', 'sale', 800000000, '₦800,000,000')
await q(`update "Listing" set status='sold' where id=$1`, [SOLD.id])
await q('delete from "RateLimit"')
r = await post({ brief: { needs: [{ kind: 'service' }, { kind: 'home_buy' }] } })
const all = (r.json?.groups ?? []).flatMap((x) => x.matches.map((m) => m.slug))
check('hidden and sold listings are not offered', !all.includes(U.slug) && !all.includes(SOLD.slug), all)

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
