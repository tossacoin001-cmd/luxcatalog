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

  const [members, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['admin', 'partner'] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.staffInvitation.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const plainMembers = members.map((m) => ({ id: m.id, userId: m.id, name: m.name, email: m.email, role: m.role }))
  const plainInvitations = invitations.map((i) => ({ ...i, status: 'pending' }))

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role="admin" />

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
