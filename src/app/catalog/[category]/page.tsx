import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AssetCard from '@/components/AssetCard'
import { categoryLabels } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

const categorySlugMap: Record<string, string> = {
  'real-estate':          'real_estate',
  'supercars':            'supercar',
  'yachts':               'yacht',
  'decor':                'decor',
  'commercial':           'commercial',
  'lifestyle':            'lifestyle',
  'shortlets':            'shortlet',
  'executive-services':   'executive_services',
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params
  const key = categorySlugMap[category]
  if (!key) return { title: 'Not Found' }
  return { title: categoryLabels[key], description: `Browse luxury ${categoryLabels[key]?.toLowerCase()} on Lux Catalog.` }
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlug } = await params
  const categoryKey = categorySlugMap[categorySlug]
  if (!categoryKey) notFound()

  const listings = await prisma.listing.findMany({
    where: { category: categoryKey as never, published: true },
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

      <div className="pt-32 pb-12 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Asset Category
          </p>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {categoryLabels[categoryKey]}
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            {plainListings.length} asset{plainListings.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        {plainListings.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-lg mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              No {categoryLabels[categoryKey]?.toLowerCase()} listed yet
            </p>
            <p className="text-sm" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Check back soon, or get in touch for early access.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {plainListings.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                href={`/catalog/${categorySlug}/${asset.slug}`}
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
