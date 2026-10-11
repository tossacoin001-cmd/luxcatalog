import { NextResponse } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { isDay, toDate } from '@/lib/booking'

// The signed-in guest's own confirmed stays covering a night (check-out day
// excluded), so a Private Service can be booked "at my Lux Catalog stay".
export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const date = new URL(req.url).searchParams.get('date')
  if (!isDay(date)) return NextResponse.json({ error: 'Choose a day' }, { status: 400 })
  const day = toDate(date)
  const rows = await prisma.booking.findMany({
    where: { userId: session.user.id, unit: 'night', status: 'confirmed', startDate: { lte: day }, endDate: { gt: day } },
    select: { reference: true, listing: { select: { title: true, location: true } } },
    orderBy: { startDate: 'asc' },
    take: 5,
  })
  return NextResponse.json({ stays: rows.map((r) => ({ reference: r.reference, title: r.listing.title, location: r.listing.location })) })
}
