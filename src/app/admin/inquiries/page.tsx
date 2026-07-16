import Link from 'next/link'
import AdminNavbar from '@/components/AdminNavbar'
import AdminInquiriesTable from '@/components/AdminInquiriesTable'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Enquiries | Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminInquiriesPage() {
  await requireAdmin()

  const inquiries = await prisma.inquiry.findMany({
    orderBy: { createdAt: 'desc' },
    include: { listing: { select: { title: true, category: true } } },
  })

  const plainInquiries = inquiries.map((i) => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    checkIn: i.checkIn ? i.checkIn.toISOString() : null,
    checkOut: i.checkOut ? i.checkOut.toISOString() : null,
  }))

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role="org:admin" />

      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-5xl mx-auto">
          <Link href="/admin" className="text-[10px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
            ← Admin
          </Link>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Enquiries
          </h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-8">
        <AdminInquiriesTable inquiries={plainInquiries} />
      </div>
    </div>
  )
}
