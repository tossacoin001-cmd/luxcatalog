import { redirect } from 'next/navigation'
import AdminNavbar from '@/components/AdminNavbar'
import Link from 'next/link'
import AdminListingForm from '@/components/AdminListingForm'
import QuickListingForm from '@/components/QuickListingForm'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/admin-auth'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Add Listing | Admin' }
export const dynamic = 'force-dynamic'

export default async function NewListingPage() {
  const { userId, role } = await requireStaff()
  const isVendor = role === 'org:vendor'

  if (isVendor) {
    const profile = await prisma.partnerProfile.findUnique({ where: { userId } })
    if (!profile) redirect('/admin/profile')
  }

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role={role} />
      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/listings" className="text-[10px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
            ← Listings
          </Link>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {isVendor ? 'List a Product' : 'Add New Listing'}
          </h1>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-10">
        {isVendor ? <QuickListingForm /> : <AdminListingForm />}
      </div>
    </div>
  )
}
