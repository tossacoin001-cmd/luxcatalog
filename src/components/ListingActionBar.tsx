'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import PriceDisplay from '@/components/PriceDisplay'
import { EASE_OUT_EXPO } from '@/components/motion/Reveal'
import { whatsappLink } from '@/lib/contact'

// Phones/tablets only: once the visitor scrolls past the gallery, keep the
// price and the two next steps (talk to the concierge / reserve) one thumb
// away. Desktop already has the sticky side panel.
export default function ListingActionBar({
  title,
  price,
  priceDisplay,
  primaryLabel,
}: {
  title: string
  price: number | null
  priceDisplay: string
  primaryLabel: string
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.45)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* Keeps the footer reachable above the bar on small screens. */}
      <div className="h-24 lg:hidden" aria-hidden />
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-4 pt-3"
            style={{
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
              background: 'rgba(8,12,8,0.86)',
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
              borderTop: '1px solid rgba(201,168,76,0.18)',
            }}
          >
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] tracking-[0.18em] uppercase truncate" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                  {title}
                </p>
                <p className="text-lg leading-tight truncate" style={{ fontFamily: 'var(--font-playfair)', color: '#C9A84C', fontStyle: price ? 'normal' : 'italic' }}>
                  <PriceDisplay price={price} priceDisplay={priceDisplay} />
                </p>
              </div>
              <a
                href={whatsappLink(`Hello, I'm interested in "${title}" on Lux Catalog.`)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ask the concierge on WhatsApp"
                className="flex items-center justify-center w-12 h-12 shrink-0 active:scale-95 transition-transform"
                style={{ border: '1px solid rgba(201,168,76,0.5)', color: '#C9A84C' }}
              >
                <MessageCircle size={18} />
              </a>
              <a
                href="#enquire"
                className="flex items-center justify-center h-12 px-5 shrink-0 text-xs tracking-[0.16em] uppercase active:scale-95 transition-transform"
                style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
              >
                {primaryLabel}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
