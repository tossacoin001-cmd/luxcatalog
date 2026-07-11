import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') redirect('/')

  const [totalListings, featuredCount, openEnquiries] = await Promise.all([
    prisma.listing.count(),
    prisma.listing.count({ where: { featured: true } }),
    prisma.inquiry.count({ where: { status: 'new' } }),
  ])

  const statCards = [
    { label: 'Total Listings', value: String(totalListings), href: '/admin/listings' },
    { label: 'Featured', value: String(featuredCount), href: '/admin/listings' },
    { label: 'Open Enquiries', value: String(openEnquiries), href: '/admin/inquiries' },
    { label: 'Categories', value: '8', href: '/admin/listings' },
  ]

  const quickActions = [
    { label: 'Add New Listing', href: '/admin/listings/new', primary: true },
    { label: 'View All Listings', href: '/admin/listings', primary: false },
    { label: 'Manage Enquiries', href: '/admin/inquiries', primary: false },
  ]

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
              Administration
            </p>
            <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Admin Dashboard
            </h1>
          </div>
          <Link
            href="/admin/listings/new"
            className="hidden md:inline-flex items-center px-7 py-3 text-xs tracking-[0.18em] uppercase"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            + Add Listing
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-10">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {statCards.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="p-6 lux-card block group"
            >
              <p className="text-3xl mb-1 group-hover:text-lux-gold transition-colors" style={{ fontFamily: 'var(--font-playfair)', color: '#C9A84C' }}>
                {s.value}
              </p>
              <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                {s.label}
              </p>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-5" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
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
                    ? { background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }
                    : { border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
                }
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
