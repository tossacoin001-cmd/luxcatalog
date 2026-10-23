import { prisma } from '@/lib/prisma'
import { matchBrief, kindMatchesListing, DATED_KINDS, type Availability, type Brief, type BriefListing, type Group } from '@/lib/discover-brief'
import { priceCaption } from '@/lib/listing-views'
import { quote, selectionToRange } from '@/lib/booking'
import { blockedRanges, bookableListing } from '@/lib/booking-server'

// Discover and Lux share this: a brief with several needs, each answered from
// real, published listings of the right kind, with real availability for the
// dates given. Our own rules choose and order everything, so nothing can be
// invented.
// A maximum price (in the listing's own unit) keeps a chat budget honest: nothing
// more than 2% above it is shown (rounding only). Listings with no figure (price on request)
// are kept.
export async function answerBriefData(brief: Brief, opts: { maxPrice?: number } = {}): Promise<{ summary: string; groups: Group[] }> {
  const rows = await prisma.listing.findMany({
    where: { status: { not: 'sold' }, published: true },
    select: { id: true, title: true, slug: true, category: true, subcategory: true, mode: true, priceDisplay: true, price: true, location: true, description: true, specs: true, images: true },
    take: 400,
  })
  const all: (BriefListing & { id: string })[] = rows.map((l) => {
    const bed = Number(String((l.specs as Record<string, unknown> | null)?.Bedrooms ?? '').match(/\d+/)?.[0])
    return {
      id: l.id, slug: l.slug, title: l.title, category: l.category, subcategory: l.subcategory, price: l.price ? Number(l.price) : null,
      priceDisplay: l.priceDisplay, location: l.location, description: l.description, bedrooms: Number.isFinite(bed) ? bed : null,
      priceNote: priceCaption(l.category, l.subcategory, String(l.mode)).suffix, image: l.images?.[0] ?? null,
    }
  })
  const cap = opts.maxPrice && opts.maxPrice > 0 ? opts.maxPrice * 1.02 : null
  const listings = cap ? all.filter((l) => l.price === null || l.price <= cap) : all

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
  return { summary, groups }
}

// Is one listing free on these dates? Same check the booking page makes.
export async function listingAvailability(listingId: string, start: string, end: string, guests?: number): Promise<Availability> {
  try {
    const found = await bookableListing(listingId)
    if (!found) return 'unchecked'
    const range = selectionToRange(found.rules.unit, start, end)
    const result = quote(found.rules, range, await blockedRanges(listingId, range.start, range.end), { guests })
    return result.ok ? 'available' : 'unavailable'
  } catch {
    return 'unchecked'
  }
}
