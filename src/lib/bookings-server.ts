import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils'
import { renderEmail, type Block } from '@/lib/notify/layout'
import { naira, quote, selectionToRange, toDate, toDay, unitLabel, POLICY_TEXT } from '@/lib/booking'
import { bookedRanges, closedRanges, rulesFrom } from '@/lib/booking-server'
import { toKobo, type PaystackTransaction } from '@/lib/paystack'
import { schedulePayout } from '@/lib/payouts-server'

export const HOLD_MINUTES = 15

// LUX- plus 6 characters without look-alikes (no 0/O, 1/I/L).
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export function newReference() {
  const bytes = randomBytes(6)
  return `LUX-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`
}

export class BookingError extends Error {
  constructor(message: string, public status = 409) {
    super(message)
  }
}

// Serialise booking writes per listing: lock the listing's settings row for
// the rest of the transaction. Two guests paying for the same dates at the
// same second are handled one after the other, so only one gets them.
const lockListing = (tx: Prisma.TransactionClient, listingId: string) =>
  tx.$queryRaw`SELECT "listingId" FROM "BookingSettings" WHERE "listingId" = ${listingId} FOR UPDATE`

// Re-price and hold the dates for HOLD_MINUTES while the guest pays.
export async function createBookingHold(input: {
  listingId: string
  userId: string
  guestName: string
  guestEmail: string
  guestPhone: string | null
  first: string
  last: string
  guests?: number
}) {
  return prisma.$transaction(async (tx) => {
    await lockListing(tx, input.listingId)
    const listing = await tx.listing.findFirst({
      where: { id: input.listingId, published: true },
      select: { id: true, title: true, ownerId: true, bookingSettings: true },
    })
    const s = listing?.bookingSettings
    if (!listing || !s?.enabled) throw new BookingError('This listing is not taking online bookings', 404)
    if (!s.instantBook) throw new BookingError('This listing takes requests: send your dates to the concierge', 409)
    if (listing.ownerId && listing.ownerId === input.userId) throw new BookingError('You can’t book your own listing', 403)

    const rules = rulesFrom(s)
    const range = selectionToRange(rules.unit, input.first, input.last)
    const blocked = [...(await closedRanges(tx, listing.id, range.start, range.end)), ...(await bookedRanges(tx, listing.id, range.start, range.end))]
    const q = quote(rules, range, blocked, { guests: input.guests })
    if (!q.ok) throw new BookingError(q.error, 409)

    let reference = newReference()
    while (await tx.booking.findUnique({ where: { reference }, select: { id: true } })) reference = newReference()
    return tx.booking.create({
      data: {
        reference,
        listingId: listing.id,
        userId: input.userId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        startDate: toDate(q.range.start),
        endDate: toDate(q.range.end),
        unit: q.unit,
        units: q.units,
        guests: rules.maxGuests ? (input.guests ?? 1) : null,
        rate: q.rate,
        base: q.base,
        cleaningFee: q.cleaningFee,
        total: q.total,
        cautionDeposit: q.cautionDeposit,
        amountDue: q.dueNow,
        cancellationPolicy: rules.cancellationPolicy,
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
      },
    })
  })
}

export type ConfirmResult = { outcome: 'confirmed' | 'already' | 'needs_refund' | 'not_paid' | 'mismatch' | 'unknown'; bookingId?: string }

// Apply a Paystack result to the booking with that reference. Safe to call
// any number of times (return page and webhook both call it).
export async function applyPayment(trx: PaystackTransaction): Promise<ConfirmResult> {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { reference: trx.reference } })
    if (!booking) return { outcome: 'unknown' as const }
    await lockListing(tx, booking.listingId)
    const fresh = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } })
    if (fresh.status === 'confirmed' || fresh.needsRefund) return { outcome: 'already' as const, bookingId: fresh.id }
    if (trx.status !== 'success') return { outcome: 'not_paid' as const, bookingId: fresh.id }
    if (trx.currency !== fresh.currency || trx.amount !== toKobo(Number(fresh.amountDue))) {
      await tx.booking.update({ where: { id: fresh.id }, data: { needsRefund: true, note: `Paid ${trx.currency} ${trx.amount / 100}, expected ${fresh.currency} ${Number(fresh.amountDue)}` } })
      if (trx.currency === 'NGN' && trx.amount > 0) {
        await tx.refund.create({ data: { bookingId: fresh.id, kind: 'payment_issue', amount: trx.amount / 100, reason: 'Paid the wrong amount; the booking was not confirmed.' } })
      }
      return { outcome: 'mismatch' as const, bookingId: fresh.id }
    }
    // The hold may have lapsed while the guest paid. If someone else has
    // taken the dates since, the money must go back.
    const start = toDay(fresh.startDate), end = toDay(fresh.endDate)
    const taken = [...(await closedRanges(tx, fresh.listingId, start, end)), ...(await bookedRanges(tx, fresh.listingId, start, end, fresh.id))]
    const paidAt = trx.paid_at ? new Date(trx.paid_at) : new Date()
    if (taken.length) {
      await tx.booking.update({
        where: { id: fresh.id },
        data: { status: 'cancelled', needsRefund: true, paidAt, paymentChannel: trx.channel ?? null, holdExpiresAt: null, cautionStatus: 'included', note: 'Paid after the hold expired and the dates were taken. Refund in full.' },
      })
      await tx.refund.create({ data: { bookingId: fresh.id, kind: 'payment_issue', amount: trx.amount / 100, reason: 'Paid after the hold expired and the dates were taken by another guest.' } })
      return { outcome: 'needs_refund' as const, bookingId: fresh.id }
    }
    await tx.booking.update({ where: { id: fresh.id }, data: { status: 'confirmed', paidAt, paymentChannel: trx.channel ?? null, holdExpiresAt: null } })
    return { outcome: 'confirmed' as const, bookingId: fresh.id }
  })
  if (result.outcome === 'confirmed' && result.bookingId) {
    await schedulePayout(result.bookingId).catch((e) => console.error('Payout scheduling failed:', e))
    await emailConfirmed(result.bookingId).catch((e) => console.error('Booking emails failed:', e))
  }
  if ((result.outcome === 'needs_refund' || result.outcome === 'mismatch') && result.bookingId) await emailRefundNeeded(result.bookingId).catch((e) => console.error('Refund alert failed:', e))
  return result
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export async function send(to: string, userId: string | null, kind: string, subject: string, content: { preheader: string; eyebrow: string; greeting: string; intro: string; blocks: Block[]; reason: string }) {
  const { html, text } = renderEmail({ ...content, manageUrl: `${getAppUrl()}/account/notifications` })
  try {
    await sendEmail({ to, subject, text, html })
    await prisma.emailLog.create({ data: { userId, to, kind, subject, status: 'sent' } })
  } catch (err) {
    console.error(`${kind} email failed:`, err)
    await prisma.emailLog.create({ data: { userId, to, kind, subject, status: 'failed', error: String(err).slice(0, 500) } })
  }
}

