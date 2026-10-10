import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Prisma } from '@prisma/client'
import { AlertTriangle } from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'
import BookingActions from '@/components/booking/BookingActions'
import { claimWindowOpen } from '@/lib/refunds-server'
import { requireStaff } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { lagosToday, naira, toDate } from '@/lib/booking'

export const metadata: Metadata = { title: 'Bookings | Admin' }
export const dynamic = 'force-dynamic'

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const STATUS: Record<string, { text: string; color: string }> = {
  confirmed: { text: 'Confirmed', color: '#6fbf73' },
  completed: { text: 'Completed', color: '#9a8f7a' },
  pending_payment: { text: 'Paying now', color: '#C9A84C' },
  cancelled: { text: 'Cancelled', color: '#e85c4c' },
  expired: { text: 'Not completed', color: '#908673' },
}
const VIEWS = { upcoming: 'Upcoming', past: 'Past', attention: 'Needs attention', all: 'All' } as const

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { userId, role, areas } = await requireStaff()
  if (role === 'team' && !areas.includes('bookings')) redirect('/admin?denied=1')
  const isPartner = role === 'partner'
  const { view: v } = await searchParams
  const view = (v && v in VIEWS ? v : 'upcoming') as keyof typeof VIEWS

  const today = toDate(lagosToday())
  const scope: Prisma.BookingWhereInput = isPartner ? { listing: { ownerId: userId } } : {}
  const byView: Record<keyof typeof VIEWS, Prisma.BookingWhereInput> = {
    upcoming: { endDate: { gt: today }, status: { in: ['confirmed', 'pending_payment'] } },
    past: { endDate: { lte: today }, status: { in: ['confirmed', 'completed'] } },
    attention: { OR: [{ needsRefund: true }, { cautionStatus: 'claimed' }] },
    all: {},
  }
  const [bookings, attention, refundsWaiting] = await Promise.all([
    prisma.booking.findMany({
      where: { ...scope, ...byView[view], ...(view === 'all' ? {} : { NOT: { status: 'expired' } }) },
      orderBy: { startDate: view === 'past' ? 'desc' : 'asc' },
      take: 200,
      include: { listing: { select: { title: true } } },
    }),
    isPartner ? Promise.resolve(0) : prisma.booking.count({ where: { OR: [{ needsRefund: true }, { cautionStatus: 'claimed' }] } }),
    isPartner ? Promise.resolve(0) : prisma.refund.count({ where: { status: { in: ['pending_approval', 'failed'] } } }),
  ])

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role={role} />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            {isPartner ? 'Your listings' : 'All listings'}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Bookings
            </h1>
            {!isPartner && (
              <Link href="/admin/refunds" className="inline-flex items-center min-h-11 px-4 text-xs tracking-[0.14em] uppercase" style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                Refunds{refundsWaiting ? ` (${refundsWaiting})` : ''}
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-5 md:px-12 py-8 space-y-6">
        {attention > 0 && (
          <Link href="/admin/bookings?view=attention" className="flex items-center gap-2 p-4 text-sm" style={{ background: 'rgba(224,183,90,0.08)', border: '1px solid rgba(224,183,90,0.35)', color: '#e6d3a1', fontFamily: 'var(--font-inter)' }}>
            <AlertTriangle size={16} /> {attention} booking{attention === 1 ? '' : 's'} need attention (refunds or damage claims). Open them.
          </Link>
        )}
        {refundsWaiting > 0 && (
          <Link href="/admin/refunds" className="flex items-center gap-2 p-4 text-sm" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.3)', color: '#e6d3a1', fontFamily: 'var(--font-inter)' }}>
            {refundsWaiting} refund{refundsWaiting === 1 ? '' : 's'} waiting for approval. Open the refund queue.
          </Link>
        )}
        <nav className="flex flex-wrap gap-2" aria-label="Filter bookings">
          {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).filter((k) => !(isPartner && k === 'attention')).map((k) => (
            <Link
              key={k}
              href={`/admin/bookings?view=${k}`}
              className="inline-flex items-center min-h-11 px-4 text-xs tracking-[0.12em] uppercase"
              style={{ border: `1px solid ${view === k ? '#C9A84C' : '#1e2e1f'}`, color: view === k ? '#e4c878' : '#9a8f7a', fontFamily: 'var(--font-inter)' }}
            >
              {VIEWS[k]}
            </Link>
          ))}
        </nav>
        {bookings.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
            No bookings here yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b) => {
              const st = STATUS[b.status]
              const last = b.unit === 'night' ? b.endDate : new Date(b.endDate.getTime() - 86_400_000)
              return (
                <li key={b.id} className="p-5 grid gap-2 md:grid-cols-[1fr_auto] md:items-center" style={{ background: '#0f1a10', border: `1px solid ${b.needsRefund || b.cautionStatus === 'claimed' ? 'rgba(224,183,90,0.45)' : '#1e2e1f'}` }}>
                  <div className="min-w-0">
                    <p className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                      {b.listing.title}
                    </p>
                    <p className="text-sm" style={{ color: '#d6cdbd', fontFamily: 'var(--font-inter)' }}>
                      {fmt(b.startDate)} → {fmt(last)} · {b.units} {b.unit === 'night' ? (b.units === 1 ? 'night' : 'nights') : b.units === 1 ? 'day' : 'days'}
                      {b.guests ? ` · ${b.guests} guest${b.guests === 1 ? '' : 's'}` : ''}
                    </p>
                    <p className="text-xs mt-1 break-all" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                      {b.guestName} · {b.guestEmail}
                      {b.guestPhone ? ` · ${b.guestPhone}` : ''} · {b.reference}
                    </p>
                    {b.note && (
                      <p className="text-xs mt-1" style={{ color: '#e6d3a1', fontFamily: 'var(--font-inter)' }}>
                        {b.note}
                      </p>
                    )}
                  </div>
                  <div className="md:text-right">
                    <p className="text-base" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                      {naira(Number(b.total))}
                    </p>
                    <p className="text-xs tracking-[0.12em] uppercase" style={{ color: b.needsRefund ? '#e0b75a' : st.color, fontFamily: 'var(--font-inter)' }}>
                      {b.needsRefund ? 'Refund due' : st.text}
                      {b.paidAt ? ` · paid ${fmt(b.paidAt)}` : ''}
                    </p>
                    {b.cancelledBy && (
                      <p className="text-xs" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                        by {b.cancelledBy}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <BookingActions
                      id={b.id}
                      canCancel={b.status === 'confirmed' && b.endDate > today}
                      canClaim={isPartner && claimWindowOpen(b)}
                      canDecide={!isPartner && b.cautionStatus === 'claimed'}
                      deposit={Number(b.cautionDeposit)}
                      claim={b.cautionStatus === 'claimed' ? { amount: Number(b.claimAmount ?? 0), note: b.claimNote ?? '' } : null}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
