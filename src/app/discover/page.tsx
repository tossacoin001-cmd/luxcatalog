import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AIDiscoverClient from './AIDiscoverClient'

export const metadata: Metadata = {
  title: 'AI Discovery',
  description: 'Let our AI matching engine find the perfect luxury assets for your unique lifestyle and preferences.',
}

export default function DiscoverPage() {
  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      {/* Header */}
      <div className="pt-32 pb-10 px-6 md:px-12 text-center" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            AI-Powered Matching
          </p>
          <h1 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Discover Your Perfect Asset
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Answer a few questions about your preferences and our AI will curate personalised recommendations from across our global catalog.
          </p>
        </div>
      </div>

      <AIDiscoverClient />

      <Footer />
    </div>
  )
}
