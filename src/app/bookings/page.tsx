import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { sessionLabel } from '@/lib/sessions'
import { naira } from '@/lib/booking'

export const metadata: Metadata = { title: 'My bookings', robots: { index: false } }
export const dynamic = 'force-dynamic'

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const LABEL: Record<string, { text: string; color: string }> = {
  confirmed: { text: 'Confirmed', color: '#2f6b45' },
  completed: { text: 'Completed', color: '#5e584c' },
  pending_payment: { text: 'Awaiting payment', color: '#7a5c24' },
  requested: { text: 'Waiting for host', color: '#7a5c24' },
  declined: { text: 'Not available', color: '#5e584c' },
  cancelled: { text: 'Cancelled', color: '#8a3b2e' },
  expired: { text: 'Not completed', color: '#5e584c' },
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
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 md:px-8 pt-28 md:pt-32 pb-16">
        <h1 className="text-3xl md:text-4xl mb-8" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
          My bookings
        </h1>
        {bookings.length === 0 ? (
          <p className="text-sm" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            No bookings yet.{' '}
            <Link href="/catalog/shortlets" className="underline" style={{ color: '#7a5c24' }}>
              Explore shortlets
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b) => {
              const l = LABEL[b.needsRefund ? 'cancelled' : b.status]
              return (
                <li key={b.id}>
                  <Link href={`/bookings/${b.reference}`} className="block p-5 transition-colors hover:border-lux-gold-muted" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                        {b.listing.title}
                      </span>
                      <span className="text-xs tracking-[0.12em] uppercase" style={{ color: l.color, fontFamily: 'var(--font-inter)' }}>
                        {b.needsRefund ? 'Refund due' : l.text}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                      {b.unit === 'session' ? sessionLabel(b.startDate, b.endDate) : `${fmt(b.startDate)} → ${fmt(b.unit === 'night' ? b.endDate : new Date(b.endDate.getTime() - 86_400_000))}`} · {naira(Number(b.total))} · {b.reference}
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
