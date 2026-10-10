import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import AdminNavbar from '@/components/AdminNavbar'
import BookingManager from '@/components/booking/BookingManager'
import { requireListings } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { categoryHrefs } from '@/lib/utils'
import { partnerMustSign } from '@/lib/agreements-server'

export const metadata: Metadata = { title: 'Booking & Calendar | Admin' }
export const dynamic = 'force-dynamic'

export default async function ListingBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, role } = await requireListings()
  const { id } = await params
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, category: true, ownerId: true, published: true, mode: true },
  })
  if (!listing) notFound()
  if (role === 'partner' && listing.ownerId !== userId) redirect('/admin/listings')
  if (role === 'partner' && (await partnerMustSign(userId))) redirect('/partners/agreement')

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role={role} />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/listings" className="text-[11px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
            ← Listings
          </Link>
          <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Booking &amp; calendar
          </p>
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {listing.title}
          </h1>
          {listing.published && (
            <Link
              href={`${categoryHrefs[listing.category] ?? '/catalog'}/${listing.slug}#enquire`}
              target="_blank"
              className="inline-block mt-2 text-xs underline underline-offset-2"
              style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
            >
              View as a guest
            </Link>
          )}
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-5 md:px-12 py-10">
        <BookingManager listingId={listing.id} published={listing.published} />
      </div>
    </div>
  )
}
