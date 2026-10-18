// Discover v2: a guest says what they want (a home to rent, a stay, a chef…)
// and gets questions that belong to it, money that makes sense for it, and
// answers that are real: only listings we hold, the right kind, checked for
// their dates, linked straight into booking. Pure, no database and no AI
// provider, so the same rules can power the concierge later and can never
// suggest something that isn't in the catalogue.

import { categoryHrefs } from '@/lib/utils'
import { SUBCATEGORIES, plainService } from '@/lib/taxonomy'
import { AREAS, LIFESTYLE } from '@/lib/discover'

export type PillarKey = 'homes' | 'stays' | 'cars' | 'yachts' | 'services' | 'security' | 'decor' | 'commercial' | 'experiences'
export type KindKey =
  | 'home_buy' | 'home_rent' | 'stay' | 'car_buy' | 'car_hire' | 'yacht_cruise' | 'yacht_stay' | 'yacht_buy'
  | 'service' | 'chauffeur' | 'protection' | 'decor' | 'commercial_buy' | 'commercial_lease' | 'experience'
export type Field = 'bedrooms' | 'dates' | 'date' | 'time' | 'guests' | 'services'

export const PILLARS: { key: PillarKey; label: string; line: string; kinds: KindKey[] }[] = [
  { key: 'homes', label: 'Homes', line: 'Buy or rent a residence', kinds: ['home_buy', 'home_rent'] },
  { key: 'stays', label: 'Stays', line: 'Luxury shortlets by the night', kinds: ['stay'] },
  { key: 'cars', label: 'Cars', line: 'Own or hire a supercar', kinds: ['car_buy', 'car_hire'] },
  { key: 'yachts', label: 'Yachts', line: 'Cruise, stay aboard or buy', kinds: ['yacht_cruise', 'yacht_stay', 'yacht_buy'] },
  { key: 'services', label: 'Services', line: 'Chefs, therapists, stylists at home', kinds: ['service'] },
  { key: 'security', label: 'Chauffeur & Security', line: 'Drivers and close protection', kinds: ['chauffeur', 'protection'] },
  { key: 'decor', label: 'Interior Decor', line: 'Pieces for your space', kinds: ['decor'] },
  { key: 'commercial', label: 'Commercial', line: 'Offices and towers to buy or lease', kinds: ['commercial_buy', 'commercial_lease'] },
  { key: 'experiences', label: 'Jets & Experiences', line: 'Arranged for you', kinds: ['experience'] },
]

type Kind = {
  pillar: PillarKey
  label: string // heading over its results
  choice: string // the button that picks it inside its pillar
  noun: string // "a yacht to buy": used when we ask a person to source it
  unit: 'total' | 'year' | 'night' | 'day' | 'slot' | 'session' | 'none'
  fields: Field[]
}

export const KINDS: Record<KindKey, Kind> = {
  home_buy: { pillar: 'homes', label: 'Homes to buy', choice: 'Buy a home', noun: 'a home to buy', unit: 'total', fields: ['bedrooms'] },
  home_rent: { pillar: 'homes', label: 'Homes to rent', choice: 'Rent a home', noun: 'a home to rent', unit: 'year', fields: ['bedrooms'] },
  stay: { pillar: 'stays', label: 'Stays', choice: 'A luxury stay', noun: 'a luxury stay', unit: 'night', fields: ['dates', 'guests', 'bedrooms'] },
  car_buy: { pillar: 'cars', label: 'Cars to buy', choice: 'Buy a car', noun: 'a car to buy', unit: 'total', fields: [] },
  car_hire: { pillar: 'cars', label: 'Cars to hire', choice: 'Hire a car', noun: 'a car to hire', unit: 'day', fields: ['dates'] },
  yacht_cruise: { pillar: 'yachts', label: 'Cruises and charters', choice: 'Cruise or charter', noun: 'a yacht cruise or charter', unit: 'slot', fields: ['date', 'guests'] },
  yacht_stay: { pillar: 'yachts', label: 'Stays aboard', choice: 'Stay aboard', noun: 'a stay aboard a yacht', unit: 'night', fields: ['dates', 'guests'] },
  yacht_buy: { pillar: 'yachts', label: 'Yachts to buy', choice: 'Buy a yacht', noun: 'a yacht to buy', unit: 'total', fields: [] },
  service: { pillar: 'services', label: 'Services', choice: 'Services', noun: 'a service at home', unit: 'session', fields: ['services', 'date', 'time', 'guests'] },
  chauffeur: { pillar: 'security', label: 'Chauffeurs', choice: 'A chauffeur', noun: 'a chauffeur', unit: 'day', fields: ['dates'] },
  protection: { pillar: 'security', label: 'Close protection', choice: 'Close protection', noun: 'close protection', unit: 'day', fields: ['dates'] },
  decor: { pillar: 'decor', label: 'Interior decor', choice: 'Decor', noun: 'a decor piece', unit: 'total', fields: [] },
  commercial_buy: { pillar: 'commercial', label: 'Commercial to buy', choice: 'Buy', noun: 'a commercial property to buy', unit: 'total', fields: [] },
  commercial_lease: { pillar: 'commercial', label: 'Commercial to lease', choice: 'Lease', noun: 'a commercial property to lease', unit: 'year', fields: [] },
  experience: { pillar: 'experiences', label: 'Jets and experiences', choice: 'Jets & experiences', noun: 'a jet or experience', unit: 'none', fields: [] },
}

