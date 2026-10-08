import { notFound } from 'next/navigation'
import ListingGallery from '@/components/ListingGallery'
import ListingActionBar from '@/components/ListingActionBar'
import Breadcrumbs from '@/components/Breadcrumbs'
import ViewTracker from '@/components/ViewTracker'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { Badge } from '@/components/ui/badge'
import InquiryModal from '@/components/InquiryModal'
import AddToCartPanel from '@/components/AddToCartPanel'
import PriceDisplay from '@/components/PriceDisplay'
import { categoryLabels, specLabel, splitHighlights } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { MapPin, Check } from 'lucide-react'
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

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const listing = await prisma.listing.findFirst({ where: { slug, published: true } })
  if (!listing) return { title: 'Not Found' }
  return {
    title: listing.title,
    description: listing.description.slice(0, 160),
  }
}

export default async function AssetDetailPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category: categorySlug, slug } = await params
  const categoryKey = categorySlugMap[categorySlug]
  if (!categoryKey) notFound()

  const listing = await prisma.listing.findFirst({ where: { slug, category: categoryKey as never, published: true } })
  if (!listing) notFound()

  const partner = listing.ownerId
    ? await prisma.partnerProfile.findUnique({ where: { userId: listing.ownerId }, select: { brandName: true, logo: true } })
    : null

  const price = listing.price ? Number(listing.price) : null
  const specs = (listing.specs ?? {}) as Record<string, string>
  // Older listings stored highlights as long sentences or one comma list;
  // split those into outline points so every listing reads the same way.
  const highlights = [...new Set(listing.features.flatMap((f) => (f.length > 90 || f.split(',').length >= 3 ? splitHighlights(f) : [f.trim()])).filter(Boolean))]
  const statusVariant =
    listing.status === 'available' ? 'available' : listing.status === 'under_offer' ? 'under_offer' : 'sold'

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <ViewTracker listingId={listing.id} />

      {/* Hero gallery */}
      <ListingGallery images={listing.images} title={listing.title}>
        {/* Way back, top-left over the photo (the fullscreen button sits top-right). */}
        <div className="absolute inset-x-0 top-24 z-10">
          <div className="max-w-7xl mx-auto pl-5 pr-32 md:pl-12 md:pr-44">
            <Breadcrumbs
              overlay
              trail={[
                { label: 'Home', href: '/' },
                { label: 'Catalog', href: '/catalog' },
                { label: categoryLabels[listing.category], href: `/catalog/${categorySlug}` },
                { label: listing.title },
              ]}
            />
          </div>
        </div>
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-6 md:px-12 pb-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.25em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                {categoryLabels[listing.category]}
              </p>
              <h1 className="text-3xl md:text-5xl leading-tight" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                {listing.title}
              </h1>
              <div className="flex items-center gap-2 mt-3">
                <MapPin size={13} style={{ color: '#9a8f7a' }} />
                <span className="text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                  {listing.location}, {listing.country}
                </span>
              </div>
            </div>
            <Badge variant={statusVariant} className="hidden md:inline-flex">
              {listing.status === 'under_offer' ? 'Under Offer' : listing.status}
            </Badge>
          </div>
        </div>
      </ListingGallery>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: description, specs, features */}
        <div className="lg:col-span-2 space-y-10">
          {/* Description */}
          <div>
            <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              About This Asset
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              {listing.description}
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.2), transparent)' }} />

          {/* Specs */}
          {Object.keys(specs).length > 0 && (
            <div>
              <h2 className="text-xl mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                Specifications
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(specs).map(([key, val]) => (
                  <div key={key} className="p-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
                    <p className="text-[11px] tracking-[0.15em] uppercase mb-1" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                      {specLabel(key)}
                    </p>
                    <p className="text-sm font-medium" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                      {val}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlights: an outline, never a paragraph */}
          {highlights.length > 0 && (
            <div>
              <h2 className="text-xl mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                What&apos;s included
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {highlights.map((f) => (
                  <li key={f} className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid #1e2e1f' }}>
                    <span className="mt-0.5 flex items-center justify-center w-5 h-5 shrink-0 rounded-full" style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)' }}>
                      <Check size={11} style={{ color: '#C9A84C' }} />
                    </span>
                    <span className="text-sm leading-relaxed" style={{ color: '#d6cdbd', fontFamily: 'var(--font-inter)' }}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: inquiry panel */}
        <div className="lg:col-span-1" id="enquire" style={{ scrollMarginTop: '6rem' }}>
          <div
            className="sticky top-24 p-7 space-y-6"
            style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}
          >
            <div>
              <p className="text-[11px] tracking-[0.2em] uppercase mb-2" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                Asking Price
              </p>
              <p className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-playfair)', color: '#C9A84C', fontStyle: !price ? 'italic' : 'normal' }}>
                <PriceDisplay price={price} priceDisplay={listing.priceDisplay} />
              </p>
            </div>

            <div style={{ height: 1, background: '#1e2e1f' }} />

            <div className="space-y-3">
              <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#908673' }}>Category</span>
                <span style={{ color: '#9a8f7a' }}>{categoryLabels[listing.category]}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#908673' }}>Location</span>
                <span style={{ color: '#9a8f7a' }}>{listing.location}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#908673' }}>Status</span>
                <Badge variant={statusVariant}>
                  {listing.status === 'under_offer' ? 'Under Offer' : listing.status}
                </Badge>
              </div>
              {partner && (
                <div className="flex justify-between items-center text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                  <span style={{ color: '#908673' }}>Listed By</span>
                  <span className="flex items-center gap-2" style={{ color: '#9a8f7a' }}>
                    {partner.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={partner.logo} alt="" className="w-5 h-5 object-cover" style={{ background: '#162318' }} />
                    )}
                    {partner.brandName}
                  </span>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: '#1e2e1f' }} />

            {listing.category === 'decor' ? (
              <AddToCartPanel
                listingId={listing.id}
                title={listing.title}
                priceNgn={price}
                image={listing.images[0] ?? null}
              />
            ) : (
              <>
                <InquiryModal
                  listingId={listing.id}
                  listingTitle={listing.title}
                  listingPrice={price}
                />

                <p
                  className="text-[11px] leading-relaxed text-center"
                  style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}
                >
                  Your enquiry is handled with complete discretion. A specialist will respond within 24 hours.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
      <ListingActionBar
        title={listing.title}
        price={price}
        priceDisplay={listing.priceDisplay}
        primaryLabel={listing.category === 'decor' ? 'Buy' : 'Reserve'}
      />
    </div>
  )
}
