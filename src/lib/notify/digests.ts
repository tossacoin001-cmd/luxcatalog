import { prisma } from '@/lib/prisma'
import { categoryHrefs, categoryLabels, getAppUrl } from '@/lib/utils'
import { deliver, firstName, greeting } from '@/lib/notify/deliver'
import { CHECK_LABELS, overall, type Check } from '@/lib/notify/watchdog'
import type { Block, ListingItem } from '@/lib/notify/layout'

const naira = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

const DAY = 24 * 3600_000

type ListingLite = {
  id: string
  title: string
  slug: string
  category: string
  location: string
  country: string
  images: string[]
  price: unknown
  priceDisplay: string
}

export function toItem(l: ListingLite, note?: string): ListingItem {
  const price = l.price != null ? naira(Number(l.price)) : l.priceDisplay
  return {
    title: l.title,
    category: categoryLabels[l.category] ?? l.category,
    price,
    location: [l.location, l.country].filter(Boolean).join(', '),
    image: l.images[0] ?? null,
    url: `${getAppUrl()}${categoryHrefs[l.category] ?? '/catalog'}/${l.slug}`,
    note,
  }
}

const listingSelect = { id: true, title: true, slug: true, category: true, location: true, country: true, images: true, price: true, priceDisplay: true } as const

async function viewCounts(since: Date, listingIds?: string[]) {
  const rows = await prisma.listingView.groupBy({
    by: ['listingId'],
    where: { createdAt: { gte: since }, ...(listingIds ? { listingId: { in: listingIds } } : {}) },
    _count: { _all: true },
  })
  return new Map(rows.map((r) => [r.listingId, r._count._all]))
}

