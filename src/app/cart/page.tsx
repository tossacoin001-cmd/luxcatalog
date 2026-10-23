'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Minus, Plus, X, ShoppingBag } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useCart } from '@/components/CartProvider'
import { useCurrency } from '@/components/CurrencyProvider'
import { formatListingPrice } from '@/lib/utils'

export default function CartPage() {
  const { items, updateQuantity, removeItem, subtotalNgn } = useCart()
  const { currency, rate } = useCurrency()
  const router = useRouter()

  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-12 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            Interior Decor
          </p>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            Your Cart
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-12 py-16">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag size={32} style={{ color: '#5e584c', margin: '0 auto 1.5rem' }} />
            <p className="text-lg mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
              Your cart is empty
            </p>
            <p className="text-sm mb-8" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
              Browse our interior decor collection to get started.
            </p>
            <Link
              href="/catalog/decor"
              className="inline-flex items-center px-8 py-4 text-xs tracking-[0.2em] uppercase"
              style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
            >
              Browse Interior Decor
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <div key={item.listingId} className="flex gap-4 p-4" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
                  <div className="w-20 h-20 flex-shrink-0 overflow-hidden" style={{ background: '#ece6d9' }}>
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm mb-1" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                      {item.title}
                    </p>
                    <p className="text-xs mb-3" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                      {formatListingPrice(item.priceNgn, null, currency, rate)}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center" style={{ border: '1px solid #d6cfbf' }}>
                        <button
                          onClick={() => updateQuantity(item.listingId, item.quantity - 1)}
                          className="p-1.5"
                          style={{ color: '#5e584c' }}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-3 text-xs" style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.listingId, item.quantity + 1)}
                          className="p-1.5"
                          style={{ color: '#5e584c' }}
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.listingId)}
                        className="text-xs tracking-wider flex items-center gap-1"
                        style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}
                      >
                        <X size={12} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="sticky top-24 p-7 space-y-5" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
                <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                  Order Summary
                </p>
                <div className="flex justify-between text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
                  <span style={{ color: '#5e584c' }}>Subtotal</span>
                  <span style={{ color: '#14130f' }}>{formatListingPrice(subtotalNgn, null, currency, rate)}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                  Delivery within 24 hours in Lagos, 24 to 72 hours outside Lagos. Delivery fee confirmed at checkout.
                </p>
                <button
                  onClick={() => router.push('/checkout')}
                  className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all hover:opacity-90"
                  style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
