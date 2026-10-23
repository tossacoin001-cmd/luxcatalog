import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import RequestButton from '@/components/concierge/RequestButton'

export const metadata: Metadata = { title: 'Page Not Found' }

const suggestions = [
  { label: 'Prime Real Estate', href: '/catalog/real-estate' },
  { label: 'Luxury Shortlets', href: '/catalog/shortlets' },
  { label: 'Supercars', href: '/catalog/supercars' },
  { label: 'Superyachts', href: '/catalog/yachts' },
  { label: 'Chauffeur & Guards', href: '/catalog/executive-services' },
]

export default function NotFound() {
  return (
    <div style={{ background: '#f4f0e8', minHeight: '100dvh' }}>
      <Navbar />
      <main className="relative flex flex-col items-center justify-center text-center px-6 pt-40 pb-28 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 50% 45% at 50% 40%, rgba(122,92,36,0.04) 0%, transparent 70%)' }}
        />
        <p className="relative text-xs tracking-[0.35em] uppercase mb-6" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
          Error 404
        </p>
        <h1 className="relative text-4xl md:text-6xl leading-tight mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
          This address is <em style={{ color: '#7a5c24' }}>off the map</em>
        </h1>
        <p className="relative max-w-md text-base leading-relaxed mb-10" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
          The page you are looking for has moved or no longer exists. Our concierge can find exactly what you need.
        </p>
        <div className="relative flex flex-col sm:flex-row gap-4 mb-14">
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase transition-opacity hover:opacity-90"
            style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
          >
            Browse the Catalog
          </Link>
          <RequestButton
            topic="Something I could not find on the site"
            label="Tell us what you were looking for"
            className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase transition-colors hover:bg-[rgba(122,92,36,0.05)]"
            style={{ border: '1px solid rgba(20,19,15,0.25)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
          >
            Ask the Concierge
          </RequestButton>
        </div>
        <nav aria-label="Popular collections" className="relative flex flex-wrap justify-center gap-3">
          {suggestions.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="inline-flex items-center min-h-11 px-4 text-xs tracking-[0.12em] uppercase transition-colors hover:text-lux-gold hover:border-lux-gold-muted"
              style={{ border: '1px solid #d6cfbf', color: '#5e584c', fontFamily: 'var(--font-inter)' }}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </main>
      <Footer />
    </div>
  )
}
