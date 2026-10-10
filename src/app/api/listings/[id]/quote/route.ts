import { NextResponse } from 'next/server'
import { isDay, quote, selectionToRange } from '@/lib/booking'
import { blockedRanges, bookableListing } from '@/lib/booking-server'

// Public: the authoritative price for the dates a guest picked.
// ?start=YYYY-MM-DD&end=YYYY-MM-DD (end = check-out for stays, last day for hire)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await bookableListing(id)
  if (!found) return NextResponse.json({ ok: false, error: 'This listing is not taking online bookings' }, { status: 404 })

  const url = new URL(req.url)
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')
  if (!isDay(start) || !isDay(end)) return NextResponse.json({ ok: false, error: 'Choose your dates' }, { status: 400 })
  const guests = Number(url.searchParams.get('guests')) || undefined

  const range = selectionToRange(found.rules.unit, start, end)
  const result = quote(found.rules, range, await blockedRanges(id, range.start, range.end), { guests })
  return NextResponse.json(result, { status: result.ok ? 200 : 409, headers: { 'Cache-Control': 'no-store' } })
}
