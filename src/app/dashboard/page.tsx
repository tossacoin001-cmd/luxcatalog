import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

const naira = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)
const formatDate = (d: Date) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// Reservation-style categories (real estate, cars, yachts, commercial) hold a
// deposit while due diligence happens, distinct from shortlet bookings (dated
// stays) and executive services (dated service requests). Each gets its own
// section so a customer sees what actually matches what they engaged with,
// instead of one flat "enquiries" list regardless of what they were doing.
const RESERVATION_CATEGORIES = ['real_estate', 'supercar', 'yacht', 'commercial', 'lifestyle']

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [user, orders, inquiries] = await Promise.all([
    currentUser(),
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    }),
    prisma.inquiry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { listing: { select: { title: true, category: true, slug: true } } },
    }),
  ])

  const bookings = inquiries.filter((i) => i.listing?.category === 'shortlet')
  const serviceRequests = inquiries.filter((i) => i.listing?.category === 'executive_services')
  const reservations = inquiries.filter((i) => i.listing && RESERVATION_CATEGORIES.includes(i.listing.category))
  const generalEnquiries = inquiries.filter((i) => !i.listing || (!bookings.includes(i) && !serviceRequests.includes(i) && !reservations.includes(i)))

  const hasActivity = orders.length > 0 || inquiries.length > 0

  const sectionStyle = { background: '#0f1a10', border: '1px solid #1e2e1f' }
  const rowStyle = { borderBottom: '1px solid #1e2e1f' }

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
        <div className="p-7 h-fit" style={sectionStyle}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-5" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Profile
          </p>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] tracking-wider uppercase mb-1" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>Name</p>
              <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                {user?.fullName ?? 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-wider uppercase mb-1" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>Email</p>
              <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                {user?.emailAddresses[0]?.emailAddress ?? 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-wider uppercase mb-1" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>Member Since</p>
              <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'Not set'}
              </p>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="lg:col-span-2 space-y-8">
          {!hasActivity && (
            <div className="p-6" style={sectionStyle}>
              <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                Get Started
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Browse Catalog', href: '/catalog', desc: 'Explore all luxury assets' },
                  { label: 'AI Discovery', href: '/discover', desc: 'Get personalised matches' },
                  { label: 'Saved Assets', href: '/saved', desc: 'Your curated collection' },
                  { label: 'Book a Call', href: '/contact', desc: 'Speak with a specialist' },
                ].map((link) => (
                  <Link key={link.href} href={link.href} className="group p-5 lux-card block">
                    <p className="text-base mb-1 group-hover:text-lux-gold transition-colors" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                      {link.label}
                    </p>
                    <p className="text-xs" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                      {link.desc}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Orders (Interior Decor) */}
          {orders.length > 0 && (
            <div className="p-6" style={sectionStyle}>
              <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                Orders
              </p>
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="pb-4" style={rowStyle}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                        {order.items.map((i) => i.titleSnapshot).join(', ')}
                      </p>
                      <span className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 flex-shrink-0" style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', fontFamily: 'var(--font-inter)' }}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                      <span>{formatDate(order.createdAt)} · {naira(Number(order.total))}</span>
                      <span>Delivering to {order.shippingCity}, {order.shippingState}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bookings (Shortlets) */}
          {bookings.length > 0 && (
            <div className="p-6" style={sectionStyle}>
              <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                Bookings
              </p>
              <div className="space-y-4">
                {bookings.map((b) => (
                  <div key={b.id} className="pb-4" style={rowStyle}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                        {b.listing?.title ?? 'Shortlet'}
                      </p>
                      <span className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 flex-shrink-0" style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', fontFamily: 'var(--font-inter)' }}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                      {b.checkIn && b.checkOut
                        ? `${formatDate(b.checkIn)} – ${formatDate(b.checkOut)}`
                        : formatDate(b.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reservations (Real Estate, Supercars, Yachts, Commercial, Lifestyle) */}
          {reservations.length > 0 && (
            <div className="p-6" style={sectionStyle}>
              <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                Reservations
              </p>
              <div className="space-y-4">
                {reservations.map((r) => (
                  <div key={r.id} className="pb-4" style={rowStyle}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                        {r.listing?.title ?? 'Asset Reservation'}
                      </p>
                      <span className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 flex-shrink-0" style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', fontFamily: 'var(--font-inter)' }}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service Requests (Executive Services) */}
          {serviceRequests.length > 0 && (
            <div className="p-6" style={sectionStyle}>
              <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                Service Requests
              </p>
              <div className="space-y-4">
                {serviceRequests.map((s) => (
                  <div key={s.id} className="pb-4" style={rowStyle}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                        {s.listing?.title ?? 'Service Request'}
                      </p>
                      <span className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 flex-shrink-0" style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', fontFamily: 'var(--font-inter)' }}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                      {s.checkIn ? formatDate(s.checkIn) : formatDate(s.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General enquiries fallback */}
          {generalEnquiries.length > 0 && (
            <div className="p-6" style={sectionStyle}>
              <p className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                Enquiries
              </p>
              <div className="space-y-3">
                {generalEnquiries.map((inq) => (
                  <div key={inq.id} className="flex items-center justify-between gap-3 py-2" style={rowStyle}>
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                        {inq.listing?.title ?? 'General enquiry'}
                      </p>
                      <p className="text-[10px]" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                        {formatDate(inq.createdAt)}
                      </p>
                    </div>
                    <span className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 flex-shrink-0" style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', fontFamily: 'var(--font-inter)' }}>
                      {inq.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
