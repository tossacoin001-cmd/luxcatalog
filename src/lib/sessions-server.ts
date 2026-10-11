import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { addDays } from '@/lib/booking'
import { activeBookingWhere, closedRanges } from '@/lib/booking-server'
import { BookingError, HOLD_MINUTES, REQUEST_HOURS, newReference } from '@/lib/bookings-server'
import { LAGOS_AREAS, WEEKDAYS, daySlots, lagosInstant, sessionQuote, type AreaFee, type Busy, type ServicePackage, type SessionRules, type WorkingHours } from '@/lib/sessions'

type Db = Prisma.TransactionClient | typeof prisma
type SettingsRow = NonNullable<Awaited<ReturnType<typeof prisma.bookingSettings.findUnique>>>
type PackageRow = Awaited<ReturnType<typeof prisma.servicePackage.findMany>>[number]

export function hoursFrom(json: unknown): WorkingHours {
  const out: WorkingHours = {}
  const src = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  for (const d of WEEKDAYS) {
    const v = src[d] as { from?: unknown; to?: unknown } | null | undefined
    out[d] = v && typeof v.from === 'string' && typeof v.to === 'string' ? { from: v.from, to: v.to } : null
  }
  return out
}

export function areasFrom(json: unknown): AreaFee[] {
  return Array.isArray(json)
    ? json.filter((a) => a && typeof a.area === 'string' && LAGOS_AREAS.includes(a.area)).map((a) => ({ area: a.area as string, fee: Math.max(0, Number(a.fee) || 0) }))
    : []
}

export function sessionRulesFrom(s: SettingsRow): SessionRules {
  return {
    workingHours: hoursFrom(s.workingHours),
    bufferMinutes: s.bufferMinutes,
    capacity: s.capacity,
    advanceNoticeHours: s.advanceNoticeHours,
    areas: areasFrom(s.areas),
    instantBook: s.instantBook,
    cancellationPolicy: s.cancellationPolicy,
  }
}

export function packageFrom(p: PackageRow): ServicePackage {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    durationMinutes: p.durationMinutes,
    pricing: p.pricing === 'per_guest' ? 'per_guest' : 'fixed',
    price: Number(p.price),
    minGuests: p.minGuests,
    maxGuests: p.maxGuests,
  }
}

