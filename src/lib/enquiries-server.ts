import { prisma } from '@/lib/prisma'
import { getAppUrl, categoryHrefs } from '@/lib/utils'
import { send } from '@/lib/bookings-server'
import { topicFromMessage, viewingModeLabel, viewingTimeLabel } from '@/lib/enquiry'

const fname = (n: string) => n.split(' ')[0] || 'there'
const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

// A new enquiry or viewing request: the team (admins and Enquiries) and the
// listing's partner hear at once; the enquirer gets an acknowledgement.
// Runs just after the response, so the guest never waits on email.
export async function notifyEnquiry(id: string) {
  const e = await prisma.inquiry.findUnique({ where: { id }, include: { listing: { select: { title: true, slug: true, category: true, ownerId: true } } } })
  if (!e) return
  const viewing = e.kind === 'viewing'
  const brief = e.kind === 'brief'
  const what = e.listing?.title ?? (brief ? topicFromMessage(e.message) : null) ?? 'a general enquiry'
  const when = viewing && e.preferredDate ? `${fmtDay(e.preferredDate)}, ${viewingTimeLabel(e.preferredTime)}, ${viewingModeLabel(e.viewingMode).toLowerCase()}` : null
  const listingUrl = e.listing ? `${getAppUrl()}${categoryHrefs[e.listing.category] ?? '/catalog'}/${e.listing.slug}` : null
  const details = [
    { text: `From: ${e.name}, ${e.email}${e.phone ? `, ${e.phone}` : ''}` },
    ...(when ? [{ text: `Preferred viewing: ${when}` }] : []),
    { text: `Message: ${e.message.slice(0, 800)}` },
  ]
  const team = await prisma.user.findMany({
    where: { OR: [{ role: 'admin' }, { role: 'team', permissions: { has: 'enquiries' } }, ...(e.listing?.ownerId ? [{ id: e.listing.ownerId }] : [])] },
    select: { id: true, email: true, name: true },
  })
  for (const u of team) {
    const owner = u.id === e.listing?.ownerId
    await send(u.email, u.id, 'inquiry_new', `${viewing ? 'Viewing request' : brief ? 'New request' : 'New enquiry'}: ${what}`, {
      preheader: `${e.name} ${viewing ? 'would like to view' : brief ? 'is looking for' : 'asked about'} ${what}.`,
      eyebrow: viewing ? 'Viewing request' : brief ? 'New request' : 'New enquiry',
      greeting: `${viewing ? 'A viewing request' : brief ? 'A new request' : 'A new enquiry'}, ${fname(u.name)}`,
      intro: `${e.name} ${viewing ? 'would like to view' : brief ? 'is looking for' : 'has asked about'} ${what}. A reply within the hour wins most clients.${owner ? ' Our concierge will coordinate with you.' : ''}`,
      blocks: [
        ...(e.listing ? [{ type: 'heading' as const, text: e.listing.title }] : []),
        { type: 'bullets', items: details },
        { type: 'cta', label: owner ? 'Open your dashboard' : 'Open enquiries', url: `${getAppUrl()}${owner ? '/admin' : '/admin/inquiries'}` },
      ],
      reason: 'You receive this because you handle enquiries on Lux Catalog.',
    })
  }
  await send(e.email, e.userId, 'inquiry_received', viewing ? `Viewing request received: ${what}` : brief ? `We’ve received your request: ${what}` : `We’ve received your enquiry: ${what}`, {
    preheader: 'A specialist will be in touch shortly.',
    eyebrow: viewing ? 'Viewing request' : brief ? 'Request received' : 'Enquiry received',
    greeting: `Thank you, ${fname(e.name)}`,
    intro: viewing
      ? `We’ve received your request to view ${what}${when ? ` on ${when}` : ''}. A specialist will confirm the time with you, usually within a few hours.`
      : brief
        ? `We’ve received your request for ${what}. A specialist will reply personally, usually within a few hours.`
        : `We’ve received your enquiry about ${what}. A specialist will reply personally, usually within a few hours.`,
    blocks: [{ type: 'paragraph', text: `Your message: “${e.message.slice(0, 600)}”` }, ...(listingUrl ? [{ type: 'cta' as const, label: 'View the listing', url: listingUrl }] : [])],
    reason: 'You receive this because you contacted Lux Catalog.',
  })
}
