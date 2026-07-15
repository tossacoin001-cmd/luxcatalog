import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { CheckCircle } from 'lucide-react'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import ClearCartOnMount from '@/components/ClearCartOnMount'

async function confirmOrder(orderId: string, sessionId: string) {
  if (!process.env.STRIPE_SECRET_KEY) return null
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' })
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.orderId !== orderId || session.payment_status !== 'paid') return null

    return prisma.order.update({
      where: { id: orderId },
      data: { status: 'paid' },
      include: { items: true },
    })
  } catch (err) {
    console.error('Order confirm error:', err)
    return null
  }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string; type?: string; orderId?: string; session_id?: string }>
}) {
  const { listing, type, orderId, session_id: sessionId } = await searchParams

  if (type === 'order' && orderId && sessionId) {
    const order = await confirmOrder(orderId, sessionId)

    if (!order) {
      return (
        <div style={{ background: '#080c08', minHeight: '100vh' }}>
          <Navbar />
          <div className="max-w-2xl mx-auto px-6 pt-40 pb-24 text-center">
            <h1 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              We couldn&rsquo;t confirm this payment
            </h1>
            <p className="text-sm mb-8" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              If you were charged, contact us and we&rsquo;ll sort it out right away.
            </p>
            <Link href="/contact" className="inline-flex items-center px-8 py-3 text-xs tracking-[0.2em] uppercase" style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
              Contact Us
            </Link>
          </div>
          <Footer />
        </div>
      )
    }

    const isLagos = order.shippingState.toLowerCase().includes('lagos')

    return (
      <div style={{ background: '#080c08', minHeight: '100vh' }}>
        <Navbar />
        <ClearCartOnMount />
        <div className="max-w-2xl mx-auto px-6 pt-40 pb-24 text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-8"
            style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}
          >
            <CheckCircle size={28} style={{ color: '#C9A84C' }} />
          </div>

          <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Order Confirmed
          </p>
          <h1 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Thank You for Your Order
          </h1>

          <div className="text-left mb-8 p-6" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm mb-2" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#9a8f7a' }}>{item.titleSnapshot} &times; {item.quantity}</span>
              </div>
            ))}
            <div style={{ height: 1, background: '#1e2e1f', margin: '0.75rem 0' }} />
            <p className="text-xs" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              Delivering to {order.shippingAddress}, {order.shippingCity}, {order.shippingState}
            </p>
            <p className="text-xs mt-1" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
              {isLagos ? 'Delivery within 24 hours' : 'Delivery within 24 to 72 hours'}
            </p>
          </div>

          <p className="text-sm leading-relaxed mb-10" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            A member of our team will reach out to confirm delivery details. Your order confirmation has
            been sent to {order.email}.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/catalog/decor"
              className="px-8 py-3 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-80"
              style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
            >
              Continue Browsing
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-3 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-80"
              style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              My Dashboard
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 pt-40 pb-24 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-8"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}
        >
          <CheckCircle size={28} style={{ color: '#C9A84C' }} />
        </div>

        <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          Reservation Secured
        </p>
        <h1 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          Your Holding Deposit<br />Has Been Received
        </h1>

        {listing && (
          <p className="text-sm mb-4" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            <span style={{ color: '#C9A84C' }}>{decodeURIComponent(listing)}</span> is now on hold pending your consultation.
          </p>
        )}

        <p className="text-sm leading-relaxed mb-10" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
          A senior specialist from our team will contact you within 24 hours to arrange a private viewing
          and begin the due diligence process. Your deposit is fully refundable should you decide not
          to proceed after consultation.
        </p>

        <div
          className="inline-flex items-center gap-2 px-4 py-3 mb-8 text-xs"
          style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
        >
          <CheckCircle size={12} style={{ color: '#C9A84C' }} />
          A confirmation has been sent to your registered email address
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/catalog"
            className="px-8 py-3 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-80"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Continue Browsing
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-3 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-80"
            style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            My Dashboard
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