// A published Private Services listing taking session bookings, with its
// rules and active packages; else null.
export async function sessionListing(listingId: string, db: Db = prisma) {
  const listing = await db.listing.findFirst({
    where: { id: listingId, published: true },
    select: { id: true, title: true, ownerId: true, category: true, bookingSettings: true, servicePackages: { where: { active: true }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
  })
  const s = listing?.bookingSettings
  if (!listing || !s?.enabled || s.unit !== 'session') return null
  return { listing, settings: s, rules: sessionRulesFrom(s), packages: listing.servicePackages.map(packageFrom) }
}

// Sessions that occupy the provider between `from` and `to` (exact times):
// confirmed, or held while the guest pays / the partner answers.
export async function busySessions(db: Db, listingId: string, from: Date, to: Date, exceptId?: string): Promise<Busy[]> {
  const rows = await db.booking.findMany({
    where: { listingId, unit: 'session', startDate: { lt: to }, endDate: { gt: from }, ...activeBookingWhere(), ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { startDate: true, endDate: true },
  })
  return rows.map((r) => ({ start: r.startDate, end: r.endDate }))
}

// Free start times per day in [from, to] (inclusive days).
export async function availability(listingId: string, rules: SessionRules, pkg: ServicePackage, from: string, to: string, now = new Date()) {
  const pad = (rules.bufferMinutes + pkg.durationMinutes + 60) * 60_000
  const busy = await busySessions(prisma, listingId, new Date(lagosInstant(from, '00:00').getTime() - pad), new Date(lagosInstant(addDays(to, 1), '00:00').getTime() + pad))
  const closed = await closedRanges(prisma, listingId, from, addDays(to, 1))
  const days: Record<string, string[]> = {}
  for (let d = from; d <= to; d = addDays(d, 1)) days[d] = daySlots(rules, pkg, d, busy, closed, now)
  return days
}

// Can this exact session still be taken by a new booking?
async function slotFree(db: Db, listingId: string, rules: SessionRules, pkg: ServicePackage, day: string, time: string) {
  const start = lagosInstant(day, time)
  const pad = (rules.bufferMinutes + pkg.durationMinutes + 60) * 60_000
  const busy = await busySessions(db, listingId, new Date(start.getTime() - pad), new Date(start.getTime() + pad))
  const closed = await closedRanges(db, listingId, day, addDays(day, 1))
  return daySlots(rules, pkg, day, busy, closed).includes(time)
}

// A payment arrived for a held session: is its time still free of clashes
// (the hold may have lapsed and someone else taken it)? Working hours and
// notice don't matter here, only other sessions and closed days.
export async function sessionStillFree(db: Db, b: { id: string; listingId: string; startDate: Date; endDate: Date }, s: SettingsRow) {
  const buffer = s.bufferMinutes * 60_000
  const busy = await busySessions(db, b.listingId, new Date(b.startDate.getTime() - buffer), new Date(b.endDate.getTime() + buffer), b.id)
  const day = new Date(b.startDate.getTime() + 3_600_000).toISOString().slice(0, 10)
  const closed = await closedRanges(db, b.listingId, day, addDays(day, 1))
  return closed.length === 0 && busy.length < Math.max(1, s.capacity)
}

const lockListing = (tx: Prisma.TransactionClient, listingId: string) =>
  tx.$queryRaw`SELECT "listingId" FROM "BookingSettings" WHERE "listingId" = ${listingId} FOR UPDATE`

// Re-price and hold a session: HOLD_MINUTES while the guest pays (instant),
// or REQUEST_HOURS while the partner decides (on request).
export async function createSessionHold(input: {
  listingId: string
  userId: string
  guestName: string
  guestEmail: string
  guestPhone: string | null
  packageId: string
  date: string
  time: string
  guests: number
  area: string
  address: string
  notes: string
}) {
  return prisma.$transaction(async (tx) => {
    await lockListing(tx, input.listingId)
    const found = await sessionListing(input.listingId, tx)
    if (!found) throw new BookingError('This service is not taking online bookings', 404)
    const { listing, rules, packages } = found
    if (listing.ownerId && listing.ownerId === input.userId) throw new BookingError('You can’t book your own service', 403)
    const pkg = packages.find((p) => p.id === input.packageId)
    if (!pkg) throw new BookingError('Choose a package', 400)
    const q = sessionQuote(rules, pkg, { guests: input.guests, area: input.area })
    if (!q.ok) throw new BookingError(q.error, 409)
    if (!(await slotFree(tx, listing.id, rules, pkg, input.date, input.time))) throw new BookingError('That time is no longer available. Please choose another.', 409)

    const start = lagosInstant(input.date, input.time)
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
        startDate: start,
        endDate: new Date(start.getTime() + pkg.durationMinutes * 60_000),
        unit: 'session',
        units: 1,
        guests: q.guests,
        rate: q.rate,
        base: q.base,
        cleaningFee: 0,
        travelFee: q.travelFee,
        total: q.total,
        cautionDeposit: 0,
        amountDue: q.total,
        cancellationPolicy: rules.cancellationPolicy,
        cautionStatus: 'included',
        packageId: pkg.id,
        packageName: pkg.name,
        area: input.area,
        address: input.address,
        serviceNotes: input.notes || null,
        status: rules.instantBook ? 'pending_payment' : 'requested',
        holdExpiresAt: new Date(Date.now() + (rules.instantBook ? HOLD_MINUTES * 60_000 : REQUEST_HOURS * 3_600_000)),
      },
    })
  })
}
