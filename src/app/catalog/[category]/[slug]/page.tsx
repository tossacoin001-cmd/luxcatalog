import { notFound } from 'next/navigation'
import { listingLd, listingTitle, trimDescription, breadcrumbLd } from '@/lib/seo'
import { pageMeta } from '@/lib/seo-metadata'
import JsonLd from '@/components/JsonLd'
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
import BookingPanel from '@/components/booking/BookingPanel'
import SessionBookingPanel from '@/components/booking/SessionBookingPanel'
import { Suspense } from 'react'
import { naira } from '@/lib/booking'
import { categoryLabels, specLabel, splitHighlights, getAppUrl, categoryHrefs } from '@/lib/utils'
import { findSubcategory } from '@/lib/taxonomy'
import { priceCaption } from '@/lib/listing-views'
import { prisma } from '@/lib/prisma'
import { MapPin, Check, MessageCircle } from 'lucide-react'
import OpenConcierge from '@/components/concierge/OpenConcierge'
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

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const listing = await prisma.listing.findFirst({ where: { slug, published: true } })
  if (!listing) return { title: 'Not Found' }
  const place = listing.location.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 2).join(', ')
  return pageMeta({
    title: listingTitle(listing),
    description: trimDescription(`${listing.description} Available through Lux Catalog${place ? ` in ${place}` : ''}.`, 155),
    path: `${categoryHrefs[listing.category] ?? '/catalog'}/${listing.slug}`,
  })
}

