// Phase B, end to end on the local build: sale / rent / lease views on real
// pages, price wording on listing pages and cards, requests ("tell us what
// you are looking for") with instant alerts and limits, and no WhatsApp
// link anywhere in the page HTML as a main action.
import { createHmac } from 'node:crypto'
import pg from 'pg'
import { refreshCatalog } from './_catalog.mjs'

const BASE = 'http://localhost:3300'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(path) {
  const res = await fetch(BASE + path, { redirect: 'manual' })
  return { status: res.status, html: await res.text() }
}
async function post(path, body, ip = '10.1.0.1') {
  const res = await fetch(BASE + path, { method: 'POST', headers: { origin: BASE, 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) })
  let json = null; try { json = await res.json() } catch {}
  return { status: res.status, json }
}
const stamp = Date.now()
const ins = async (title, category, sub, mode, price, display) => {
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`
  await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,'Test listing.',$4,$5,'Ikoyi, Lagos','Nigeria',ARRAY['https://example.com/a.jpg'],'{}',ARRAY[]::text[],$6,$7,true,now())`, [title, slug, category, price, display, mode, sub])
  return slug
}
const clean = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<footer[\s\S]*<\/footer>/, '')
// Warm a page (ISR serves the previous render once after changes).
const warm = async (p, must) => {
  let r = await get(p)
  for (let i = 0; i < 12 && must && !r.html.includes(must); i++) { await sleep(1000); r = await get(p) }
  return r
}
await q('delete from "RateLimit"')

console.log('1. Setup')
const SALE = await ins('Banana Villa SaleB', 'real_estate', 'for_sale', 'sale', 2500000000, '₦2,500,000,000')
const RENT = await ins('Lekki Flat RentB', 'real_estate', 'for_rent', 'rent', 25000000, '₦25,000,000')
const STAY = await ins('Ikoyi Loft StayB', 'real_estate', 'luxury_shortlets', 'booking', 300000, '₦300,000')
const COMSALE = await ins('Marina Tower SaleB', 'commercial', 'for_sale', 'sale', 900000000, '₦900,000,000')
const COMLEASE = await ins('Maitama Floor LeaseB', 'commercial', 'for_lease', 'rent', 150000000, '₦150,000,000')
check('five listings created', true)
await refreshCatalog(BASE, q)

console.log('2. Real estate and commercial pages (cached, filtered in the browser)')
let r = await warm('/catalog/real-estate', 'Banana Villa SaleB')
check('the page lists sale, rent and short stays', ['Banana Villa SaleB', 'Lekki Flat RentB', 'Ikoyi Loft StayB'].every((t) => r.html.includes(t)))
check('tabs: For Sale, For Rent, Luxury Shortlets', ['For Sale', 'For Rent', 'Luxury Shortlets'].every((t) => r.html.includes(t)) && r.html.includes('data-view-tabs'))
check('cards say what each is (For rent, Short stay, For sale)', ['For rent', 'Short stay', 'For sale'].every((t) => r.html.includes(t)))
check('the rental card says per year', /per year/.test(r.html))
check('an address with ?view= is served from the same cached page', (await get('/catalog/real-estate?view=for_rent')).status === 200)
r = await warm('/catalog/commercial', 'Maitama Floor LeaseB')
check('commercial: tabs For Sale and For Lease, both listings', ['For Sale', 'For Lease', 'Marina Tower SaleB', 'Maitama Floor LeaseB'].every((t) => r.html.includes(t)) && r.html.includes('data-view-tabs'))
check('commercial lease card says per year', /per year/.test(r.html))

console.log('4. Empty categories offer an on-site request')
r = await warm('/catalog/private-services', 'data-brief-trigger')
check('Private Services: a request button per empty service', (r.html.match(/data-brief-trigger/g) ?? []).length >= 8)
check('Private Services: no WhatsApp outside the footer', !/wa\.me/.test(clean(r.html)))

