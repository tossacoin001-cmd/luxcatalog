import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/admin-auth'
import { paystackConfigured } from '@/lib/paystack'
import { validateCart } from '@/lib/orders'
import { OrderError, createOrder, type Shipping } from '@/lib/orders-server'

// Décor checkout: re-price the cart from the database and hand the buyer to
// Paystack's secure checkout (Naira). The order is marked paid only when
// Paystack confirms (return page or signed webhook).
export async function POST(req: Request) {
  if (!paystackConfigured()) return NextResponse.json({ error: 'Online payment is not available right now. Please enquire instead.' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const cart = validateCart(body.items)
  if (!cart.ok) return NextResponse.json({ error: cart.error }, { status: 400 })
  const s = (body.shipping ?? {}) as Record<string, unknown>
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const shipping: Shipping = { name: str(s.name, 120), email: str(s.email).toLowerCase(), phone: str(s.phone, 40), address: str(s.address, 300), city: str(s.city, 80), state: str(s.state, 80), country: str(s.country, 80) }
  if (!shipping.name || !shipping.phone || !shipping.address || !shipping.city || !shipping.state || !shipping.country || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(shipping.email)) {
    return NextResponse.json({ error: 'Please complete your delivery details' }, { status: 400 })
  }
  try {
    const { url } = await createOrder(cart.items, shipping, (await getUserId()) || null)
    return NextResponse.json({ url })
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('Order creation error:', e)
    return NextResponse.json({ error: 'We couldn’t start the payment. Please try again in a moment.' }, { status: 502 })
  }
}
