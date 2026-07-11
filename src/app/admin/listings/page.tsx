import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import AdminListingsTable from '@/components/AdminListingsTable'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Manage Listings | Admin' }

export default async function AdminListingsPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') redirect('/')

  const listings = await prisma.listing.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, category: true, priceDisplay: true, status: true, featured: true },
  })

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          <div>
            <Link href="/admin" className="text-[10px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              ← Admin
            </Link>
            <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              All Listings
            </h1>
          </div>
          <Link
            href="/admin/listings/new"
            className="inline-flex items-center px-7 py-3 text-xs tracking-[0.18em] uppercase"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            + Add Listing
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        <AdminListingsTable listings={listings} />
      </div>
    </div>
  )
}
