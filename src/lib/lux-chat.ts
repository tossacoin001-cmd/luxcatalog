// Lux, the chat: the pure rules. A greeting that follows the visitor's own
// hour, questions they can tap, and a reader that turns a plain message into
// what they want (what, budget, bedrooms, guests, dates). Nothing here talks
// to the database or a model; the answer is always built from real listings
// elsewhere, so this can only ever narrow a search, never invent an item.
import { AREAS } from '@/lib/discover'
import { bandsFor, type KindKey } from '@/lib/discover-brief'

const MAX_INPUT = 600

// ---- Greeting ----------------------------------------------------------------

const safeFirstName = (n?: string | null) => {
  const first = (n ?? '').normalize('NFC').trim().split(/\s+/)[0] ?? ''
  return /^[\p{L}\p{M}'’.-]{1,30}$/u.test(first) ? first : ''
}

export function greeting(hour: number, firstName?: string | null): string {
  const name = safeFirstName(firstName)
  const h = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : -1
  const word = h < 0 ? 'Hello' : h >= 5 && h <= 11 ? 'Good morning' : h >= 12 && h <= 16 ? 'Good afternoon' : h >= 17 && h <= 21 ? 'Good evening' : 'Still up'
  const hello = word === 'Still up' ? (name ? `Still up, ${name}?` : 'Still up?') : name ? `${word}, ${name}.` : `${word}.`
  return `${hello} I’m Lux. What can I help you find today?`
}

// ---- Tappable questions --------------------------------------------------------

export type Starter = { label: string; text: string }

export function starters(ctx?: { listingTitle?: string }): Starter[] {
  const title = (ctx?.listingTitle ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (title) {
    return [
      { label: 'Is it free on my dates?', text: `Is ${title} free on my dates?` },
      { label: 'What is included?', text: `What is included with ${title}?` },
      { label: 'How do I book it?', text: `How do I book ${title}?` },
      { label: 'Show me similar', text: `Show me something similar to ${title}` },
      { label: 'Stay within a budget', text: 'Help me find something within my budget' },
      { label: 'Speak to a person', text: 'I would like to speak to a person' },
    ]
  }
  return [
    { label: 'Find a home to buy', text: 'I want to buy a home' },
    { label: 'A stay for my dates', text: 'I need a shortlet stay for my dates' },
    { label: 'Hire a car', text: 'I want to hire a supercar' },
    { label: 'A private chef or service', text: 'I need a private chef or another service at home' },
    { label: 'Within my budget', text: 'Help me find something within my budget' },
    { label: 'Speak to a person', text: 'I would like to speak to a person' },
  ]
}

// ---- Reading a message ------------------------------------------------------------

export type Ask = 'availability' | 'book' | 'price' | 'payment' | 'cancel' | 'partner' | 'about' | 'safety'
export type Read = {
  kind?: KindKey
  kindChoices?: KindKey[]
  services?: string[]
  budget?: number
  usdOnly?: boolean
  bedrooms?: number
  guests?: number
  nights?: number
  start?: string
  end?: string
  locations?: string[]
  asks: Ask[]
  wantsPerson: boolean
  greeting: boolean
  thanks: boolean
  injection: boolean
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const NUMWORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
const NUM = '(\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten)'
const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUMWORDS[s.toLowerCase()])

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay() // 0 Sun … 6 Sat
const validDay = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
// The next time this day-of-year comes round (today counts).
function nextOccurrence(today: string, m: number, d: number): string | null {
  const y = Number(today.slice(0, 4))
  for (const yy of [y, y + 1]) {
    if (!validDay(yy, m, d)) continue
    const c = iso(yy, m, d)
    if (c >= today) return c
  }
  return null
}

function readDates(t: string, today: string): { start?: string; end?: string } {
  let m: RegExpMatchArray | null
  // "12 to 15 December", "12-15 dec"
  if ((m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|-|–|until|till)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*${MONTH_RE}\\b`)))) {
    const mo = MONTHS[m[3]]; const a = nextOccurrence(today, mo, Number(m[1]))
    if (a) { const y = Number(a.slice(0, 4)); const b = validDay(y, mo, Number(m[2])) ? iso(y, mo, Number(m[2])) : null; if (b && b > a) return { start: a, end: b } }
  }
  // "20 Dec - 3 Jan", "from 12 December to 15 January"
  if ((m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*${MONTH_RE}\\s*(?:to|-|–|until|till)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*${MONTH_RE}\\b`)))) {
    const a = nextOccurrence(today, MONTHS[m[2]], Number(m[1]))
    if (a) {
      const y = Number(a.slice(0, 4))
      for (const yy of [y, y + 1]) {
        if (!validDay(yy, MONTHS[m[4]], Number(m[3]))) continue
        const b = iso(yy, MONTHS[m[4]], Number(m[3]))
        if (b > a) return { start: a, end: b }
      }
    }
  }
  // "from 12 December for 3 nights" / "12 December, 2 days"
  if ((m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*${MONTH_RE}\\b`)))) {
    const a = nextOccurrence(today, MONTHS[m[2]], Number(m[1]))
    if (a) {
      const len = t.match(new RegExp(`\\b${NUM}\\s*(?:nights?|days?)\\b`))
      if (len) return { start: a, end: addDays(a, Math.max(1, num(len[1]) ?? 1)) }
      return { start: a }
    }
  }
  // "December 12 to 15"
  if ((m = t.match(new RegExp(`\\b${MONTH_RE}\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|-|–)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) {
    const mo = MONTHS[m[1]]; const a = nextOccurrence(today, mo, Number(m[2]))
    if (a) { const y = Number(a.slice(0, 4)); if (validDay(y, mo, Number(m[3])) && Number(m[3]) > Number(m[2])) return { start: a, end: iso(y, mo, Number(m[3])) } }
  }
  if (/\btonight\b/.test(t)) return { start: today, end: addDays(today, 1) }
  if (/\btomorrow\b/.test(t)) return { start: addDays(today, 1), end: addDays(today, 2) }
  if (/\b(next|following)\s+weekend\b/.test(t)) {
    const toFri = (5 - weekday(today) + 7) % 7
    const thisFri = addDays(today, toFri === 0 && weekday(today) === 5 ? 0 : toFri)
    const start = addDays(thisFri, 7)
    return { start, end: addDays(start, 2) }
  }
  if (/\b(this\s+)?weekend\b/.test(t)) {
    const wd = weekday(today)
    if (wd === 6) return { start: today, end: addDays(today, 1) }
    if (wd === 0) return { start: today, end: addDays(today, 1) }
    const start = addDays(today, (5 - wd + 7) % 7)
    return { start, end: addDays(start, 2) }
  }
  // "for 2 days from 14 November" is covered by the pattern above; a bare "3 nights" has no start.
  return {}
}