const UNIT_WORD: Record<Kind['unit'], string> = { total: '', year: ' a year', night: ' a night', day: ' a day', slot: ' a cruise', session: ' a session', none: '' }

// ---- Budget bands: each kind speaks in its own scale -----------------------

export type Band = { key: string; label: string; min: number; max: number }
const K = 1_000, M = 1_000_000, B = 1_000_000_000
const money = (n: number) => (n >= B ? `₦${n / B}B` : n >= M ? `₦${n / M}M` : `₦${n / K}k`)
const ANY: Band = { key: 'any', label: 'Not sure yet', min: 0, max: Infinity }
function ladder(prefix: string, edges: number[]): Band[] {
  const slug = (n: number) => (n >= B ? `${n / B}b` : n >= M ? `${n / M}m` : `${n / K}k`)
  const out: Band[] = []
  let lo = 0
  for (const e of edges) {
    out.push({ key: lo === 0 ? `${prefix}_u${slug(e)}` : `${prefix}_${slug(lo).replace(/[mkb]$/, '')}_${slug(e)}`, label: lo === 0 ? `Under ${money(e)}` : `${money(lo)} – ${money(e)}`, min: lo, max: e })
    lo = e
  }
  out.push({ key: `${prefix}_${slug(lo)}_plus`, label: `${money(lo)}+`, min: lo, max: Infinity })
  return [...out, ANY]
}

const BANDS: Record<KindKey, Band[]> = {
  home_buy: ladder('buy', [100 * M, 500 * M, 2 * B]),
  home_rent: ladder('rent', [10 * M, 30 * M, 80 * M]),
  stay: ladder('stay', [150 * K, 400 * K, 1 * M]),
  car_buy: ladder('carbuy', [50 * M, 150 * M, 400 * M]),
  car_hire: ladder('carhire', [150 * K, 400 * K]),
  yacht_cruise: ladder('cruise', [500 * K, 2 * M]),
  yacht_stay: ladder('aqua', [300 * K, 800 * K]),
  yacht_buy: ladder('yachtbuy', [300 * M, 1 * B]),
  service: ladder('svc', [40 * K, 100 * K]),
  chauffeur: ladder('drive', [100 * K, 250 * K]),
  protection: ladder('guard', [250 * K, 600 * K]),
  decor: ladder('decor', [1 * M, 5 * M]),
  commercial_buy: ladder('combuy', [500 * M, 2 * B]),
  commercial_lease: ladder('comlease', [50 * M, 200 * M]),
  experience: [],
}

export const bandsFor = (kind: KindKey): Band[] => BANDS[kind] ?? []
export const bandLabel = (kind: KindKey, key?: string) => bandsFor(kind).find((b) => b.key === key)?.label

// ---- Which listings can answer which kind ----------------------------------

