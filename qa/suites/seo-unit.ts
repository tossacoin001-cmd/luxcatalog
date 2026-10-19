// SEO rules, pure: titles, descriptions, structured data (JSON-LD) and URLs.
// Run: npx tsx qa/suites/seo-unit.ts
import {
  SITE, absoluteUrl, safeJsonLd, trimDescription, organizationLd, websiteLd, breadcrumbLd, listingLd,
  categoryTitle, categoryDescription, listingTitle, homeTitle, homeDescription, type LdListing,
} from '../../src/lib/seo'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const BASE = 'https://example.test'
const noUndefined = (o: unknown): boolean => {
  if (o === undefined) return false
  if (Array.isArray(o)) return o.every(noUndefined)
  if (o && typeof o === 'object') return Object.values(o).every(noUndefined)
  return !(typeof o === 'number' && !Number.isFinite(o))
}
const CATEGORIES = ['real_estate', 'shortlet', 'supercar', 'yacht', 'decor', 'commercial', 'lifestyle', 'executive_services', 'private_services']

console.log('1. Absolute URLs')
check('a path is joined to the site address', absoluteUrl(BASE, '/catalog') === `${BASE}/catalog`)
check('a trailing slash on the base does not double up', absoluteUrl(`${BASE}/`, '/catalog') === `${BASE}/catalog`)
check('a path without a leading slash still works', absoluteUrl(BASE, 'catalog') === `${BASE}/catalog`)
check('an absolute https address is kept', absoluteUrl(BASE, 'https://cdn.test/a.jpg') === 'https://cdn.test/a.jpg')
check('an absolute http address is kept', absoluteUrl(BASE, 'http://cdn.test/a.jpg') === 'http://cdn.test/a.jpg')
check('a script address is refused', absoluteUrl(BASE, 'javascript:alert(1)') === null)
check('a data address is refused', absoluteUrl(BASE, 'data:text/html,<b>x</b>') === null)
check('nothing in, nothing out', absoluteUrl(BASE, '') === null && absoluteUrl(BASE, undefined as never) === null)
check('the site root is the base itself', absoluteUrl(BASE, '/') === `${BASE}/`)

console.log('2. Safe JSON for a script tag')
const evil = safeJsonLd({ name: '</script><script>alert(1)</script>', note: 'a & b <c>', line: 'x y z' })
check('no raw "<" survives', !evil.includes('<'))
check('no raw ">" or "&" survives', !evil.includes('>') && !evil.includes('&'))
check('no raw line separators survive', !evil.includes(' ') && !evil.includes(' '))
check('it parses back to exactly what went in', (() => { const o = JSON.parse(evil); return o.name === '</script><script>alert(1)</script>' && o.note === 'a & b <c>' && o.line === 'x y z' })())
check('a plain object is unchanged in meaning', JSON.parse(safeJsonLd({ a: 1, b: 'x' })).a === 1)

console.log('3. Descriptions')
check('short text is kept as it is', trimDescription('A quiet home in Ikoyi.') === 'A quiet home in Ikoyi.')
check('whitespace and line breaks are tidied', trimDescription('A  home\n\nwith   a\tjetty.') === 'A home with a jetty.')
check('HTML tags are removed', trimDescription('<p>A <b>grand</b> home</p>') === 'A grand home')
check('long text is cut at a word, with an ellipsis, within the limit', (() => { const t = trimDescription('word '.repeat(80), 155); return t.length <= 155 && t.endsWith('…') && !/\sword…$/.test(t.slice(0, -1) + 'x') })())
check('the cut never ends mid-word', (() => { const t = trimDescription('abcdefghij '.repeat(30), 50); return t.endsWith('…') && /abcdefghij…$/.test(t) })())
check('a single very long word is still cut inside the limit', trimDescription('x'.repeat(400), 100).length <= 100)
check('empty and undefined become an empty string', trimDescription('') === '' && trimDescription(undefined as never) === '')
check('the default limit is 155 characters', trimDescription('word '.repeat(100)).length <= 155)

console.log('4. Site-wide titles and descriptions')
check('the home title starts with the brand', homeTitle().startsWith(SITE.name))
check('the home title says what we are and where', /Lagos/.test(homeTitle()) && /Luxury/i.test(homeTitle()))
check('the home title fits a results page (70 characters)', homeTitle().length <= 70, homeTitle().length)
check('the home description is a real sentence of a sensible length', homeDescription().length >= 110 && homeDescription().length <= 160, homeDescription().length)
check('the home description names Lagos and Nigeria', /Lagos/.test(homeDescription()) && /Nigeria/.test(homeDescription() + SITE.country))
check('the brand name is spelled one way', SITE.name === 'Lux Catalog')

