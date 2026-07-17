import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getNgnToUsdRate } from '@/lib/fx'

interface CartItemInput {
  listingId: string
  quantity: number
}

interface ShippingInput {
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  country: string
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Payments are not configured in this environment' }, { status: 503 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' })

    const { userId } = await auth()
    const { items, shipping }: { items: CartItemInput[]; shipping: ShippingInput } = await req.json()

    if (!items?.length) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    if (!shipping?.name || !shipping?.email || !shipping?.phone || !shipping?.address || !shipping?.city || !shipping?.state || !shipping?.country) {
      return NextResponse.json({ error: 'Missing shipping details' }, { status: 400 })
    }

    // Never trust client-submitted prices, re-fetch authoritative current
    // price/title for every item from the database.
    const listings = await prisma.listing.findMany({
      where: { id: { in: items.map((i) => i.listingId) }, category: 'decor', published: true },
    })
    if (listings.length !== items.length) {
      return NextResponse.json({ error: 'One or more items are no longer available' }, { status: 400 })
    }

    const rate = await getNgnToUsdRate()
    const shippingFee = 0

    let subtotalNgn = 0
    const orderItemsData = items.map((item) => {
      const listing = listings.find((l) => l.id === item.listingId)!
      const priceNgn = Number(listing.price ?? 0)
      subtotalNgn += priceNgn * item.quantity
      return {
        listingId: listing.id,
        titleSnapshot: listing.title,
        priceSnapshot: priceNgn,
        quantity: item.quantity,
      }
    })
    const totalNgn = subtotalNgn + shippingFee

    const order = await prisma.order.create({
      data: {
        userId: userId || null,
        email: shipping.email,
        phone: shipping.phone,
        currency: 'NGN',
        subtotal: subtotalNgn,
        shippingFee,
        total: totalNgn,
        shippingName: shipping.name,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
        shippingState: shipping.state,
        shippingCountry: shipping.country,
        paymentProvider: 'stripe',
        status: 'pending',
        items: { create: orderItemsData },
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: shipping.email,
      line_items: orderItemsData.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: { name: item.titleSnapshot, metadata: { listingId: item.listingId } },
          unit_amount: Math.max(50, Math.round(item.priceSnapshot * rate * 100)),
        },
        quantity: item.quantity,
      })),
      metadata: { orderId: order.id },
      success_url: `${appUrl}/checkout/success?type=order&orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cart`,
    })

    await prisma.order.update({ where: { id: order.id }, data: { paymentRef: session.id } })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Order creation error:', err)
    return NextResponse.json({ error: 'Unable to create order' }, { status: 500 })
  }
}
