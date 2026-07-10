import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import AdminListingForm from '@/components/AdminListingForm'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Edit Listing — Admin' }

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') redirect('/')

  const { id } = await params
  const listing = await prisma.listing.findUnique({ where: { id } })
  if (!listing) notFound()

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/listings" className="text-[10px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
            ← Listings
          </Link>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Edit Listing
          </h1>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-10">
        <AdminListingForm
          listing={{
            id: listing.id,
            title: listing.title,
            category: listing.category,
            description: listing.description,
            priceDisplay: listing.priceDisplay,
            price: listing.price ? String(listing.price) : '',
            location: listing.location,
            country: listing.country,
            images: listing.images,
            features: listing.features.join(', '),
            status: listing.status,
            featured: listing.featured,
            hireAvailable: listing.hireAvailable,
            hireRateDisplay: listing.hireRateDisplay ?? '',
          }}
        />
      </div>
    </div>
  )
}
