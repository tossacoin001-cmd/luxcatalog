import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils'
import { renderEmail, type Block } from '@/lib/notify/layout'
import { naira, quote, selectionToRange, toDate, toDay, unitLabel, POLICY_TEXT } from '@/lib/booking'
import { bookedRanges, closedRanges, rulesFrom } from '@/lib/booking-server'
import { initializeTransaction, toKobo, type PaystackTransaction } from '@/lib/paystack'
import { schedulePayout } from '@/lib/payouts-server'

export const HOLD_MINUTES = 15
// On-request listings: the partner has this long to answer, then the guest
// this long to pay after acceptance.
export const REQUEST_HOURS = 12
export const PAY_AFTER_ACCEPT_HOURS = 24

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

// Re-price and hold the dates: for HOLD_MINUTES while the guest pays
// (instant booking), or REQUEST_HOURS while the partner decides (on request).
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
        status: s.instantBook ? 'pending_payment' : 'requested',
        holdExpiresAt: new Date(Date.now() + (s.instantBook ? HOLD_MINUTES * 60_000 : REQUEST_HOURS * 3_600_000)),
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
    include: { listing: { select: { title: true, location: true, ownerId: true, bookingSettings: { select: { checkInTime: true, checkOutTime: true, hoursPerDay: true, requireGuestId: true } } } } },
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
      ...(b.unit === 'night' && b.listing.bookingSettings?.requireGuestId
        ? [{ type: 'paragraph' as const, text: 'Before you arrive, please add a photo of your ID on your booking page (passport, driver’s licence or national ID). It is stored privately and only your host and our bookings team can see it.' }]
        : []),
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

// ---------------------------------------------------------------------------
// Payment links, and on-request bookings
// ---------------------------------------------------------------------------

// Paystack checkout for a booking awaiting payment. Re-uses the link already
// issued (Paystack refuses a second transaction with the same reference),
// so a guest who leaves the checkout can come back and finish.
export async function startPayment(bookingId: string) {
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })
  if (b.status !== 'pending_payment' || !b.holdExpiresAt || b.holdExpiresAt <= new Date()) {
    throw new BookingError('This booking can no longer be paid. Please choose your dates again.', 409)
  }
  if (b.paymentUrl) return b.paymentUrl
  const trx = await initializeTransaction({
    email: b.guestEmail,
    amountKobo: toKobo(Number(b.amountDue)),
    reference: b.reference,
    callbackUrl: `${getAppUrl()}/bookings/${b.reference}`,
    metadata: { bookingId: b.id, listingId: b.listingId, cancel_action: `${getAppUrl()}/bookings/${b.reference}` },
  })
  await prisma.booking.update({ where: { id: b.id }, data: { paymentUrl: trx.authorization_url } })
  return trx.authorization_url
}

const fname = (n: string) => n.split(' ')[0] || 'there'
async function bookingStaff(ownerId: string | null) {
  return prisma.user.findMany({
    where: { OR: [{ role: 'admin' }, { role: 'team', permissions: { has: 'bookings' } }, ...(ownerId ? [{ id: ownerId }] : [])] },
    select: { id: true, email: true, name: true },
  })
}

export async function emailRequested(bookingId: string) {
  const b = await loadForEmail(bookingId)
  await send(b.guestEmail, b.userId, 'booking_requested', `Request sent: ${b.listing.title}`, {
    preheader: 'The host will reply within 12 hours. No payment has been taken.',
    eyebrow: 'Booking request',
    greeting: `Request sent, ${fname(b.guestName)}`,
    intro: `We've sent your request for ${b.listing.title} to the host. They reply within ${REQUEST_HOURS} hours, and your dates are held until then. You only pay once they accept.`,
    blocks: [...summary(b), { type: 'cta', label: 'View your request', url: `${getAppUrl()}/bookings/${b.reference}` }],
    reason: 'You receive this because you requested a booking on Lux Catalog.',
  })
  for (const u of await bookingStaff(b.listing.ownerId)) {
    const owner = u.id === b.listing.ownerId
    await send(u.email, u.id, 'booking_request_new', `Booking request: ${b.listing.title} (${b.reference})`, {
      preheader: `Please accept or decline within ${REQUEST_HOURS} hours.`,
      eyebrow: 'New booking request',
      greeting: `New request, ${fname(u.name)}`,
      intro: `${b.guestName} would like to book ${b.listing.title}. ${owner ? 'Please' : 'The partner should'} accept or decline within ${REQUEST_HOURS} hours. After that the request expires and the dates reopen.`,
      blocks: [...summary(b), { type: 'cta', label: 'Accept or decline', url: `${getAppUrl()}/admin/bookings` }],
      reason: 'You receive this because a booking was requested on Lux Catalog.',
    })
  }
}

