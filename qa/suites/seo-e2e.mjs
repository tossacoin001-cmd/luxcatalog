// SEO on the real pages of the local build: what a search engine or a link
// preview reads. Run from the repo root with the app on :3300.
// The site address comes from NEXT_PUBLIC_APP_URL, so when the domain changes
// nothing in the pages needs editing: this suite proves no address is
// hard-coded (the local build must never mention vercel.app).
import pg from 'pg'
import { refreshCatalog } from './_catalog.mjs'

const BASE = process.env.BASE ?? 'http://localhost:3300'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') })
await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stamp = Date.now()
const get = async (path, init) => {
  const res = await fetch(BASE + path, { redirect: 'manual', ...init })
  const buf = Buffer.from(await res.arrayBuffer())
  return { status: res.status, headers: res.headers, buf, text: buf.toString('utf8') }
}
const head = (html) => html.slice(0, html.indexOf('</head>') + 7)
const meta = (html, key, attr = 'name') => {
  const m = [...head(html).matchAll(/<meta\s+[^>]*>/g)].map((x) => x[0]).find((t) => new RegExp(`${attr}="${key}"`).test(t))
  const c = m?.match(/content="([^"]*)"/)
  return c ? c[1].replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"') : null
}
const metas = (html, key, attr = 'property') => [...head(html).matchAll(/<meta\s+[^>]*>/g)].map((x) => x[0]).filter((t) => new RegExp(`${attr}="${key}"`).test(t)).map((t) => (t.match(/content="([^"]*)"/) ?? [])[1])
const titleOf = (html) => (head(html).match(/<title>([^<]*)<\/title>/) ?? [])[1]?.replaceAll('&amp;', '&').replaceAll('&#x27;', "'")
const canonical = (html) => (head(html).match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) ?? head(html).match(/<link[^>]*href="([^"]*)"[^>]*rel="canonical"/) ?? [])[1]
const body = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '')
const h1s = (html) => [...body(html).matchAll(/<h1[\s>][\s\S]*?<\/h1>/g)].map((m) => m[0].replace(/<[^>]+>/g, '').trim())
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]) } catch { return { __bad: m[1].slice(0, 80) } } })
const ldOfType = (html, t) => ld(html).flatMap((x) => (Array.isArray(x) ? x : x['@graph'] ?? [x])).find((x) => x['@type'] === t)
await q('delete from "RateLimit"')

