'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useCart } from '@/components/CartProvider'
import { useCurrency } from '@/components/CurrencyProvider'
import { formatListingPrice } from '@/lib/utils'

const fieldStyle = {
  background: '#162318',
  border: '1px solid #1e2e1f',
  color: '#f5f0e8',
  fontFamily: 'var(--font-inter)',
}

export default function CheckoutPage() {
  const { items, subtotalNgn } = useCart()
  const { currency, rate } = useCurrency()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', state: '', country: 'Nigeria' })

  const isLagos = form.state.toLowerCase().includes('lagos')
  const deliveryEstimate = form.state
    ? isLagos
      ? 'Delivery within 24 hours'
      : 'Delivery within 24 to 72 hours'
    : null

  const set = (key: keyof typeof form, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      toast.error('Your cart is empty.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ listingId: i.listingId, quantity: i.quantity })),
          shipping: form,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error()
      window.location.href = data.url
    } catch {
      toast.error('Unable to start checkout. Please try again.')
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div style={{ background: '#080c08', minHeight: '100vh' }}>
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 pt-40 pb-24 text-center">
          <p className="text-lg mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Your cart is empty
          </p>
          <button
            onClick={() => router.push('/catalog/decor')}
            className="inline-flex items-center px-8 py-4 text-xs tracking-[0.2em] uppercase"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Browse Interior Decor
          </button>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-12 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Interior Decor
          </p>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Checkout
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-12 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
          <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Delivery Details
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                Full Name *
              </label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full h-11 px-4 text-sm focus:outline-none" style={fieldStyle} />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                Phone *
              </label>
              <input required type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="w-full h-11 px-4 text-sm focus:outline-none" style={fieldStyle} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Email *
            </label>
            <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full h-11 px-4 text-sm focus:outline-none" style={fieldStyle} />
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Delivery Address *
            </label>
            <input required value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" className="w-full h-11 px-4 text-sm focus:outline-none" style={fieldStyle} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                City *
              </label>
              <input required value={form.city} onChange={(e) => set('city', e.target.value)} className="w-full h-11 px-4 text-sm focus:outline-none" style={fieldStyle} />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                State *
              </label>
              <input required value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="e.g. Lagos" className="w-full h-11 px-4 text-sm focus:outline-none" style={fieldStyle} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Country *
            </label>
            <input required value={form.country} onChange={(e) => set('country', e.target.value)} className="w-full h-11 px-4 text-sm focus:outline-none" style={fieldStyle} />
          </div>

          {deliveryEstimate && (
            <p className="text-xs" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
              {deliveryEstimate}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all disabled:opacity-60"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            {loading ? 'Redirecting to payment…' : 'Continue to Payment'}
          </button>
          <p className="text-[10px] text-center" style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}>
            Secured via Stripe. Card payment processed in USD at the current exchange rate.
          </p>
        </form>

        <div>
          <div className="sticky top-24 p-7 space-y-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
            <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Order Summary
            </p>
            {items.map((item) => (
              <div key={item.listingId} className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#9a8f7a' }}>{item.title} × {item.quantity}</span>
                <span style={{ color: '#f5f0e8' }}>{formatListingPrice(item.priceNgn * item.quantity, null, currency, rate)}</span>
              </div>
            ))}
            <div style={{ height: 1, background: '#1e2e1f' }} />
            <div className="flex justify-between text-sm">
              <span style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>Total</span>
              <span style={{ color: '#C9A84C', fontFamily: 'var(--font-playfair)' }}>
                {formatListingPrice(subtotalNgn, null, currency, rate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
