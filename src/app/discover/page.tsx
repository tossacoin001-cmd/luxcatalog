import type { Metadata } from 'next'
import { pageMeta } from '@/lib/seo-metadata'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AIDiscoverClient from './AIDiscoverClient'

export const metadata: Metadata = pageMeta({
  title: 'Find Luxury Homes, Stays, Cars and Services in Lagos',
  description: 'Tell us what you are looking for. We ask only what matters, then show what is available for your dates, with a way straight into booking.',
  path: '/discover',
})

export default function DiscoverPage() {
  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <Navbar />

      {/* Header */}
      <div className="pt-32 pb-10 px-6 md:px-12 text-center" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            Concierge Discovery
          </p>
          <h1 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            Find exactly what you want
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            Choose what interests you. We ask only what matters for each, then show what is available for your dates, with a way straight into booking.
          </p>
        </div>
      </div>

      <AIDiscoverClient />

      <Footer />
    </div>
  )
}