// ---------------------------------------------------------------------------
// Admin: the 7am Lux Briefing. Always sent (admins opted in by role), because
// "nothing happened" plus "all systems healthy" is itself useful news.
// ---------------------------------------------------------------------------
export async function sendAdminBriefings(checks: Check[], { dryRun = false } = {}) {
  const since = new Date(Date.now() - DAY)
  const [newUsers, newPartners, enquiries, paidOrders, saves, pending, unanswered, views] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: since }, role: 'partner' } }),
    prisma.inquiry.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { name: true, listing: { select: { title: true } } },
    }),
    prisma.order.findMany({ where: { status: 'paid', updatedAt: { gte: since } }, select: { total: true } }),
    prisma.savedListing.count({ where: { createdAt: { gte: since } } }),
    prisma.listing.count({ where: { published: false, ownerId: { not: null } } }),
    prisma.inquiry.count({ where: { status: 'new', createdAt: { lt: since } } }),
    viewCounts(since),
  ])
  const enquiryCount = await prisma.inquiry.count({ where: { createdAt: { gte: since } } })
  const revenue = paidOrders.reduce((s, o) => s + Number(o.total), 0)
  const totalViews = [...views.values()].reduce((a, b) => a + b, 0)

  const topIds = [...views.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const topListings = topIds.length
    ? await prisma.listing.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: listingSelect })
    : []

  const blocks: Block[] = [
    {
      type: 'stats',
      stats: [
        { label: 'Enquiries', value: String(enquiryCount) },
        { label: 'Paid orders', value: String(paidOrders.length), hint: revenue ? naira(revenue) : undefined },
        { label: 'New members', value: String(newUsers), hint: newPartners ? `${newPartners} partner${newPartners > 1 ? 's' : ''}` : undefined },
      ],
    },
    { type: 'stats', stats: [{ label: 'Listing views', value: String(totalViews) }, { label: 'Saves', value: String(saves) }, { label: 'To approve', value: String(pending) }] },
  ]

  const actions: { text: string; tone?: 'ok' | 'warn' | 'alert' }[] = []
  const waitingApps = await prisma.partnerApplication.count({ where: { status: 'submitted' } })
  if (waitingApps) actions.push({ text: `${waitingApps} partner application${waitingApps === 1 ? ' is' : 's are'} waiting for review.`, tone: 'warn' })
  if (unanswered) actions.push({ text: `${unanswered} enquir${unanswered === 1 ? 'y has' : 'ies have'} waited over 24 hours. A quick reply wins the booking.`, tone: 'alert' })
  if (pending) actions.push({ text: `${pending} partner listing${pending === 1 ? ' is' : 's are'} waiting for your approval.`, tone: 'warn' })
  if (actions.length) blocks.push({ type: 'heading', text: 'Needs your attention' }, { type: 'bullets', items: actions })

  if (enquiries.length) {
    blocks.push(
      { type: 'heading', text: 'Latest enquiries' },
      { type: 'bullets', items: enquiries.map((e) => ({ text: `${e.name}${e.listing ? ` about ${e.listing.title}` : ' (general)'}` })) }
    )
  }

  if (topListings.length) {
    blocks.push(
      { type: 'heading', text: 'Most viewed yesterday' },
      { type: 'listings', items: topIds.map(([id]) => topListings.find((l) => l.id === id)).filter(Boolean).map((l) => toItem(l!, `${views.get(l!.id)} views`)) }
    )
  }

  const status = overall(checks)
  blocks.push(
    { type: 'heading', text: status === 'ok' ? 'Watchdog: all systems healthy' : 'Watchdog report' },
    {
      type: 'bullets',
      items: checks
        .filter((c) => status === 'ok' || c.status !== 'ok')
        .slice(0, status === 'ok' ? 4 : 10)
        .map((c) => ({ text: `${CHECK_LABELS[c.name] ?? c.name}: ${c.detail}`, tone: c.status === 'fail' ? 'alert' : c.status === 'warn' ? 'warn' : 'ok' })),
    },
    { type: 'cta', label: 'Open the admin panel', url: `${getAppUrl()}/admin` }
  )

  const quiet = !enquiryCount && !paidOrders.length && !newUsers && !totalViews
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, email: true, name: true } })
  const results: Record<string, string> = {}
  for (const a of admins) {
    const name = firstName(a.name, a.email)
    results[a.email] = await deliver(
      a,
      'admin_briefing',
      status === 'fail'
        ? `Lux Briefing: action needed today, ${name}`
        : enquiryCount
          ? `Lux Briefing: ${enquiryCount} new enquir${enquiryCount === 1 ? 'y' : 'ies'}, ${name}`
          : `Your Lux Briefing, ${name}`,
      {
        preheader: `${enquiryCount} enquiries · ${totalViews} views · ${status === 'ok' ? 'all systems healthy' : 'Watchdog needs a look'}`,
        eyebrow: 'The Lux Briefing',
        greeting: greeting(name),
        intro: quiet
          ? 'A quiet 24 hours on the platform. Everything below is ready for the day ahead.'
          : "Here's what happened on Lux Catalog in the last 24 hours, and what needs you today.",
        blocks,
        reason: 'You receive this daily briefing because you are a Lux Catalog admin.',
      },
      { dryRun }
    )
  }
  return results
}

