import { NextResponse } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { BookingError, startPayment } from '@/lib/bookings-server'

// The guest pays (or resumes paying) for a booking awaiting payment: an
// accepted request, or an instant booking they left mid-checkout.
export async function POST(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { reference } = await params
  const b = await prisma.booking.findUnique({ where: { reference }, select: { id: true, userId: true } })
  if (!b || b.userId !== session.user.id) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  try {
    return NextResponse.json({ url: await startPayment(b.id) })
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('Payment start failed:', e)
    return NextResponse.json({ error: 'We couldn’t start the payment. Please try again in a moment.' }, { status: 502 })
  }
}
