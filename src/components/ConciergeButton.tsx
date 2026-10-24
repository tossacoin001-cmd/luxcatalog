'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { EASE_OUT_EXPO } from '@/components/motion/Reveal'
import LuxChat from '@/components/lux/LuxChat'
import { CONCIERGE_EVENT } from '@/components/concierge/OpenConcierge'
import { nudgeText } from '@/lib/lux-chat'
import { useScrollLock } from '@/lib/use-scroll-lock'

const SEEN = 'lux-nudge-seen'
const read = () => {
  try {
    return window.sessionStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}
const mark = () => {
  try {
    window.sessionStorage.setItem(SEEN, '1')
  } catch {
    // Private windows: the nudge may show once more. Harmless.
  }
}

// Lux: a small round monogram that floats at the bottom corner on every screen
// size. It breathes, a thin brass arc circles it, a soft ring pulses outward,
// a green dot says someone is here, and after a few seconds it says hello once
// in the visitor's own time of day. Everything that moves stops for people who
// asked for reduced motion. It opens the chat.
export default function ConciergeButton() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [waited, setWaited] = useState(false)
  const [open, setOpen] = useState(false)
  const [nudge, setNudge] = useState<string | null>(null)
  useScrollLock(open)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.25)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const onOpen = () => setOpen(true)
    window.addEventListener(CONCIERGE_EVENT, onOpen)
    const wait = window.setTimeout(() => setWaited(true), 3500)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener(CONCIERGE_EVENT, onOpen)
      window.clearTimeout(wait)
    }
  }, [])

  const visible = scrolled || waited
  const isListingPage = /^\/catalog\/[^/]+\/[^/]+/.test(pathname)
  const hidden = /^\/(admin|sign-in|sign-up|forgot-password|reset-password|two-factor|invite|checkout)/.test(pathname)

  // One friendly hello per visit, a few seconds after the icon appears.
  useEffect(() => {
    if (!visible || open || hidden || read()) return
    const show = window.setTimeout(() => setNudge(nudgeText(new Date().getHours())), 2500)
    const hide = window.setTimeout(() => {
      setNudge(null)
      mark()
    }, 12000)
    return () => {
      window.clearTimeout(show)
      window.clearTimeout(hide)
    }
  }, [visible, open, hidden])

  if (hidden) return null
  const bottom = isListingPage ? 'calc(5.75rem + env(safe-area-inset-bottom))' : 'calc(1rem + env(safe-area-inset-bottom))'
  const openChat = () => {
    setNudge(null)
    mark()
    setOpen(true)
  }

  return (
    <>
      <AnimatePresence>
        {visible && !open && (
          <motion.div
            key="lux-orb"
            className="fixed z-40 right-4 md:right-8 flex flex-col items-end gap-3 lg:bottom-4!"
            style={{ bottom }}
            initial={{ opacity: 0, y: 18, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
          >
            {nudge && (
              <div data-lux-nudge className="relative max-w-[230px]" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf', fontFamily: 'var(--font-inter)' }}>
                <button type="button" onClick={openChat} className="block text-left text-sm leading-snug pl-4 pr-12 py-3 min-h-11" style={{ color: '#14130f' }}>
                  {nudge}
                </button>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => {
                    setNudge(null)
                    mark()
                  }}
                  className="absolute top-0 right-0 w-11 h-11 inline-flex items-center justify-center"
                  style={{ color: '#5e584c' }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              data-lux-button
              onClick={openChat}
              aria-label="Chat with Lux"
              className="lux-orb group relative inline-flex items-center justify-center w-16 h-16 active:scale-95 transition-transform"
            >
              {/* A label that slides out on wide screens when the icon is hovered or focused. */}
              <span
                aria-hidden
                className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 h-11 items-center pl-5 pr-9 text-xs tracking-[0.16em] uppercase whitespace-nowrap origin-right scale-x-0 opacity-0 transition-[transform,opacity] duration-500 group-hover:scale-x-100 group-hover:opacity-100 group-focus-visible:scale-x-100 group-focus-visible:opacity-100"
                style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
              >
                Ask Lux
              </span>
              <svg viewBox="0 0 64 64" width="64" height="64" className="relative lux-orb-body" aria-hidden focusable="false">
                {/* Soft rings that drift outward and fade, one after the other. */}
                <circle className="lux-pulse" cx="32" cy="32" r="30" fill="none" stroke="#c9a867" strokeWidth="1" />
                <circle className="lux-pulse lux-pulse-late" cx="32" cy="32" r="30" fill="none" stroke="#c9a867" strokeWidth="1" />
                <circle cx="32" cy="32" r="29" fill="#14130f" />
                {/* A thin brass arc that circles the disc. */}
                <circle className="lux-orbit" cx="32" cy="32" r="29.5" fill="none" stroke="#c9a867" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="46 140" />
                <text x="32" y="42" textAnchor="middle" fontSize="30" fontStyle="italic" fill="#f4f0e8" style={{ fontFamily: 'var(--font-playfair)' }}>
                  L
                </text>
                <rect x="41" y="38" width="4" height="4" fill="#c9a867" transform="rotate(45 43 40)" />
                {/* Someone is here. */}
                <circle cx="52" cy="13" r="5" fill="#14130f" />
                <circle className="lux-dot" cx="52" cy="13" r="3.2" fill="#5fae7a" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {open && <LuxChat onClose={() => setOpen(false)} />}
    </>
  )
}
