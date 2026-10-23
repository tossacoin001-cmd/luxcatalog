import { notFound } from 'next/navigation'
import { categoryTitle, categoryDescription, breadcrumbLd } from '@/lib/seo'
import { pageMeta } from '@/lib/seo-metadata'
import JsonLd from '@/components/JsonLd'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ServicesCatalog from '@/components/services/ServicesCatalog'
import CategoryViewsFromAddress, { CategoryViews } from '@/components/CategoryViews'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/Breadcrumbs'
import { categoryLabels, getAppUrl } from '@/lib/utils'
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
  'private-services':     'private_services',
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
  return pageMeta({ title: categoryTitle(key), description: categoryDescription(key), path: `/catalog/${category}` })
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlug } = await params
  const categoryKey = categorySlugMap[categorySlug]
  if (!categoryKey) notFound()

  const listings = await prisma.listing.findMany({
    where: { category: categoryKey as never, published: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, slug: true, category: true, subcategory: true, location: true, country: true,
      priceDisplay: true, price: true, images: true, status: true, featured: true, mode: true,
    },
  })
  const isServices = categoryKey === 'private_services'
  const plainListings = listings.map((l) => ({ ...l, price: l.price ? Number(l.price) : null }))
  const viewProps = { category: categoryKey, categorySlug, categoryLabel: categoryLabels[categoryKey], listings: plainListings.map((l) => ({ ...l, mode: String(l.mode) })) }

  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <JsonLd data={breadcrumbLd(getAppUrl(), [{ name: 'Home', path: '/' }, { name: 'Catalog', path: '/catalog' }, { name: isServices ? 'Services' : categoryLabels[categoryKey], path: `/catalog/${categorySlug}` }])} />
      <Navbar />

      <div className="pt-28 md:pt-32 pb-12 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Breadcrumbs trail={[{ label: 'Home', href: '/' }, { label: 'Catalog', href: '/catalog' }, { label: isServices ? 'Services' : categoryLabels[categoryKey] }]} />
          </div>
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            {isServices ? 'Brought to you' : 'Asset Category'}
          </p>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            {isServices ? 'Services' : categoryLabels[categoryKey]}
          </h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            {isServices
              ? 'Vetted chefs, therapists, stylists and more, who come to your home or your stay. Every professional is identity- and police-checked.'
              : `${plainListings.length} asset${plainListings.length !== 1 ? 's' : ''} available`}
          </p>
        </div>
      </div>

      {isServices ? (
        <ServicesCatalog listings={plainListings} />
      ) : (
        <Suspense fallback={<CategoryViews {...viewProps} view={null} />}>
          <CategoryViewsFromAddress {...viewProps} />
        </Suspense>
      )}

      <Footer />
    </div>
  )
}
