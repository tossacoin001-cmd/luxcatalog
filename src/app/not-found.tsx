import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { whatsappLink } from '@/lib/contact'

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
    <div style={{ background: '#080c08', minHeight: '100dvh' }}>
      <Navbar />
      <main className="relative flex flex-col items-center justify-center text-center px-6 pt-40 pb-28 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 50% 45% at 50% 40%, rgba(201,168,76,0.07) 0%, transparent 70%)' }}
        />
        <p className="relative text-xs tracking-[0.35em] uppercase mb-6" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          Error 404
        </p>
        <h1 className="relative text-4xl md:text-6xl leading-tight mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          This address is <em style={{ color: '#C9A84C' }}>off the map</em>
        </h1>
        <p className="relative max-w-md text-base leading-relaxed mb-10" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
          The page you are looking for has moved or no longer exists. Our concierge can find exactly what you need.
        </p>
        <div className="relative flex flex-col sm:flex-row gap-4 mb-14">
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase transition-opacity hover:opacity-90"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Browse the Catalog
          </Link>
          <a
            href={whatsappLink("Hello, I'm looking for something on Lux Catalog.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase transition-colors hover:bg-[rgba(201,168,76,0.08)]"
            style={{ border: '1px solid rgba(201,168,76,0.5)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            Ask the Concierge
          </a>
        </div>
        <nav aria-label="Popular collections" className="relative flex flex-wrap justify-center gap-3">
          {suggestions.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="inline-flex items-center min-h-11 px-4 text-xs tracking-[0.12em] uppercase transition-colors hover:text-lux-gold hover:border-lux-gold-muted"
              style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
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
