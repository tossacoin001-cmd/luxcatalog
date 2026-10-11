import { NextResponse } from 'next/server'
import { audit } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { revalidateCatalog } from '@/lib/revalidate'
import { DAY_SUBCATEGORIES, manageableListing } from '@/lib/booking-admin'
import { partnerMustSign } from '@/lib/agreements-server'

const POLICIES = ['flexible', 'moderate', 'strict'] as const
type PolicyKey = (typeof POLICIES)[number]
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await manageableListing(id)
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
  const { listing } = found
  const s = listing.bookingSettings
  const dayUnit = DAY_SUBCATEGORIES.includes(listing.subcategory ?? '')
  return NextResponse.json({
    settings: s
      ? { ...s, rate: Number(s.rate), cleaningFee: Number(s.cleaningFee), cautionDeposit: Number(s.cautionDeposit) }
      : {
          // A sensible starting point, prefilled from the listing.
          enabled: false,
          unit: dayUnit ? 'day' : 'night',
          rate: Number((dayUnit ? listing.hireRatePerDay : null) ?? listing.price ?? 0),
          cleaningFee: 0,
          cautionDeposit: 0,
          minUnits: 1,
          maxUnits: 30,
          maxGuests: null,
          instantBook: true,
          cancellationPolicy: 'moderate',
          checkInTime: dayUnit ? '09:00' : '14:00',
          checkOutTime: dayUnit ? '19:00' : '11:00',
          hoursPerDay: dayUnit ? 10 : null,
          advanceNoticeHours: 24,
          requireGuestId: !dayUnit,
        },
  })
}

const int = (v: unknown, min: number, max: number) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}
const amount = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? Math.round(n * 100) / 100 : null
}
const optionalInt = (v: unknown, min: number, max: number) => (v === null || v === '' || v === undefined ? null : int(v, min, max))

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await manageableListing(id)
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
  const b = await req.json().catch(() => ({}))

  const rate = amount(b.rate)
  const cleaningFee = amount(b.cleaningFee ?? 0)
  const cautionDeposit = amount(b.cautionDeposit ?? 0)
  const minUnits = int(b.minUnits, 1, 365)
  const maxUnits = int(b.maxUnits, 1, 365)
  const advanceNoticeHours = int(b.advanceNoticeHours ?? 24, 0, 24 * 30)
  const policy = POLICIES.includes(b.cancellationPolicy) ? (b.cancellationPolicy as PolicyKey) : null
  const checkInTime = TIME.test(String(b.checkInTime)) ? String(b.checkInTime) : null
  const checkOutTime = TIME.test(String(b.checkOutTime)) ? String(b.checkOutTime) : null
  const maxGuests = optionalInt(b.maxGuests, 1, 500)
  const hoursPerDay = optionalInt(b.hoursPerDay, 1, 24)

  const missing = Object.entries({ rate, cleaningFee, cautionDeposit, minUnits, maxUnits, advanceNoticeHours, policy, checkInTime, checkOutTime })
    .filter(([, v]) => v === null)
    .map(([k]) => k)
  if (missing.length || rate === null || cleaningFee === null || cautionDeposit === null || minUnits === null || maxUnits === null || advanceNoticeHours === null || !policy || !checkInTime || !checkOutTime) {
    return NextResponse.json({ error: `Check these fields: ${missing.join(', ')}` }, { status: 400 })
  }
  if (minUnits > maxUnits) return NextResponse.json({ error: 'The minimum can’t be more than the maximum' }, { status: 400 })
  const enabled = b.enabled === true
  // Bookings run under the partner agreement: it must be signed first.
  if (enabled && found.staff.role === 'partner' && (await partnerMustSign(found.staff.userId))) {
    return NextResponse.json({ error: 'Sign your partner agreement before taking bookings', signUrl: '/partners/agreement' }, { status: 403 })
  }
  if (enabled && !(rate > 0)) return NextResponse.json({ error: 'Set a price before turning on online booking' }, { status: 400 })

  const data = {
    enabled,
    unit: b.unit === 'day' ? 'day' : 'night',
    rate,
    cleaningFee,
    cautionDeposit,
    minUnits,
    maxUnits,
    maxGuests,
    instantBook: b.instantBook !== false,
    cancellationPolicy: policy,
    checkInTime,
    checkOutTime,
    hoursPerDay,
    advanceNoticeHours,
    requireGuestId: b.requireGuestId !== false,
  }
  const settings = await prisma.bookingSettings.upsert({ where: { listingId: id }, create: { listingId: id, ...data }, update: data })
  await audit(found.staff.userId, 'listing.booking_settings', id, { enabled: settings.enabled, rate: Number(settings.rate), unit: settings.unit })
  revalidateCatalog()
  return NextResponse.json({ success: true })
}
