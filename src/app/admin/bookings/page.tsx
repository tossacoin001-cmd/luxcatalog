import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { Prisma } from '@prisma/client'
import { AlertTriangle } from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'
import BookingActions from '@/components/booking/BookingActions'
import ConcernResolve from '@/components/booking/ConcernResolve'
import { concernKind } from '@/lib/aftercare'
import { claimWindowOpen } from '@/lib/refunds-server'
import { requireStaff } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { lagosToday, naira, toDate } from '@/lib/booking'
import { sessionLabel } from '@/lib/sessions'

export const metadata: Metadata = { title: 'Bookings | Admin' }
export const dynamic = 'force-dynamic'

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const STATUS: Record<string, { text: string; color: string }> = {
  confirmed: { text: 'Confirmed', color: '#2f6b45' },
  completed: { text: 'Completed', color: '#5e584c' },
  pending_payment: { text: 'Awaiting payment', color: '#7a5c24' },
  requested: { text: 'Request: answer within 12h', color: '#7a5c24' },
  declined: { text: 'Declined', color: '#5e584c' },
  cancelled: { text: 'Cancelled', color: '#8a3b2e' },
  expired: { text: 'Not completed', color: '#5e584c' },
}
// Is a hold (e.g. a request waiting for the partner) still running?
const stillHeld = (until: Date | null) => !!until && until.getTime() > Date.now()
const hasEnded = (end: Date) => end.getTime() <= Date.now()
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
    upcoming: { endDate: { gt: today }, status: { in: ['confirmed', 'pending_payment', 'requested'] } },
    past: { endDate: { lte: today }, status: { in: ['confirmed', 'completed'] } },
    attention: { OR: [{ needsRefund: true }, { cautionStatus: 'claimed' }, { concerns: { some: { status: 'open' } } }] },
    all: {},
  }
  const [bookings, attention, refundsWaiting, openConcerns] = await Promise.all([
    prisma.booking.findMany({
      where: { ...scope, ...byView[view], ...(view === 'all' ? {} : { NOT: { status: 'expired' } }) },
      orderBy: { startDate: view === 'past' ? 'desc' : 'asc' },
      take: 200,
      include: {
        listing: { select: { title: true, bookingSettings: { select: { requireGuestId: true } } } },
        // Guest concerns are for Lux Catalog's team only, never the partner.
        concerns: isPartner ? false : { orderBy: { createdAt: 'asc' } },
      },
    }),
    isPartner ? Promise.resolve(0) : prisma.booking.count({ where: { OR: [{ needsRefund: true }, { cautionStatus: 'claimed' }, { concerns: { some: { status: 'open' } } }] } }),
    isPartner ? Promise.resolve(0) : prisma.refund.count({ where: { status: { in: ['pending_approval', 'failed'] } } }),
    isPartner ? Promise.resolve(0) : prisma.bookingConcern.count({ where: { status: 'open' } }),
  ])

  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <AdminNavbar role={role} />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            {isPartner ? 'Your listings' : 'All listings'}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
              Bookings
            </h1>
            {!isPartner && (
              <div className="flex flex-wrap gap-2">
              {areas.includes('payouts') && (
                <Link href="/admin/payouts" className="inline-flex items-center min-h-11 px-4 text-xs tracking-[0.14em] uppercase" style={{ border: '1px solid rgba(20,19,15,0.20)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                  Payouts
                </Link>
              )}
              <Link href="/admin/refunds" className="inline-flex items-center min-h-11 px-4 text-xs tracking-[0.14em] uppercase" style={{ border: '1px solid rgba(20,19,15,0.20)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                Refunds{refundsWaiting ? ` (${refundsWaiting})` : ''}
              </Link>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-5 md:px-12 py-8 space-y-6">
        {attention > 0 && (
          <Link href="/admin/bookings?view=attention" className="flex items-center gap-2 p-4 text-sm" style={{ background: 'rgba(122,92,36,0.08)', border: '1px solid rgba(122,92,36,0.35)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            <AlertTriangle size={16} /> {attention} booking{attention === 1 ? '' : 's'} need attention (refunds, damage claims or guest concerns). Open them.
          </Link>
        )}
        {openConcerns > 0 && (
          <Link href="/admin/bookings?view=attention" className="flex items-center gap-2 p-4 text-sm" style={{ background: 'rgba(138,59,46,0.08)', border: '1px solid rgba(138,59,46,0.4)', color: '#8a3b2e', fontFamily: 'var(--font-inter)' }}>
            <AlertTriangle size={16} /> {openConcerns} open concern{openConcerns === 1 ? '' : 's'} from guests. Open them.
          </Link>
        )}
        {refundsWaiting > 0 && (
          <Link href="/admin/refunds" className="flex items-center gap-2 p-4 text-sm" style={{ background: 'rgba(122,92,36,0.04)', border: '1px solid rgba(20,19,15,0.15)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            {refundsWaiting} refund{refundsWaiting === 1 ? '' : 's'} waiting for approval. Open the refund queue.
          </Link>
        )}
        <nav className="flex flex-wrap gap-2" aria-label="Filter bookings">
          {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).filter((k) => !(isPartner && k === 'attention')).map((k) => (
            <Link
              key={k}
              href={`/admin/bookings?view=${k}`}
              className="inline-flex items-center min-h-11 px-4 text-xs tracking-[0.12em] uppercase"
              style={{ border: `1px solid ${view === k ? '#14130f' : '#d6cfbf'}`, color: view === k ? '#7a5c24' : '#5e584c', fontFamily: 'var(--font-inter)' }}
            >
              {VIEWS[k]}
            </Link>
          ))}
        </nav>
        {bookings.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            No bookings here yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b) => {
              const st = STATUS[b.status]
              const last = b.unit === 'night' ? b.endDate : new Date(b.endDate.getTime() - 86_400_000)
              return (
                <li key={b.id} className="p-5 grid gap-2 md:grid-cols-[1fr_auto] md:items-center" style={{ background: '#fbf9f4', border: `1px solid ${b.needsRefund || b.cautionStatus === 'claimed' ? 'rgba(122,92,36,0.45)' : '#d6cfbf'}` }}>
                  <div className="min-w-0">
                    <p className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                      {b.listing.title}
                    </p>
                    {b.unit === 'session' ? (
                      <>
                        <p className="text-sm" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
                          {sessionLabel(b.startDate, b.endDate)} · {b.packageName}
                          {b.guests ? ` · ${b.guests} guest${b.guests === 1 ? '' : 's'}` : ''} · {b.area}
                        </p>
                        {/* The address and notes reach the partner only once the booking is paid. */}
                        {!isPartner || ['confirmed', 'completed'].includes(b.status) ? (
                          <>
                            {b.address && (
                              <p className="text-sm mt-1" style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}>
                                {b.address}
                              </p>
                            )}
                            {b.serviceNotes && (
                              <p className="text-xs mt-1" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                                Notes: {b.serviceNotes}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs mt-1" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                            The full address and notes appear here once the booking is paid.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
                        {fmt(b.startDate)} → {fmt(last)} · {b.units} {b.unit === 'night' ? (b.units === 1 ? 'night' : 'nights') : b.units === 1 ? 'day' : 'days'}
                        {b.guests ? ` · ${b.guests} guest${b.guests === 1 ? '' : 's'}` : ''}
                      </p>
                    )}
                    <p className="text-xs mt-1 break-all" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                      {b.guestName} · {b.guestEmail}
                      {b.guestPhone ? ` · ${b.guestPhone}` : ''} · {b.reference}
                    </p>
                    {['confirmed', 'completed'].includes(b.status) && b.unit === 'night' && b.listing.bookingSettings?.requireGuestId && (
                      <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-inter)' }}>
                        {b.guestIdUploadedAt ? (
                          <a href={`/api/bookings/${b.reference}/guest-id`} target="_blank" rel="noopener" className="underline underline-offset-2" style={{ color: '#7a5c24' }}>
                            View guest ID
                          </a>
                        ) : (
                          <span style={{ color: '#7a5c24' }}>Guest ID not uploaded yet</span>
                        )}
                      </p>
                    )}
                    {b.note && (
                      <p className="text-xs mt-1" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                        {b.note}
                      </p>
                    )}
                    {!isPartner &&
                      b.concerns?.map((c) => (
                        <div key={c.id} data-concern={c.id} className="mt-3 p-3" style={{ background: c.status === 'open' ? 'rgba(138,59,46,0.06)' : 'transparent', border: `1px solid ${c.status === 'open' ? 'rgba(138,59,46,0.35)' : '#d6cfbf'}` }}>
                          <p className="text-xs tracking-[0.12em] uppercase" style={{ color: c.status === 'open' ? (concernKind(c.kind)?.urgent ? '#8a3b2e' : '#7a5c24') : '#2f6b45', fontFamily: 'var(--font-inter)' }}>
                            {c.status === 'open' ? `${concernKind(c.kind)?.urgent ? 'Urgent · ' : ''}Guest concern` : 'Resolved'} · {concernKind(c.kind)?.label ?? c.kind} · {fmt(c.createdAt)}
                          </p>
                          <p className="text-sm mt-1" style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}>
                            “{c.message}”
                          </p>
                          {c.status === 'open' ? (
                            <ConcernResolve bookingId={b.id} concernId={c.id} />
                          ) : (
                            c.resolutionNote && (
                              <p className="text-xs mt-1" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                                Resolved: {c.resolutionNote}
                              </p>
                            )
                          )}
                        </div>
                      ))}
                  </div>
                  <div className="md:text-right">
                    <p className="text-base" style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}>
                      {naira(Number(b.total))}
                    </p>
                    <p className="text-xs tracking-[0.12em] uppercase" style={{ color: b.needsRefund ? '#7a5c24' : st.color, fontFamily: 'var(--font-inter)' }}>
                      {b.needsRefund ? 'Refund due' : st.text}
                      {b.paidAt ? ` · paid ${fmt(b.paidAt)}` : ''}
                    </p>
                    {b.cancelledBy && (
                      <p className="text-xs" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                        by {b.cancelledBy}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <BookingActions
                      id={b.id}
                      canCancel={b.status === 'confirmed' && (b.unit === 'session' ? !hasEnded(b.endDate) : b.endDate > today)}
                      canRespond={b.status === 'requested' && stillHeld(b.holdExpiresAt)}
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