export async function loadForEmail(bookingId: string) {
  return prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { listing: { select: { title: true, location: true, ownerId: true, bookingSettings: { select: { checkInTime: true, checkOutTime: true, hoursPerDay: true } } } } },
  })
}

export function summary(b: Awaited<ReturnType<typeof loadForEmail>>): Block[] {
  const night = b.unit === 'night'
  const s = b.listing.bookingSettings
  const items = [
    { text: `${night ? 'Check-in' : 'From'}: ${fmtDay(b.startDate)}${night && s ? `, from ${s.checkInTime}` : ''}` },
    { text: `${night ? 'Check-out' : 'Until'}: ${fmtDay(night ? b.endDate : new Date(b.endDate.getTime() - 86_400_000))}${night && s ? `, by ${s.checkOutTime}` : ''}` },
    { text: `${b.units} ${unitLabel(night ? 'night' : 'day', b.units)}${b.guests ? `, ${b.guests} guest${b.guests === 1 ? '' : 's'}` : ''}` },
    { text: `Total: ${naira(Number(b.total))}${Number(b.cautionDeposit) > 0 ? `, plus ${naira(Number(b.cautionDeposit))} refundable caution deposit` : ''}` },
    { text: `Reference: ${b.reference}` },
  ]
  return [
    { type: 'heading', text: b.listing.title },
    { type: 'bullets', items },
  ]
}

async function emailConfirmed(bookingId: string) {
  const b = await loadForEmail(bookingId)
  const first = b.guestName.split(' ')[0] || 'there'
  await send(b.guestEmail, b.userId, 'booking_confirmed', `Confirmed: ${b.listing.title} (${b.reference})`, {
    preheader: `Your booking ${b.reference} is confirmed.`,
    eyebrow: 'Booking confirmed',
    greeting: `You're booked, ${first}`,
    intro: `Thank you. Your payment of ${naira(Number(b.amountDue))} was received and ${b.listing.title} is reserved for you. Our concierge will send arrival details before your stay.`,
    blocks: [
      ...summary(b),
      { type: 'paragraph', text: `${POLICY_TEXT[b.cancellationPolicy].label} cancellation: ${POLICY_TEXT[b.cancellationPolicy].summary}` },
      { type: 'cta', label: 'View your booking', url: `${getAppUrl()}/bookings/${b.reference}` },
    ],
    reason: 'You receive this because you made a booking on Lux Catalog.',
  })

  const staffAndOwner = await prisma.user.findMany({
    where: { OR: [{ role: 'admin' }, { role: 'team', permissions: { has: 'bookings' } }, ...(b.listing.ownerId ? [{ id: b.listing.ownerId }] : [])] },
    select: { id: true, email: true, name: true },
  })
  for (const u of staffAndOwner) {
    const isOwner = u.id === b.listing.ownerId
    await send(u.email, u.id, isOwner ? 'booking_new_partner' : 'booking_new_admin', `New booking: ${b.listing.title} (${b.reference})`, {
      preheader: `${b.guestName} booked ${b.units} ${unitLabel(b.unit === 'night' ? 'night' : 'day', b.units)} from ${fmtDay(b.startDate)}.`,
      eyebrow: 'New booking',
      greeting: `New booking, ${u.name.split(' ')[0] || 'there'}`,
      intro: isOwner
        ? `${b.guestName} has booked and paid for ${b.listing.title}. The dates are now closed on your calendar.`
        : `${b.guestName} has booked and paid for ${b.listing.title}.`,
      blocks: [...summary(b), { type: 'cta', label: isOwner ? 'Open your bookings' : 'Open bookings', url: `${getAppUrl()}/admin/bookings` }],
      reason: 'You receive this because a booking was made on Lux Catalog.',
    })
  }
}

async function emailRefundNeeded(bookingId: string) {
  const b = await loadForEmail(bookingId)
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, email: true, name: true } })
  for (const u of admins) {
    await send(u.email, u.id, 'booking_refund_needed', `Action needed: refund ${b.reference}`, {
      preheader: 'A payment needs a refund.',
      eyebrow: 'Payment needs attention',
      greeting: `Refund needed, ${u.name.split(' ')[0] || 'there'}`,
      intro: `A payment for ${b.listing.title} can't be kept: ${b.note ?? 'see the booking'}`,
      blocks: [...summary(b), { type: 'cta', label: 'Open bookings', url: `${getAppUrl()}/admin/bookings` }],
      reason: 'You receive this as a Lux Catalog admin.',
    })
  }
}
