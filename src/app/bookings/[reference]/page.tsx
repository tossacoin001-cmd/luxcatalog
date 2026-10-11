import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { can, getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { naira, unitLabel, POLICY_TEXT } from '@/lib/booking'
import { applyPayment } from '@/lib/bookings-server'
import { paystackConfigured, verifyTransaction } from '@/lib/paystack'
import { categoryHrefs } from '@/lib/utils'
import { guestCancellationQuote } from '@/lib/refunds-server'
import CancelBooking from '@/components/booking/CancelBooking'
import PayNow from '@/components/booking/PayNow'
import GuestIdUpload from '@/components/booking/GuestIdUpload'

export const metadata: Metadata = { title: 'Your booking', robots: { index: false } }
export const dynamic = 'force-dynamic'

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

async function load(reference: string) {
  return prisma.booking.findUnique({
    where: { reference },
    include: { refunds: { orderBy: { createdAt: 'asc' } }, listing: { select: { title: true, slug: true, category: true, location: true, ownerId: true, images: true, bookingSettings: { select: { checkInTime: true, checkOutTime: true, hoursPerDay: true, requireGuestId: true } } } } },
  })
}

export default async function BookingPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params
  const session = await getSession()
  if (!session) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/bookings/${reference}`)}`)

  let booking = await load(reference)
  if (!booking) notFound()
  const allowed = booking.userId === session.user.id || booking.listing.ownerId === session.user.id || (await can(session.user.id, 'bookings'))
  if (!allowed) notFound()

  // Back from Paystack (or reopened while pending): ask Paystack directly.
  if (booking.status === 'pending_payment' && paystackConfigured()) {
    try {
      await applyPayment(await verifyTransaction(reference))
      booking = (await load(reference))!
    } catch {
      // Not paid yet, or Paystack unreachable: show the pending state.
    }
  }

  const b = booking
  const night = b.unit === 'night'
  const s = b.listing.bookingSettings
  const lastDay = night ? b.endDate : new Date(b.endDate.getTime() - 86_400_000)
  const holdLive = b.status === 'pending_payment' && !!b.holdExpiresAt && b.holdExpiresAt > new Date()
  const requestLive = b.status === 'requested' && !!b.holdExpiresAt && b.holdExpiresAt > new Date()
  const accepted = holdLive && !!b.respondedAt
  const until = b.holdExpiresAt ? b.holdExpiresAt.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) : ''
  const state = b.needsRefund
    ? { icon: <AlertTriangle size={22} style={{ color: '#e0b75a' }} />, title: 'We’ll refund this payment', body: 'Your payment came through after these dates were taken by another guest. Our team will refund you in full and help you find an alternative.' }
    : b.status === 'confirmed' || b.status === 'completed'
      ? { icon: <CheckCircle2 size={22} style={{ color: '#6fbf73' }} />, title: 'Your booking is confirmed', body: 'A confirmation and receipt are on their way to your email. Our concierge will send arrival details before your stay.' }
      : b.status === 'cancelled' && b.paidAt
        ? { icon: <XCircle size={22} style={{ color: '#e85c4c' }} />, title: 'This booking is cancelled', body: b.cancelledBy === 'guest' ? 'You cancelled this booking. Any refund due is shown below.' : `This booking was cancelled by the ${b.cancelledBy ?? 'team'}. You will receive a full refund.` }
      : requestLive
        ? { icon: <Clock size={22} style={{ color: '#C9A84C' }} />, title: 'Waiting for the host to accept', body: `We’ve sent your request. The host replies by ${until} (Lagos time), and your dates are held until then. No payment has been taken.` }
      : b.status === 'declined'
        ? { icon: <XCircle size={22} style={{ color: '#e85c4c' }} />, title: 'The host can’t accept this request', body: `${b.declineReason ? `${b.declineReason}. ` : ''}No payment was taken. Our concierge can suggest similar options for your dates.` }
      : accepted
        ? { icon: <CheckCircle2 size={22} style={{ color: '#6fbf73' }} />, title: 'Accepted: complete your booking', body: `The host has accepted. Pay by ${until} (Lagos time) to confirm; your dates are held until then.` }
      : holdLive
        ? { icon: <Clock size={22} style={{ color: '#C9A84C' }} />, title: 'Waiting for your payment', body: 'Your dates are held for a few more minutes. If you’ve paid, this page updates as soon as the payment is confirmed.' }
        : { icon: <XCircle size={22} style={{ color: '#e85c4c' }} />, title: b.status === 'cancelled' ? 'This booking was cancelled' : b.note?.includes('did not answer') || b.status === 'requested' ? 'The host didn’t reply in time' : 'This booking wasn’t completed', body: 'No payment was taken for it. You can choose your dates again on the listing.' }

  const listingHref = `${categoryHrefs[b.listing.category] ?? '/catalog'}/${b.listing.slug}`
  const rows: [string, string][] = [
    [night ? 'Check-in' : 'From', `${fmt(b.startDate)}${night && s ? `, from ${s.checkInTime}` : ''}`],
    [night ? 'Check-out' : 'Until', `${fmt(lastDay)}${night && s ? `, by ${s.checkOutTime}` : ''}`],
    ['Length', `${b.units} ${unitLabel(night ? 'night' : 'day', b.units)}${b.guests ? ` · ${b.guests} guest${b.guests === 1 ? '' : 's'}` : ''}`],
    [`${naira(Number(b.rate))} × ${b.units}`, naira(Number(b.base))],
    ...(Number(b.cleaningFee) > 0 ? [['Cleaning', naira(Number(b.cleaningFee))] as [string, string]] : []),
    ['Total', naira(Number(b.total))],
    ...(Number(b.cautionDeposit) > 0 ? [['Refundable caution deposit', naira(Number(b.cautionDeposit))] as [string, string]] : []),
    [b.paidAt ? 'Paid' : 'Due', `${naira(Number(b.amountDue))}${b.paidAt ? ` on ${fmt(b.paidAt)}` : ''}`],
    ['Reference', b.reference],
  ]

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-5 md:px-8 pt-28 md:pt-32 pb-16 space-y-8">
        <div className="p-6 md:p-8 flex items-start gap-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }} role="status">
          <span className="shrink-0 mt-1">{state.icon}</span>
          <div>
            <h1 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              {state.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed" style={text}>
              {state.body}
            </p>
          </div>
        </div>

        {b.status === 'confirmed' && b.userId === session.user.id && night && s?.requireGuestId && (
          <GuestIdUpload reference={b.reference} uploaded={!!b.guestIdUploadedAt} />
        )}

        {holdLive && b.userId === session.user.id && <PayNow reference={b.reference} label={accepted ? `Pay ${naira(Number(b.amountDue))} and confirm` : 'Continue to payment'} />}

        <section className="p-6 md:p-8 space-y-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
              {b.listing.location}
            </p>
            <Link href={listingHref} className="text-xl hover:underline" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              {b.listing.title}
            </Link>
          </div>
          <dl className="space-y-2 text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-1" style={{ borderBottom: '1px solid #1e2e1f' }}>
                <dt style={{ color: '#908673' }}>{k}</dt>
                <dd className="text-right" style={{ color: k === 'Total' ? '#f5f0e8' : '#d6cdbd', fontWeight: k === 'Total' ? 600 : 400 }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs leading-relaxed" style={text}>
            <strong style={{ color: '#d6cdbd', fontWeight: 500 }}>{POLICY_TEXT[b.cancellationPolicy].label} cancellation.</strong> {POLICY_TEXT[b.cancellationPolicy].summary}
            {Number(b.cautionDeposit) > 0 ? ' The caution deposit is refunded within 48 hours of check-out.' : ''}
          </p>
        </section>

        {b.refunds.length > 0 && (
          <section className="p-5 space-y-2" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
            <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
              Refunds
            </p>
            {b.refunds.filter((r) => r.status !== 'rejected').map((r) => (
              <div key={r.id} className="flex justify-between gap-3 text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#908673' }}>{r.kind === 'caution' ? 'Caution deposit' : 'Refund'}</span>
                <span style={{ color: '#d6cdbd' }}>
                  {naira(Number(r.amount))} ·{' '}
                  {r.status === 'completed' ? 'sent' : r.status === 'processing' ? 'on its way' : r.status === 'failed' ? 'being retried by our team' : 'being approved'}
                </span>
              </div>
            ))}
          </section>
        )}

        {(() => {
          const cq = guestCancellationQuote(b)
          return b.userId === session.user.id && cq.ok ? <CancelBooking reference={b.reference} quote={cq} /> : null
        })()}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/bookings" className="inline-flex items-center justify-center min-h-12 px-6 text-xs tracking-[0.16em] uppercase" style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            All my bookings
          </Link>
          {!holdLive && !requestLive && b.status !== 'confirmed' && b.status !== 'completed' && (
            <Link href={listingHref} className="inline-flex items-center justify-center min-h-12 px-6 text-xs tracking-[0.16em] uppercase" style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
              Choose dates again
            </Link>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
