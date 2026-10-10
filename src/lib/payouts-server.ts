import { prisma } from '@/lib/prisma'
import { DEFAULT_COMMISSION } from '@/lib/taxonomy'
import { createRecipient, initiateTransfer, resolveAccount, toKobo } from '@/lib/paystack'

// Partner payouts. A payout is created when a booking is confirmed, becomes
// due at the payout time in the partner's agreement, and is only sent (by
// Paystack Transfer) after a person approves it.

const money = (n: number) => Math.round(n * 100) / 100
const HOUR = 3_600_000

export class PayoutError extends Error {
  constructor(message: string, public status = 409) {
    super(message)
  }
}

// The partner's commission for a listing: a rate set for them personally
// wins, then the platform default for the collection, then the code default.
export async function commissionFor(listing: { ownerId: string | null; subcategory: string | null; mode: string }) {
  const matches = (r: { subcategory: string | null; mode: string | null }) =>
    listing.subcategory && listing.subcategory !== 'for_sale' ? r.subcategory === listing.subcategory : r.mode === 'sale' && !r.subcategory
  const rules = await prisma.commissionRule.findMany({
    where: { active: true, OR: [{ partnerId: listing.ownerId ?? '__none__' }, { partnerId: null }] },
    orderBy: { updatedAt: 'desc' },
  })
  const rule =
    rules.find((r) => r.partnerId && matches(r)) ??
    rules.find((r) => !r.partnerId && matches(r)) ??
    DEFAULT_COMMISSION.find((r) => matches({ subcategory: r.subcategory ?? null, mode: r.mode ?? null }))
  return { rate: rule ? Number(rule.ratePercent) : 15, timing: rule?.payoutTiming ?? 'after_checkin' }
}

// When the money becomes due: about a day after check-in (stays, hire), or
// after the end (close protection and other "after completion" services).
function dueFor(timing: string, start: Date, end: Date) {
  return timing === 'after_completion' || timing === 'on_completion_of_sale' ? new Date(end.getTime() + 12 * HOUR) : new Date(start.getTime() + 36 * HOUR)
}

function split(gross: number, rate: number) {
  const commission = money((gross * rate) / 100)
  return { gross: money(gross), commission, amount: money(gross - commission) }
}

// Called when a booking is confirmed. House listings (no partner) have none.
export async function schedulePayout(bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { listing: { select: { ownerId: true, subcategory: true, mode: true } }, payout: true } })
  if (!b || b.payout || !b.listing.ownerId) return null
  const { rate, timing } = await commissionFor(b.listing)
  const s = split(Number(b.total), rate)
  return prisma.payout.create({
    data: {
      bookingId: b.id,
      partnerId: b.listing.ownerId,
      ...s,
      commissionRate: rate,
      dueAt: dueFor(timing, b.startDate, b.endDate),
      reference: `payout-${b.reference.toLowerCase()}`,
    },
  })
}

// After a cancellation: the partner keeps their share of whatever the guest
// didn't get back (the stay portion only); otherwise the payout is cancelled.
export async function adjustPayoutForCancellation(bookingId: string, keptStay: number) {
  const p = await prisma.payout.findUnique({ where: { bookingId } })
  if (!p || !['scheduled', 'pending_approval', 'failed'].includes(p.status)) return
  if (keptStay > 0) {
    const s = split(keptStay, Number(p.commissionRate))
    await prisma.payout.update({ where: { id: p.id }, data: { ...s, note: 'Reduced after the guest cancelled (share of the non-refundable stay).' } })
  } else {
    await prisma.payout.update({ where: { id: p.id }, data: { status: 'cancelled', note: 'Booking cancelled; nothing due.' } })
  }
}

// Damage the team decided the partner may keep from the caution deposit.
// Added to the payout if it hasn't gone yet (not commissionable).
export async function addDamageCompensation(bookingId: string, kept: number) {
  if (kept <= 0) return
  const p = await prisma.payout.findUnique({ where: { bookingId } })
  if (p && ['scheduled', 'pending_approval', 'failed'].includes(p.status)) {
    await prisma.payout.update({ where: { id: p.id }, data: { amount: money(Number(p.amount) + kept), note: `Includes ₦${kept.toLocaleString('en-NG')} damage compensation from the caution deposit.` } })
  } else if (p) {
    await prisma.booking.update({ where: { id: bookingId }, data: { note: `Pay the partner ₦${kept.toLocaleString('en-NG')} damage compensation separately (payout already sent).` } })
  }
}

// Daily: payouts whose time has come move to the approval queue.
export async function markDuePayouts(now = new Date()) {
  const res = await prisma.payout.updateMany({
    where: { status: 'scheduled', dueAt: { lte: now }, booking: { status: { in: ['confirmed', 'completed'] } } },
    data: { status: 'pending_approval' },
  })
  return res.count
}