console.log('1. Setup')
const mk = async (title, category, sub, mode, price, display, extra = {}) => {
  const slug = `seo-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`
  await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,status,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,'Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200','/relative.jpg'],'{}',ARRAY[]::text[],$8,$9,$10,$11,now())`,
    [title, slug, category, extra.description ?? `${title}: a bright and generous residence with sea views, a private lift and round-the-clock power, set in a quiet and secure part of the island.`, price, display, extra.location ?? 'Ikoyi, Lagos', mode, sub, extra.status ?? 'available', extra.published ?? true])
  return slug
}
const SALE = await mk('Seo Villa Sale', 'real_estate', 'for_sale', 'sale', 900000000, '₦900,000,000')
const RENT = await mk('Seo Flat Rent', 'real_estate', 'for_rent', 'rent', 25000000, '₦25,000,000')
const STAY = await mk('Seo Loft Stay', 'real_estate', 'luxury_shortlets', 'booking', 300000, '₦300,000')
const POA = await mk('Seo Trophy Home', 'real_estate', 'for_sale', 'sale', null, 'Price On Application')
const SOLD = await mk('Seo Sold House', 'real_estate', 'for_sale', 'sale', 700000000, '₦700,000,000', { status: 'sold' })
const DRAFT = await mk('Seo Draft House', 'real_estate', 'for_sale', 'sale', 600000000, '₦600,000,000', { published: false })
const EVIL = await mk('Seo Evil Name', 'real_estate', 'for_sale', 'sale', 500000000, '₦500,000,000')
await q(`update "Listing" set title=$1, description=$2 where slug=$3`, ['</script><script>alert(1)</script> "Quote" & <b>Bold</b>', 'Tom & Jerry\'s <script>alert(2)</script> home with a "pool".', EVIL])
await refreshCatalog(BASE, q)
for (const [p, must] of [[`/catalog/real-estate/${SALE}`, 'Seo Villa Sale'], [`/catalog/real-estate/${EVIL}`, 'Quote']]) {
  for (let i = 0; i < 30; i++) { if ((await get(p)).text.includes(must)) break; await sleep(1000) }
}
check('seven listings created (live, rent, stay, price on application, sold, draft, hostile text)', true)

const STATIC = ['/', '/about', '/catalog', '/discover', '/contact', '/partners', '/privacy', '/terms']
const CATS = ['real-estate', 'shortlets', 'supercars', 'yachts', 'decor', 'commercial', 'lifestyle', 'executive-services', 'private-services'].map((c) => `/catalog/${c}`)
const LISTING = [`/catalog/real-estate/${SALE}`, `/catalog/real-estate/${RENT}`, `/catalog/real-estate/${STAY}`, `/catalog/real-estate/${POA}`, `/catalog/real-estate/${SOLD}`]
const pages = {}
for (const p of [...STATIC, ...CATS, ...LISTING]) pages[p] = await get(p)

console.log('2. Every public page has a title, a description and one canonical address')
const titles = {}, descs = {}
for (const [p, r] of Object.entries(pages)) {
  const t = titleOf(r.text), d = meta(r.text, 'description'), c = canonical(r.text)
  titles[p] = t; descs[p] = d
  check(`${p}: opens`, r.status === 200, `${r.status}`)
  check(`${p}: title present, names the brand, fits 70 characters`, !!t && /Lux Catalog/.test(t) && t.length <= 70, `${t} (${t?.length})`)
  check(`${p}: description present, 70 to 165 characters`, !!d && d.length >= 70 && d.length <= 165, `${d?.length}`)
  check(`${p}: canonical is absolute, on this site, no query, matches the page`, c === `${BASE}${p === '/' ? '' : p}` || c === `${BASE}${p}`, c)
  check(`${p}: exactly one heading level 1`, h1s(r.text).length === 1 && h1s(r.text)[0].length > 2, h1s(r.text))
  check(`${p}: no address of another site is hard-coded`, !/vercel\.app/.test(r.text), (r.text.match(/.{20}vercel\.app.{10}/) ?? [''])[0])
}
check('no two pages share a title', new Set(Object.values(titles)).size === Object.keys(titles).length, Object.entries(titles).filter(([, t], i, a) => a.filter(([, u]) => u === t).length > 1))
check('no two pages share a description', new Set(Object.values(descs)).size === Object.keys(descs).length, Object.entries(descs).filter(([, t], i, a) => a.filter(([, u]) => u === t).length > 1).map(([p]) => p))

console.log('3. Brand and place words where searchers look')
check('the home title starts with the brand', /^Lux Catalog/.test(titles['/']), titles['/'])
check('the home title and description say Lagos', /Lagos/.test(titles['/']) && /Lagos/.test(descs['/']))
check('the home description says Nigeria somewhere in the page data', /Nigeria/.test(descs['/']) || JSON.stringify(ld(pages['/'].text)).includes('Nigeria'))
check('real estate, shortlets, cars and yachts pages say Lagos in the title', ['/catalog/real-estate', '/catalog/shortlets', '/catalog/supercars', '/catalog/yachts'].every((p) => /Lagos/.test(titles[p])), ['/catalog/real-estate', '/catalog/shortlets', '/catalog/supercars', '/catalog/yachts'].map((p) => titles[p]))
check('the services page title says what the services are', /Chef|Massage|Barber/i.test(titles['/catalog/private-services']), titles['/catalog/private-services'])
check('a listing page title carries the listing name and the place', /Seo Villa Sale/.test(titles[LISTING[0]]) && /Ikoyi|Lagos/.test(titles[LISTING[0]]), titles[LISTING[0]])
check('html language is declared', /<html[^>]*lang="en/.test(pages['/'].text))
check('the brand is spelled "Lux Catalog" in the site name and nowhere as "LuxCatalog" or "Lux-Catalog" in titles', Object.values(titles).every((t) => !/LuxCatalog|Lux-Catalog/.test(t)))

console.log('4. Link previews (Open Graph and Twitter)')
for (const p of ['/', '/catalog', '/catalog/real-estate', LISTING[0]]) {
  const h = pages[p].text
  check(`${p}: og title, description, url, site name, type, locale`, !!meta(h, 'og:title', 'property') && !!meta(h, 'og:description', 'property') && meta(h, 'og:url', 'property')?.startsWith(BASE) && meta(h, 'og:site_name', 'property') === 'Lux Catalog' && !!meta(h, 'og:type', 'property') && /en_NG|en_US|en/.test(meta(h, 'og:locale', 'property') ?? ''), { t: meta(h, 'og:title', 'property'), u: meta(h, 'og:url', 'property'), l: meta(h, 'og:locale', 'property') })
  const img = meta(h, 'og:image', 'property')
  check(`${p}: og image is an absolute address on this site`, !!img && img.startsWith(BASE), img)
  check(`${p}: twitter card is the large-image kind with an image`, meta(h, 'twitter:card') === 'summary_large_image' && !!meta(h, 'twitter:image'), meta(h, 'twitter:card'))
  check(`${p}: og and twitter titles agree`, meta(h, 'og:title', 'property') === meta(h, 'twitter:title'))
}
const og = await get('/opengraph-image')
check('the shared preview image loads as a PNG of a sensible size', og.status === 200 && /image\/png/.test(og.headers.get('content-type') ?? '') && og.buf.length > 4000 && og.buf.length < 600000, `${og.status} ${og.headers.get('content-type')} ${og.buf.length}`)
check('it is 1200 by 630 (the size every platform expects)', og.buf.length > 24 && og.buf.readUInt32BE(16) === 1200 && og.buf.readUInt32BE(20) === 630, og.buf.length > 24 ? [og.buf.readUInt32BE(16), og.buf.readUInt32BE(20)] : 'short')
const og2 = meta(pages['/'].text, 'og:image', 'property')
check('the address in the page serves that same image', og2 && (await get(new URL(og2).pathname)).status === 200)

console.log('5. Structured data')
for (const p of [...STATIC, ...CATS, ...LISTING]) {
  const blocks = ld(pages[p].text)
  check(`${p}: every JSON-LD block is valid JSON with a schema.org context`, blocks.every((b) => !b.__bad && JSON.stringify(b).includes('schema.org')), blocks.filter((b) => b.__bad))
}
const homeOrg = ldOfType(pages['/'].text, 'Organization')
check('home: Organization with name, url, absolute logo, Nigeria', homeOrg?.name === 'Lux Catalog' && homeOrg.url === BASE && homeOrg.logo?.startsWith(BASE) && JSON.stringify(homeOrg).includes('Nigeria'), homeOrg)
check('home: its logo address loads as an image', homeOrg?.logo && (await get(new URL(homeOrg.logo).pathname)).status === 200)
check('home: WebSite with name and url', ldOfType(pages['/'].text, 'WebSite')?.name === 'Lux Catalog')
check('Organization is on the home page only (once, not repeated on every page)', STATIC.slice(1).concat(CATS).every((p) => !ldOfType(pages[p].text, 'Organization')))
const bcReal = ldOfType(pages['/catalog/real-estate'].text, 'BreadcrumbList')
check('a category page has breadcrumbs: Home, Catalog, the category', bcReal?.itemListElement?.length === 3 && bcReal.itemListElement[0].item === `${BASE}/` && bcReal.itemListElement[2].item === `${BASE}/catalog/real-estate`, bcReal)
const pSale = ldOfType(pages[LISTING[0]].text, 'Product')
check('a for-sale listing is a Product with its name, image, sku and url', pSale?.name === 'Seo Villa Sale' && pSale.sku === SALE && pSale.url === `${BASE}${LISTING[0]}` && pSale.image?.[0]?.startsWith('https://'), pSale)
check('its relative image became an absolute address on this site', pSale?.image?.includes(`${BASE}/relative.jpg`), pSale?.image)
check('its offer is ₦900,000,000 in NGN, in stock', pSale?.offers?.price === 900000000 && pSale.offers.priceCurrency === 'NGN' && /InStock/.test(pSale.offers.availability), pSale?.offers)
const pRent = ldOfType(pages[LISTING[1]].text, 'Product')
check('a rental says the price is per year', pRent?.offers?.priceSpecification?.unitText === 'YEAR', pRent?.offers)
const pStay = ldOfType(pages[LISTING[2]].text, 'Product')
check('a shortlet says the price is per night', pStay?.offers?.priceSpecification?.unitText === 'NIGHT', pStay?.offers)
const pPoa = ldOfType(pages[LISTING[3]].text, 'Product')
check('price on application has a Product but no offer', !!pPoa && !('offers' in pPoa), pPoa)
const pSold = ldOfType(pages[LISTING[4]].text, 'Product')
check('a sold listing is marked SoldOut', /SoldOut/.test(pSold?.offers?.availability ?? ''), pSold?.offers)
const bcListing = ldOfType(pages[LISTING[0]].text, 'BreadcrumbList')
check('a listing page has breadcrumbs ending at the listing', bcListing?.itemListElement?.length === 4 && bcListing.itemListElement[3].name === 'Seo Villa Sale', bcListing?.itemListElement?.map((i) => i.name))

console.log('6. Hostile text cannot break out of the page or the data')
const evil = await get(`/catalog/real-estate/${EVIL}`)
check('the page opens', evil.status === 200, `${evil.status}`)
check('no raw script tag from a listing title or description is in the page', !evil.text.includes('</script><script>alert(1)') && !evil.text.includes('<script>alert(2)'))
check('the structured data still parses', ld(evil.text).every((b) => !b.__bad))
check('and carries the original title, exactly', ldOfType(evil.text, 'Product')?.name === '</script><script>alert(1)</script> "Quote" & <b>Bold</b>', ldOfType(evil.text, 'Product')?.name)
check('the description in structured data is plain text', !/[<>]/.test(ldOfType(evil.text, 'Product')?.description ?? ''), ldOfType(evil.text, 'Product')?.description)
check('the page title and meta description carry no raw angle brackets', !/[<>]/.test(titleOf(evil.text) ?? '') && !/[<>]/.test(meta(evil.text, 'description') ?? ''))

console.log('7. Unpublished and missing things')
const draft = await get(`/catalog/real-estate/${DRAFT}`)
check('a draft listing is not found', draft.status === 404, `${draft.status}`)
check('and it does not describe itself in the page', !draft.text.includes('Seo Draft House'))
const nf = await get('/catalog/real-estate/definitely-not-a-listing')
check('an unknown listing is a real 404', nf.status === 404)
check('a 404 page tells search engines not to index it', /noindex/.test(meta(nf.text, 'robots') ?? ''), meta(nf.text, 'robots'))
check('an unknown category is a real 404', (await get('/catalog/nonsense')).status === 404)

console.log('8. robots.txt')
const robots = await get('/robots.txt')
check('it loads as plain text', robots.status === 200 && /text\/plain/.test(robots.headers.get('content-type') ?? ''))
check('it allows the public site and names the sitemap on this site', /Allow: \//.test(robots.text) && robots.text.includes(`Sitemap: ${BASE}/sitemap.xml`), robots.text)
check('it keeps private areas out', ['/admin', '/dashboard', '/saved', '/cart', '/checkout', '/api/', '/account', '/bookings'].every((d) => robots.text.includes(`Disallow: ${d}`)), robots.text)
check('it does not block the whole site', !/Disallow: \/\s*$/m.test(robots.text))

console.log('9. sitemap.xml')
const sm = await get('/sitemap.xml')
const locs = [...sm.text.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replaceAll('&amp;', '&'))
check('it is XML', sm.status === 200 && /xml/.test(sm.headers.get('content-type') ?? '') && sm.text.startsWith('<?xml'))
check('every address is absolute and on this site', locs.length > 15 && locs.every((l) => l.startsWith(BASE)), locs.filter((l) => !l.startsWith(BASE)).slice(0, 3))
check('no address appears twice', new Set(locs).size === locs.length)
check('live listings are in it', [SALE, RENT, STAY, POA].every((s) => locs.some((l) => l.endsWith(`/${s}`))))
check('a sold listing stays listed (people still search for it)', locs.some((l) => l.endsWith(`/${SOLD}`)))
check('a draft is not in it', !locs.some((l) => l.endsWith(`/${DRAFT}`)))
check('the pages that must never be indexed are not in it', !locs.some((l) => /\/(admin|dashboard|account|cart|checkout|sign-in|sign-up|saved|bookings)(\/|$)/.test(l)))
check('every address in it opens (200)', await (async () => { const bad = []; for (const l of locs) { const r = await fetch(l, { redirect: 'manual' }); if (r.status !== 200) bad.push([l, r.status]) } return bad.length === 0 ? true : bad.slice(0, 4) })())
check('listings carry a last-modified date', /<lastmod>/.test(sm.text))

console.log('10. Private pages tell search engines to stay away')
for (const p of ['/sign-in', '/sign-up', '/forgot-password', '/cart', '/checkout', '/dashboard', '/account', '/saved', '/admin', '/bookings']) {
  const r = await get(p)
  check(`${p}: noindex in the response headers`, /noindex/.test(r.headers.get('x-robots-tag') ?? ''), `${r.status} ${r.headers.get('x-robots-tag')}`)
}
for (const p of ['/', '/catalog', '/about', LISTING[0]]) {
  const r = pages[p]
  check(`${p}: public pages are not marked noindex`, !/noindex/.test(r.headers.get('x-robots-tag') ?? '') && !/noindex/.test(meta(r.text, 'robots') ?? ''))
}
check('API responses are not indexable either', /noindex/.test((await get('/api/health')).headers.get('x-robots-tag') ?? ''))

console.log('11. App icons and install data')
const mf = await get('/manifest.webmanifest')
let mj = null; try { mj = JSON.parse(mf.text) } catch {}
check('the manifest loads and is valid', mf.status === 200 && !!mj, `${mf.status}`)
check('it has name, short name, start address, display and colours', mj?.name && mj.short_name && mj.start_url && mj.display && mj.theme_color && mj.background_color, mj)
check('its name is the brand', /Lux Catalog/.test(mj?.name ?? ''))
check('every icon it lists loads as an image', await (async () => { for (const i of mj?.icons ?? []) { const r = await get(new URL(i.src, BASE).pathname); if (r.status !== 200 || !/image/.test(r.headers.get('content-type') ?? '')) return [i.src, r.status] } return (mj?.icons ?? []).length >= 2 })())
check('the page links to the manifest and an icon', /rel="manifest"/.test(head(pages['/'].text)) && /rel="icon"/.test(head(pages['/'].text)))
check('there is an Apple touch icon', (await get('/apple-icon')).status === 200)
check('favicon.ico still loads', (await get('/favicon.ico')).status === 200)

console.log('12. Verification codes appear only when set')
check('no empty verification tag is emitted', !/google-site-verification" content=""/.test(pages['/'].text) && !/msvalidate\.01" content=""/.test(pages['/'].text))

console.log('13. Images describe themselves')
const imgs = [...body(pages[LISTING[0]].text).matchAll(/<img\b[^>]*>/g)].map((m) => m[0])
check('every image on a listing page has an alt attribute', imgs.length > 0 && imgs.every((t) => /\balt="/.test(t)), imgs.filter((t) => !/\balt=/.test(t)).slice(0, 2))
check('the main photo’s alt names the listing', imgs.some((t) => /alt="Seo Villa Sale/.test(t)))

console.log(`\n${pass} passed, ${fail} failed`)
await db.end()
process.exit(fail ? 1 : 0)
