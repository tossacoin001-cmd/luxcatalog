import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AssetCard from '@/components/AssetCard'
import { categoryHrefs } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Saved Assets' }
export const dynamic = 'force-dynamic'

export default async function SavedPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const savedListings = await prisma.savedListing.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: {
        select: {
          id: true, title: true, slug: true, category: true, location: true, country: true,
          priceDisplay: true, price: true, images: true, status: true, featured: true,
        },
      },
    },
  })
  const saved = savedListings
    .filter((s) => s.listing)
    .map((s) => ({ ...s.listing, price: s.listing!.price ? Number(s.listing!.price) : null }))

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-12 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Your Collection
          </p>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Saved Assets
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        {saved.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-4xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Your collection is empty
            </p>
            <p className="text-sm mb-8" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              Browse the catalog and save assets that capture your attention.
            </p>
            <Link
              href="/catalog"
              className="inline-flex items-center px-8 py-4 text-xs tracking-[0.2em] uppercase"
              style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
            >
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {saved.map((asset) => (
              <AssetCard
                key={asset!.id}
                asset={asset!}
                href={`${categoryHrefs[asset!.category] ?? '/catalog'}/${asset!.slug}`}
                saved
              />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
