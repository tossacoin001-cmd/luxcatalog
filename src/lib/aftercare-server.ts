import { prisma } from '@/lib/prisma'
import { getAppUrl } from '@/lib/utils'
import { naira } from '@/lib/booking'
import { lagosParts, sessionLabel } from '@/lib/sessions'
import { loadForEmail, send, summary } from '@/lib/bookings-server'
import { MAX_CONCERNS_PER_BOOKING, REMINDER_HOURS, concernKind, validateConcern } from '@/lib/aftercare'

const fname = (n: string) => n.split(' ')[0] || 'there'

// "today" / "tomorrow" / the weekday, relative to when the job runs (Lagos).
function whenWord(start: Date, now: Date) {
  const s = lagosParts(start).day, n = lagosParts(now).day
  const diff = Math.round((Date.parse(`${s}T00:00:00Z`) - Date.parse(`${n}T00:00:00Z`)) / 86_400_000)
  return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : 'coming up'
}

// Daily: remind the guest and the professional of every paid session
// starting within REMINDER_HOURS. Each booking is claimed before sending,
// so a second run (or two runs at once) never sends twice.
export async function sendSessionReminders(now = new Date()) {
  const due = await prisma.booking.findMany({
    where: { unit: 'session', status: 'confirmed', remindedAt: null, startDate: { gt: now, lte: new Date(now.getTime() + REMINDER_HOURS * 3_600_000) } },
    select: { id: true },
  })
  let sent = 0
  for (const { id } of due) {
    const claimed = await prisma.booking.updateMany({ where: { id, remindedAt: null, status: 'confirmed' }, data: { remindedAt: now } })
    if (!claimed.count) continue
    const b = await loadForEmail(id)
    const when = whenWord(b.startDate, now)
    const time = lagosParts(b.startDate).time
    const pro = b.listing.ownerId
      ? await prisma.partnerProfile.findUnique({ where: { userId: b.listing.ownerId }, select: { brandName: true } })
      : null
    await send(b.guestEmail, b.userId, 'session_reminder', `Your session ${when} at ${time}: ${b.listing.title} (${b.reference})`, {
      preheader: `${b.packageName ?? 'Your session'} ${when} at ${time}, Lagos time.`,
      eyebrow: 'Your session is coming up',
      greeting: `See you ${when === 'coming up' ? 'soon' : when}, ${fname(b.guestName)}`,
      intro: `${pro?.brandName ?? 'Your professional'} will arrive ${when} at ${time} (Lagos time) for ${b.packageName ?? 'your session'}. If anything has changed, or if they are running late, reply to this email or message our concierge.`,
      blocks: [
        ...summary(b, true),
        { type: 'paragraph', text: `Who’s coming: ${pro?.brandName ?? 'your professional'}, vetted by Lux Catalog (identity and police character checked).` },
        { type: 'cta', label: 'View your booking', url: `${getAppUrl()}/bookings/${b.reference}` },
      ],
      reason: 'You receive this because you booked a session on Lux Catalog.',
    })
    if (b.listing.ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: b.listing.ownerId }, select: { id: true, email: true, name: true } })
      if (owner) {
        await send(owner.email, owner.id, 'session_reminder_partner', `Reminder: ${b.guestName} ${when} at ${time} (${b.reference})`, {
          preheader: `${sessionLabel(b.startDate, b.endDate)}, ${b.area ?? 'Lagos'}.`,
          eyebrow: 'Session reminder',
          greeting: `Your session ${when}, ${fname(owner.name)}`,
          intro: `${b.guestName} is expecting you ${when} at ${time} (Lagos time). Please arrive on time; if you are delayed, tell the guest${b.guestPhone ? ` (${b.guestPhone})` : ''} and our concierge straight away.`,
          blocks: [...summary(b, true), { type: 'cta', label: 'Open your bookings', url: `${getAppUrl()}/admin/bookings` }],
          reason: 'You receive this because you have a booking on Lux Catalog.',
        })
      }
    }
    sent++
  }
  return sent
}

export class ConcernError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