type Typed = { category: string; subcategory?: string | null }
export function kindMatchesListing(kind: KindKey, l: Typed): boolean {
  const s = l.subcategory ?? null
  switch (kind) {
    case 'home_buy': return l.category === 'real_estate' && s === 'for_sale'
    case 'home_rent': return l.category === 'real_estate' && s === 'for_rent'
    case 'stay': return (l.category === 'real_estate' && s === 'luxury_shortlets') || l.category === 'shortlet'
    case 'car_buy': return l.category === 'supercar' && s === 'for_sale'
    case 'car_hire': return l.category === 'supercar' && s === 'car_rental'
    case 'yacht_cruise': return l.category === 'yacht' && s === 'boat_cruises'
    case 'yacht_stay': return l.category === 'yacht' && s === 'aqua_homes'
    case 'yacht_buy': return l.category === 'yacht' && s === 'for_sale'
    case 'service': return l.category === 'private_services'
    case 'chauffeur': return l.category === 'executive_services' && s === 'chauffeur'
    case 'protection': return l.category === 'executive_services' && s === 'close_protection'
    case 'decor': return l.category === 'decor'
    case 'commercial_buy': return l.category === 'commercial' && s === 'for_sale'
    case 'commercial_lease': return l.category === 'commercial' && s === 'for_lease'
    case 'experience': return l.category === 'lifestyle'
  }
}

// ---- The options a guest picks from (shared by the page and the checks) ----

