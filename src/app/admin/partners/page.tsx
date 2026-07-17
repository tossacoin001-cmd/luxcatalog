import Link from 'next/link'
import AdminNavbar from '@/components/AdminNavbar'
import PartnerAdminTable from '@/components/PartnerAdminTable'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Partners | Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminPartnersPage() {
  await requireAdmin()

  const profiles = await prisma.partnerProfile.findMany({ orderBy: { createdAt: 'desc' } })
  const counts = await prisma.listing.groupBy({
    by: ['ownerId'],
    where: { ownerId: { in: profiles.map((p) => p.userId) } },
    _count: { id: true },
  })
  const countByOwner = Object.fromEntries(counts.map((c) => [c.ownerId, c._count.id]))

  const rows = profiles.map((p) => ({
    userId: p.userId,
    brandName: p.brandName,
    logo: p.logo,
    bio: p.bio,
    featured: p.featured,
    listingCount: countByOwner[p.userId] ?? 0,
  }))

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role="org:admin" />

      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <Link href="/admin" className="text-[10px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
            ← Admin
          </Link>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Partners
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Feature trusted partners to show their logo on the homepage.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-10">
        <PartnerAdminTable partners={rows} />
      </div>
    </div>
  )
}
