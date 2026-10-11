import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { naira } from '@/lib/booking'

export const metadata: Metadata = { title: 'My bookings', robots: { index: false } }
export const dynamic = 'force-dynamic'

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const LABEL: Record<string, { text: string; color: string }> = {
  confirmed: { text: 'Confirmed', color: '#6fbf73' },
  completed: { text: 'Completed', color: '#9a8f7a' },
  pending_payment: { text: 'Awaiting payment', color: '#C9A84C' },
  requested: { text: 'Waiting for host', color: '#C9A84C' },
  declined: { text: 'Not available', color: '#908673' },
  cancelled: { text: 'Cancelled', color: '#e85c4c' },
  expired: { text: 'Not completed', color: '#908673' },
}

export default async function MyBookingsPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in?redirect_url=/bookings')
  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id, OR: [{ status: { in: ['confirmed', 'completed', 'cancelled', 'declined'] } }, { status: { in: ['pending_payment', 'requested'] }, holdExpiresAt: { gt: new Date() } }] },
    orderBy: { startDate: 'desc' },
    include: { listing: { select: { title: true, location: true } } },
  })

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-28 md:pt-32 pb-16">
        <h1 className="text-3xl md:text-4xl mb-8" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          My bookings
        </h1>
        {bookings.length === 0 ? (
          <p className="text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            No bookings yet.{' '}
            <Link href="/catalog/shortlets" className="underline" style={{ color: '#C9A84C' }}>
              Explore shortlets
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b) => {
              const l = LABEL[b.needsRefund ? 'cancelled' : b.status]
              return (
                <li key={b.id}>
                  <Link href={`/bookings/${b.reference}`} className="block p-5 transition-colors hover:border-lux-gold-muted" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                        {b.listing.title}
                      </span>
                      <span className="text-xs tracking-[0.12em] uppercase" style={{ color: l.color, fontFamily: 'var(--font-inter)' }}>
                        {b.needsRefund ? 'Refund due' : l.text}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                      {fmt(b.startDate)} → {fmt(b.unit === 'night' ? b.endDate : new Date(b.endDate.getTime() - 86_400_000))} · {naira(Number(b.total))} · {b.reference}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <Footer />
    </div>
  )
}
