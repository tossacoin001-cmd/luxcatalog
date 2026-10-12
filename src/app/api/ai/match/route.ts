import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { matchListings, type DiscoverPrefs } from '@/lib/discover'
import { clientIp, rateLimit } from '@/lib/protect'

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
  const body = await req.json().catch(() => ({}))
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
