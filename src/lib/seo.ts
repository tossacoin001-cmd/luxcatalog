// SEO rules in one place: titles, descriptions, structured data (JSON-LD) and
// addresses. Pure (no Next.js, no database) so it can be tested alone.
// Every address is built from the site address given by the caller, so moving
// to a new domain means changing one environment variable and nothing else.

export const SITE = {
  name: 'Lux Catalog',
  city: 'Lagos',
  country: 'Nigeria',
  locale: 'en_NG',
} as const

const SCHEMA = 'https://schema.org'

// ---- Addresses ---------------------------------------------------------------

export function absoluteUrl(base: string, pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  const raw = String(pathOrUrl).trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null // javascript:, data:, mailto: and the like
  const root = base.replace(/\/+$/, '')
  return `${root}${raw.startsWith('/') ? '' : '/'}${raw}`
}

// ---- Safe JSON inside a script tag --------------------------------------------

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

// ---- Text ----------------------------------------------------------------------

export function trimDescription(text: string | null | undefined, max = 155): string {
  const clean = String(text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  const base = space > max * 0.5 ? cut.slice(0, space) : cut
  return `${base.replace(/[\s,;:.\-–—]+$/, '')}…`
}

export const homeTitle = () => `${SITE.name} | Luxury Homes, Shortlets, Supercars & Yachts in ${SITE.city}`
export const homeDescription = () =>
  `Luxury homes, shortlets, supercars, yachts and vetted services in ${SITE.city} and across ${SITE.country}. See real prices, check dates, then book or enquire.`

const CATEGORY_TITLE: Record<string, string> = {
  real_estate: 'Luxury Homes for Sale and Rent in Lagos',
  shortlet: 'Luxury Shortlets in Lagos, Booked by the Night',
  supercar: 'Supercars for Sale and Hire in Lagos',
  yacht: 'Yachts, Cruises and Aqua Homes in Lagos',
  decor: 'Luxury Interior Decor and Furniture in Nigeria',
  commercial: 'Commercial Property for Sale and Lease in Lagos',
  lifestyle: 'Private Jets and Luxury Experiences from Lagos',
  executive_services: 'Chauffeur and Close Protection in Lagos',
  private_services: 'Private Chefs, Massage and Grooming at Home in Lagos',
}
const CATEGORY_DESCRIPTION: Record<string, string> = {
  real_estate: 'Browse vetted luxury homes in Lagos and across Nigeria: houses and apartments to buy, rent or lease, with real prices and photographs.',
  shortlet: 'Luxury shortlets in Lagos, booked by the night. See real nightly rates, check your dates and reserve a vetted apartment or villa.',
  supercar: 'Supercars for sale and for hire in Lagos, from rare collectibles to chauffeur-driven rentals, with prices and dates you can check.',
  yacht: 'Yachts for sale, boat cruises and charters, and stays aboard in Lagos. See rates, check dates and enquire with Lux Catalog.',
  decor: 'Statement furniture, lighting and decor pieces for high-end homes in Nigeria, with prices and photographs of every piece.',
  commercial: 'Offices, towers and commercial space in Lagos and Abuja to buy or lease, with real prices and photographs.',
  lifestyle: 'Private jets and luxury experiences arranged from Lagos. Tell us what you have in mind and a specialist will arrange it.',
  executive_services: 'Chauffeur-driven cars and close protection in Lagos, booked by the day from vetted drivers and security teams.',
  private_services: 'Vetted chefs, massage therapists, barbers, stylists and more who come to your home or stay in Lagos. Book a session online.',
}
export const categoryTitle = (category: string) => CATEGORY_TITLE[category] ?? `Luxury Assets in ${SITE.city}`
export const categoryDescription = (category: string) =>
  CATEGORY_DESCRIPTION[category] ?? `Browse luxury homes, cars, yachts and services in ${SITE.city}, with real prices and photographs.`

export type LdListing = {
  title: string
  description: string
  slug: string
  category: string
  subcategory?: string | null
  price: number | null
  priceDisplay?: string
  images: string[]
  location: string
  country?: string
  status: 'available' | 'under_offer' | 'sold'
  brand?: string | null
}

// Where it is, short enough to keep the whole title under 70 characters with the brand.
export function listingTitle(l: Pick<LdListing, 'title' | 'location'>): string {
  const place = String(l.location ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(', ')
  const full = place ? `${l.title.trim()}, ${place}` : l.title.trim()
  const MAX = 56
  if (full.length <= MAX) return full
  const cut = full.slice(0, MAX - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > MAX * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, '')}…`
}

// ---- Structured data -------------------------------------------------------------

export function organizationLd(base: string, opts: { sameAs?: string[]; email?: string } = {}) {
  const root = base.replace(/\/+$/, '')
  const sameAs = (opts.sameAs ?? []).map((u) => absoluteUrl(root, u)).filter((u): u is string => !!u && /^https?:\/\//.test(u))
  return {
    '@context': SCHEMA,
    '@type': 'Organization',
    '@id': `${root}/#organization`,
    name: SITE.name,
    url: root,
    logo: `${root}/icon`,
    description: homeDescription(),
    areaServed: { '@type': 'Country', name: SITE.country },
    address: { '@type': 'PostalAddress', addressLocality: SITE.city, addressCountry: 'NG' },
    ...(sameAs.length ? { sameAs } : {}),
    ...(opts.email ? { email: opts.email } : {}),
  }
}

