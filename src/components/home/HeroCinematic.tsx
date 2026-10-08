'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { EASE_OUT_EXPO } from '@/components/motion/Reveal'
import { whatsappLink } from '@/lib/contact'

const SLIDE_MS = 6500

const slides = [
  {
    word: 'Estate',
    label: 'Prime Real Estate',
    src: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=2000&q=80',
    alt: 'Modern villa with an infinity pool at dusk',
  },
  {
    word: 'Supercar',
    label: 'Supercars',
    src: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=2000&q=80',
    alt: 'Black Porsche gliding along an open highway',
  },
  {
    word: 'Superyacht',
    label: 'Superyachts',
    src: 'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=2000&q=80',
    alt: 'Dark-hulled superyacht at sea',
  },
  {
    word: 'Experience',
    label: 'Chauffeur & Guards',
    src: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=2000&q=80',
    alt: 'Black Range Rover ready for a chauffeured journey',
  },
]

export default function HeroCinematic() {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  // Slides only advance onto a photo that has finished downloading, so slow
  // connections never see a blank frame mid-crossfade.
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set())
  const markLoaded = useCallback((i: number) => setLoaded((prev) => (prev.has(i) ? prev : new Set(prev).add(i))), [])
  const timer = useRef<number | null>(null)

  const go = useCallback((i: number) => setIndex((i + slides.length) % slides.length), [])

  // Auto-advance, but never for reduced-motion visitors, while the tab is
  // hidden, or while the visitor is hovering/focused on the hero.
  useEffect(() => {
    if (reduce || paused) return
    const next = (index + 1) % slides.length
    timer.current = window.setTimeout(() => {
      if (!document.hidden && loaded.has(next)) go(next)
    }, SLIDE_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [index, paused, reduce, go, loaded])

  const slide = slides[index]

  return (
    <section
      className="relative min-h-[100svh] flex flex-col justify-end overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Lux Catalog collections"
    >
      {/* Imagery: crossfade between slides, each drifting slowly (Ken Burns). */}
      <div className="absolute inset-0 bg-lux-bg">
        {slides.map((sl, i) => {
          const active = i === index
          return (
            <div
              key={sl.src}
              className="absolute inset-0 transition-opacity duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ opacity: active ? 1 : 0 }}
              aria-hidden={!active}
            >
              {/* Re-keyed on activation so the slow drift restarts each time. */}
              <div key={active ? `on-${index}` : 'off'} className={active && !reduce ? 'absolute inset-0 animate-kenburns' : 'absolute inset-0'}>
                {/* Only the first photo competes for bandwidth on arrival; the
                    rest start downloading once it is on screen. */}
                {(i === 0 || loaded.has(0)) && (
                  <Image
                    src={sl.src}
                    alt={active ? sl.alt : ''}
                    fill
                    priority={i === 0}
                    loading={i === 0 ? undefined : 'eager'}
                    fetchPriority={i === 0 ? 'high' : 'low'}
                    sizes="100vw"
                    className="object-cover"
                    onLoad={() => markLoaded(i)}
                  />
                )}
              </div>
            </div>
          )
        })}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,12,8,0.55) 0%, rgba(8,12,8,0.25) 35%, rgba(8,12,8,0.7) 70%, rgba(8,12,8,0.97) 100%), radial-gradient(ellipse 80% 60% at 20% 80%, rgba(8,12,8,0.6), transparent)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 md:px-12 pt-32 pb-10 md:pb-16">
        <div className="max-w-3xl">
          <p
            className="hero-rise text-[11px] md:text-xs tracking-[0.32em] uppercase mb-5 md:mb-6"
            style={{ color: '#e4c878', fontFamily: 'var(--font-inter)', textShadow: '0 1px 14px rgba(0,0,0,0.65)', animationDelay: '0.1s' }}
          >
            The Luxury Asset Platform &middot; Lagos to the World
          </p>

          <h1 className="text-[2.6rem] leading-[1.04] sm:text-6xl md:text-7xl md:leading-[1.02] mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8', textShadow: '0 2px 30px rgba(0,0,0,0.45)' }}>
            <span className="sr-only">Every Luxury Asset. One Destination.</span>
            <span aria-hidden>
              <span
                className="block hero-rise"
                style={{ animationDelay: '0.2s' }}
              >
                Every Luxury{' '}
                {/* All words share one grid cell so the line never reflows as they change. */}
                <span className="inline-grid align-baseline">
                  {slides.map((s) => (
                    <span key={s.word} className="col-start-1 row-start-1 invisible">
                      {s.word}.
                    </span>
                  ))}
                  <span className="col-start-1 row-start-1 grid">
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={slide.word}
                        className="col-start-1 row-start-1 inline-block"
                        initial={{ y: '0.6em', opacity: 0, filter: 'blur(6px)' }}
                        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                        exit={{ y: '-0.5em', opacity: 0, filter: 'blur(6px)' }}
                        transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
                      >
                        {slide.word}.
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </span>
              </span>
              <em
                className="block hero-rise"
                style={{ color: '#C9A84C', fontStyle: 'italic', animationDelay: '0.35s' }}
              >
                One Destination.
              </em>
            </span>
          </h1>

          <p
            className="hero-rise text-base md:text-lg mb-9 max-w-xl leading-relaxed"
            style={{ color: '#d6cdbd', fontFamily: 'var(--font-inter)', textShadow: '0 1px 18px rgba(0,0,0,0.6)', animationDelay: '0.5s' }}
          >
            Prime real estate, supercars, superyachts and private protection, bought, sold and booked through one private
            concierge. In Lagos today, and around the world.
          </p>

          <div
            className="hero-rise flex flex-col sm:flex-row gap-3 sm:gap-4"
            style={{ animationDelay: '0.65s' }}
          >
            <Link
              href="/catalog"
              className="sheen group inline-flex items-center justify-center gap-3 min-h-[52px] px-8 text-xs tracking-[0.2em] uppercase transition-transform duration-300 active:scale-[0.98]"
              style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
            >
              Explore the Collection
              <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a
              href={whatsappLink("Hello, I'd like help from the Lux Catalog concierge.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 min-h-[52px] px-8 text-xs tracking-[0.2em] uppercase transition-colors duration-300 hover:bg-[rgba(201,168,76,0.1)]"
              style={{ border: '1px solid rgba(201,168,76,0.55)', color: '#e4c878', fontFamily: 'var(--font-inter)', backdropFilter: 'blur(6px)' }}
            >
              <MessageCircle size={15} />
              Speak to a Concierge
            </a>
          </div>
        </div>

        {/* Slide selector: doubles as progress indicator and category legend. */}
        <div className="mt-12 md:mt-16 grid grid-cols-4 gap-2 md:gap-6" role="tablist" aria-label="Choose a collection">
          {slides.map((s, i) => {
            const active = i === index
            return (
              <button
                key={s.label}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={s.label}
                onClick={() => go(i)}
                className="group text-left min-h-11 pt-3"
              >
                <span className="block h-px w-full overflow-hidden" style={{ background: 'rgba(245,240,232,0.18)' }}>
                  <span
                    key={active ? `${index}-${paused}` : 'idle'}
                    className="block h-full origin-left"
                    style={{
                      background: '#C9A84C',
                      transform: active ? undefined : 'scaleX(0)',
                      animation: active && !reduce && !paused ? `heroProgress ${SLIDE_MS}ms linear forwards` : undefined,
                      ...(active && (reduce || paused) ? { transform: 'scaleX(1)' } : {}),
                    }}
                  />
                </span>
                <span
                  className="hidden sm:block mt-3 text-[11px] tracking-[0.2em] uppercase transition-colors duration-300"
                  style={{ color: active ? '#e4c878' : '#908673', fontFamily: 'var(--font-inter)' }}
                >
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <style>{`@keyframes heroProgress { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
    </section>
  )
}
