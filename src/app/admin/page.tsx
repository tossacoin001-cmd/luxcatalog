import Link from 'next/link'
import AdminNavbar from '@/components/AdminNavbar'
import AdminEmailTools from '@/components/AdminEmailTools'
import { prisma } from '@/lib/prisma'
import { requireStaff, currentStaff } from '@/lib/admin-auth'
import type { Area } from '@/lib/access'
import { partnerMustSign } from '@/lib/agreements-server'
import { ownerEmailFromEnv } from '@/lib/owner'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const staff = await currentStaff()
  return { title: staff?.role === 'team' ? 'Team Desk' : staff?.role === 'partner' ? 'Partner Dashboard' : 'Admin' }
}
export const dynamic = 'force-dynamic'

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { userId, role, areas } = await requireStaff()
  const { denied } = await searchParams
  const isVendor = role === 'partner'

  // Partners sign the current agreement before using the dashboard.
  if (isVendor && (await partnerMustSign(userId))) redirect('/partners/agreement')

  if (isVendor) {
    const [myListings, live, pendingReview, itemsSold, enquiries] = await Promise.all([
      prisma.listing.count({ where: { ownerId: userId } }),
      prisma.listing.count({ where: { ownerId: userId, published: true } }),
      prisma.listing.count({ where: { ownerId: userId, published: false } }),
      prisma.orderItem.count({ where: { listing: { ownerId: userId }, order: { status: { in: ['paid', 'fulfilled'] } } } }),
      prisma.inquiry.count({ where: { listing: { ownerId: userId } } }),
    ])

    const statCards = [
      { label: 'My Listings', value: String(myListings), href: '/admin/listings' },
      { label: 'Live', value: String(live), href: '/admin/listings' },
      { label: 'Pending Review', value: String(pendingReview), href: '/admin/listings' },
      { label: 'Items Sold', value: String(itemsSold), href: '/admin/listings' },
      { label: 'Enquiries Received', value: String(enquiries), href: '/admin/listings' },
    ]

    return (
      <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
        <AdminNavbar role={role} />

        <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
          <div className="max-w-7xl mx-auto flex items-end justify-between">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                Partner Dashboard
              </p>
              <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                Welcome Back
              </h1>
            </div>
            <Link
              href="/admin/listings/new"
              className="hidden md:inline-flex items-center px-7 py-3 text-xs tracking-[0.18em] uppercase"
              style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
            >
              + Add Listing
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-10">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            {statCards.map((s) => (
              <Link key={s.label} href={s.href} className="p-6 lux-card block group">
                <p className="text-3xl mb-1 group-hover:text-lux-gold transition-colors" style={{ fontFamily: 'var(--font-playfair)', color: '#7a5c24' }}>
                  {s.value}
                </p>
                <p className="text-[11px] tracking-[0.15em] uppercase" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                  {s.label}
                </p>
              </Link>
            ))}
          </div>

          <p className="text-sm leading-relaxed max-w-2xl" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            Submit a listing in your own words, our team reviews and polishes it before it goes live on the public store.
            Items sold and enquiries received are counted against your listings, if something&rsquo;s no longer available,
            edit it and update the status yourself.
          </p>
        </div>
      </div>
    )
  }

  const [totalListings, featuredCount, openEnquiries, pendingOrders, pendingReview] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.count({ where: { featured: true } }),
    prisma.inquiry.count({ where: { status: 'new' } }),
    prisma.order.count({ where: { status: { in: ['pending', 'paid'] } } }),
    prisma.listing.count({ where: { published: false } }),
  ])

  const lastRun = await prisma.watchdogRun.findFirst({ where: { kind: 'daily' }, orderBy: { createdAt: 'desc' } })
  const lastRunHasWarn = Array.isArray(lastRun?.checks) && (lastRun.checks as { status?: string }[]).some((c) => c.status === 'warn')

  // Team members see only the areas they've been given.
  const has = (a: Area) => areas.includes(a)
  const statCards = [
    { label: 'Total Listings', value: String(totalListings), href: '/admin/listings', area: 'listings' as Area },
    { label: 'Featured', value: String(featuredCount), href: '/admin/listings', area: 'listings' as Area },
    { label: 'Open Enquiries', value: String(openEnquiries), href: '/admin/inquiries', area: 'enquiries' as Area },
    { label: 'Orders to Fulfil', value: String(pendingOrders), href: '/admin/orders', area: 'orders' as Area },
    { label: 'Pending Review', value: String(pendingReview), href: '/admin/listings', area: 'listings' as Area },
  ].filter((c) => has(c.area))

  const quickActions = [
    { label: 'Add New Listing', href: '/admin/listings/new', primary: true, area: 'listings' as Area },
    { label: 'View All Listings', href: '/admin/listings', primary: false, area: 'listings' as Area },
    { label: 'Manage Enquiries', href: '/admin/inquiries', primary: false, area: 'enquiries' as Area },
    { label: 'Manage Orders', href: '/admin/orders', primary: false, area: 'orders' as Area },
    { label: 'Partner Applications', href: '/admin/applications', primary: false, area: 'applications' as Area },
    { label: 'Partners', href: '/admin/partners', primary: false, area: 'partners' as Area },
  ].filter((a) => has(a.area))
  if (role === 'admin') quickActions.push({ label: 'Manage Team', href: '/admin/team', primary: false, area: 'listings' })

  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <AdminNavbar role={role} />

      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
              {role === 'team' ? 'Lux Catalog team' : 'Administration'}
            </p>
            <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
              {role === 'team' ? 'Team Dashboard' : 'Admin Dashboard'}
            </h1>
          </div>
          {has('listings') && <Link
            href="/admin/listings/new"
            className="hidden md:inline-flex items-center px-7 py-3 text-xs tracking-[0.18em] uppercase"
            style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
          >
            + Add Listing
          </Link>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-10">
        {role === 'admin' && !ownerEmailFromEnv(process.env.OWNER_EMAIL) && (
          <p className="p-4 text-sm" style={{ background: 'rgba(122,92,36,0.05)', border: '1px solid rgba(20,19,15,0.15)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            Security: the OWNER_EMAIL setting is not set, so any account with the admin role is trusted. Set OWNER_EMAIL to your own address in the hosting settings so that you are the only administrator.
          </p>
        )}
        {denied && (
          <p className="p-4 text-sm" style={{ background: 'rgba(138,59,46,0.08)', border: '1px solid rgba(138,59,46,0.3)', color: '#8a3b2e', fontFamily: 'var(--font-inter)' }}>
            You don&apos;t have access to that page. Ask an admin if you need it.
          </p>
        )}
        {role === 'team' && areas.length === 0 && (
          <p className="p-4 text-sm" style={{ border: '1px solid #d6cfbf', color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            Your account is set up. An admin will give you access to the areas you work on.
          </p>
        )}
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
          {statCards.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="p-6 lux-card block group"
            >
              <p className="text-3xl mb-1 group-hover:text-lux-gold transition-colors" style={{ fontFamily: 'var(--font-playfair)', color: '#7a5c24' }}>
                {s.value}
              </p>
              <p className="text-[11px] tracking-[0.15em] uppercase" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                {s.label}
              </p>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase mb-5" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            Quick Actions
          </p>
          <div className="flex flex-wrap gap-4">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="inline-flex items-center px-7 py-3 text-xs tracking-[0.18em] uppercase transition-all"
                style={
                  a.primary
                    ? { background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }
                    : { border: '1px solid #d6cfbf', color: '#5e584c', fontFamily: 'var(--font-inter)' }
                }
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>

        {role === 'admin' && <AdminEmailTools lastRun={lastRun ? { at: lastRun.createdAt.toISOString(), status: lastRun.ok ? (lastRunHasWarn ? 'warn' : 'ok') : 'fail' } : null} />}
      </div>
    </div>
  )
}
