import { prisma } from '@/lib/prisma'
import { getAppUrl } from '@/lib/utils'
import { lagosToday, naira, refundShare, toDate, toDay, POLICY_TEXT } from '@/lib/booking'
import { loadForEmail, send, summary } from '@/lib/bookings-server'
import { createRefund, toKobo } from '@/lib/paystack'
import { addDamageCompensation, adjustPayoutForCancellation, markDuePayouts } from '@/lib/payouts-server'

// Refunds and cancellations. Money only moves when a person approves a
// refund in the admin queue; everything else just prepares the numbers.

export const CLAIM_WINDOW_HOURS = 48
const money = (n: number) => Math.round(n * 100) / 100

// Can the partner still report damage on this booking? From the check-out
// day until 48 hours after it, while the deposit is untouched.
export function claimWindowOpen(b: { status: string; cautionDeposit: unknown; cautionStatus: string; endDate: Date }, now = new Date()) {
  const checkout = toDate(toDay(b.endDate)).getTime()
  return (
    ['confirmed', 'completed'].includes(b.status) &&
    Number(b.cautionDeposit) > 0 &&
    b.cautionStatus === 'held' &&
    now.getTime() >= checkout &&
    now.getTime() <= checkout + (CLAIM_WINDOW_HOURS + 24) * 3_600_000
  )
}

export class RefundError extends Error {
  constructor(message: string, public status = 409) {
    super(message)
  }
}

type BookingMoney = {
  status: string
  startDate: Date
  createdAt: Date
  base: unknown
  cleaningFee: unknown
  cautionDeposit: unknown
  amountDue: unknown
  cancellationPolicy: 'flexible' | 'moderate' | 'strict'
}

// What a guest gets back if they cancel now. Guests can cancel until the
// start day; the stay (base) is refunded per the policy, cleaning and the
// caution deposit in full.
export function guestCancellationQuote(b: BookingMoney, now = new Date()) {
  if (b.status !== 'confirmed') return { ok: false as const, error: 'Only confirmed bookings can be cancelled' }
  if (toDay(b.startDate) <= lagosToday(now)) return { ok: false as const, error: 'Your stay has started. Please contact the concierge.' }
  const share = refundShare(b.cancellationPolicy, toDay(b.startDate), b.createdAt, now)
  const stay = money(Number(b.base) * share)
  const refund = money(stay + Number(b.cleaningFee) + Number(b.cautionDeposit))
  return { ok: true as const, share, stay, cleaning: Number(b.cleaningFee), deposit: Number(b.cautionDeposit), refund, kept: money(Number(b.amountDue) - refund) }
}

async function staffAndOwner(ownerId: string | null) {
  return prisma.user.findMany({
    where: { OR: [{ role: 'admin' }, { role: 'team', permissions: { has: 'bookings' } }, ...(ownerId ? [{ id: ownerId }] : [])] },
    select: { id: true, email: true, name: true },
  })
}
const firstName = (n: string) => n.split(' ')[0] || 'there'

async function emailCancelled(bookingId: string, refund: number, by: string) {
  const b = await loadForEmail(bookingId)
  await send(b.guestEmail, b.userId, 'booking_cancelled', `Cancelled: ${b.listing.title} (${b.reference})`, {
    preheader: refund > 0 ? `${naira(refund)} will be refunded to you.` : 'Your booking has been cancelled.',
    eyebrow: 'Booking cancelled',
    greeting: `Your booking is cancelled, ${firstName(b.guestName)}`,
    intro:
      by === 'guest'
        ? `As requested, we've cancelled your booking. ${refund > 0 ? `${naira(refund)} will be refunded to the card or account you paid with, usually within 5 to 10 working days.` : 'Under the cancellation policy, no refund is due.'}`
        : `We're sorry: this booking has had to be cancelled. You'll receive a full refund of ${naira(refund)} to the card or account you paid with, usually within 5 to 10 working days. Our concierge will help you find an alternative.`,
    blocks: [...summary(b), { type: 'cta', label: 'View your booking', url: `${getAppUrl()}/bookings/${b.reference}` }],
    reason: 'You receive this because you made a booking on Lux Catalog.',
  })
  for (const u of await staffAndOwner(b.listing.ownerId)) {
    await send(u.email, u.id, 'booking_cancelled_staff', `Cancelled: ${b.listing.title} (${b.reference})`, {
      preheader: `Cancelled by the ${by}. Dates reopened.`,
      eyebrow: 'Booking cancelled',
      greeting: `Booking cancelled, ${firstName(u.name)}`,
      intro: `${b.guestName}'s booking was cancelled by the ${by}${b.cancelReason ? ` (${b.cancelReason})` : ''}. The dates are open again.${refund > 0 ? ` A refund of ${naira(refund)} is waiting for approval.` : ''}`,
      blocks: [...summary(b), { type: 'cta', label: 'Open bookings', url: `${getAppUrl()}/admin/bookings` }],
      reason: 'You receive this because a booking on Lux Catalog changed.',
    })
  }
}