// One click from a person: send the transfer.
export async function approvePayout(payoutId: string, actorId: string) {
  const p = await prisma.payout.findUnique({ where: { id: payoutId } })
  if (!p) throw new PayoutError('Payout not found', 404)
  if (!['pending_approval', 'failed'].includes(p.status)) throw new PayoutError('This payout is not waiting for approval')
  const account = await prisma.payoutAccount.findUnique({ where: { userId: p.partnerId } })
  if (!account) throw new PayoutError('The partner hasn’t added their bank details yet')
  const claimed = await prisma.payout.updateMany({ where: { id: p.id, status: { in: ['pending_approval', 'failed'] } }, data: { status: 'processing', decidedById: actorId, decidedAt: new Date(), failureReason: null } })
  if (!claimed.count) throw new PayoutError('This payout is already being processed')
  try {
    const t = await initiateTransfer({ amountKobo: toKobo(Number(p.amount)), recipient: account.recipientCode, reference: p.reference, reason: `Lux Catalog payout ${p.reference}` })
    if (t.status === 'otp') {
      await prisma.payout.update({ where: { id: p.id }, data: { status: 'failed', transferCode: t.transfer_code, failureReason: 'Paystack asked for an OTP. Turn off OTP for transfers in Paystack (Settings > Preferences).' } })
      throw new PayoutError('Paystack is asking for an OTP. Turn off OTP for transfers in your Paystack settings, then retry.', 502)
    }
    await prisma.payout.update({
      where: { id: p.id },
      data: { transferCode: t.transfer_code, ...(t.status === 'success' ? { status: 'paid', paidAt: new Date() } : {}) },
    })
  } catch (err) {
    if (err instanceof PayoutError) throw err
    await prisma.payout.update({ where: { id: p.id }, data: { status: 'failed', failureReason: String((err as Error).message).slice(0, 300) } })
    throw new PayoutError(`Paystack refused the transfer: ${(err as Error).message}`, 502)
  }
}

// Paid outside Paystack (e.g. a bank transfer from the business account),
// recorded with its reference so the books stay complete.
export async function markPaidManually(payoutId: string, actorId: string, reference: string) {
  const res = await prisma.payout.updateMany({
    where: { id: payoutId, status: { in: ['pending_approval', 'failed'] } },
    data: { status: 'paid', paidAt: new Date(), decidedById: actorId, decidedAt: new Date(), failureReason: null, note: `Paid manually: ${reference}`.slice(0, 300) },
  })
  if (!res.count) throw new PayoutError('Only due or failed payouts can be marked as paid')
}

export async function cancelPayout(payoutId: string, actorId: string, reason: string) {
  const res = await prisma.payout.updateMany({
    where: { id: payoutId, status: { in: ['scheduled', 'pending_approval', 'failed'] } },
    data: { status: 'cancelled', decidedById: actorId, decidedAt: new Date(), note: reason.slice(0, 300) },
  })
  if (!res.count) throw new PayoutError('This payout can’t be cancelled now')
}

// Paystack transfer webhooks.
export async function applyTransferEvent(event: string, data: { reference?: string; transfer_code?: string; reason?: string }) {
  if (!data.reference?.startsWith('payout-')) return
  if (event === 'transfer.success') {
    await prisma.payout.updateMany({ where: { reference: data.reference, status: { not: 'paid' } }, data: { status: 'paid', paidAt: new Date(), transferCode: data.transfer_code ?? undefined } })
  } else if (event === 'transfer.failed' || event === 'transfer.reversed') {
    await prisma.payout.updateMany({ where: { reference: data.reference }, data: { status: 'failed', failureReason: event === 'transfer.reversed' ? 'The transfer was reversed by the bank' : (data.reason ?? 'The transfer failed') } })
  }
}

// Partner bank details: the name always comes from the bank, never the form.
export async function savePayoutAccount(userId: string, bankCode: string, bankName: string, accountNumber: string) {
  if (!/^\d{10}$/.test(accountNumber)) throw new PayoutError('Enter the 10-digit account number', 400)
  let resolved
  try {
    resolved = await resolveAccount(accountNumber, bankCode)
  } catch {
    throw new PayoutError('That account number doesn’t match the bank. Please check both.', 400)
  }
  let recipient
  try {
    recipient = await createRecipient({ name: resolved.account_name, accountNumber, bankCode })
  } catch {
    throw new PayoutError('Paystack couldn’t set up transfers to this account. Please check the bank and account number, or try another account.', 400)
  }
  return prisma.payoutAccount.upsert({
    where: { userId },
    create: { userId, bankCode, bankName, accountNumber, accountName: resolved.account_name, recipientCode: recipient.recipient_code },
    update: { bankCode, bankName, accountNumber, accountName: resolved.account_name, recipientCode: recipient.recipient_code },
  })
}

export const maskAccount = (n: string) => `••••${n.slice(-4)}`
