import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import { whatsappLink } from '@/lib/contact'

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
    <section className="relative overflow-hidden" style={{ background: '#0b120b', borderTop: '1px solid rgba(201,168,76,0.12)', borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
      <div className="py-5 overflow-hidden" style={{ borderBottom: '1px solid rgba(201,168,76,0.08)' }} aria-hidden>
        <div className="flex w-max animate-marquee">
          {items.map((t, i) => (
            <span key={i} className="flex items-center gap-8 px-8 text-sm md:text-base whitespace-nowrap" style={{ fontFamily: 'var(--font-playfair)', color: '#9a8f7a' }}>
              <em style={{ color: i % 2 ? '#9a8f7a' : '#e4c878' }}>{t}</em>
              <span className="w-1.5 h-1.5 rotate-45" style={{ background: '#8a6f2e' }} />
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-12 py-14 md:py-20 grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-10 md:gap-16 items-center">
        <Reveal>
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            {SEASON.eyebrow}
          </p>
          <h2 className="text-3xl md:text-5xl leading-tight mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {SEASON.title}
          </h2>
          <p className="text-base leading-relaxed max-w-xl" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            {SEASON.body}
          </p>
        </Reveal>
        <Reveal delay={0.15} className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3">
          <a
            href={whatsappLink("Hello, I'd like to reserve for the festive season. My dates are: ")}
            target="_blank"
            rel="noopener noreferrer"
            className="sheen inline-flex items-center justify-center gap-3 min-h-[52px] px-8 text-xs tracking-[0.2em] uppercase transition-transform duration-300 active:scale-[0.98]"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            <MessageCircle size={15} />
            Reserve Your Dates
          </a>
          <Link
            href="/catalog/shortlets"
            className="inline-flex items-center justify-center min-h-[52px] px-8 text-xs tracking-[0.2em] uppercase transition-colors duration-300 hover:bg-[rgba(201,168,76,0.08)]"
            style={{ border: '1px solid rgba(201,168,76,0.45)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            View Shortlets
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
