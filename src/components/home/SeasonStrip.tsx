import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import OpenConcierge from '@/components/concierge/OpenConcierge'

const ticker = ['Luxury Shortlets', 'Private Car Rental', 'Chauffeur Service', 'Private Guards', 'Boat Cruises', 'Aqua Homes', 'Airport Arrivals']

// Seasonal sales strip for the December rush in Lagos: a slow, quiet ticker
// of what is in demand plus one clear action. Edit SEASON when the season
// changes; the rest of the homepage is evergreen.
const SEASON = {
  eyebrow: 'December in Lagos',
  title: 'The season books out early.',
  body: 'Shortlets, cars, chauffeurs and protection for the festive season are reserved weeks ahead. Tell us your dates and we will hold the best of it for you.',
}

export default function SeasonStrip() {
  // Rendered twice so the marquee loops seamlessly at -50%.
  const items = [...ticker, ...ticker]
  return (
    <section className="relative overflow-hidden" style={{ background: '#f4f0e8', borderTop: '1px solid rgba(20,19,15,0.14)', borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
      <div className="py-5 overflow-hidden" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }} aria-hidden>
        <div className="flex w-max animate-marquee">
          {items.map((t, i) => (
            <span key={i} className="flex items-center gap-8 px-8 text-sm md:text-base whitespace-nowrap" style={{ fontFamily: 'var(--font-playfair)', color: '#5e584c' }}>
              <em style={{ color: i % 2 ? '#5e584c' : '#7a5c24' }}>{t}</em>
              <span className="w-1.5 h-1.5 rotate-45" style={{ background: '#7a5c24' }} />
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-12 py-14 md:py-20 grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-10 md:gap-16 items-center">
        <Reveal>
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            {SEASON.eyebrow}
          </p>
          <h2 className="text-3xl md:text-5xl leading-tight mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            {SEASON.title}
          </h2>
          <p className="text-base leading-relaxed max-w-xl" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            {SEASON.body}
          </p>
        </Reveal>
        <Reveal delay={0.15} className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3">
          <Link
            href="/catalog/shortlets"
            className="sheen inline-flex items-center justify-center gap-3 min-h-[52px] px-8 text-xs tracking-[0.2em] uppercase transition-transform duration-300 active:scale-[0.98]"
            style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
          >
            Reserve Your Dates
          </Link>
          <OpenConcierge
            className="inline-flex items-center justify-center gap-3 min-h-[52px] px-8 text-xs tracking-[0.2em] uppercase transition-colors duration-300 hover:bg-[rgba(122,92,36,0.05)]"
            style={{ border: '1px solid rgba(20,19,15,0.23)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
          >
            <MessageCircle size={15} />
            Ask Lux
          </OpenConcierge>
        </Reveal>
      </div>
    </section>
  )
}
