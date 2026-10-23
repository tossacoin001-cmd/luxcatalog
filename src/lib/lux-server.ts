import { prisma } from '@/lib/prisma'
import { DATED_KINDS, KINDS, kindMatchesListing, type KindKey, type Need } from '@/lib/discover-brief'
import { answerBriefData, listingAvailability } from '@/lib/discover-brief-server'
import { mergeReads, readMessage, starters, type Read, type Starter } from '@/lib/lux-chat'
import { KNOWLEDGE } from '@/lib/lux-knowledge'

// Lux answers from real listings only. Our own rules read the message and pick
// the listings; the wording is plain and ours. (A model can later rewrite the
// wording; it never chooses what is shown.)
export type LuxMessage = { role: 'user' | 'assistant'; content: string }
export type LuxCard = {
  slug: string; title: string; href: string; image: string | null; priceDisplay: string; priceNote: string
  availability: 'available' | 'unavailable' | 'unchecked'; reason: string; bookHref?: string
}
export type LuxReply = { reply: string; cards: LuxCard[]; chips: Starter[]; handoff?: boolean; engine: 'lux' }

const lagosToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)
const pretty = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const KIND_KEYS = Object.keys(KINDS) as KindKey[]
const kindOfListing = (l: { category: string; subcategory: string | null }): KindKey | undefined => KIND_KEYS.find((k) => kindMatchesListing(k, l))

const FOLLOW_UPS: Starter[] = [
  { label: 'Change my budget', text: 'Let me change my budget' },
  { label: 'Different dates', text: 'Let me try different dates' },
  { label: 'Show me something similar', text: 'Show me something similar' },
  { label: 'Speak to a person', text: 'I would like to speak to a person' },
]

const reply = (text: string, chips: Starter[] = starters(), cards: LuxCard[] = [], extra: Partial<LuxReply> = {}): LuxReply => ({ reply: text, cards, chips, engine: 'lux', ...extra })

function toNeed(m: Read): Need | null {
  if (!m.kind) return null
  const dated = DATED_KINDS.includes(m.kind)
  const need: Need = { kind: m.kind }
  if (m.bedrooms) need.bedrooms = m.bedrooms
  if (m.guests) need.guests = m.guests
  if (m.services?.length) need.services = m.services
  if (dated && m.start && m.end) { need.start = m.start; need.end = m.end }
  if ((m.kind === 'service' || m.kind === 'yacht_cruise') && m.start) need.date = m.start
  return need
}

