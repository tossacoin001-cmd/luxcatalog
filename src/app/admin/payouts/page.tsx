import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import AdminNavbar from '@/components/AdminNavbar'
import BankDetailsForm from '@/components/booking/BankDetailsForm'
import PayoutActions from '@/components/booking/PayoutActions'
import { requireStaff } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { naira } from '@/lib/booking'
import { maskAccount } from '@/lib/payouts-server'

export const metadata: Metadata = { title: 'Payouts | Admin' }
export const dynamic = 'force-dynamic'

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const STATUS: Record<string, { text: string; color: string }> = {
  scheduled: { text: 'Scheduled', color: '#9a8f7a' },
  pending_approval: { text: 'Due: awaiting approval', color: '#C9A84C' },
  processing: { text: 'On its way', color: '#9ab8e0' },
  paid: { text: 'Paid', color: '#6fbf73' },
  failed: { text: 'Failed', color: '#e85c4c' },
  cancelled: { text: 'Cancelled', color: '#908673' },
}
const card = { background: '#0f1a10', border: '1px solid #1e2e1f' }
const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }

export default async function PayoutsPage() {
  const { userId, role, areas } = await requireStaff()
  const isPartner = role === 'partner'
  if (!isPartner && !areas.includes('payouts')) redirect('/admin?denied=1')

  const payouts = await prisma.payout.findMany({
    where: isPartner ? { partnerId: userId } : {},
    orderBy: [{ dueAt: 'asc' }],
    take: 300,
    include: { booking: { select: { reference: true, startDate: true, guestName: true, listing: { select: { title: true } } } } },
  })
  const partnerIds = [...new Set(payouts.map((p) => p.partnerId))]
  const [accounts, profiles] = await Promise.all([
    prisma.payoutAccount.findMany({ where: { userId: { in: isPartner ? [userId] : partnerIds } } }),
    isPartner ? Promise.resolve([]) : prisma.partnerProfile.findMany({ where: { userId: { in: partnerIds } }, select: { userId: true, brandName: true } }),
  ])
  const accountOf = new Map(accounts.map((a) => [a.userId, a]))
  const brandOf = new Map(profiles.map((p) => [p.userId, p.brandName]))
  const queue = payouts.filter((p) => p.status === 'pending_approval' || p.status === 'failed')
  const upcoming = payouts.filter((p) => p.status === 'scheduled' || p.status === 'processing')
  const done = payouts.filter((p) => p.status === 'paid' || p.status === 'cancelled').reverse()
  const mine = isPartner ? accountOf.get(userId) : undefined
  const sum = (list: typeof payouts) => list.reduce((n, p) => n + Number(p.amount), 0)

  const Row = ({ p, actions }: { p: (typeof payouts)[number]; actions?: boolean }) => {
    const acct = accountOf.get(p.partnerId)
    return (
      <li className="p-5 space-y-2" style={{ ...card, borderColor: p.status === 'failed' ? 'rgba(232,92,76,0.4)' : '#1e2e1f' }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {naira(Number(p.amount))}{' '}
            <span className="text-xs" style={text}>
              {naira(Number(p.gross))} − {Number(p.commissionRate)}% commission ({naira(Number(p.commission))})
            </span>
          </p>
          <span className="text-xs tracking-[0.12em] uppercase" style={{ color: STATUS[p.status].color, fontFamily: 'var(--font-inter)' }}>
            {STATUS[p.status].text}
          </span>
        </div>
        <p className="text-sm" style={{ color: '#d6cdbd', fontFamily: 'var(--font-inter)' }}>
          {p.booking.listing.title} · {p.booking.guestName} · {p.booking.reference}
          {!isPartner && ` · ${brandOf.get(p.partnerId) ?? 'Partner'}`}
        </p>
        <p className="text-xs" style={text}>
          {p.status === 'paid' && p.paidAt ? `Paid ${fmt(p.paidAt)}` : `Due ${fmt(p.dueAt)}`}
          {!isPartner && (acct ? ` · to ${acct.accountName}, ${acct.bankName} ${maskAccount(acct.accountNumber)}` : ' · no bank details yet')}
          {p.note ? ` · ${p.note}` : ''}
          {p.failureReason ? ` · ${p.failureReason}` : ''}
        </p>
        {actions && !isPartner && <PayoutActions id={p.id} amount={naira(Number(p.amount))} ready={!!acct} />}
      </li>
    )
  }

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role={role} />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-5xl mx-auto">
          {!isPartner && (
            <Link href="/admin/bookings" className="text-[11px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
              ← Bookings
            </Link>
          )}
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Payouts
          </h1>
          <p className="mt-2 text-sm" style={text}>
            {isPartner
              ? 'Your earnings from each booking, after commission. Paid about a day after check-in (after completion for protection services) once approved.'
              : `${queue.length} due for approval (${naira(sum(queue))}). Approving sends a Paystack transfer to the partner's verified account.`}
          </p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-5 md:px-12 py-8 space-y-10">
        {isPartner && (
          <section className="space-y-3">
            <h2 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Bank details
            </h2>
            <BankDetailsForm initial={mine ? { bankName: mine.bankName, accountName: mine.accountName, account: maskAccount(mine.accountNumber) } : null} />
          </section>
        )}
        {!isPartner && queue.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Due for approval
            </h2>
            <ul className="space-y-3">{queue.map((p) => <Row key={p.id} p={p} actions />)}</ul>
          </section>
        )}
        {isPartner && queue.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Due now
            </h2>
            <ul className="space-y-3">{queue.map((p) => <Row key={p.id} p={p} />)}</ul>
          </section>
        )}
        <section className="space-y-3">
          <h2 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Upcoming {upcoming.length ? <span className="text-sm" style={text}>· {naira(sum(upcoming))}</span> : null}
          </h2>
          {upcoming.length ? <ul className="space-y-3">{upcoming.map((p) => <Row key={p.id} p={p} />)}</ul> : <p className="text-sm" style={text}>Nothing scheduled.</p>}
        </section>
        {done.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              History
            </h2>
            <ul className="space-y-3">{done.slice(0, 50).map((p) => <Row key={p.id} p={p} />)}</ul>
          </section>
        )}
      </div>
    </div>
  )
}
