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

// Dates that can't be booked in [from, to). Bookings join this in Phase 4b.
export async function blockedRanges(listingId: string, from: string, to: string): Promise<Range[]> {
  const rows = await prisma.unavailableDate.findMany({
    where: { listingId, startDate: { lt: toDate(to) }, endDate: { gt: toDate(from) } },
    select: { startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
  })
  return rows.map((r) => ({ start: toDay(r.startDate), end: toDay(r.endDate) }))
}
