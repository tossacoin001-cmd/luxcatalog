'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'
import { whatsappLink } from '@/lib/contact'
import { EASE_OUT_EXPO } from '@/components/motion/Reveal'
import BriefForm from '@/components/concierge/BriefForm'
import { CONCIERGE_EVENT } from '@/components/concierge/OpenConcierge'
import { BRIEF_TOPICS } from '@/lib/enquiry'
import { useScrollLock } from '@/lib/use-scroll-lock'

// The Lux Catalog concierge: a floating button that opens a short panel on
// the site. The visitor says what they need and the team replies; WhatsApp
// is only a plain link at the very bottom, for anyone who prefers it.
// The button appears once the visitor has scrolled past the first screen
// (never covers the hero), sits above the iOS home indicator, and stays out
// of the way on listing pages (own sticky bar), auth, admin and checkout.
export default function ConciergeButton() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState<string>(BRIEF_TOPICS[0].key)
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
  const chosen = BRIEF_TOPICS.find((t) => t.key === topic) ?? BRIEF_TOPICS[0]

  return (
    <>
      <AnimatePresence>
        {visible && !isListingPage && !open && (
          <motion.button
            key="concierge"
            type="button"
            data-concierge-button
            onClick={() => setOpen(true)}
            aria-label="Open the concierge"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            className="group fixed z-40 right-4 md:right-8 flex items-center justify-center gap-3 h-14 w-14 sm:w-auto sm:pl-4 sm:pr-5 active:scale-95 transition-transform"
            style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))', background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
          >
            <span className="relative flex items-center justify-center">
              <MessageCircle size={20} />
            </span>
            <span className="hidden sm:inline text-xs tracking-[0.16em] uppercase font-medium">Concierge</span>
          </motion.button>
        )}
      </AnimatePresence>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(20,19,15,0.5)' }} onClick={() => setOpen(false)}>
          <div data-concierge-panel className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Lux Catalog concierge">
            <div className="flex items-start justify-between gap-3 px-6 py-5" style={{ borderBottom: '1px solid #d6cfbf' }}>
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                  Lux Catalog concierge
                </p>
                <h3 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                  How can we help?
                </h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="w-11 h-11 inline-flex items-center justify-center shrink-0" style={{ color: '#5e584c' }} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 pt-5 flex flex-wrap gap-2">
              {BRIEF_TOPICS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-topic={t.key}
                  aria-pressed={t.key === topic}
                  onClick={() => setTopic(t.key)}
                  className="min-h-11 px-4 text-[11px] tracking-[0.12em] uppercase"
                  style={{ border: `1px solid ${t.key === topic ? '#14130f' : '#d6cfbf'}`, background: t.key === topic ? 'rgba(122,92,36,0.07)' : 'transparent', color: t.key === topic ? '#7a5c24' : '#5e584c', fontFamily: 'var(--font-inter)' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <BriefForm topic={chosen.topic} onDone={() => setOpen(false)} />
            <p className="px-6 pb-6 -mt-2 text-center text-xs" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
              Prefer WhatsApp?{' '}
              <a data-wa-fallback href={whatsappLink('Hello, I’d like help from the Lux Catalog concierge.')} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#5e584c' }}>
                Message us there
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