// Guest cancels their own booking.
export async function cancelByGuest(bookingId: string, userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: bookingId } })
    if (!b || b.userId !== userId) throw new RefundError('Booking not found', 404)
    const q = guestCancellationQuote(b)
    if (!q.ok) throw new RefundError(q.error)
    await tx.booking.update({ where: { id: b.id }, data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'guest', cautionStatus: 'included', holdExpiresAt: null } })
    if (q.refund > 0) {
      await tx.refund.create({
        data: {
          bookingId: b.id,
          kind: 'cancellation',
          amount: q.refund,
          reason: `Guest cancelled. ${POLICY_TEXT[b.cancellationPolicy].label} policy: ${Math.round(q.share * 100)}% of the stay, plus cleaning and caution deposit.`,
          requestedById: userId,
        },
      })
    }
    return { refund: q.refund, keptStay: money(Number(b.base) - q.stay) }
  })
  await adjustPayoutForCancellation(bookingId, result.keptStay).catch((e) => console.error('Payout adjust failed:', e))
  await emailCancelled(bookingId, result.refund, 'guest').catch((e) => console.error('Cancel emails failed:', e))
  return result.refund
}

// Partner or Lux Catalog cancels: the guest gets everything back.
export async function cancelByStaff(bookingId: string, actor: { userId: string; role: 'partner' | 'team' | 'admin' }, reason: string) {
  const refund = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { ownerId: true } } } })
    if (!b) throw new RefundError('Booking not found', 404)
    if (actor.role === 'partner' && b.listing.ownerId !== actor.userId) throw new RefundError('Booking not found', 404)
    if (b.status !== 'confirmed') throw new RefundError('Only confirmed bookings can be cancelled')
    if (toDay(b.endDate) <= lagosToday()) throw new RefundError('This stay has already ended')
    await tx.booking.update({
      where: { id: b.id },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: actor.role === 'partner' ? 'partner' : 'Lux Catalog team', cancelReason: reason.slice(0, 300), cautionStatus: 'included' },
    })
    const amount = Number(b.amountDue)
    await tx.refund.create({ data: { bookingId: b.id, kind: 'cancellation', amount, reason: `Cancelled by the ${actor.role === 'partner' ? 'partner' : 'team'}: ${reason}`.slice(0, 400), requestedById: actor.userId } })
    return amount
  })
  await adjustPayoutForCancellation(bookingId, 0).catch((e) => console.error('Payout adjust failed:', e))
  await emailCancelled(bookingId, refund, actor.role === 'partner' ? 'partner' : 'Lux Catalog team').catch((e) => console.error('Cancel emails failed:', e))
  return refund
}

// Partner reports damage within 48 hours of check-out.
export async function fileClaim(bookingId: string, partnerId: string, amount: number, note: string, now = new Date()) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { ownerId: true, title: true } } } })
  if (!b || b.listing.ownerId !== partnerId) throw new RefundError('Booking not found', 404)
  if (!['confirmed', 'completed'].includes(b.status) || Number(b.cautionDeposit) <= 0) throw new RefundError('There is no caution deposit on this booking')
  if (b.cautionStatus !== 'held') throw new RefundError('The caution deposit has already been dealt with')
  const checkout = toDate(toDay(b.endDate))
  if (now < checkout) throw new RefundError('You can report damage from the check-out day')
  if (now.getTime() > checkout.getTime() + (CLAIM_WINDOW_HOURS + 24) * 3_600_000) throw new RefundError('The 48-hour window for damage claims has passed')
  if (!(amount > 0) || amount > Number(b.cautionDeposit)) throw new RefundError(`The claim must be between ₦1 and the deposit (${naira(Number(b.cautionDeposit))})`, 400)
  if (note.trim().length < 10) throw new RefundError('Describe the damage (at least a sentence)', 400)
  await prisma.booking.update({ where: { id: b.id }, data: { cautionStatus: 'claimed', claimAmount: amount, claimNote: note.trim().slice(0, 1000), claimAt: now } })
  const admins = await prisma.user.findMany({ where: { OR: [{ role: 'admin' }, { role: 'team', permissions: { has: 'bookings' } }] }, select: { id: true, email: true, name: true } })
  const full = await loadForEmail(b.id)
  for (const u of admins) {
    await send(u.email, u.id, 'caution_claim', `Damage claim: ${b.listing.title} (${b.reference})`, {
      preheader: `${naira(amount)} claimed from the caution deposit.`,
      eyebrow: 'Damage claim',
      greeting: `A claim needs a decision, ${firstName(u.name)}`,
      intro: `The partner has claimed ${naira(amount)} of the ${naira(Number(b.cautionDeposit))} caution deposit: "${note.trim().slice(0, 300)}"`,
      blocks: [...summary(full), { type: 'cta', label: 'Decide the claim', url: `${getAppUrl()}/admin/bookings?view=attention` }],
      reason: 'You receive this because you handle bookings on Lux Catalog.',
    })
  }
}

