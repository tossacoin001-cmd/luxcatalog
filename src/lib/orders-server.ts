import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getAppUrl } from '@/lib/utils'
import { naira } from '@/lib/booking'
import { send } from '@/lib/bookings-server'
import { initializeTransaction, toKobo, type PaystackTransaction } from '@/lib/paystack'
import type { CartLine } from '@/lib/orders'

// Décor orders, paid with Paystack in Naira. Prices always come from the
// database, never from the browser.

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const newRef = () => `ORD-${[...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export type Shipping = { name: string; email: string; phone: string; address: string; city: string; state: string; country: string }

export async function createOrder(items: CartLine[], shipping: Shipping, userId: string | null) {
  const listings = await prisma.listing.findMany({
    where: { id: { in: items.map((i) => i.listingId) }, category: 'decor', published: true, status: 'available' },
    select: { id: true, title: true, price: true },
  })
  if (listings.length !== items.length) throw new OrderError('One or more pieces are no longer available')
  if (listings.some((l) => !l.price || Number(l.price) <= 0)) throw new OrderError('One of these pieces is priced on application. Please enquire instead.')
  const lines = items.map((i) => {
    const l = listings.find((x) => x.id === i.listingId)!
    return { listingId: l.id, titleSnapshot: l.title, priceSnapshot: Number(l.price), quantity: i.quantity }
  })
  const subtotal = lines.reduce((s, l) => s + l.priceSnapshot * l.quantity, 0)
  let reference = newRef()
  while (await prisma.order.findFirst({ where: { paymentRef: reference }, select: { id: true } })) reference = newRef()
  const order = await prisma.order.create({
    data: {
      userId,
      email: shipping.email,
      phone: shipping.phone,
      currency: 'NGN',
      subtotal,
      shippingFee: 0,
      total: subtotal,
      shippingName: shipping.name,
      shippingAddress: shipping.address,
      shippingCity: shipping.city,
      shippingState: shipping.state,
      shippingCountry: shipping.country,
      paymentProvider: 'paystack',
      paymentRef: reference,
      status: 'pending',
      items: { create: lines },
    },
  })
  const trx = await initializeTransaction({
    email: shipping.email,
    amountKobo: toKobo(subtotal),
    reference,
    callbackUrl: `${getAppUrl()}/checkout/success?type=order&orderId=${order.id}&reference=${reference}`,
    metadata: { orderId: order.id, cancel_action: `${getAppUrl()}/cart` },
  })
  return { order, url: trx.authorization_url }
}

// Apply a Paystack result to the order with that reference. Safe to call
// any number of times (return page and webhook both call it).
export async function applyOrderPayment(trx: PaystackTransaction) {
  const order = await prisma.order.findFirst({ where: { paymentRef: trx.reference } })
  if (!order || order.status !== 'pending') return { outcome: order ? 'already' : 'unknown' }
  if (trx.status !== 'success') return { outcome: 'not_paid' }
  if (trx.currency !== 'NGN' || trx.amount !== toKobo(Number(order.total))) {
    console.error(`Order ${trx.reference}: paid ${trx.currency} ${trx.amount / 100}, expected NGN ${Number(order.total)}`)
    return { outcome: 'mismatch' }
  }
  const claimed = await prisma.order.updateMany({ where: { id: order.id, status: 'pending' }, data: { status: 'paid' } })
  if (!claimed.count) return { outcome: 'already' }
  await emailOrderPaid(order.id).catch((e) => console.error('Order emails failed:', e))
  return { outcome: 'paid' }
}

async function emailOrderPaid(orderId: string) {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { listing: { select: { ownerId: true } } } } } })
  const lines = o.items.map((i) => ({ text: `${i.titleSnapshot} × ${i.quantity}: ${naira(Number(i.priceSnapshot) * i.quantity)}` }))
  const ship = `${o.shippingName}, ${o.shippingAddress}, ${o.shippingCity}, ${o.shippingState}, ${o.shippingCountry}`
  await send(o.email, o.userId, 'order_paid', `Order confirmed: ${o.paymentRef}`, {
    preheader: `Thank you. We’ve received ${naira(Number(o.total))}.`,
    eyebrow: 'Order confirmed',
    greeting: `Thank you, ${o.shippingName.split(' ')[0] || 'there'}`,
    intro: `Your payment of ${naira(Number(o.total))} was received. Our team will contact you to arrange delivery.`,
    blocks: [{ type: 'bullets', items: [...lines, { text: `Total: ${naira(Number(o.total))}` }, { text: `Deliver to: ${ship}` }, { text: `Reference: ${o.paymentRef}` }] }],
    reason: 'You receive this because you placed an order on Lux Catalog.',
  })
  const owners = [...new Set(o.items.map((i) => i.listing.ownerId).filter((x): x is string => !!x))]
  const staff = await prisma.user.findMany({ where: { OR: [{ role: 'admin' }, { role: 'team', permissions: { has: 'orders' } }, ...(owners.length ? [{ id: { in: owners } }] : [])] }, select: { id: true, email: true, name: true } })
  for (const u of staff) {
    await send(u.email, u.id, 'order_new', `New order: ${o.paymentRef} (${naira(Number(o.total))})`, {
      preheader: `${o.shippingName} paid ${naira(Number(o.total))}.`,
      eyebrow: 'New order',
      greeting: `A new order, ${u.name.split(' ')[0] || 'there'}`,
      intro: `${o.shippingName} has paid for the pieces below. Please arrange delivery.`,
      blocks: [{ type: 'bullets', items: [...lines, { text: `Deliver to: ${ship}` }, { text: `Contact: ${o.email}${o.phone ? `, ${o.phone}` : ''}` }] }, { type: 'cta', label: 'Open orders', url: `${getAppUrl()}/admin/orders` }],
      reason: 'You receive this because you handle orders on Lux Catalog.',
    })
  }
}
