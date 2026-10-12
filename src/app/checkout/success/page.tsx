import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CheckCircle, Clock } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ClearCartOnMount from '@/components/ClearCartOnMount'
import { prisma } from '@/lib/prisma'
import { naira } from '@/lib/booking'
import { paystackConfigured, verifyTransaction } from '@/lib/paystack'
import { applyOrderPayment } from '@/lib/orders-server'

export const metadata: Metadata = { title: 'Your order', robots: { index: false } }
export const dynamic = 'force-dynamic'

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }

async function load(orderId: string, reference: string) {
  return prisma.order.findFirst({ where: { id: orderId, paymentRef: reference }, include: { items: true } })
}

// Back from Paystack: confirm with Paystack directly (the webhook does the
// same), then show the order. Only a real, matching order is ever shown.
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ type?: string; orderId?: string; reference?: string }> }) {
  const { type, orderId, reference } = await searchParams
  if (type !== 'order' || !orderId || !reference) redirect('/cart')
  let order = await load(orderId, reference)
  if (!order) redirect('/cart')
  if (order.status === 'pending' && paystackConfigured()) {
    try {
      await applyOrderPayment(await verifyTransaction(reference))
      order = (await load(orderId, reference))!
    } catch {
      // Not paid yet, or Paystack unreachable: show the waiting state.
    }
  }
  const paid = order.status === 'paid' || order.status === 'fulfilled'
  const isLagos = order.shippingState.toLowerCase().includes('lagos')

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      {paid && <ClearCartOnMount />}
      <div className="max-w-2xl mx-auto px-6 pt-36 pb-24 text-center">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-8" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          {paid ? <CheckCircle size={28} style={{ color: '#C9A84C' }} /> : <Clock size={28} style={{ color: '#C9A84C' }} />}
        </span>
        <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          {paid ? 'Order confirmed' : 'Waiting for payment'}
        </p>
        <h1 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          {paid ? 'Thank you for your order' : 'Your payment is being confirmed'}
        </h1>
        <div className="text-left mb-8 p-6 space-y-2" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
              <span style={{ color: '#d6cdbd' }}>
                {item.titleSnapshot} &times; {item.quantity}
              </span>
              <span style={{ color: '#d6cdbd' }}>{naira(Number(item.priceSnapshot) * item.quantity)}</span>
            </div>
          ))}
          <div style={{ height: 1, background: '#1e2e1f' }} />
          <div className="flex justify-between text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
            <span style={{ color: '#f5f0e8' }}>Total</span>
            <span style={{ color: '#f5f0e8', fontWeight: 600 }}>{naira(Number(order.total))}</span>
          </div>
          <p className="text-xs pt-2" style={text}>
            Delivering to {order.shippingAddress}, {order.shippingCity}, {order.shippingState}. Reference {order.paymentRef}.
          </p>
          {paid && (
            <p className="text-xs" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
              {isLagos ? 'Delivery within 24 hours in Lagos' : 'Delivery within 24 to 72 hours'}
            </p>
          )}
        </div>
        <p className="text-sm leading-relaxed mb-10" style={text}>
          {paid
            ? `A confirmation has been sent to ${order.email}. Our team will contact you to arrange delivery.`
            : 'If you completed the payment, this page updates as soon as Paystack confirms it. If you closed the payment window, you can return to your cart and try again.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={paid ? '/catalog/decor' : '/cart'} className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase" style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
            {paid ? 'Continue browsing' : 'Back to your cart'}
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