// Admin decides a claim: keep some (0..claimed) of the deposit, refund the rest.
export async function decideClaim(bookingId: string, actorId: string, keep: number) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!b || b.cautionStatus !== 'claimed') throw new RefundError('There is no open claim on this booking')
  const deposit = Number(b.cautionDeposit)
  const kept = Math.min(Math.max(money(keep), 0), Number(b.claimAmount ?? 0))
  const back = money(deposit - kept)
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: b.id }, data: { cautionStatus: back > 0 ? 'refund_queued' : 'kept' } })
    if (back > 0) {
      await tx.refund.create({ data: { bookingId: b.id, kind: 'caution', amount: back, reason: `Caution deposit after a damage claim: ${naira(kept)} kept for damage.`, requestedById: actorId } })
    }
  })
  await addDamageCompensation(b.id, kept).catch((e) => console.error('Damage compensation failed:', e))
  return { kept, back }
}

// Daily: end finished stays, and queue caution refunds once the claim window
// has passed without a claim.
export async function runDailyBookingJobs(now = new Date()) {
  const today = toDate(lagosToday(now))
  const completed = await prisma.booking.updateMany({ where: { status: 'confirmed', endDate: { lte: today } }, data: { status: 'completed' } })
  const cutoff = new Date(today.getTime() - CLAIM_WINDOW_HOURS * 3_600_000)
  const due = await prisma.booking.findMany({
    where: { status: { in: ['confirmed', 'completed'] }, cautionStatus: 'held', cautionDeposit: { gt: 0 }, endDate: { lte: cutoff } },
    select: { id: true, cautionDeposit: true },
  })
  for (const b of due) {
    await prisma.$transaction([
      prisma.booking.update({ where: { id: b.id }, data: { cautionStatus: 'refund_queued' } }),
      prisma.refund.create({ data: { bookingId: b.id, kind: 'caution', amount: b.cautionDeposit, reason: 'Caution deposit: no damage reported within 48 hours of check-out.' } }),
    ])
  }
  const payoutsDue = await markDuePayouts(now)
  return { completed: completed.count, cautionQueued: due.length, payoutsDue }
}

// One click from a person: send an approved refund to Paystack.
export async function approveRefund(refundId: string, actorId: string) {
  const r = await prisma.refund.findUnique({ where: { id: refundId }, include: { booking: { select: { reference: true, paidAt: true } } } })
  if (!r) throw new RefundError('Refund not found', 404)
  if (r.status !== 'pending_approval') throw new RefundError('This refund has already been decided')
  if (!r.booking.paidAt) throw new RefundError('No payment was taken for this booking')
  // Claim the row first so a double click can't send it twice.
  const claimed = await prisma.refund.updateMany({ where: { id: r.id, status: 'pending_approval' }, data: { status: 'processing', decidedById: actorId, decidedAt: new Date() } })
  if (!claimed.count) throw new RefundError('This refund has already been decided')
  try {
    const res = await createRefund({ reference: r.booking.reference, amountKobo: toKobo(Number(r.amount)), note: r.reason })
    await prisma.refund.update({
      where: { id: r.id },
      data: { paystackRefund: res.id ? String(res.id) : null, ...(res.status === 'processed' ? { status: 'completed', completedAt: new Date() } : {}) },
    })
  } catch (err) {
    await prisma.refund.update({ where: { id: r.id }, data: { status: 'failed', failureReason: String((err as Error).message).slice(0, 300) } })
    throw new RefundError(`Paystack refused the refund: ${(err as Error).message}`, 502)
  }
}

export async function rejectRefund(refundId: string, actorId: string, reason: string) {
  const res = await prisma.refund.updateMany({
    where: { id: refundId, status: { in: ['pending_approval', 'failed'] } },
    data: { status: 'rejected', decidedById: actorId, decidedAt: new Date(), failureReason: reason.slice(0, 300) },
  })
  if (!res.count) throw new RefundError('This refund has already been decided')
}

// Paystack refund webhooks (refund.processed / refund.failed).
export async function applyRefundEvent(event: string, data: { id?: number; transaction_reference?: string; transaction?: { reference?: string }; amount?: number }) {
  const ref = data.transaction_reference ?? data.transaction?.reference
  const where = data.id
    ? { paystackRefund: String(data.id) }
    : ref
      ? { status: 'processing' as const, booking: { reference: ref }, ...(data.amount ? { amount: data.amount / 100 } : {}) }
      : null
  if (!where) return
  if (event === 'refund.processed') await prisma.refund.updateMany({ where, data: { status: 'completed', completedAt: new Date() } })
  if (event === 'refund.failed') await prisma.refund.updateMany({ where, data: { status: 'failed', failureReason: 'Paystack reported the refund failed' } })
}
