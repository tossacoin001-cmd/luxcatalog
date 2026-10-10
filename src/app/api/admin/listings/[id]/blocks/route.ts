import { NextResponse } from 'next/server'
import { audit } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { addDays, isDay, lagosToday, toDate, toDay } from '@/lib/booking'
import { manageableListing } from '@/lib/booking-admin'

// Dates a partner or the team has closed on a listing.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await manageableListing(id)
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
  const rows = await prisma.unavailableDate.findMany({
    where: { listingId: id, endDate: { gt: toDate(lagosToday()) } },
    orderBy: { startDate: 'asc' },
  })
  return NextResponse.json({ blocks: rows.map((r) => ({ id: r.id, start: toDay(r.startDate), end: toDay(r.endDate), note: r.note, source: r.source })) })
}

// Close days: { first, last, note }, both inclusive.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await manageableListing(id)
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
  const b = await req.json().catch(() => ({}))
  if (!isDay(b.first) || !isDay(b.last) || b.last < b.first) return NextResponse.json({ error: 'Choose the first and last day to close' }, { status: 400 })
  if (b.first < lagosToday()) return NextResponse.json({ error: 'Those dates are in the past' }, { status: 400 })
  const block = await prisma.unavailableDate.create({
    data: {
      listingId: id,
      startDate: toDate(b.first),
      endDate: toDate(addDays(b.last, 1)),
      note: typeof b.note === 'string' ? b.note.trim().slice(0, 140) || null : null,
    },
  })
  await audit(found.staff.userId, 'listing.dates_closed', id, { first: b.first, last: b.last })
  return NextResponse.json({ block: { id: block.id, start: b.first, end: addDays(b.last, 1), note: block.note, source: block.source } })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await manageableListing(id)
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
  const { blockId } = await req.json().catch(() => ({}))
  const res = await prisma.unavailableDate.deleteMany({ where: { id: String(blockId), listingId: id } })
  if (!res.count) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await audit(found.staff.userId, 'listing.dates_reopened', id, { blockId })
  return NextResponse.json({ success: true })
}