export async function luxAnswer(messages: LuxMessage[], listingSlug?: string): Promise<LuxReply> {
  const today = lagosToday()
  const users = messages.filter((x) => x.role === 'user').slice(-6)
  const m = mergeReads(users.map((x) => readMessage(x.content, today)))
  const last = readMessage(users[users.length - 1]?.content ?? '', today)

  if (last.injection) return reply(KNOWLEDGE.refuse)
  if (last.wantsPerson) return reply(KNOWLEDGE.person, FOLLOW_UPS.slice(0, 3), [], { handoff: true })

  if (m.usdOnly && !m.budget && !m.asks.length) return reply(KNOWLEDGE.naira)

  // A question about the listing the visitor is looking at.
  if (listingSlug) {
    const l = await prisma.listing.findFirst({ where: { slug: listingSlug, published: true, status: { not: 'sold' } }, select: { id: true, title: true, category: true, subcategory: true } })
    if (l && (last.asks.includes('availability') || last.asks.includes('book')) ) {
      const dated = m.start && m.end
      if (!dated) return reply(`Tell me the dates you have in mind for ${l.title} and I’ll check them straight away.`, starters({ listingTitle: l.title }))
      const a = await listingAvailability(l.id, m.start!, m.end!, m.guests)
      if (a === 'available') {
        return reply(`Yes, ${l.title} is free from ${pretty(m.start!)} to ${pretty(m.end!)}. You can book those dates from its page.`, FOLLOW_UPS.slice(1), [], {})
      }
      const kind = kindOfListing(l)
      const alt = kind ? await answerBriefData({ needs: [{ kind, start: m.start, end: m.end, guests: m.guests }] }) : null
      const cards = cardsFrom(alt?.groups?.[0]?.matches ?? []).filter((c) => c.slug !== listingSlug && c.availability === 'available').slice(0, 3)
      return reply(a === 'unavailable'
        ? `${l.title} is not free from ${pretty(m.start!)} to ${pretty(m.end!)}.${cards.length ? ' These similar ones are free on those dates:' : ' I can ask the team to find you something similar.'}`
        : `I can’t confirm ${l.title} for those dates from here. A specialist can check it for you.`, FOLLOW_UPS, cards)
    }
  }

  // Questions about us.
  if (!m.kind && !m.kindChoices) {
    for (const [ask, text] of [['payment', KNOWLEDGE.payment], ['cancel', KNOWLEDGE.cancel], ['partner', KNOWLEDGE.partner], ['about', KNOWLEDGE.about], ['safety', KNOWLEDGE.safety]] as const) {
      if (last.asks.includes(ask)) return reply(text, starters())
    }
    if (m.usdOnly) return reply(KNOWLEDGE.naira)
    if (last.thanks && !last.greeting) return reply(KNOWLEDGE.thanks)
    if (last.greeting) return reply('Lovely to hear from you. What are you looking for: a home, a stay, a car, a yacht, or a private service?')
    return reply(KNOWLEDGE.fallback)
  }

  if (m.kindChoices && !m.kind) {
    return reply('Would you like to buy, rent for the year, or stay by the night?', [
      { label: 'Buy a home', text: 'I want to buy a home' },
      { label: 'Rent a home', text: 'I want to rent a home' },
      { label: 'A stay by the night', text: 'I need a shortlet stay' },
    ])
  }

  const kind = m.kind!
  const meta = KINDS[kind]
  if (m.usdOnly && !m.budget) return reply(KNOWLEDGE.naira)

  // A stay needs both ends of the dates to check them.
  if (DATED_KINDS.includes(kind) && m.start && !m.end) {
    return reply(`How many nights from ${pretty(m.start)}? I’ll check what is free.`, [
      { label: '1 night', text: '1 night' }, { label: '2 nights', text: '2 nights' }, { label: '3 nights', text: '3 nights' }, { label: 'A week', text: 'a week' },
    ])
  }

  const need = toNeed(m)!
  const data = await answerBriefData({ needs: [need], location: m.locations }, { maxPrice: m.budget })
  const group = data.groups[0]
  const cards = cardsFrom(group?.matches ?? [])

  if (!cards.length) {
    const why = m.budget ? ' within that budget' : ''
    const missing = group?.missing?.length ? ` (${group.missing.join(', ')})` : ''
    return reply(`I don’t have ${meta.noun}${why} right now${missing}. I can ask the team to source it for you, or you can change the budget.`, FOLLOW_UPS)
  }

  const dated = !!(need.start && need.end)
  const free = cards.filter((c) => c.availability === 'available').length
  const lead = dated
    ? free
      ? `Here ${cards.length === 1 ? 'is' : 'are'} ${cards.length} ${meta.label.toLowerCase()} for ${pretty(need.start!)} to ${pretty(need.end!)}; ${free === cards.length ? 'all' : free} free on those dates.`
      : `Nothing I can confirm as free for ${pretty(need.start!)} to ${pretty(need.end!)}. These are the closest; a specialist can look further.`
    : `Here ${cards.length === 1 ? 'is' : 'are'} ${cards.length} ${meta.label.toLowerCase()} I found${m.budget ? ' within your budget' : ''}.${DATED_KINDS.includes(kind) ? ' Tell me your dates and I’ll check they are free.' : ''}`
  return reply(lead, FOLLOW_UPS, cards)
}

function cardsFrom(matches: { slug: string; title: string; priceDisplay: string; priceNote: string; image: string | null; reason: string; availability: 'available' | 'unavailable' | 'unchecked'; href: string }[]): LuxCard[] {
  return matches.map((x) => ({
    slug: x.slug, title: x.title, href: x.href, image: x.image, priceDisplay: x.priceDisplay, priceNote: x.priceNote, availability: x.availability, reason: x.reason,
    ...(x.availability === 'available' && /[?&]start=/.test(x.href) ? { bookHref: x.href } : {}),
  }))
}
