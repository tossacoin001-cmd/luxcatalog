import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Payments are not configured in this environment' }, { status: 503 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' })

    const { id } = await params
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: 'Missing session' }, { status: 400 })

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.orderId !== id || session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status: 'paid' },
    })

    return NextResponse.json({ success: true, order })
  } catch (err) {
    console.error('Order confirm error:', err)
    return NextResponse.json({ error: 'Unable to confirm order' }, { status: 500 })
  }
}