// ---------------------------------------------------------------------------
// Partners: daily when there was activity on their listings; on Mondays a
// 7-day summary (or a nudge to list) even if yesterday was quiet.
// ---------------------------------------------------------------------------
export async function sendPartnerDigests({ dryRun = false, now = new Date() } = {}) {
  const isMonday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Africa/Lagos' }).format(now) === 'Mon'
  const partners = await prisma.user.findMany({ where: { role: 'partner' }, select: { id: true, email: true, name: true } })
  const results: Record<string, string> = {}

  for (const p of partners) {
    const listings = await prisma.listing.findMany({ where: { ownerId: p.id }, select: { ...listingSelect, published: true } })
    const name = firstName(p.name, p.email)
    const ids = listings.map((l) => l.id)
    const windowMs = isMonday ? 7 * DAY : DAY
    const since = new Date(now.getTime() - windowMs)
    const period = isMonday ? 'this past week' : 'yesterday'

    if (!listings.length) {
      if (!isMonday) {
        results[p.email] = 'skipped_no_listings'
        continue
      }
      results[p.email] = await deliver(p, 'partner_digest', `${name}, your first listing is a few minutes away`, {
        preheader: 'Buyers and guests are browsing Lux Catalog right now.',
        eyebrow: 'Partner update',
        greeting: greeting(name),
        intro: "You don't have a listing on Lux Catalog yet. Shortlets, cars and protection are in high demand for the festive season. Add your first listing and our team will polish and publish it.",
        blocks: [{ type: 'cta', label: 'Add a listing', url: `${getAppUrl()}/admin/listings/new` }],
        reason: 'You receive partner updates because you list with Lux Catalog.',
      }, { dryRun, minGapHours: 6 * 24 })
      continue
    }

    const [views, saves, enquiries] = await Promise.all([
      viewCounts(since, ids),
      prisma.savedListing.count({ where: { listingId: { in: ids }, createdAt: { gte: since } } }),
      prisma.inquiry.count({ where: { listingId: { in: ids }, createdAt: { gte: since } } }),
    ])
    const totalViews = [...views.values()].reduce((a, b) => a + b, 0)
    const pendingMine = listings.filter((l) => !l.published).length
    const activity = totalViews + saves + enquiries

    if (!activity && !isMonday && !pendingMine) {
      results[p.email] = 'skipped_quiet'
      continue
    }

    const ranked = [...listings].sort((a, b) => (views.get(b.id) ?? 0) - (views.get(a.id) ?? 0))
    const tips: { text: string; tone?: 'ok' | 'warn' }[] = []
    const fewPhotos = listings.filter((l) => l.images.length < 4)
    if (fewPhotos.length) tips.push({ text: `${fewPhotos[0].title}${fewPhotos.length > 1 ? ` and ${fewPhotos.length - 1} more` : ''} ${fewPhotos.length > 1 ? 'have' : 'has'} fewer than 4 photos. Listings with 6+ photos get noticeably more enquiries.`, tone: 'warn' })
    const noPrice = listings.filter((l) => l.price == null)
    if (noPrice.length) tips.push({ text: `Adding a price to ${noPrice[0].title} helps it appear in price-sorted searches.`, tone: 'warn' })
    if (pendingMine) tips.push({ text: `${pendingMine} of your listing${pendingMine > 1 ? 's are' : ' is'} in review. We'll email you the moment it goes live.` })

    const blocks: Block[] = [
      { type: 'stats', stats: [{ label: 'Views', value: String(totalViews) }, { label: 'Saves', value: String(saves) }, { label: 'Enquiries', value: String(enquiries) }] },
    ]
    if (ranked.length) {
      blocks.push(
        { type: 'heading', text: isMonday ? 'Your listings this week' : 'Your listings yesterday' },
        { type: 'listings', items: ranked.slice(0, 3).map((l) => toItem(l, `${views.get(l.id) ?? 0} views${l.published ? '' : ' · in review'}`)) }
      )
    }
    if (tips.length) blocks.push({ type: 'heading', text: 'Ways to get more enquiries' }, { type: 'bullets', items: tips })
    blocks.push({ type: 'cta', label: 'Open your partner dashboard', url: `${getAppUrl()}/admin` })

    const subject = enquiries
      ? `${name}, ${enquiries} new enquir${enquiries === 1 ? 'y' : 'ies'} on your listings`
      : totalViews
        ? `${name}, your listings had ${totalViews} view${totalViews === 1 ? '' : 's'} ${period}`
        : `${name}, your weekly Lux Catalog summary`

    results[p.email] = await deliver(p, 'partner_digest', subject, {
      preheader: `${totalViews} views · ${saves} saves · ${enquiries} enquiries ${period}`,
      eyebrow: isMonday ? 'Your week on Lux Catalog' : 'Your day on Lux Catalog',
      greeting: greeting(name),
      intro: activity
        ? `Here's how your listings performed ${period}.`
        : 'A quieter week. Small improvements below can make a real difference before the festive rush.',
      blocks,
      reason: 'You receive partner updates because you list with Lux Catalog.',
    }, { dryRun })
  }
  return results
}