// A guest reports a problem: saved straight away; the alerts go out from
// notifyConcern (run just after the response, so the guest never waits).
export async function reportConcern(reference: string, userId: string, kind: string, message: string) {
  const b = await prisma.booking.findUnique({ where: { reference }, select: { id: true, userId: true, _count: { select: { concerns: true } } } })
  if (!b || b.userId !== userId) throw new ConcernError('Booking not found', 404)
  const invalid = validateConcern(kind, message)
  if (invalid) throw new ConcernError(invalid, 400)
  if (b._count.concerns >= MAX_CONCERNS_PER_BOOKING) throw new ConcernError('You’ve already sent several reports for this booking. Our team will be in touch; for anything urgent, call or message the concierge.', 429)
  const concern = await prisma.bookingConcern.create({ data: { bookingId: b.id, userId, kind, message: message.trim() } })
  return concern.id
}

// Admins and the bookings team are told (never the partner); the guest gets
// a receipt.
export async function notifyConcern(concernId: string) {
  const c = await prisma.bookingConcern.findUnique({ where: { id: concernId } })
  if (!c) return
  const k = concernKind(c.kind)!
  const message = c.message
  const full = await loadForEmail(c.bookingId)
  const staff = await prisma.user.findMany({
    where: { OR: [{ role: 'admin' }, { role: 'team', permissions: { has: 'bookings' } }] },
    select: { id: true, email: true, name: true },
  })
  for (const u of staff) {
    await send(u.email, u.id, 'booking_concern', `${k.urgent ? 'URGENT: ' : ''}Concern about ${full.reference}: ${k.label}`, {
      preheader: `${full.guestName}: ${message.trim().slice(0, 90)}`,
      eyebrow: k.urgent ? 'Urgent concern' : 'Guest concern',
      greeting: `${k.urgent ? 'Please act now' : 'A guest needs help'}, ${fname(u.name)}`,
      intro: `${full.guestName} reported “${k.label}” on ${full.listing.title}: “${message.trim().slice(0, 600)}”${k.urgent ? ' Contact the guest straight away.' : ''}`,
      blocks: [...summary(full, true), { type: 'paragraph', text: `Guest: ${full.guestName}, ${full.guestEmail}${full.guestPhone ? `, ${full.guestPhone}` : ''}. Paid ${naira(Number(full.amountDue))}.` }, { type: 'cta', label: 'Open needs attention', url: `${getAppUrl()}/admin/bookings?view=attention` }],
      reason: 'You receive this because you handle bookings on Lux Catalog.',
    })
  }
  await send(full.guestEmail, full.userId, 'booking_concern_received', `We’ve received your report (${full.reference})`, {
    preheader: 'Our team will be in touch shortly.',
    eyebrow: 'Report received',
    greeting: `Thank you, ${fname(full.guestName)}`,
    intro: k.urgent
      ? 'We’ve received your report and our team is acting on it now. If you feel unsafe, please call the emergency services first (112), then our concierge.'
      : 'We’ve received your report. Our team will look into it and contact you, usually within a few hours.',
    blocks: [{ type: 'paragraph', text: `What you told us (${k.label}): “${message.trim().slice(0, 600)}”` }, { type: 'cta', label: 'View your booking', url: `${getAppUrl()}/bookings/${full.reference}` }],
    reason: 'You receive this because you reported a concern on Lux Catalog.',
  })
}

export async function resolveConcern(bookingId: string, concernId: string, actorId: string, note: string) {
  const c = await prisma.bookingConcern.findFirst({ where: { id: concernId, bookingId } })
  if (!c) throw new ConcernError('Concern not found', 404)
  if (c.status === 'resolved') throw new ConcernError('This concern is already resolved', 409)
  if (note.trim().length < 5) throw new ConcernError('Add a short note on how it was resolved', 400)
  await prisma.bookingConcern.update({ where: { id: c.id }, data: { status: 'resolved', resolvedAt: new Date(), resolvedById: actorId, resolutionNote: note.trim().slice(0, 1000) } })
}
