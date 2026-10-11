import { NextResponse } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { isDay } from '@/lib/booking'
import { BookingError, createBookingHold, emailRequested, startPayment } from '@/lib/bookings-server'
import { paystackConfigured } from '@/lib/paystack'

// Start a booking: re-price and hold the dates. Instant booking hands the
// guest to Paystack's secure checkout; on-request listings wait for the
// partner to accept first. The booking is only confirmed once Paystack
// confirms the payment (return page or webhook).
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in to book' }, { status: 401 })
  if (!paystackConfigured()) return NextResponse.json({ error: 'Online payment is not available right now. Please request these dates instead.' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const { listingId, start, end } = body
  if (typeof listingId !== 'string' || !isDay(start) || !isDay(end)) return NextResponse.json({ error: 'Choose your dates' }, { status: 400 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, phone: true } })
  if (!user) return NextResponse.json({ error: 'Sign in to book' }, { status: 401 })

  let booking
  try {
    booking = await createBookingHold({
      listingId,
      userId: session.user.id,
      guestName: user.name,
      guestEmail: user.email,
      guestPhone: user.phone,
      first: start,
      last: end,
      guests: Number(body.guests) || undefined,
    })
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  // On-request listing: no payment yet; the partner has 12 hours to answer.
  if (booking.status === 'requested') {
    await emailRequested(booking.id).catch((e) => console.error('Request emails failed:', e))
    return NextResponse.json({ requested: true, reference: booking.reference })
  }

  try {
    const url = await startPayment(booking.id)
    return NextResponse.json({ url, reference: booking.reference })
  } catch (err) {
    // Couldn't reach Paystack: release the dates straight away.
    console.error('Paystack initialize failed:', err)
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'expired', holdExpiresAt: null, note: 'Payment could not be started' } })
    return NextResponse.json({ error: 'We couldn’t start the payment. Please try again in a moment.' }, { status: 502 })
  }
}
