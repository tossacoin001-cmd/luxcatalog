import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import AssetCard from '@/components/AssetCard'
import Breadcrumbs from '@/components/Breadcrumbs'
import { whatsappLink } from '@/lib/contact'
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

// Cached at the edge and refreshed every 5 minutes, or immediately when an
// admin or partner changes a listing (revalidateCatalog). Visitors get an
// instant page and the database isn't woken for every view.
export const revalidate = 300

// No pages are pre-built at deploy; each is rendered on its first visit and
// then served from the cache like the rest.
export async function generateStaticParams() {
  return []
}

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

      <div className="pt-28 md:pt-32 pb-12 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Breadcrumbs trail={[{ label: 'Home', href: '/' }, { label: 'Catalog', href: '/catalog' }, { label: categoryLabels[categoryKey] }]} />
          </div>
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

      <div className="max-w-7xl mx-auto px-5 md:px-12 py-12">
        {plainListings.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-lg mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              No {categoryLabels[categoryKey]?.toLowerCase()} listed yet
            </p>
            <p className="text-sm mb-8" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
              New pieces arrive privately before they are listed. Ask the concierge, or explore the rest of the catalog.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={whatsappLink(`Hello, I'm looking for ${categoryLabels[categoryKey]?.toLowerCase()} on Lux Catalog.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase"
                style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
              >
                Ask the Concierge
              </a>
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase transition-colors hover:bg-[rgba(201,168,76,0.08)]"
                style={{ border: '1px solid rgba(201,168,76,0.45)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
              >
                Browse All Collections
              </Link>
            </div>
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
