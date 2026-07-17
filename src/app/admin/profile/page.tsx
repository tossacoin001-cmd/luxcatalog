import AdminNavbar from '@/components/AdminNavbar'
import PartnerProfileForm from '@/components/PartnerProfileForm'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/admin-auth'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Profile | Admin' }
export const dynamic = 'force-dynamic'

export default async function PartnerProfilePage() {
  const { userId, role } = await requireStaff()

  const profile = await prisma.partnerProfile.findUnique({ where: { userId } })

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role={role} />

      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            My Profile
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            This is how you appear on listings once they&rsquo;re approved and live.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-10">
        <PartnerProfileForm
          profile={profile ? { brandName: profile.brandName, logo: profile.logo, bio: profile.bio ?? '' } : undefined}
        />
      </div>
    </div>
  )
}