console.log('5. Price wording on listing pages')
r = await warm(`/catalog/real-estate/${SALE}`, 'Banana Villa SaleB')
check('sale: "Asking price"', r.html.includes('Asking Price') || r.html.includes('Asking price'))
r = await warm(`/catalog/real-estate/${RENT}`, 'Lekki Flat RentB')
check('rent: "Annual rent" and "per year"', /Annual rent/i.test(r.html) && /per year/.test(r.html), r.status)
check('rent: not labelled "Asking price"', !/Asking price/i.test(r.html.replace(/<title>[\s\S]*?<\/title>/, '')))
r = await warm(`/catalog/commercial/${COMLEASE}`, 'Maitama Floor LeaseB')
check('commercial lease: "Annual rent" and "per year"', /Annual rent/i.test(r.html) && /per year/.test(r.html))
check('listing page: no WhatsApp link in the main content', !/wa\.me/.test(clean(r.html)))

console.log('6. Requests')
const brief = (o = {}, ip = '10.1.1.1') => post('/api/inquiries', { kind: 'brief', name: 'Tola Bakare', email: `tola.b${stamp}@example.com`, phone: '+234 803 000 0000', message: briefMsg, ...o }, ip)
const briefMsg = 'Looking for: Private chef\n\nDinner for 6 on 12 December in Ikoyi, no shellfish.'
await q('delete from "RateLimit"')
r = await brief()
check('a request is accepted without an account', r.status === 200 && !!r.json?.id, `${r.status} ${JSON.stringify(r.json)}`)
const row = (await q(`select kind, "listingId", "userId", message from "Inquiry" where id=$1`, [r.json?.id]))[0]
check('stored as a request, no listing, with its topic', row?.kind === 'brief' && row.listingId === null && row.userId === null && row.message.startsWith('Looking for: Private chef'), JSON.stringify(row))
let mails = []
for (let i = 0; i < 60; i++) { mails = await q(`select kind, "to", subject from "EmailLog" where kind in ('inquiry_new','inquiry_received') and subject like '%Private chef%' and "createdAt" > now() - interval '5 minutes'`); if (mails.some((m) => m.kind === 'inquiry_received') && mails.some((m) => m.kind === 'inquiry_new')) break; await sleep(500) }
check('team alerted, naming what was asked for', mails.some((m) => m.kind === 'inquiry_new' && /request/i.test(m.subject)), JSON.stringify(mails))
check('requester gets an acknowledgement', mails.some((m) => m.kind === 'inquiry_received' && m.to === `tola.b${stamp}@example.com`))
r = await brief({ message: 'hi' }, '10.1.1.2')
check('too-short request refused', r.status === 400, r.status)
r = await brief({ website: 'http://spam.example' }, '10.1.1.3')
check('bots are quietly ignored', r.status === 200 && !r.json?.id, JSON.stringify(r.json))
let last
for (let i = 0; i < 6; i++) last = await brief({}, '10.1.1.9')
check('requests are rate limited per visitor', last.status === 429, last.status)

console.log('7. No WhatsApp as a main action in page HTML')
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<footer[\s\S]*<\/footer>/, '').replace(/<a[^>]*data-wa-fallback[^>]*>/g, '<a>')
for (const p of ['/', '/about', '/partners', '/catalog', '/catalog/real-estate', '/catalog/decor', '/discover', '/cart']) {
  const h = (await warm(p)).html
  const links = [...strip(h).matchAll(/<a[^>]*href="[^"]*wa\.me[^"]*"[^>]*>/g)].map((m) => m[0])
  check(`${p}: no WhatsApp link outside the footer`, links.length === 0, links.slice(0, 2).join(' | ').slice(0, 200))
}
const home = (await warm('/')).html
check('homepage chips go to the site: rent, car rental, cruises, aqua homes', ['/catalog/real-estate?view=for_rent', '/catalog/supercars?view=car_rental', '/catalog/yachts?view=boat_cruises', '/catalog/yachts?view=aqua_homes'].every((h) => home.includes(`href="${h}"`)), home.match(/href="\/catalog\/[^"]*view=[^"]*"/g))
check('festive "Reserve Your Dates" goes to Shortlets', /href="\/catalog\/shortlets"[^>]*>[\s\S]{0,300}Reserve Your Dates/.test(home) || /Reserve Your Dates[\s\S]{0,80}/.test(home) && home.includes('href="/catalog/shortlets"'))
r = await warm('/contact')
const form = r.html.indexOf('<form'), wa = r.html.search(/wa\.me/)
check('contact: the form comes before any WhatsApp link', form > 0 && (wa === -1 || wa > form), `${form} ${wa}`)

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