console.log('5. Category titles and descriptions')
const titles = CATEGORIES.map((c) => categoryTitle(c))
const descs = CATEGORIES.map((c) => categoryDescription(c))
check('every category has a title', titles.every((t) => t.length > 10))
check('every category title is unique', new Set(titles).size === titles.length, titles)
check('with the brand added, each title still fits 70 characters', titles.every((t) => `${t} | ${SITE.name}`.length <= 70), titles.map((t) => `${t} | ${SITE.name}`.length))
check('every category title names a place people search for', titles.every((t) => /Lagos|Nigeria/.test(t)), titles)
check('every category description is unique and sensible', new Set(descs).size === descs.length && descs.every((d) => d.length >= 90 && d.length <= 160), descs.map((d) => d.length))
check('an unknown category falls back to something sensible, never throws', (() => { try { return categoryTitle('nonsense').length > 5 && categoryDescription('nonsense').length > 20 } catch { return false } })())
check('nothing says undefined or null', [...titles, ...descs].every((t) => !/undefined|null/.test(t)))

console.log('6. Listing titles')
const L: LdListing = {
  title: 'Brand New Three Bedroom Apartment', description: 'A bright three-bedroom apartment with sea views, a private lift and 24-hour power in the heart of Ikoyi.',
  slug: 'brand-new-three-bedroom', category: 'real_estate', subcategory: 'for_sale', price: 900_000_000, priceDisplay: '₦900,000,000',
  images: ['/a.jpg', 'https://cdn.test/b.jpg'], location: 'Ikoyi, Lagos', country: 'Nigeria', status: 'available', brand: null,
}
check('a listing title includes where it is', /Ikoyi/.test(listingTitle(L)))
check('and still fits 70 characters with the brand', `${listingTitle(L)} | ${SITE.name}`.length <= 70, `${listingTitle(L)} | ${SITE.name}`.length)
check('a very long title is shortened at a word', (() => { const t = listingTitle({ ...L, title: 'An extraordinarily long listing name that keeps going and going well beyond any sensible length' }); return `${t} | ${SITE.name}`.length <= 70 && !/\s$/.test(t) })())
check('an empty location does not leave a dangling comma', !/[,:|-]\s*$/.test(listingTitle({ ...L, location: '' })))

console.log('7. Organization and website data')
const org = organizationLd(BASE) as Record<string, unknown>
check('Organization has the schema.org context and type', org['@context'] === 'https://schema.org' && org['@type'] === 'Organization')
check('it has a stable id, the name, the site address', org['@id'] === `${BASE}/#organization` && org.name === 'Lux Catalog' && org.url === BASE)
check('its logo is an absolute address', typeof org.logo === 'string' && (org.logo as string).startsWith(BASE))
check('it serves Nigeria', JSON.stringify(org.areaServed).includes('Nigeria'))
check('no empty or undefined fields are emitted', noUndefined(org) && !('sameAs' in org) && !('email' in org))
const org2 = organizationLd(BASE, { sameAs: ['https://instagram.com/luxcatalog', 'javascript:x', ''], email: 'hello@example.test' }) as Record<string, unknown>
check('social profiles are included, bad ones dropped', JSON.stringify(org2.sameAs) === '["https://instagram.com/luxcatalog"]', org2.sameAs)
check('a contact email is included when given', JSON.stringify(org2).includes('hello@example.test'))
const web = websiteLd(BASE) as Record<string, unknown>
check('WebSite has type, id, url, name and language', web['@type'] === 'WebSite' && web['@id'] === `${BASE}/#website` && web.url === BASE && web.name === 'Lux Catalog' && web.inLanguage === 'en')
check('it points at the organization as publisher', JSON.stringify(web.publisher) === `{"@id":"${BASE}/#organization"}`)

