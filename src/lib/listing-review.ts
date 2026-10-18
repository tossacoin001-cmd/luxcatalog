import { prisma } from '@/lib/prisma'
import { getAppUrl } from '@/lib/utils'
import { send } from '@/lib/bookings-server'

// Tells the admins a listing is waiting for approval, so the gate never
// becomes a silent queue. Runs after the response (the person who submitted
// never waits on email).
export async function notifyListingPending(listingId: string, byUserId: string, kind: 'new' | 'edited') {
  const [listing, by, admins] = await Promise.all([
    prisma.listing.findUnique({ where: { id: listingId }, select: { title: true, category: true, location: true } }),
    prisma.user.findUnique({ where: { id: byUserId }, select: { name: true, role: true } }),
    prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, email: true, name: true } }),
  ])
  if (!listing || !by) return
  const who = `${by.name} (${by.role === 'partner' ? 'partner' : 'team'})`
  for (const a of admins) {
    await send(a.email, a.id, 'listing_pending', `Awaiting your approval: ${listing.title}`, {
      preheader: `${who} ${kind === 'new' ? 'submitted' : 'changed'} a listing. It is not live until you approve it.`,
      eyebrow: 'Awaiting approval',
      greeting: `A listing needs you, ${a.name.split(' ')[0] || 'there'}`,
      intro: `${who} ${kind === 'new' ? 'submitted' : 'changed'} “${listing.title}” (${listing.location}). It stays hidden from customers until you approve it.`,
      blocks: [{ type: 'cta', label: 'Review the listing', url: `${getAppUrl()}/admin/listings` }],
      reason: 'You receive this because you approve listings on Lux Catalog.',
    })
  }
}