export function websiteLd(base: string) {
  const root = base.replace(/\/+$/, '')
  return {
    '@context': SCHEMA,
    '@type': 'WebSite',
    '@id': `${root}/#website`,
    url: root,
    name: SITE.name,
    inLanguage: 'en',
    publisher: { '@id': `${root}/#organization` },
  }
}

export function breadcrumbLd(base: string, trail: { name: string; path?: string }[]) {
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => {
      const item = t.path ? absoluteUrl(base, t.path) : null
      return { '@type': 'ListItem', position: i + 1, name: t.name, ...(item ? { item } : {}) }
    }),
  }
}

const UNIT: Record<string, string> = {
  for_rent: 'YEAR', for_lease: 'YEAR', luxury_shortlets: 'NIGHT', aqua_homes: 'NIGHT', car_rental: 'DAY', chauffeur: 'DAY', close_protection: 'DAY',
}
const AVAILABILITY: Record<LdListing['status'], string> = {
  available: `${SCHEMA}/InStock`,
  under_offer: `${SCHEMA}/LimitedAvailability`,
  sold: `${SCHEMA}/SoldOut`,
}

export function listingLd(base: string, l: LdListing, href: string) {
  const url = absoluteUrl(base, href) ?? base
  const images = (l.images ?? []).map((i) => absoluteUrl(base, i)).filter((i): i is string => !!i).slice(0, 8)
  const unit = l.subcategory ? UNIT[l.subcategory] : undefined
  const hasPrice = typeof l.price === 'number' && Number.isFinite(l.price) && l.price > 0
  return {
    '@context': SCHEMA,
    '@type': 'Product',
    name: l.title,
    sku: l.slug,
    url,
    description: trimDescription(l.description, 300),
    ...(images.length ? { image: images } : {}),
    brand: { '@type': 'Brand', name: l.brand || SITE.name },
    additionalProperty: [{ '@type': 'PropertyValue', name: 'Location', value: [l.location, l.country].filter(Boolean).join(', ') }],
    ...(hasPrice
      ? {
          offers: {
            '@type': 'Offer',
            url,
            price: l.price as number,
            priceCurrency: 'NGN',
            availability: AVAILABILITY[l.status] ?? AVAILABILITY.available,
            ...(unit ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: l.price as number, priceCurrency: 'NGN', unitText: unit } } : {}),
          },
        }
      : {}),
  }
}
