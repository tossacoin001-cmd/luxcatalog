import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
})

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { listingId, listingTitle, listingPrice } = await req.json()

    if (!listingId || !listingTitle) {
      return NextResponse.json({ error: 'Missing listing details' }, { status: 400 })
    }

    // Holding deposit: 1% of price, minimum $1,000, maximum $50,000
    const rawDeposit = listingPrice ? Math.round(listingPrice * 0.01) : 1000
    const depositAmount = Math.min(Math.max(rawDeposit, 1000), 50000)
    const depositCents = depositAmount * 100

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Holding Deposit — ${listingTitle}`,
              description:
                'Refundable holding deposit to secure this asset while due diligence is completed. A member of our team will contact you within 24 hours.',
              metadata: { listingId },
            },
            unit_amount: depositCents,
          },
          quantity: 1,
        },
      ],
      metadata: { listingId, userId },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&listing=${encodeURIComponent(listingTitle)}`,
      cancel_url: `${appUrl}/catalog`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Unable to create payment session' }, { status: 500 })
  }
}
