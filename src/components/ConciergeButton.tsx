'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import { EASE_OUT_EXPO } from '@/components/motion/Reveal'
import LuxChat from '@/components/lux/LuxChat'
import { CONCIERGE_EVENT } from '@/components/concierge/OpenConcierge'
import { useScrollLock } from '@/lib/use-scroll-lock'

// Lux: a floating button that opens a real chat. The button appears once the
// visitor has scrolled past the first screen (never covers the hero), sits
// above the iOS home indicator, and stays out of the way on auth, admin and
// checkout. "Ask Lux" buttons elsewhere on the page open the same chat.
export default function ConciergeButton() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  useScrollLock(open)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const onOpen = () => setOpen(true)
    window.addEventListener(CONCIERGE_EVENT, onOpen)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener(CONCIERGE_EVENT, onOpen)
    }
  }, [])

  const isListingPage = /^\/catalog\/[^/]+\/[^/]+/.test(pathname)
  const hidden = /^\/(admin|sign-in|sign-up|forgot-password|reset-password|two-factor|invite|checkout)/.test(pathname)
  if (hidden) return null

  return (
    <>
      <AnimatePresence>
        {visible && !isListingPage && !open && (
          <motion.button
            key="lux"
            type="button"
            data-lux-button
            onClick={() => setOpen(true)}
            aria-label="Chat with Lux"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="group fixed z-40 right-4 md:right-8 flex items-center justify-center gap-3 h-14 w-14 sm:w-auto sm:pl-4 sm:pr-5 active:scale-95 transition-transform"
            style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))', background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
          >
            <MessageCircle size={20} />
            <span className="hidden sm:inline text-xs tracking-[0.16em] uppercase font-medium">Ask Lux</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* On a listing page the chat is reached from the listing's own bar. */}
      {isListingPage && !open && visible && (
        <button
          type="button"
          data-lux-button
          onClick={() => setOpen(true)}
          aria-label="Chat with Lux"
          className="hidden lg:flex fixed z-40 right-8 items-center justify-center gap-3 h-14 pl-4 pr-5"
          style={{ bottom: '1rem', background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
        >
          <MessageCircle size={20} />
          <span className="text-xs tracking-[0.16em] uppercase font-medium">Ask Lux</span>
        </button>
      )}

      {open && <LuxChat onClose={() => setOpen(false)} />}
    </>
  )
}
