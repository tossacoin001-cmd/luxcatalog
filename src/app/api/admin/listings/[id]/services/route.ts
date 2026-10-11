import { NextResponse } from 'next/server'
import { audit } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { revalidateCatalog } from '@/lib/revalidate'
import { manageableListing } from '@/lib/booking-admin'
import { partnerMustSign } from '@/lib/agreements-server'
import { serviceFloors } from '@/lib/services-server'
import { areasFrom, hoursFrom, packageFrom } from '@/lib/sessions-server'
import { LAGOS_AREAS, WEEKDAYS, validateHours, validatePackage, type WorkingHours } from '@/lib/sessions'

// Private Services: how a listing is booked by the session (packages,
// weekly hours, areas with travel fees, buffer, team size, policy).

const POLICIES = ['flexible', 'moderate', 'strict'] as const
const int = (v: unknown, min: number, max: number) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

async function load(id: string) {
  const found = await manageableListing(id)
  if ('error' in found) return { error: NextResponse.json({ error: found.error }, { status: found.status }) }
  if (found.listing.category !== 'private_services') return { error: NextResponse.json({ error: 'Only Private Services are booked by the session' }, { status: 400 }) }
  return found
}

async function view(listingId: string) {
  const [s, pkgs] = await Promise.all([
    prisma.bookingSettings.findUnique({ where: { listingId } }),
    prisma.servicePackage.findMany({ where: { listingId, active: true }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
  ])
  const session = s?.unit === 'session' ? s : null
  return {
    enabled: !!session?.enabled,
    instantBook: session?.instantBook ?? true,
    cancellationPolicy: session?.cancellationPolicy ?? 'moderate',
    advanceNoticeHours: session?.advanceNoticeHours ?? 24,
    bufferMinutes: session?.bufferMinutes ?? 60,
    capacity: session?.capacity ?? 1,
    workingHours: session ? hoursFrom(session.workingHours) : Object.fromEntries(WEEKDAYS.map((d) => [d, d === 'sun' ? null : { from: '10:00', to: '20:00' }])),
    areas: session ? areasFrom(session.areas) : [],
    packages: pkgs.map(packageFrom),
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await load(id)
  if ('error' in found) return found.error
  const floor = (await serviceFloors()).find((f) => f.key === found.listing.subcategory)?.minPrice ?? null
  return NextResponse.json({ settings: await view(id), areasAll: LAGOS_AREAS, floor })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await load(id)
  if ('error' in found) return found.error
  const { staff, listing } = found
  if (staff.role === 'partner' && (await partnerMustSign(staff.userId))) {
    return NextResponse.json({ error: 'Sign your partner agreement first', signUrl: '/partners/agreement' }, { status: 403 })
  }
  const b = await req.json().catch(() => ({}))
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 })

  const enabled = b.enabled === true
  const instantBook = b.instantBook !== false
  const cancellationPolicy = POLICIES.includes(b.cancellationPolicy) ? (b.cancellationPolicy as (typeof POLICIES)[number]) : null
  const advanceNoticeHours = int(b.advanceNoticeHours, 0, 720)
  const bufferMinutes = int(b.bufferMinutes, 0, 240)
  const capacity = int(b.capacity, 1, 20)
  if (!cancellationPolicy) return bad('Choose a cancellation policy')
  if (advanceNoticeHours === null) return bad('Choose how much notice you need')
  if (bufferMinutes === null) return bad('Choose a travel time between sessions (up to 4 hours)')
  if (capacity === null) return bad('Sessions at the same time must be between 1 and 20')

  // Hours: only days with both times count as working days.
  const workingHours: WorkingHours = {}
  for (const d of WEEKDAYS) {
    const v = b.workingHours?.[d]
    workingHours[d] = v && typeof v.from === 'string' && typeof v.to === 'string' ? { from: v.from, to: v.to } : null
  }
  const hoursError = validateHours(workingHours)
  if (hoursError && (enabled || WEEKDAYS.some((d) => workingHours[d]))) return bad(hoursError)

  if (!Array.isArray(b.areas)) return bad('Choose the areas you cover')
  const areas: { area: string; fee: number }[] = []
  for (const a of b.areas) {
    if (!a || !LAGOS_AREAS.includes(a.area)) return bad(`Unknown area: ${a?.area ?? ''}`)
    const fee = Number(a.fee ?? 0)
    if (!Number.isFinite(fee) || fee < 0 || fee > 10_000_000) return bad(`${a.area}: the travel fee must be ₦0 or more`)
    if (!areas.some((x) => x.area === a.area)) areas.push({ area: a.area, fee: Math.round(fee) })
  }
  if (enabled && !areas.length) return bad('Choose at least one area you travel to')

  if (!Array.isArray(b.packages) || b.packages.length > 8) return bad('Add up to eight packages')
  const floor = staff.role === 'partner' ? (await serviceFloors()).find((f) => f.key === listing.subcategory)?.minPrice : undefined
  const packages = (b.packages as Record<string, unknown>[]).map((p) => ({
    id: typeof p.id === 'string' ? p.id : null,
    name: String(p.name ?? '').trim().slice(0, 80),
    description: String(p.description ?? '').trim().slice(0, 400),
    durationMinutes: Number(p.durationMinutes),
    pricing: (p.pricing === 'per_guest' || p.pricing === 'fixed' ? p.pricing : String(p.pricing ?? '')) as 'fixed' | 'per_guest',
    price: Math.round(Number(p.price) * 100) / 100,
    minGuests: p.minGuests == null || p.minGuests === '' ? 1 : Number(p.minGuests),
    maxGuests: p.maxGuests == null || p.maxGuests === '' ? null : Number(p.maxGuests),
  }))
  for (const p of packages) {
    const err = validatePackage({ ...p, id: p.id ?? undefined }, floor)
    if (err) return bad(err)
  }
  if (enabled && !packages.length) return bad('Add at least one package before switching online booking on')

  const existing = await prisma.servicePackage.findMany({ where: { listingId: id }, select: { id: true } })
  const own = new Set(existing.map((p) => p.id))
  const cheapest = packages.length ? Math.min(...packages.map((p) => p.price)) : null

  await prisma.$transaction(async (tx) => {
    const data = {
      enabled,
      unit: 'session',
      rate: cheapest ?? 0,
      cleaningFee: 0,
      cautionDeposit: 0,
      minUnits: 1,
      maxUnits: 1,
      instantBook,
      cancellationPolicy,
      advanceNoticeHours,
      bufferMinutes,
      capacity,
      requireGuestId: false,
      workingHours: workingHours as object,
      areas: areas as object,
    }
    await tx.bookingSettings.upsert({ where: { listingId: id }, create: { listingId: id, ...data }, update: data })
    const kept: string[] = []
    for (const [i, p] of packages.entries()) {
      const fields = { name: p.name, description: p.description, durationMinutes: p.durationMinutes, pricing: p.pricing, price: p.price, minGuests: p.minGuests, maxGuests: p.maxGuests, sort: i, active: true }
      if (p.id && own.has(p.id)) {
        await tx.servicePackage.update({ where: { id: p.id }, data: fields })
        kept.push(p.id)
      } else {
        kept.push((await tx.servicePackage.create({ data: { listingId: id, ...fields } })).id)
      }
    }
    // Removed packages stay on record (past bookings name them) but inactive.
    await tx.servicePackage.updateMany({ where: { listingId: id, id: { notIn: kept } }, data: { active: false } })
    // The listing's "From" price follows the cheapest package.
    if (cheapest !== null) {
      await tx.listing.update({ where: { id }, data: { price: cheapest, priceDisplay: `₦${cheapest.toLocaleString('en-NG')}` } })
    }
  })
  await audit(staff.userId, 'listing.session_settings', id, { enabled, packages: packages.length, areas: areas.length })
  revalidateCatalog()
  return NextResponse.json({ settings: await view(id) })
}