function readBudget(raw: string): { budget?: number; usdOnly?: boolean } {
  // Strip dates and bedroom/guest counts first so they are never taken as money.
  const t = raw
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s*(?:to|-|–)?\\s*\\d{0,2}\\s*${MONTH_RE}\\b`, 'g'), ' ')
    .replace(new RegExp(`\\b${MONTH_RE}\\s*\\d{1,2}\\b`, 'g'), ' ')
    .replace(/\b\d+\s*(?:bed(?:room)?s?|br|guests?|people|persons?|pax|nights?|days?|hours?)\b/g, ' ')
  const usd = /\$\s*\d|\b\d[\d,.]*\s*(?:usd|dollars?)\b/.test(t)
  const re = /(?:₦|ngn|naira|\bn(?=\d))?\s*(\d[\d,]*(?:\.\d+)?)\s*(billion|bn|b|million|mil|m|thousand|k)?\b/g
  let best: number | undefined
  for (const m of t.matchAll(re)) {
    const hadSymbol = /₦|ngn|naira|\bn\d/.test(m[0]) || /(?:₦|ngn|naira|\bn)\s*$/.test(t.slice(Math.max(0, (m.index ?? 0) - 6), m.index))
    const unit = m[2]
    const n = Number(m[1].replace(/,/g, ''))
    if (!Number.isFinite(n)) continue
    const mult = !unit ? 1 : /^b/.test(unit) ? 1e9 : /^m/.test(unit) ? 1e6 : 1e3
    const value = n * mult
    // Bare small numbers (a "2" or a "12") are not money; money has a unit, a symbol or is large.
    if (!unit && !hadSymbol && value < 10_000) continue
    if (value < 1_000) continue
    if (usd && !hadSymbol) continue
    if (best === undefined || value > best) best = value
  }
  if (best === undefined) return usd ? { usdOnly: true } : {}
  return { budget: best }
}

const SERVICE_WORDS: [RegExp, string][] = [
  [/\b(chef|cook|dinner at home|catering)\b/, 'private_chef'],
  [/\b(mixologist|bartender|cocktail)/, 'mixologist'],
  [/\b(butler|waiter|event staff)\b/, 'butler_staff'],
  [/\b(massage|spa|facial)\b/, 'massage_spa'],
  [/\b(trainer|yoga|personal training)\b/, 'personal_training'],
  [/\b(barber|haircut|beard)\b/, 'barber'],
  [/\b(hair ?stylist|braids|silk press|wig)\b/, 'hair_stylist'],
  [/\b(make ?up|mua)\b/, 'makeup_artist'],
  [/\b(nails?|manicure|pedicure)\b/, 'nail_technician'],
  [/\b(housekeep|cleaner|cleaning)\b/, 'housekeeping'],
  [/\b(photographer|photoshoot|photo shoot)\b/, 'photographer'],
]

const AREA_WORDS: [string, RegExp][] = Object.entries(AREAS)
  .filter(([, words]) => words.length)
  .map(([key, words]) => [key, new RegExp(`(?:^|[^a-z])(?:${words.map((w) => w.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:[^a-z]|$)`)] as [string, RegExp])

const INJECTION = /(ignore|disregard|forget|override)\b[^.]{0,40}\b(previous|prior|above|earlier|all|your)\b[^.]{0,30}\b(instructions?|rules?|prompts?|guidelines?)|\bsystem prompt\b|\byou are now\b|\bdeveloper mode\b|\bjailbreak\b|\breveal (your|the) (keys?|prompt|instructions?)\b|\bact as (?:an? )?(?:admin|administrator|root)\b/i

export function readMessage(input: unknown, today: string): Read {
  const text = typeof input === 'string' ? input.slice(0, MAX_INPUT) : ''
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim()
  const out: Read = { asks: [], wantsPerson: false, greeting: false, thanks: false, injection: INJECTION.test(text) }
  if (!t) return out

  out.wantsPerson = /\b(speak|talk|chat)\s+(to|with)\s+(a\s+|an\s+|some\s*one|somebody|the team|your team)|\b(human|real person|an? agent|call me|phone me|ring me|whatsapp me)\b|\bsomeone\b.*\b(call|help)\b|\bspeak to someone\b|\bspeak to a person\b/.test(t)
  out.greeting = /^(hi|hello|hey|good (morning|afternoon|evening)|hiya|yo)\b/.test(t) && t.length < 40
  out.thanks = /\b(thanks|thank you|thx|cheers|appreciate)\b/.test(t)

  const buy = /\b(buy|purchase|own|for sale|acquire|investment)\b/.test(t)
  const rent = /\b(rent|lease|to let|renting|per year|a year|annual)\b/.test(t)
  const hire = /\b(hire|rent|charter|for a day|per day|a day|chauffeur[- ]driven)\b/.test(t)
  const stay = /\b(shortlet|short let|short-let|stay|night|nights|airbnb|holiday|getaway|vacation)\b/.test(t)

  const svc = SERVICE_WORDS.filter(([re]) => re.test(t)).map(([, k]) => k)
  // "List my property" is about partnering with us, not about finding a home.
  const partnerAsk = /\b(list (my|our)|become a partner|partner with|i own a|my property|host with you|sell through)\b/.test(t)

  if (partnerAsk) { /* a question about us: no search */ }
  else if (svc.length) { out.kind = 'service'; out.services = [...new Set(svc)] }
  else if (/\b(close protection|bodyguard|security detail|armed escort|guards?)\b/.test(t)) out.kind = 'protection'
  else if (/\b(chauffeur|driver)\b/.test(t)) out.kind = 'chauffeur'
  else if (/\b(yacht|superyacht|boat|cruise|charter)\b/.test(t)) out.kind = /\b(stay aboard|aqua home|sleep aboard|overnight)\b/.test(t) ? 'yacht_stay' : buy && !/\bcruise|charter\b/.test(t) ? 'yacht_buy' : 'yacht_cruise'
  else if (/\b(car|cars|supercar|ferrari|lamborghini|lambo|bentley|rolls|mercedes|range rover|porsche|suv|bugatti|mclaren)\b/.test(t)) out.kind = buy && !hire ? 'car_buy' : hire ? 'car_hire' : buy ? 'car_buy' : undefined
  else if (/\b(decor|furniture|interior|sculpture|artwork|chandelier)\b/.test(t)) out.kind = 'decor'
  else if (/\b(office|commercial|warehouse|shop space|tower)\b/.test(t)) out.kind = rent ? 'commercial_lease' : 'commercial_buy'
  else if (/\b(jet|private jet|helicopter|experience)\b/.test(t)) out.kind = 'experience'
  else if (/\b(house|home|villa|apartment|flat|mansion|penthouse|duplex|residence|property|bungalow)\b/.test(t) || stay) {
    if (stay && !buy && !(rent && !/\bnight/.test(t))) out.kind = 'stay'
    else if (buy && !rent) out.kind = 'home_buy'
    else if (rent && !buy) out.kind = 'home_rent'
    else if (stay) out.kind = 'stay'
    else out.kindChoices = ['home_buy', 'home_rent', 'stay']
  }
  if (out.kind === 'car_hire' && !hire) out.kind = undefined

  const bed = t.match(new RegExp(`\\b${NUM}[\\s-]*(?:bed(?:room)?s?|br)\\b`))
  if (bed) { const n = num(bed[1]); if (n && n >= 1 && n <= 12) out.bedrooms = n }
  const guests = t.match(new RegExp(`\\b(?:for\\s+)?${NUM}\\s*(?:guests?|people|persons?|pax|adults?)\\b`))
  if (guests) { const n = num(guests[1]); if (n && n >= 1 && n <= 60) out.guests = n }

  const nights = t.match(new RegExp(`\\b${NUM}[\\s-]*(?:nights?|days?)\\b`))
  if (nights) { const n = num(nights[1]); if (n && n >= 1 && n <= 60) out.nights = n }
  else if (/\b(a|one) week\b/.test(t)) out.nights = 7
  const dates = readDates(t, /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date(Date.now() + 3_600_000).toISOString().slice(0, 10))
  if (dates.start) out.start = dates.start
  if (dates.end) out.end = dates.end

  const b = readBudget(t)
  if (b.budget !== undefined) out.budget = b.budget
  if (b.usdOnly) out.usdOnly = true

  const areas = AREA_WORDS.filter(([, re]) => re.test(` ${t} `)).map(([k]) => k)
  if (areas.length) out.locations = areas

  const asks = new Set<Ask>()
  if (/\b(available|availability|free (on|for|from)|is anything free|vacant|open (on|for))\b|\bis (it|this|that) free\b/.test(t) || (out.start && /\b(free|anything)\b/.test(t))) asks.add('availability')
  if (/\b(book|reserve|reservation|secure it)\b/.test(t)) asks.add('book')
  if (/\b(price|cost|how much|rate|fee|budget)\b/.test(t)) asks.add('price')
  if (/\b(pay|payment|card|transfer|deposit|invoice)\b/.test(t)) asks.add('payment')
  if (/\b(cancel|cancellation|refund|change my booking)\b/.test(t)) asks.add('cancel')
  if (/\b(list (my|our)|become a partner|partner with|i own a|my property|host with you|sell through)\b/.test(t)) asks.add('partner')
  if (/\b(what is lux|who are you|about (you|lux)|what do you (do|sell|offer))\b/.test(t)) asks.add('about')
  if (/\b(safe|security|safety|secure|trust|legit|scam)\b/.test(t)) asks.add('safety')
  out.asks = [...asks]
  return out
}

// A budget in naira, placed in the band Discover already uses for that kind.
export function bandKeyFor(kind: KindKey, amount: number): string | undefined {
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  return bandsFor(kind).find((b) => b.key !== 'any' && amount >= b.min && amount < b.max)?.key
}

// A conversation is read message by message: a later message adds to or changes
// what an earlier one said ("a villa", then "under 500m"). Changing what is
// being looked for (home, then a car) starts the search afresh. A start date
// plus a number of nights becomes a range.
export function mergeReads(reads: Read[]): Read {
  const latest = reads[reads.length - 1]
  const out: Read = { asks: latest?.asks ?? [], wantsPerson: !!latest?.wantsPerson, greeting: !!latest?.greeting, thanks: !!latest?.thanks, injection: !!latest?.injection }
  let kind: KindKey | undefined
  for (const r of reads) {
    if (r.kind && r.kind !== kind) {
      kind = r.kind
      delete out.budget; delete out.usdOnly; delete out.bedrooms; delete out.guests; delete out.nights; delete out.start; delete out.end; delete out.locations; delete out.services; delete out.kindChoices
    }
    if (r.kind) out.kind = r.kind
    if (r.kindChoices && !out.kind) out.kindChoices = r.kindChoices
    for (const k of ['budget', 'usdOnly', 'bedrooms', 'guests', 'nights', 'start', 'end', 'locations', 'services'] as const) {
      if (r[k] !== undefined) (out as Record<string, unknown>)[k] = r[k]
    }
    // New dates replace old ones as a pair.
    if (r.start && !r.end) delete out.end
  }
  if (out.start && !out.end && out.nights) {
    out.end = new Date(Date.parse(`${out.start}T00:00:00Z`) + out.nights * 86_400_000).toISOString().slice(0, 10)
  }
  return out
}

// The one-line hello that floats next to the icon: the greeting without the
// introduction, then a short offer. Never repeats a question mark.
export function nudgeText(hour: number): string {
  const head = greeting(hour).split(/(?<=[.?])\s/)[0]
  return `${head} Need a hand?`
}
