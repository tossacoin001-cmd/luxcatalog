import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { matchListings, type DiscoverPrefs } from '@/lib/discover'
import { clientIp, rateLimit } from '@/lib/protect'
import { validateBrief, matchBrief, kindMatchesListing, DATED_KINDS, type Availability, type BriefListing } from '@/lib/discover-brief'
import { priceCaption } from '@/lib/listing-views'
import { quote, selectionToRange } from '@/lib/booking'
import { blockedRanges, bookableListing } from '@/lib/booking-server'

// Discover: our own matching always chooses the listings (it can only pick
// real, published ones). When an Anthropic key is configured, Claude writes
// the summary and the "why" for those same matches; if it is unavailable
// or fails, our own wording is used. Rate limited per visitor.
const MODEL = 'claude-haiku-5-5'

const LABEL: Record<string, string> = {
  real_estate: 'homes', shortlet: 'stays', supercar: 'cars', yacht: 'yachts', decor: 'pieces', commercial: 'commercial spaces', lifestyle: 'experiences', executive_services: 'chauffeur and security services', private_services: 'private services',
}

export async function POST(req: Request) {
  if (!(await rateLimit(`discover:${clientIp(req.headers)}`, 10, 3_600_000))) {
    return NextResponse.json({ error: 'You’ve asked for several matches in a short time. Please try again a little later.' }, { status: 429 })
  }
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Tell us what you are looking for first.' }, { status: 400 })
  if ('brief' in body) return answerBrief((body as { brief: unknown }).brief)
  const prefs = (body.preferences ?? {}) as DiscoverPrefs
  const listings = await prisma.listing.findMany({
    where: { status: { not: 'sold' }, published: true },
    select: { title: true, slug: true, category: true, priceDisplay: true, price: true, location: true, description: true },
    take: 300,
  })
  if (!listings.length) {
    return NextResponse.json({ summary: 'Our collection is being curated. Tell us what you are looking for and a specialist will find it for you.', matches: [], engine: 'lux' })
  }
  const ranked = matchListings(prefs, listings.map((l) => ({ ...l, price: l.price ? Number(l.price) : null })))
  const byslug = new Map(listings.map((l) => [l.slug, l]))
  const top = ranked.slice(0, 5)
  let matches = top.map((m, i) => ({ title: m.title, slug: m.slug, category: m.category, priceDisplay: byslug.get(m.slug)?.priceDisplay ?? '', matchScore: Math.max(60, 97 - i * 6), reason: m.reason }))
  const cats = Array.isArray(prefs.categories) ? prefs.categories : prefs.categories ? [prefs.categories] : []
  let summary = matches.length
    ? `Here are ${matches.length === 1 ? 'the' : `the ${matches.length}`} ${cats.length ? cats.map((c) => LABEL[c] ?? c).join(' and ') : 'pieces'} in our collection that best match what you told us.`
    : 'Nothing in the collection matches those choices right now. Tell us what you are looking for and a specialist will source it for you.'
  let engine: 'lux' | 'ai' = 'lux'

  if (process.env.ANTHROPIC_API_KEY && matches.length) {
    try {
      const client = new Anthropic()
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 700,
        messages: [
          {
            role: 'user',
            content: `You write for Lux Catalog, a luxury marketplace in Lagos. A client answered: ${JSON.stringify(prefs)}. These listings were already chosen for them (do not add or remove any):\n${matches.map((m) => `- ${m.slug}: ${m.title} | ${m.category} | ${m.priceDisplay} | ${byslug.get(m.slug)?.location}`).join('\n')}\nReply with JSON only: {"summary": "one elegant sentence", "reasons": {"<slug>": "one or two sentences on why it suits them"}}`,
          },
        ],
      })
      const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
      const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { summary?: string; reasons?: Record<string, string> }
      if (typeof data.summary === 'string' && data.summary.length > 10) summary = data.summary.slice(0, 300)
      matches = matches.map((m) => ({ ...m, reason: typeof data.reasons?.[m.slug] === 'string' ? data.reasons[m.slug].slice(0, 400) : m.reason }))
      engine = 'ai'
    } catch (err) {
      console.error('Discover AI wording unavailable, using our own:', (err as Error).message)
    }
  }
  return NextResponse.json({ summary, matches, engine })
}

// Discover v2: a brief with several needs, each answered from real listings of
// the right kind, with real availability for the dates given. Our own rules
// choose and order everything (so nothing can be invented); the wording is
// plain and ours.
async function answerBrief(raw: unknown) {
  const checked = validateBrief(raw)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
  const { brief } = checked
  const rows = await prisma.listing.findMany({
    where: { status: { not: 'sold' }, published: true },
    select: { id: true, title: true, slug: true, category: true, subcategory: true, mode: true, priceDisplay: true, price: true, location: true, description: true, specs: true, images: true },
    take: 400,
  })
  const listings: (BriefListing & { id: string })[] = rows.map((l) => {
    const bed = Number(String((l.specs as Record<string, unknown> | null)?.Bedrooms ?? '').match(/\d+/)?.[0])
    return {
      id: l.id, slug: l.slug, title: l.title, category: l.category, subcategory: l.subcategory, price: l.price ? Number(l.price) : null,
      priceDisplay: l.priceDisplay, location: l.location, description: l.description, bedrooms: Number.isFinite(bed) ? bed : null,
      priceNote: priceCaption(l.category, l.subcategory, String(l.mode)).suffix, image: l.images?.[0] ?? null,
    }
  })

  // Real availability for stays, hire and security on the dates asked.
  const availability: Record<string, Availability> = {}
  for (const need of brief.needs) {
    if (!DATED_KINDS.includes(need.kind) || !need.start || !need.end) continue
    const candidates = listings.filter((l) => kindMatchesListing(need.kind, l)).slice(0, 12)
    await Promise.all(
      candidates.map(async (l) => {
        try {
          const found = await bookableListing(l.id)
          if (!found) return
          const range = selectionToRange(found.rules.unit, need.start!, need.end!)
          const result = quote(found.rules, range, await blockedRanges(l.id, range.start, range.end), { guests: need.guests })
          availability[l.slug] = result.ok ? 'available' : 'unavailable'
        } catch {
          // Could not check: leave it unchecked rather than guess.
        }
      }),
    )
  }

  const groups = matchBrief(brief, listings, availability)
  const found = groups.filter((g) => !g.empty)
  const summary = found.length
    ? `Here is what we can offer for ${found.map((g) => g.label.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}${brief.needs.some((n) => n.start && n.end) ? ', with availability checked for your dates' : ''}.${groups.some((g) => g.empty || g.missing.length) ? ' For the rest, a specialist will source it for you.' : ''}`
    : 'We have nothing in the collection for those choices right now. Tell us what you are looking for and a specialist will source it for you.'
  return NextResponse.json({ summary, groups, engine: 'lux' })
}