// Partner (own listing) or bookings team accepts a request: the guest then
// has PAY_AFTER_ACCEPT_HOURS to pay.
export async function acceptRequest(bookingId: string, actor: { userId: string; role: string }) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { ownerId: true } } } })
  if (!b || (actor.role === 'partner' && b.listing.ownerId !== actor.userId)) throw new BookingError('Booking not found', 404)
  if (b.status !== 'requested') throw new BookingError('This request has already been answered')
  if (!b.holdExpiresAt || b.holdExpiresAt <= new Date()) throw new BookingError('This request has expired')
  await prisma.booking.update({
    where: { id: b.id },
    data: { status: 'pending_payment', respondedAt: new Date(), holdExpiresAt: new Date(Date.now() + PAY_AFTER_ACCEPT_HOURS * 3_600_000) },
  })
  const full = await loadForEmail(b.id)
  await send(full.guestEmail, full.userId, 'booking_accepted', `Accepted: ${full.listing.title}. Complete your booking`, {
    preheader: `Pay within ${PAY_AFTER_ACCEPT_HOURS} hours to confirm.`,
    eyebrow: 'Request accepted',
    greeting: `Good news, ${fname(full.guestName)}`,
    intro: `The host has accepted your request. Pay ${naira(Number(full.amountDue))} within ${PAY_AFTER_ACCEPT_HOURS} hours to confirm your booking. The dates are held for you until then.`,
    blocks: [...summary(full), { type: 'cta', label: 'Pay and confirm', url: `${getAppUrl()}/bookings/${full.reference}` }],
    reason: 'You receive this because you requested a booking on Lux Catalog.',
  }).catch((e) => console.error('Accept email failed:', e))
}

export async function declineRequest(bookingId: string, actor: { userId: string; role: string }, reason: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { ownerId: true } } } })
  if (!b || (actor.role === 'partner' && b.listing.ownerId !== actor.userId)) throw new BookingError('Booking not found', 404)
  if (b.status !== 'requested') throw new BookingError('This request has already been answered')
  await prisma.booking.update({ where: { id: b.id }, data: { status: 'declined', respondedAt: new Date(), declineReason: reason.slice(0, 300), holdExpiresAt: null } })
  const full = await loadForEmail(b.id)
  await send(full.guestEmail, full.userId, 'booking_declined', `Request not available: ${full.listing.title}`, {
    preheader: 'No payment was taken. Our concierge can suggest alternatives.',
    eyebrow: 'Booking request',
    greeting: `We're sorry, ${fname(full.guestName)}`,
    intro: `The host can't accommodate this request${reason ? ` (${reason})` : ''}. No payment was taken. Reply to this email and our concierge will suggest similar options for your dates.`,
    blocks: [...summary(full), { type: 'cta', label: 'Explore alternatives', url: `${getAppUrl()}/catalog` }],
    reason: 'You receive this because you requested a booking on Lux Catalog.',
  }).catch((e) => console.error('Decline email failed:', e))
}

// Daily: requests nobody answered in time expire (their dates were already
// freed when the hold lapsed), and the guest is told.
export async function expireUnansweredRequests(now = new Date()) {
  const stale = await prisma.booking.findMany({ where: { status: 'requested', holdExpiresAt: { lte: now } }, select: { id: true } })
  for (const { id } of stale) {
    await prisma.booking.update({ where: { id }, data: { status: 'expired', note: 'The host did not answer in time.' } })
    const b = await loadForEmail(id)
    await send(b.guestEmail, b.userId, 'booking_request_expired', `Request expired: ${b.listing.title}`, {
      preheader: 'The host did not reply in time. No payment was taken.',
      eyebrow: 'Booking request',
      greeting: `We're sorry, ${fname(b.guestName)}`,
      intro: 'The host did not reply in time, so your request has expired. No payment was taken. Our concierge will gladly help you find something similar.',
      blocks: [...summary(b), { type: 'cta', label: 'Explore alternatives', url: `${getAppUrl()}/catalog` }],
      reason: 'You receive this because you requested a booking on Lux Catalog.',
    }).catch(() => {})
  }
  return stale.length
}
