import Link from 'next/link'
import AdminNavbar from '@/components/AdminNavbar'
import PartnerProfileForm from '@/components/PartnerProfileForm'
import { prisma } from '@/lib/prisma'
import { requireStaff } from '@/lib/admin-auth'
import { AREAS } from '@/lib/access'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Profile' }
export const dynamic = 'force-dynamic'

const gold = { color: '#C9A84C', fontFamily: 'var(--font-inter)' }
const muted = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const ACTION_WORDS: Record<string, string> = {
  'listing.create': 'Submitted a listing',
  'listing.edit': 'Edited a listing',
  'listing.publish': 'Approved a listing',
  'listing.unpublish': 'Took a listing offline',
  'listing.delete': 'Deleted a listing',
}

// Partners keep their brand profile; team members and admins get their own:
// who they are here, what they can do, how they are secured, what they did.
export default async function ProfilePage() {
  const { userId, role, areas } = await requireStaff()

  if (role === 'partner') {
    const profile = await prisma.partnerProfile.findUnique({ where: { userId } })
    return (
      <div style={{ background: '#080c08', minHeight: '100vh' }}>
        <AdminNavbar role={role} />
        <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>My Profile</h1>
            <p className="mt-2 text-sm" style={muted}>This is how you appear on listings once they&rsquo;re approved and live.</p>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-6 md:px-12 py-10">
          <PartnerProfileForm profile={profile ? { brandName: profile.brandName, logo: profile.logo, bio: profile.bio ?? '' } : undefined} />
        </div>
      </div>
    )
  }

  const [user, activity] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, createdAt: true, twoFactorEnabled: true } }),
    prisma.auditLog.findMany({ where: { actorId: userId, action: { startsWith: 'listing.' } }, orderBy: { createdAt: 'desc' }, take: 8, select: { action: true, createdAt: true, detail: true } }),
  ])
  const mine = AREAS.filter((a) => areas.includes(a.key))

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role={role} />
      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={gold}>{role === 'team' ? 'Lux Catalog team' : 'Administration'}</p>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>{user?.name ?? 'My Profile'}</h1>
          <p className="mt-2 text-sm" style={muted}>{user?.email}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-10 space-y-10">
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase mb-4" style={gold}>What you can do</h2>
          {role === 'admin' ? (
            <p className="text-sm" style={muted}>Everything, including approving listings and managing the team.</p>
          ) : mine.length ? (
            <ul className="space-y-3">
              {mine.map((a) => (
                <li key={a.key} className="p-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
                  <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>{a.label}</p>
                  <p className="text-xs mt-1" style={muted}>{a.key === 'listings' ? 'Add and edit listings. Everything you submit goes to an admin for approval before customers see it.' : a.help}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm" style={muted}>An admin will give you access to the areas you work on.</p>
          )}
        </section>

        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase mb-4" style={gold}>Security</h2>
          <div className="p-4 flex flex-wrap items-center justify-between gap-3" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
            <p className="text-sm" style={{ color: user?.twoFactorEnabled ? '#7fb98a' : '#e8b4b4', fontFamily: 'var(--font-inter)' }}>
              {user?.twoFactorEnabled ? 'Two-step verification is on.' : 'Two-step verification is off. Staff access needs it.'}
            </p>
            <Link href="/account" className="text-xs tracking-wider underline" style={gold}>Account &amp; Security</Link>
          </div>
        </section>

        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase mb-4" style={gold}>Your recent activity</h2>
          {activity.length ? (
            <ul className="space-y-2">
              {activity.map((a, i) => {
                const title = (a.detail as { title?: string } | null)?.title
                return (
                  <li key={i} className="flex flex-wrap justify-between gap-2 text-sm py-2" style={{ borderBottom: '1px solid #1e2e1f', fontFamily: 'var(--font-inter)' }}>
                    <span style={{ color: '#d8cfbc' }}>{ACTION_WORDS[a.action] ?? a.action}{title ? `: ${title}` : ''}</span>
                    <span style={muted}>{a.createdAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm" style={muted}>Nothing yet. What you do on listings is recorded here and in the admin audit trail.</p>
          )}
        </section>
      </div>
    </div>
  )
}
