// Discover matching that runs on our own data and rules: no AI provider
// needed, and it can never suggest something that isn't in the catalogue.
// When an AI provider is configured it may rewrite the summary, but these
// matches stay the source of truth. Pure.

export type DiscoverListing = {
  slug: string
  title: string
  category: string
  price: number | null
  location: string
  description: string
}

export type DiscoverPrefs = {
  categories?: string[] | string
  budget?: string[] | string
  location?: string[] | string
  lifestyle?: string[] | string
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : [])

const BUDGETS: Record<string, [number, number]> = {
  under_100m: [0, 100_000_000],
  '100m_500m': [100_000_000, 500_000_000],
  '500m_2b': [500_000_000, 2_000_000_000],
  '2b_plus': [2_000_000_000, Infinity],
}

export const AREAS: Record<string, string[]> = {
  lagos_island: ['ikoyi', 'victoria island', ' vi', 'banana island', 'eko atlantic', 'oniru', 'lagos island'],
  lagos_lekki: ['lekki', 'ajah', 'chevron', 'ikate'],
  lagos_mainland: ['ikeja', 'gra', 'maryland', 'surulere', 'yaba', 'mainland'],
  abuja: ['abuja', 'maitama', 'asokoro', 'wuse', 'jabi', 'katampe'],
  nationwide: ['nigeria'],
  global: [],
}

export const LIFESTYLE: Record<string, string[]> = {
  understated: ['private', 'quiet', 'discreet', 'serene', 'gated'],
  bold: ['iconic', 'bold', 'statement', 'supercar', 'penthouse'],
  investment: ['investment', 'yield', 'lease', 'rental', 'roi', 'office'],
  adventure: ['yacht', 'cruise', 'jet', 'travel', 'water'],
  art: ['art', 'design', 'gallery', 'sculpt', 'handmade', 'murano', 'brass'],
  family: ['family', 'garden', 'school', 'staff', 'bedroom', 'home'],
}

const CATEGORY_LABEL: Record<string, string> = {
  real_estate: 'home', shortlet: 'stay', supercar: 'car', yacht: 'yacht', decor: 'piece', commercial: 'property', lifestyle: 'experience', executive_services: 'service', private_services: 'service',
}

export function matchListings(prefs: DiscoverPrefs, listings: DiscoverListing[], limit = 6) {
  const cats = list(prefs.categories)
  const budgets = list(prefs.budget)
  const areas = list(prefs.location)
  const styles = list(prefs.lifestyle)
  const pool = cats.length ? listings.filter((l) => cats.includes(l.category)) : listings

  return pool
    .map((l) => {
      let score = 1
      const why: string[] = []
      const text = ` ${`${l.title} ${l.location} ${l.description}`.toLowerCase()} `
      if (cats.length) why.push(`a ${CATEGORY_LABEL[l.category] ?? 'match'} in your chosen category`)
      if (budgets.length) {
        if (l.price === null) {
          if (budgets.includes('poa')) {
            score += 2
            why.push('price on application, as you prefer')
          }
        } else if (budgets.some((b) => BUDGETS[b] && l.price! >= BUDGETS[b][0] && l.price! < BUDGETS[b][1])) {
          score += 4
          why.push('within your budget')
        }
      }
      const areaHit = areas.find((a) => (AREAS[a] ?? []).some((k) => text.includes(k)))
      if (areaHit) {
        score += 3
        why.push(`in ${l.location}`)
      }
      const styleHit = styles.filter((s) => (LIFESTYLE[s] ?? []).some((k) => text.includes(k)))
      if (styleHit.length) {
        score += styleHit.length
        why.push('suits the lifestyle you described')
      }
      return { slug: l.slug, category: l.category, title: l.title, score, reason: why.length ? `Chosen because it is ${why.join(', ')}.` : 'A standout piece from the current collection.' }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
