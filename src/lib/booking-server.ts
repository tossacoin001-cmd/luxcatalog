import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toDate, toDay, type BookingRules, type Range } from '@/lib/booking'

type SettingsRow = NonNullable<Awaited<ReturnType<typeof prisma.bookingSettings.findUnique>>>

export function rulesFrom(s: SettingsRow): BookingRules {
  return {
    unit: s.unit === 'day' ? 'day' : 'night',
    rate: Number(s.rate),
    cleaningFee: Number(s.cleaningFee),
    cautionDeposit: Number(s.cautionDeposit),
    minUnits: s.minUnits,
    maxUnits: s.maxUnits,
    maxGuests: s.maxGuests,
    instantBook: s.instantBook,
    cancellationPolicy: s.cancellationPolicy,
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime,
    hoursPerDay: s.hoursPerDay,
    advanceNoticeHours: s.advanceNoticeHours,
  }
}

// A published listing that takes online bookings, with its rules; else null.
export async function bookableListing(listingId: string) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, published: true },
    select: { id: true, title: true, ownerId: true, bookingSettings: true },
  })
  if (!listing?.bookingSettings?.enabled) return null
  return { listing, rules: rulesFrom(listing.bookingSettings) }
}

type Db = Prisma.TransactionClient | typeof prisma

// A booking blocks its dates while confirmed, or while its hold (payment,
// or a request waiting for the partner) is still running. Expired holds free the dates without any clean-up job.
export const activeBookingWhere = (now = new Date()): Prisma.BookingWhereInput => ({
  OR: [{ status: 'confirmed' }, { status: { in: ['pending_payment', 'requested'] }, holdExpiresAt: { gt: now } }],
})

export async function bookedRanges(db: Db, listingId: string, from: string, to: string, exceptId?: string): Promise<Range[]> {
  const rows = await db.booking.findMany({
    where: { listingId, startDate: { lt: toDate(to) }, endDate: { gt: toDate(from) }, ...activeBookingWhere(), ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { startDate: true, endDate: true },
  })
  return rows.map((r) => ({ start: toDay(r.startDate), end: toDay(r.endDate) }))
}

export async function closedRanges(db: Db, listingId: string, from: string, to: string): Promise<Range[]> {
  const rows = await db.unavailableDate.findMany({
    where: { listingId, startDate: { lt: toDate(to) }, endDate: { gt: toDate(from) } },
    select: { startDate: true, endDate: true },
  })
  return rows.map((r) => ({ start: toDay(r.startDate), end: toDay(r.endDate) }))
}

// Every date that can't be booked in [from, to): closed by the partner or
// taken by a booking. Guests never learn which.
export async function blockedRanges(listingId: string, from: string, to: string): Promise<Range[]> {
  const all = [...(await closedRanges(prisma, listingId, from, to)), ...(await bookedRanges(prisma, listingId, from, to))]
  return all.sort((a, b) => a.start.localeCompare(b.start))
}