export default async function AssetDetailPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category: categorySlug, slug } = await params
  const categoryKey = categorySlugMap[categorySlug]
  if (!categoryKey) notFound()

  const listing = await prisma.listing.findFirst({
    where: { slug, category: categoryKey as never, published: true },
    include: { bookingSettings: { select: { enabled: true, rate: true, unit: true } } },
  })
  if (!listing) notFound()

  const partner = listing.ownerId
    ? await prisma.partnerProfile.findUnique({ where: { userId: listing.ownerId }, select: { brandName: true, logo: true } })
    : null

  const price = listing.price ? Number(listing.price) : null
  // Private Services show a starting price and the service they offer.
  const caption = priceCaption(listing.category, listing.subcategory, String(listing.mode))
  const service = listing.category === 'private_services' ? findSubcategory('private_services', listing.subcategory) : undefined
  // Listings that take online bookings show the booking panel instead of an asking price.
  const booking = listing.bookingSettings?.enabled ? listing.bookingSettings : null
  const specs = (listing.specs ?? {}) as Record<string, string>
  // Older listings stored highlights as long sentences or one comma list;
  // split those into outline points so every listing reads the same way.
  const highlights = [...new Set(listing.features.flatMap((f) => (f.length > 90 || f.split(',').length >= 3 ? splitHighlights(f) : [f.trim()])).filter(Boolean))]
  const statusVariant =
    listing.status === 'available' ? 'available' : listing.status === 'under_offer' ? 'under_offer' : 'sold'

  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <JsonLd
        data={[
          listingLd(getAppUrl(), { title: listing.title, description: listing.description, slug: listing.slug, category: listing.category, subcategory: listing.subcategory, price: listing.price ? Number(listing.price) : null, images: listing.images, location: listing.location, country: listing.country, status: listing.status, brand: partner?.brandName ?? null }, `${categoryHrefs[listing.category] ?? '/catalog'}/${listing.slug}`),
          breadcrumbLd(getAppUrl(), [{ name: 'Home', path: '/' }, { name: 'Catalog', path: '/catalog' }, { name: categoryLabels[categoryKey], path: `/catalog/${categorySlug}` }, { name: listing.title }]),
        ]}
      />
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
      </ListingGallery>

      {/* Title: beneath the photo so the photo is seen in full. */}
      <header className="max-w-7xl mx-auto px-6 md:px-12 pt-8 md:pt-10">
        <p className="text-xs md:text-sm font-semibold tracking-[0.22em] uppercase mb-3" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
          {service ? service.label : categoryLabels[listing.category]}
        </p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <h1 className="text-[32px] md:text-6xl font-semibold leading-[1.1] tracking-[-0.01em] max-w-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            {listing.title}
          </h1>
          <Badge variant={statusVariant} className="hidden md:inline-flex shrink-0 mb-2">
            {listing.status === 'under_offer' ? 'Under Offer' : listing.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <MapPin size={15} style={{ color: '#7a5c24' }} />
          <span className="text-base font-medium" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
            {listing.location}, {listing.country}
          </span>
        </div>
        <div className="mt-8" style={{ height: 1, background: 'linear-gradient(90deg, rgba(122,92,36,0.14), rgba(122,92,36,0.03))' }} />
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 md:py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left: description, specs, features */}
        <div className="lg:col-span-2 space-y-10">
          {/* Description */}
          <div>
            <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
              {service ? 'About This Service' : 'About This Asset'}
            </h2>
            <p data-listing-description className="text-base leading-relaxed" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
              {listing.description}
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(122,92,36,0.12), transparent)' }} />

          {/* Specs */}
          {Object.keys(specs).length > 0 && (
            <div>
              <h2 className="text-xl mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                Specifications
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(specs).map(([key, val]) => (
                  <div key={key} className="p-4" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
                    <p className="text-[11px] tracking-[0.15em] uppercase mb-1" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                      {specLabel(key)}
                    </p>
                    <p className="text-sm font-medium" style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}>
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
              <h2 className="text-xl mb-5" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                What&apos;s included
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {highlights.map((f) => (
                  <li key={f} className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid #d6cfbf' }}>
                    <span className="mt-0.5 flex items-center justify-center w-5 h-5 shrink-0 rounded-full" style={{ background: 'rgba(122,92,36,0.07)', border: '1px solid rgba(20,19,15,0.17)' }}>
                      <Check size={11} style={{ color: '#7a5c24' }} />
                    </span>
                    <span className="text-sm leading-relaxed" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
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
            style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}
          >
            {booking ? (
              <Suspense fallback={<div className="min-h-[420px]" aria-hidden />}>
                {booking.unit === 'session' ? (
                  <SessionBookingPanel listingId={listing.id} />
                ) : (
                  <BookingPanel listingId={listing.id} listingTitle={listing.title} />
                )}
              </Suspense>
            ) : (
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase mb-2" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                  {caption.label}
                </p>
                <p className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f', fontStyle: !price ? 'italic' : 'normal' }}>
                  <PriceDisplay price={price} priceDisplay={listing.priceDisplay} />
                  {caption.suffix && price ? (
                    <span className="ml-2 text-sm not-italic" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                      {caption.suffix}
                    </span>
                  ) : null}
                </p>
                {service?.key === 'private_chef' && (
                  <p className="mt-1 text-xs" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                    per guest, ingredients included
                  </p>
                )}
              </div>
            )}

            <div style={{ height: 1, background: '#ece6d9' }} />

            <div className="space-y-3">
              <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#5e584c' }}>Category</span>
                <span style={{ color: '#5e584c' }}>{categoryLabels[listing.category]}</span>
              </div>
              {service && (
                <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                  <span style={{ color: '#5e584c' }}>Service</span>
                  <span style={{ color: '#5e584c' }}>{service.label}</span>
                </div>
              )}
              <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#5e584c' }}>Location</span>
                <span style={{ color: '#5e584c' }}>{listing.location}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#5e584c' }}>Status</span>
                <Badge variant={statusVariant}>
                  {listing.status === 'under_offer' ? 'Under Offer' : listing.status}
                </Badge>
              </div>
              {partner && (
                <div className="flex justify-between items-center text-xs" style={{ fontFamily: 'var(--font-inter)' }}>
                  <span style={{ color: '#5e584c' }}>Listed By</span>
                  <span className="flex items-center gap-2" style={{ color: '#5e584c' }}>
                    {partner.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={partner.logo} alt="" className="w-5 h-5 object-cover" style={{ background: '#ece6d9' }} />
                    )}
                    {partner.brandName}
                  </span>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: '#ece6d9' }} />

            {booking ? (
              <div className="text-center space-y-2">
                <p className="text-[11px] leading-relaxed" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                  Questions before you book? Ask Lux and a specialist will help if needed.
                </p>
                <OpenConcierge
                  className="inline-flex items-center justify-center gap-2 min-h-11 px-4 text-xs tracking-[0.14em] uppercase"
                  style={{ border: '1px solid #14130f', color: '#14130f', fontFamily: 'var(--font-inter)' }}
                >
                  <MessageCircle size={14} /> Ask Lux about this
                </OpenConcierge>
              </div>
            ) : listing.category === 'decor' ? (
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
                  style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}
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
        price={booking ? null : price}
        priceDisplay={
          booking
            ? booking.unit === 'session'
              ? `From ${naira(Number(booking.rate))}`
              : `${naira(Number(booking.rate))} / ${booking.unit === 'day' ? 'day' : 'night'}`
            : listing.priceDisplay
        }
        primaryLabel={booking ? 'Book' : listing.category === 'decor' ? 'Buy' : 'Enquire'}
      />
    </div>
  )
}