console.log('8. Breadcrumbs')
const bc = breadcrumbLd(BASE, [{ name: 'Home', path: '/' }, { name: 'Catalog', path: '/catalog' }, { name: 'Real Estate', path: '/catalog/real-estate' }]) as { itemListElement: { position: number; name: string; item: string }[] }
check('positions run 1..n in order', bc.itemListElement.map((i) => i.position).join() === '1,2,3')
check('names are kept', bc.itemListElement.map((i) => i.name).join() === 'Home,Catalog,Real Estate')
check('items are absolute addresses', bc.itemListElement.every((i) => i.item.startsWith(BASE)))
check('the type is BreadcrumbList', (bc as unknown as { '@type': string })['@type'] === 'BreadcrumbList')
const bc2 = breadcrumbLd(BASE, [{ name: 'Home', path: '/' }, { name: 'This page' }]) as { itemListElement: { item?: string }[] }
check('the current page may have no address', bc2.itemListElement[1].item === undefined && noUndefined(JSON.parse(JSON.stringify(bc2))))
check('an empty trail gives an empty list, not a crash', (breadcrumbLd(BASE, []) as { itemListElement: unknown[] }).itemListElement.length === 0)

console.log('9. Listing data (Product)')
const href = '/catalog/real-estate/brand-new-three-bedroom'
const p = listingLd(BASE, L, href) as Record<string, any>
check('type Product with the schema.org context', p['@type'] === 'Product' && p['@context'] === 'https://schema.org')
check('name, sku and url', p.name === L.title && p.sku === L.slug && p.url === `${BASE}${href}`)
check('description is trimmed and plain', typeof p.description === 'string' && p.description.length <= 300 && !/</.test(p.description))
check('images are absolute and valid', JSON.stringify(p.image) === `["${BASE}/a.jpg","https://cdn.test/b.jpg"]`, p.image)
check('there is an offer with a numeric price in naira', p.offers?.['@type'] === 'Offer' && p.offers.price === 900000000 && p.offers.priceCurrency === 'NGN')
check('an available listing is InStock', p.offers.availability === 'https://schema.org/InStock')
check('the offer links to the page', p.offers.url === `${BASE}${href}`)
check('the brand is Lux Catalog when no partner brand is known', p.brand?.name === 'Lux Catalog')
check('a partner brand is used when known', (listingLd(BASE, { ...L, brand: 'Real Brand Cars' }, href) as any).brand.name === 'Real Brand Cars')
check('the location is carried as a property', JSON.stringify(p.additionalProperty).includes('Ikoyi, Lagos'))
check('nothing is undefined or NaN', noUndefined(p) && !/NaN|undefined/.test(JSON.stringify(p)))
check('a sold listing is SoldOut', (listingLd(BASE, { ...L, status: 'sold' }, href) as any).offers.availability === 'https://schema.org/SoldOut')
check('an under-offer listing is LimitedAvailability', (listingLd(BASE, { ...L, status: 'under_offer' }, href) as any).offers.availability === 'https://schema.org/LimitedAvailability')
check('price on application has no offer at all', !('offers' in (listingLd(BASE, { ...L, price: null, priceDisplay: 'Price On Application' }, href) as object)))
check('a zero or negative price has no offer', !('offers' in (listingLd(BASE, { ...L, price: 0 }, href) as object)) && !('offers' in (listingLd(BASE, { ...L, price: -5 }, href) as object)))
check('a rental carries its unit (per year)', (() => { const r = listingLd(BASE, { ...L, subcategory: 'for_rent', price: 25_000_000 }, href) as any; return r.offers.priceSpecification?.unitText === 'YEAR' && r.offers.priceSpecification.price === 25000000 })())
check('a shortlet carries its unit (per night)', (listingLd(BASE, { ...L, subcategory: 'luxury_shortlets', price: 300_000 }, href) as any).offers.priceSpecification?.unitText === 'NIGHT')
check('car hire carries its unit (per day)', (listingLd(BASE, { ...L, category: 'supercar', subcategory: 'car_rental', price: 350_000 }, href) as any).offers.priceSpecification?.unitText === 'DAY')
check('a sale has no unit', !('priceSpecification' in (p.offers as object)))
check('no images means no image field, not an empty list', !('image' in (listingLd(BASE, { ...L, images: [] }, href) as object)))
check('at most eight images', ((listingLd(BASE, { ...L, images: Array.from({ length: 20 }, (_, i) => `/i${i}.jpg`) }, href) as any).image as string[]).length === 8)
check('a hostile title survives a round trip through the script-safe encoder', (() => { const e = listingLd(BASE, { ...L, title: '</script><script>alert(1)</script>' }, href); return JSON.parse(safeJsonLd(e)).name === '</script><script>alert(1)</script>' && !safeJsonLd(e).includes('<') })())

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