export const SERVICE_OPTIONS = SUBCATEGORIES.private_services.map((s) => ({ key: s.key, label: plainService(s.label) }))
export const LOCATION_OPTIONS = [
  { key: 'lagos_island', label: 'Lagos Island (VI, Ikoyi, Banana Island)' },
  { key: 'lagos_lekki', label: 'Lekki & Ajah' },
  { key: 'lagos_mainland', label: 'Lagos Mainland (Ikeja GRA & more)' },
  { key: 'abuja', label: 'Abuja' },
  { key: 'nationwide', label: 'Anywhere in Nigeria' },
  { key: 'global', label: 'Diaspora / Global' },
]
export const TASTE_OPTIONS = [
  { key: 'understated', label: 'Understated & private' },
  { key: 'bold', label: 'Bold & iconic' },
  { key: 'investment', label: 'Investment-minded' },
  { key: 'adventure', label: 'Adventure & travel' },
  { key: 'art', label: 'Art & culture' },
  { key: 'family', label: 'Family & legacy' },
]
export const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5'].map((n) => ({ key: n, label: n === '5' ? '5+' : n }))
export const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`)
export const timeLabel = (t: string) => { const h = Number(t.slice(0, 2)); return `${h % 12 || 12}:00 ${h < 12 ? 'am' : 'pm'}` }

// ---- A brief, checked before it is used ------------------------------------

export type Need = {
  kind: KindKey
  budget?: string
  services?: string[]
  bedrooms?: number
  start?: string
  end?: string
  date?: string
  time?: string
  guests?: number
}
export type Brief = { needs: Need[]; location?: string[]; lifestyle?: string[] }

const MAX_NEEDS = 6
const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
const lagosToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const inWindow = (d: string) => d >= lagosToday() && d <= addDays(lagosToday(), 365)
const keysOf = (o: object) => Object.keys(o)
const pick = (v: unknown, allowed: string[]) => (Array.isArray(v) ? [...new Set(v.slice(0, 40).filter((x): x is string => typeof x === 'string' && allowed.includes(x)))] : [])
const whole = (v: unknown, min: number, max: number) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max ? n : undefined
}

export function validateBrief(input: unknown): { ok: true; brief: Brief } | { ok: false; error: string } {
  const raw = (input && typeof input === 'object' ? input : {}) as { needs?: unknown; location?: unknown; lifestyle?: unknown }
  if (!Array.isArray(raw.needs) || raw.needs.length === 0) return { ok: false, error: 'Tell us what you are looking for first.' }
  if (raw.needs.length > MAX_NEEDS) return { ok: false, error: `Please choose up to ${MAX_NEEDS} things at a time.` }
  const seen = new Set<string>()
  const needs: Need[] = []
  for (const n of raw.needs) {
    const o = (n && typeof n === 'object' ? n : {}) as Record<string, unknown>
    const kind = o.kind as KindKey
    if (typeof kind !== 'string' || !Object.hasOwn(KINDS, kind)) return { ok: false, error: 'One of the choices was not recognised. Please start again.' }
    if (seen.has(kind)) continue
    seen.add(kind)
    const need: Need = { kind }
    if (typeof o.budget === 'string' && bandsFor(kind).some((b) => b.key === o.budget)) need.budget = o.budget
    const services = pick(o.services, SERVICE_OPTIONS.map((s) => s.key))
    if (kind === 'service' && services.length) need.services = services
    const bedrooms = whole(o.bedrooms, 1, 10)
    if (bedrooms) need.bedrooms = bedrooms
    const guests = whole(o.guests, 1, 50)
    if (guests) need.guests = guests
    if (isDay(o.start) && inWindow(o.start)) {
      need.start = o.start
      if (isDay(o.end) && o.end >= o.start && o.end <= addDays(lagosToday(), 400)) need.end = o.end
    }
    if (isDay(o.date) && inWindow(o.date)) need.date = o.date
    if (typeof o.time === 'string' && TIME_SLOTS.includes(o.time)) need.time = o.time
    needs.push(need)
  }
  const brief: Brief = { needs }
  const location = pick(raw.location, keysOf(AREAS))
  const lifestyle = pick(raw.lifestyle, keysOf(LIFESTYLE))
  if (location.length) brief.location = location
  if (lifestyle.length) brief.lifestyle = lifestyle
  return { ok: true, brief }
}

// ---- Matching --------------------------------------------------------------

export type BriefListing = {
  slug: string
  title: string
  category: string
  subcategory?: string | null
  price: number | null
  priceDisplay: string
  location: string
  description: string
  bedrooms?: number | null
  priceNote?: string
  image?: string | null
}
export type Availability = 'available' | 'unavailable' | 'unchecked'
export type Match = {
  slug: string; title: string; category: string; priceDisplay: string; priceNote: string; image: string | null
  score: number; reason: string; availability: Availability; href: string
}
export type Group = { kind: KindKey; label: string; matches: Match[]; missing: string[]; empty: boolean; askUs: string }

export const DATED_KINDS: KindKey[] = ['stay', 'car_hire', 'yacht_stay', 'chauffeur', 'protection']
const MAX_PER_GROUP = 4
const OVER_BUDGET = 1.25

export function listingHref(need: Need, l: { slug: string; category: string }): string {
  const base = `${categoryHrefs[l.category] ?? '/catalog'}/${l.slug}`
  const p: string[] = []
  const add = (k: string, v: string | number | undefined) => v !== undefined && v !== '' && p.push(`${k}=${encodeURIComponent(String(v))}`)
  const { kind } = need
  if (kind === 'stay' || kind === 'car_hire' || kind === 'yacht_stay' || kind === 'chauffeur' || kind === 'protection') {
    add('start', need.start); add('end', need.end); add('guests', need.guests)
  } else if (kind === 'service') {
    add('date', need.date); add('time', need.time); add('guests', need.guests)
  } else if (kind === 'yacht_cruise') {
    add('date', need.date); add('guests', need.guests)
  }
  return p.length ? `${base}?${p.join('&')}` : base
}

export function matchBrief(brief: Brief, listings: BriefListing[], availability: Record<string, Availability> = {}): Group[] {
  const used = new Set<string>()
  return brief.needs.map((need) => {
    const meta = KINDS[need.kind]
    const band = need.budget && need.budget !== 'any' ? bandsFor(need.kind).find((b) => b.key === need.budget) : undefined
    const datesAsked = DATED_KINDS.includes(need.kind) && !!need.start && !!need.end
    let pool = listings.filter((l) => !used.has(l.slug) && kindMatchesListing(need.kind, l))
    if (need.kind === 'service' && need.services?.length) pool = pool.filter((l) => need.services!.includes(l.subcategory ?? ''))
    const missing = need.kind === 'service' && need.services?.length
      ? need.services.filter((s) => !listings.some((l) => l.subcategory === s)).map((s) => SERVICE_OPTIONS.find((o) => o.key === s)?.label ?? s)
      : []

    const ranked = pool
      .map((l) => {
        const why: string[] = []
        let score = 40
        if (band && l.price !== null) {
          if (l.price >= band.min && l.price < band.max) { score += 35; why.push('within your budget') }
          else if (l.price >= band.max && l.price <= band.max * OVER_BUDGET) { score += 12; why.push('slightly above your budget') }
          else if (l.price < band.min) { score += 10; why.push('below your range') }
          else return null
        }
        if (need.bedrooms && typeof l.bedrooms === 'number') {
          if (l.bedrooms >= need.bedrooms) { score += 8; why.push(`${l.bedrooms} bedrooms`) }
          else return null
        }
        const text = ` ${`${l.title} ${l.location} ${l.description}`.toLowerCase()} `
        const area = (brief.location ?? []).find((a) => (AREAS[a] ?? []).some((k) => text.includes(k)))
        if (area) { score += 15; why.push(`in ${l.location}`) }
        const taste = (brief.lifestyle ?? []).filter((t) => (LIFESTYLE[t] ?? []).some((k) => text.includes(k)))
        if (taste.length) { score += Math.min(10, taste.length * 5); why.push('in keeping with your taste') }
        let availabilityState: Availability = 'unchecked'
        if (datesAsked) {
          const a = availability[l.slug]
          if (a === 'available') { availabilityState = a; score += 10; why.unshift('free on your dates') }
          else if (a === 'unavailable') { availabilityState = a; score = Math.min(score, 20); why.unshift('not free on those dates') }
        }
        const phrase = why.length ? why.join(', ') : ''
        const reason = phrase ? `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.` : `Matches what you asked for: ${meta.label.toLowerCase()}.`
        return { l, score: Math.max(1, Math.min(100, Math.round(score))), reason, availability: availabilityState }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => (a.availability === 'unavailable' ? 1 : 0) - (b.availability === 'unavailable' ? 1 : 0) || b.score - a.score)
      .slice(0, MAX_PER_GROUP)

    ranked.forEach((r) => used.add(r.l.slug))
    const matches: Match[] = ranked.map((r) => ({
      slug: r.l.slug, title: r.l.title, category: r.l.category, priceDisplay: r.l.priceDisplay, priceNote: r.l.priceNote ?? '', image: r.l.image ?? null,
      score: r.score, reason: r.reason, availability: r.availability, href: listingHref(need, r.l),
    }))
    return {
      kind: need.kind, label: meta.label, matches, missing, empty: matches.length === 0,
      askUs: `We can source ${meta.noun} for you. Tell us what matters and a specialist will find it.`,
    }
  })
}

// ---- Words for people (the team, the concierge, a handoff) -----------------

const areaLabel = (k: string) => LOCATION_OPTIONS.find((o) => o.key === k)?.label ?? ''
const tasteLabel = (k: string) => TASTE_OPTIONS.find((o) => o.key === k)?.label ?? ''

export function describeNeed(need: Need): string {
  const meta = KINDS[need.kind]
  const bits: string[] = []
  if (need.kind === 'service' && need.services?.length) bits.push(need.services.map((s) => SERVICE_OPTIONS.find((o) => o.key === s)?.label ?? s).join(', '))
  if (need.bedrooms) bits.push(`${need.bedrooms} bedroom${need.bedrooms > 1 ? 's' : ''}`)
  if (need.start) bits.push(need.end && need.end !== need.start ? `${need.start} to ${need.end}` : need.start)
  if (need.date) bits.push(`on ${need.date}${need.time ? ` at ${need.time}` : ''}`)
  if (need.guests) bits.push(`${need.guests} guest${need.guests > 1 ? 's' : ''}`)
  const b = bandLabel(need.kind, need.budget)
  if (b && need.budget !== 'any') bits.push(`budget ${b}${UNIT_WORD[meta.unit]}`)
  const head = need.kind === 'service' ? 'Services' : meta.noun.charAt(0).toUpperCase() + meta.noun.slice(1)
  return bits.length ? `${head}: ${bits.join(', ')}` : head
}

export function describeBrief(brief: Brief): string {
  const lines = brief.needs.map((n) => `• ${describeNeed(n)}`)
  const places = (brief.location ?? []).map(areaLabel).filter(Boolean)
  const taste = (brief.lifestyle ?? []).map(tasteLabel).filter(Boolean)
  return [
    'Hello, I used Discover on Lux Catalog and would like a specialist’s help.',
    '',
    ...lines,
    ...(places.length ? ['', `Where: ${places.join(', ')}`] : []),
    ...(taste.length ? [`Taste: ${taste.join(', ')}`] : []),
  ].join('\n')
}
