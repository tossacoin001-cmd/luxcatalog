'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShoppingBag, Check } from 'lucide-react'
import { useCart } from '@/components/CartProvider'

interface AddToCartPanelProps {
  listingId: string
  title: string
  priceNgn: number | null
  image: string | null
}

export default function AddToCartPanel({ listingId, title, priceNgn, image }: AddToCartPanelProps) {
  const { addItem } = useCart()
  const router = useRouter()
  const [added, setAdded] = useState(false)

  const handleAdd = () => {
    if (!priceNgn) {
      toast.error('This item requires a quote, contact us via WhatsApp for pricing.')
      return
    }
    addItem({ listingId, title, priceNgn, image })
    setAdded(true)
    toast.success('Added to your cart.')
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleAdd}
        className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
        style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
      >
        {added ? <Check size={14} /> : <ShoppingBag size={14} />}
        {added ? 'Added to Cart' : 'Add to Cart'}
      </button>

      {added && (
        <button
          onClick={() => router.push('/cart')}
          className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300"
          style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
        >
          View Cart & Checkout
        </button>
      )}

      <p className="text-[10px] leading-relaxed text-center" style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}>
        Delivery within 24 hours in Lagos, 24 to 72 hours outside Lagos.
      </p>
    </div>
  )
}
