import { NextResponse } from 'next/server'
import { BOOKING_WINDOW_DAYS, addDays, earliestStart, isDay, lagosToday } from '@/lib/booking'
import { blockedRanges, bookableListing } from '@/lib/booking-server'

// Public: a bookable listing's rules and the dates that are taken (no
// reasons, no guest details), for the date picker.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await bookableListing(id)
  if (!found) return NextResponse.json({ error: 'Not bookable' }, { status: 404 })

  const url = new URL(req.url)
  const today = lagosToday()
  const from = isDay(url.searchParams.get('from')) ? url.searchParams.get('from')! : today
  const lastDay = addDays(today, BOOKING_WINDOW_DAYS + 1)
  const toParam = url.searchParams.get('to')
  const to = isDay(toParam) && toParam < lastDay ? toParam : lastDay

  const { rules } = found
  return NextResponse.json(
    {
      rules: {
        unit: rules.unit,
        rate: rules.rate,
        cleaningFee: rules.cleaningFee,
        cautionDeposit: rules.cautionDeposit,
        minUnits: rules.minUnits,
        maxUnits: rules.maxUnits,
        maxGuests: rules.maxGuests,
        instantBook: rules.instantBook,
        cancellationPolicy: rules.cancellationPolicy,
        checkInTime: rules.checkInTime,
        checkOutTime: rules.checkOutTime,
        hoursPerDay: rules.hoursPerDay,
        advanceNoticeHours: rules.advanceNoticeHours,
      },
      earliestStart: earliestStart(rules),
      blocked: await blockedRanges(id, from, to),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
