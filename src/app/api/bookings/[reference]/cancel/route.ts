import { NextResponse } from 'next/server'
import { audit, getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { RefundError, cancelByGuest } from '@/lib/refunds-server'

// Guest cancels their own booking; the refund (per policy) goes to the
// approval queue.
export async function POST(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { reference } = await params
  const b = await prisma.booking.findUnique({ where: { reference }, select: { id: true, userId: true } })
  if (!b || b.userId !== session.user.id) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  try {
    const refund = await cancelByGuest(b.id, session.user.id)
    await audit(session.user.id, 'booking.cancel.guest', b.id, { refund })
    return NextResponse.json({ cancelled: true, refund })
  } catch (e) {
    if (e instanceof RefundError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
