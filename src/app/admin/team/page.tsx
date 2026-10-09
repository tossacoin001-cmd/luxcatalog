import Link from 'next/link'
import AdminNavbar from '@/components/AdminNavbar'
import AdminTeamManager from '@/components/AdminTeamManager'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Team | Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminTeamPage() {
  const userId = await requireAdmin()

  const [members, invitations, invitedPartners] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['admin', 'team'] } },
      select: { id: true, name: true, email: true, role: true, permissions: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.staffInvitation.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, permissions: true },
      orderBy: { createdAt: 'desc' },
    }),
    // Partner accounts that never applied: people invited through the old
    // team invite, which only offered "partner". Usually staff, not brands.
    prisma.user.findMany({ where: { role: 'partner' }, select: { id: true, name: true, email: true } }),
  ])
  const applied = new Set(
    (await prisma.partnerApplication.findMany({ where: { userId: { in: invitedPartners.map((p) => p.id) } }, select: { userId: true } })).map((a) => a.userId)
  )

  const plainMembers = members.map((m) => ({ id: m.id, userId: m.id, name: m.name, email: m.email, role: m.role, permissions: m.permissions }))
  const plainInvitations = invitations.map((i) => ({ ...i, status: 'pending' }))
  const plainInvitedPartners = invitedPartners.filter((p) => !applied.has(p.id))

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role="admin" />

      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <Link href="/admin" className="text-[11px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
            ← Admin
          </Link>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Team &amp; Access
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Invite your team and choose exactly what each person can access. Brand partners join through the partner application instead.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-10">
        <AdminTeamManager members={plainMembers} invitations={plainInvitations} invitedPartners={plainInvitedPartners} currentUserId={userId} />
      </div>
    </div>
  )
}
