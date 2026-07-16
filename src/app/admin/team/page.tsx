import Link from 'next/link'
import AdminNavbar from '@/components/AdminNavbar'
import AdminTeamManager from '@/components/AdminTeamManager'
import { clerkClient } from '@clerk/nextjs/server'
import { requireAdmin, LUX_CATALOG_ORG_ID } from '@/lib/admin-auth'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Team | Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminTeamPage() {
  const userId = await requireAdmin()

  const clerk = await clerkClient()
  const [members, invitations] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({ organizationId: LUX_CATALOG_ORG_ID }),
    clerk.organizations.getOrganizationInvitationList({ organizationId: LUX_CATALOG_ORG_ID, status: ['pending'] }),
  ])

  const plainMembers = members.data.map((m) => ({
    id: m.id,
    userId: m.publicUserData?.userId,
    name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ') || null,
    email: m.publicUserData?.identifier,
    role: m.role,
  }))
  const plainInvitations = invitations.data.map((i) => ({
    id: i.id,
    email: i.emailAddress,
    role: i.role,
    status: i.status ?? 'pending',
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
            Team &amp; Access
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Invite teammates and partners to manage listings and enquiries alongside you.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-10">
        <AdminTeamManager members={plainMembers} invitations={plainInvitations} currentUserId={userId} />
      </div>
    </div>
  )
}
