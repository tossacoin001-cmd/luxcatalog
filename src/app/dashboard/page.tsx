import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [user, recentInquiries] = await Promise.all([
    currentUser(),
    prisma.inquiry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { listing: { select: { title: true } } },
    }),
  ])

  const quickLinks = [
    { label: 'Browse Catalog', href: '/catalog', desc: 'Explore all luxury assets' },
    { label: 'AI Discovery', href: '/discover', desc: 'Get personalised matches' },
    { label: 'Saved Assets', href: '/saved', desc: 'Your curated collection' },
    { label: 'Book a Call', href: '/contact', desc: 'Speak with a specialist' },
  ]

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-12 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Member Dashboard
          </p>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Welcome, {user?.firstName ?? 'Member'}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Profile card */}
        <div className="p-7" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-5" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Profile
          </p>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] tracking-wider uppercase mb-1" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>Name</p>
              <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                {user?.fullName ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-wider uppercase mb-1" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>Email</p>
              <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                {user?.emailAddresses[0]?.emailAddress ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-wider uppercase mb-1" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>Member Since</p>
              <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="lg:col-span-2">
          <p className="text-[10px] tracking-[0.2em] uppercase mb-5" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Quick Access
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group p-6 lux-card block"
              >
                <p className="text-base mb-1 group-hover:text-lux-gold transition-colors" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                  {link.label}
                </p>
                <p className="text-xs" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                  {link.desc}
                </p>
              </Link>
            ))}
          </div>

          {/* Inquiry history */}
          <div className="mt-8 p-6" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
            <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
              Recent Enquiries
            </p>
            {recentInquiries.length === 0 ? (
              <p className="text-sm" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                No enquiries yet. Browse the catalog and enquire about an asset to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {recentInquiries.map((inq) => (
                  <div key={inq.id} className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: '1px solid #1e2e1f' }}>
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                        {inq.listing?.title ?? 'General enquiry'}
                      </p>
                      <p className="text-[10px]" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                        {new Date(inq.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span
                      className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 flex-shrink-0"
                      style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', fontFamily: 'var(--font-inter)' }}
                    >
                      {inq.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
