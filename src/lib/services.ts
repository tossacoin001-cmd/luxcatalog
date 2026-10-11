// Private Services rules shared by forms, APIs and the application review.
// Pure module (no DB) so client components and tests can use it.

// Words that mark adult services passed off as massage or "home spa"
// listings (seen on Lagos listing sites, 2026-10). Any of them in a Private
// Services listing or a Service Professional application is refused.
// Matched as whole words/phrases after normalising case and punctuation.
export const BANNED_TERMS = [
  'nuru',
  'body to body',
  'b2b massage',
  'happy ending',
  'erotic',
  'sensual',
  'tantric',
  'tantra',
  'escort',
  'escorts',
  'extra services',
  'full service massage',
  'nude',
  'naked',
  'intimate massage',
  'yoni',
  'lingam',
  'prostate massage',
  'adult services',
  'gfe',
]

function normalise(text: string) {
  return ` ${text
    .toLowerCase()
    .replace(/body\s*(2|-|to)\s*body/g, 'body to body')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `
}

function collect(value: unknown, out: string[]) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collect(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collect(v, out))
}

// Every banned term found in the given values (strings, arrays or objects,
// e.g. title, features and specs together), each listed once.
export function findBannedTerms(...values: unknown[]): string[] {
  const texts: string[] = []
  values.forEach((v) => collect(v, texts))
  const haystack = normalise(texts.join(' \n '))
  return BANNED_TERMS.filter((term) => haystack.includes(` ${term} `))
}

export function bannedTermsMessage(terms: string[]) {
  return `Lux Catalog does not allow these words in Private Services: ${terms.map((t) => `“${t}”`).join(', ')}. Please remove them.`
}

// Minimum "from" price per service (NGN), pre-filled from Lagos market
// research on 2026-10-10 and adjustable by admins on /admin/services.
export const SERVICE_FLOOR_DEFAULTS: Record<string, number> = {
  private_chef: 35000, // per guest
  mixologist: 150000,
  butler_staff: 50000,
  massage_spa: 50000,
  personal_training: 25000,
  barber: 25000,
  hair_stylist: 50000,
  makeup_artist: 60000,
  nail_technician: 30000,
  housekeeping: 60000,
  photographer: 100000,
}

export function floorMessage(label: string, floor: number) {
  return `The minimum price for ${label} on Lux Catalog is ₦${floor.toLocaleString('en-NG')}.`
}
