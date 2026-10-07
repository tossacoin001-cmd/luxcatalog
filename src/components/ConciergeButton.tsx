'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import { whatsappLink } from '@/lib/contact'
import { EASE_OUT_EXPO } from '@/components/motion/Reveal'

// Floating WhatsApp concierge. Appears once the visitor has scrolled past the
// first screen (never covers the hero CTAs), sits above the iOS home
// indicator, and stays out of the way on pages that have their own sticky
// action bar (listing detail) or are not for shoppers (auth, admin).
export default function ConciergeButton() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isListingPage = /^\/catalog\/[^/]+\/[^/]+/.test(pathname)
  const hidden = isListingPage || /^\/(admin|sign-in|sign-up|forgot-password|reset-password|two-factor|invite|checkout)/.test(pathname)
  if (hidden) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.a
          key="concierge"
          href={whatsappLink("Hello, I'd like help from the Lux Catalog concierge.")}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with the concierge on WhatsApp"
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.95 }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
          className="group fixed z-40 right-4 md:right-8 flex items-center justify-center gap-3 h-14 w-14 sm:w-auto sm:pl-4 sm:pr-5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.45)] active:scale-95 transition-transform"
          style={{
            bottom: 'calc(1rem + env(safe-area-inset-bottom))',
            background: 'linear-gradient(135deg, #d8b85c, #b8943a)',
            color: '#080c08',
            fontFamily: 'var(--font-inter)',
          }}
        >
          <span className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-8 w-8 rounded-full bg-[#080c08]/15 animate-ping [animation-duration:2.4s]" aria-hidden />
            <MessageCircle size={20} />
          </span>
          <span className="hidden sm:inline text-xs tracking-[0.16em] uppercase font-medium">Concierge</span>
        </motion.a>
      )}
    </AnimatePresence>
  )
}
