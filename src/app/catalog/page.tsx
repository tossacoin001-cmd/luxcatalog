import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CatalogClient from './CatalogClient'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Catalog',
  description: 'Browse the full Lux Catalog: prime real estate, supercars, yachts, decor, commercial properties and lifestyle assets.',
}

export const dynamic = 'force-dynamic'

export default async function CatalogPage() {
  const listings = await prisma.listing.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, slug: true, category: true, location: true, country: true,
      priceDisplay: true, price: true, images: true, status: true, featured: true,
    },
  })

  const plainListings = listings.map((l) => ({ ...l, price: l.price ? Number(l.price) : null }))

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      {/* Page header */}
      <div
        className="pt-32 pb-12 px-6 md:px-12"
        style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}
      >
        <div className="max-w-7xl mx-auto">
          <p
            className="text-xs tracking-[0.3em] uppercase mb-4"
            style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            Full Collection
          </p>
          <h1
            className="text-4xl md:text-5xl"
            style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}
          >
            Luxury Asset Catalog
          </h1>
        </div>
      </div>

      <Suspense fallback={<div className="p-12 text-center text-lux-text-muted">Loading catalog…</div>}>
        <CatalogClient listings={plainListings} />
      </Suspense>

      <Footer />
    </div>
  )
}
