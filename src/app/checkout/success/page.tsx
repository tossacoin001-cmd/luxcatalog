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

const text = { color: '#5e584c', fontFamily: 'var(--font-inter)' }

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
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <Navbar />
      {paid && <ClearCartOnMount />}
      <div className="max-w-2xl mx-auto px-6 pt-36 pb-24 text-center">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-8" style={{ background: 'rgba(122,92,36,0.06)', border: '1px solid rgba(20,19,15,0.15)' }}>
          {paid ? <CheckCircle size={28} style={{ color: '#7a5c24' }} /> : <Clock size={28} style={{ color: '#7a5c24' }} />}
        </span>
        <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
          {paid ? 'Order confirmed' : 'Waiting for payment'}
        </p>
        <h1 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
          {paid ? 'Thank you for your order' : 'Your payment is being confirmed'}
        </h1>
        <div className="text-left mb-8 p-6 space-y-2" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
              <span style={{ color: '#3a362d' }}>
                {item.titleSnapshot} &times; {item.quantity}
              </span>
              <span style={{ color: '#3a362d' }}>{naira(Number(item.priceSnapshot) * item.quantity)}</span>
            </div>
          ))}
          <div style={{ height: 1, background: '#ece6d9' }} />
          <div className="flex justify-between text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
            <span style={{ color: '#14130f' }}>Total</span>
            <span style={{ color: '#14130f', fontWeight: 600 }}>{naira(Number(order.total))}</span>
          </div>
          <p className="text-xs pt-2" style={text}>
            Delivering to {order.shippingAddress}, {order.shippingCity}, {order.shippingState}. Reference {order.paymentRef}.
          </p>
          {paid && (
            <p className="text-xs" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
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
          <Link href={paid ? '/catalog/decor' : '/cart'} className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase" style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}>
            {paid ? 'Continue browsing' : 'Back to your cart'}
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
