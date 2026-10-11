import { NextResponse } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { isDay } from '@/lib/booking'
import { BookingError, createBookingHold, emailRequested, startPayment } from '@/lib/bookings-server'
import { paystackConfigured } from '@/lib/paystack'
import { createSessionHold } from '@/lib/sessions-server'

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
  const sess = body.session && typeof body.session === 'object' ? body.session : null
  if (typeof listingId !== 'string') return NextResponse.json({ error: 'Choose your dates' }, { status: 400 })
  if (sess) {
    // Private Services: one session at an exact time and place.
    if (typeof sess.packageId !== 'string') return NextResponse.json({ error: 'Choose a package' }, { status: 400 })
    if (!isDay(sess.date) || typeof sess.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(sess.time)) return NextResponse.json({ error: 'Choose a day and a time' }, { status: 400 })
    if (typeof sess.area !== 'string' || !sess.area) return NextResponse.json({ error: 'Choose your area' }, { status: 400 })
    if (typeof sess.address !== 'string' || sess.address.trim().length < 10) return NextResponse.json({ error: 'Add the full address (street, building, flat) so the professional can find you' }, { status: 400 })
  } else if (!isDay(start) || !isDay(end)) return NextResponse.json({ error: 'Choose your dates' }, { status: 400 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, phone: true } })
  if (!user) return NextResponse.json({ error: 'Sign in to book' }, { status: 401 })

  let booking
  try {
    booking = sess
      ? await createSessionHold({
          listingId,
          userId: session.user.id,
          guestName: user.name,
          guestEmail: user.email,
          guestPhone: user.phone,
          packageId: sess.packageId,
          date: sess.date,
          time: sess.time,
          guests: Number(sess.guests),
          area: sess.area,
          address: sess.address.trim().slice(0, 300),
          notes: typeof sess.notes === 'string' ? sess.notes.trim().slice(0, 500) : '',
        })
      : await createBookingHold({
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
