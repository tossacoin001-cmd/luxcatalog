import Link from 'next/link'
import type { Metadata } from 'next'
import AdminNavbar from '@/components/AdminNavbar'
import RefundActions from '@/components/booking/RefundActions'
import { requireArea } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { naira } from '@/lib/booking'

export const metadata: Metadata = { title: 'Refunds | Admin' }
export const dynamic = 'force-dynamic'

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const KIND: Record<string, string> = { cancellation: 'Cancellation', caution: 'Caution deposit', payment_issue: 'Payment problem' }
const STATUS: Record<string, { text: string; color: string }> = {
  pending_approval: { text: 'Waiting for approval', color: '#7a5c24' },
  processing: { text: 'Sent to Paystack', color: '#3a5a80' },
  completed: { text: 'Refunded', color: '#2f6b45' },
  failed: { text: 'Failed', color: '#8a3b2e' },
  rejected: { text: 'Rejected', color: '#5e584c' },
}

// The refund queue: nothing goes back to a guest until someone approves it here.
export default async function RefundsPage() {
  const { role } = await requireArea('bookings')
  const [open, history] = await Promise.all([
    prisma.refund.findMany({
      where: { status: { in: ['pending_approval', 'failed'] } },
      orderBy: { createdAt: 'asc' },
      include: { booking: { select: { reference: true, guestName: true, guestEmail: true, amountDue: true, listing: { select: { title: true } } } } },
    }),
    prisma.refund.findMany({
      where: { status: { in: ['processing', 'completed', 'rejected'] } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { booking: { select: { reference: true, guestName: true, listing: { select: { title: true } } } } },
    }),
  ])
  const total = open.reduce((n, r) => n + Number(r.amount), 0)

  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <AdminNavbar role={role} />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
        <div className="max-w-5xl mx-auto">
          <Link href="/admin/bookings" className="text-[11px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            ← Bookings
          </Link>
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            Refunds
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            {open.length ? `${open.length} waiting · ${naira(total)} in total. ` : 'Nothing waiting. '}Approving sends the money back to the guest through Paystack.
          </p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-5 md:px-12 py-8 space-y-10">
        <ul className="space-y-3">
          {open.map((r) => (
            <li key={r.id} className="p-5 space-y-3" style={{ background: '#fbf9f4', border: `1px solid ${r.status === 'failed' ? 'rgba(138,59,46,0.4)' : '#d6cfbf'}` }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                  {naira(Number(r.amount))} <span className="text-sm" style={{ color: '#5e584c' }}>{KIND[r.kind] ?? r.kind}</span>
                </p>
                <span className="text-xs tracking-[0.12em] uppercase" style={{ color: STATUS[r.status].color, fontFamily: 'var(--font-inter)' }}>
                  {STATUS[r.status].text}
                </span>
              </div>
              <p className="text-sm" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
                {r.booking.listing.title} · {r.booking.guestName} ({r.booking.guestEmail}) · {r.booking.reference} · paid {naira(Number(r.booking.amountDue))}
              </p>
              <p className="text-xs" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                {r.reason}
                {r.failureReason ? ` · ${r.failureReason}` : ''}
              </p>
              <RefundActions id={r.id} amount={naira(Number(r.amount))} />
            </li>
          ))}
        </ul>
        {history.length > 0 && (
          <section>
            <h2 className="text-xl mb-3" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
              Recent
            </h2>
            <ul className="space-y-2">
              {history.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf', fontFamily: 'var(--font-inter)' }}>
                  <span style={{ color: '#3a362d' }}>
                    {naira(Number(r.amount))} · {KIND[r.kind] ?? r.kind} · {r.booking.listing.title} · {r.booking.reference}
                  </span>
                  <span style={{ color: STATUS[r.status].color }}>
                    {STATUS[r.status].text} {r.decidedAt ? `· ${fmt(r.decidedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
