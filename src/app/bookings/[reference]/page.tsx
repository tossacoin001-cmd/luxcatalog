import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { CheckCircle2, Clock, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react'
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
import ReportConcern from '@/components/booking/ReportConcern'
import { SERVICE_GROUPS } from '@/lib/taxonomy'
import { durationLabel, sessionLabel, SESSION_POLICY_TEXT } from '@/lib/sessions'

export const metadata: Metadata = { title: 'Your booking', robots: { index: false } }
export const dynamic = 'force-dynamic'

const text = { color: '#5e584c', fontFamily: 'var(--font-inter)' }
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
  const isSession = b.unit === 'session'
  const night = b.unit === 'night'
  const policy = (isSession ? SESSION_POLICY_TEXT : POLICY_TEXT)[b.cancellationPolicy]
  // Who's coming: the vetted professional behind a Private Services booking.
  const pro =
    isSession && b.listing.ownerId
      ? await Promise.all([
          prisma.partnerProfile.findUnique({ where: { userId: b.listing.ownerId }, select: { brandName: true, logo: true } }),
          prisma.partnerApplication.findUnique({ where: { userId: b.listing.ownerId }, select: { contactName: true } }),
        ]).then(([profile, app]) => (profile ? { name: profile.brandName, logo: profile.logo, contact: app?.contactName ?? null } : null))
      : null
  const s = b.listing.bookingSettings
  const lastDay = night ? b.endDate : new Date(b.endDate.getTime() - 86_400_000)
  const holdLive = b.status === 'pending_payment' && !!b.holdExpiresAt && b.holdExpiresAt > new Date()
  const requestLive = b.status === 'requested' && !!b.holdExpiresAt && b.holdExpiresAt > new Date()
  const accepted = holdLive && !!b.respondedAt
  const until = b.holdExpiresAt ? b.holdExpiresAt.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) : ''
  const state = b.needsRefund
    ? { icon: <AlertTriangle size={22} style={{ color: '#7a5c24' }} />, title: 'We’ll refund this payment', body: 'Your payment came through after these dates were taken by another guest. Our team will refund you in full and help you find an alternative.' }
    : b.status === 'confirmed' || b.status === 'completed'
      ? { icon: <CheckCircle2 size={22} style={{ color: '#2f6b45' }} />, title: 'Your booking is confirmed', body: isSession ? 'A confirmation and receipt are on their way to your email. Your professional will arrive at the time below; our team is on hand if anything changes.' : 'A confirmation and receipt are on their way to your email. our team will send arrival details before your stay.' }
      : b.status === 'cancelled' && b.paidAt
        ? { icon: <XCircle size={22} style={{ color: '#8a3b2e' }} />, title: 'This booking is cancelled', body: b.cancelledBy === 'guest' ? 'You cancelled this booking. Any refund due is shown below.' : `This booking was cancelled by the ${b.cancelledBy ?? 'team'}. You will receive a full refund.` }
      : requestLive
        ? { icon: <Clock size={22} style={{ color: '#7a5c24' }} />, title: 'Waiting for the host to accept', body: `We’ve sent your request. The host replies by ${until} (Lagos time), and your dates are held until then. No payment has been taken.` }
      : b.status === 'declined'
        ? { icon: <XCircle size={22} style={{ color: '#8a3b2e' }} />, title: 'The host can’t accept this request', body: `${b.declineReason ? `${b.declineReason}. ` : ''}No payment was taken. our team can suggest similar options for your dates.` }
      : accepted
        ? { icon: <CheckCircle2 size={22} style={{ color: '#2f6b45' }} />, title: 'Accepted: complete your booking', body: `The host has accepted. Pay by ${until} (Lagos time) to confirm; your dates are held until then.` }
      : holdLive
        ? { icon: <Clock size={22} style={{ color: '#7a5c24' }} />, title: 'Waiting for your payment', body: 'Your dates are held for a few more minutes. If you’ve paid, this page updates as soon as the payment is confirmed.' }
        : { icon: <XCircle size={22} style={{ color: '#8a3b2e' }} />, title: b.status === 'cancelled' ? 'This booking was cancelled' : b.note?.includes('did not answer') || b.status === 'requested' ? 'The host didn’t reply in time' : 'This booking wasn’t completed', body: 'No payment was taken for it. You can choose your dates again on the listing.' }

  const listingHref = `${categoryHrefs[b.listing.category] ?? '/catalog'}/${b.listing.slug}`
  const sessionRows: [string, string][] = isSession
    ? [
        ['When', `${sessionLabel(b.startDate, b.endDate)} (Lagos time)`],
        ['Package', `${b.packageName ?? 'Session'} · ${durationLabel(Math.round((b.endDate.getTime() - b.startDate.getTime()) / 60_000))}`],
        ...(b.guests ? [['Guests', `${b.guests} guest${b.guests === 1 ? '' : 's'}`] as [string, string]] : []),
        ['Where', `${b.address ?? ''}${b.area && !(b.address ?? '').toLowerCase().includes(b.area.toLowerCase()) ? ` (${b.area})` : ''}`],
        ...(b.serviceNotes ? [['Notes', b.serviceNotes] as [string, string]] : []),
        [b.guests && Number(b.base) !== Number(b.rate) ? `${naira(Number(b.rate))} × ${b.guests} guests` : 'Package', naira(Number(b.base))],
        ...(Number(b.travelFee) > 0 ? [[`Travel (${b.area})`, naira(Number(b.travelFee))] as [string, string]] : []),
        ['Total', naira(Number(b.total))],
        [b.paidAt ? 'Paid' : 'Due', `${naira(Number(b.amountDue))}${b.paidAt ? ` on ${fmt(b.paidAt)}` : ''}`],
        ['Reference', b.reference],
      ]
    : []
  const rows: [string, string][] = isSession ? sessionRows : [
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
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-5 md:px-8 pt-28 md:pt-32 pb-16 space-y-8">
        <div className="p-6 md:p-8 flex items-start gap-4" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }} role="status">
          <span className="shrink-0 mt-1">{state.icon}</span>
          <div>
            <h1 className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
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

        <section className="p-6 md:p-8 space-y-4" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
              {b.listing.location}
            </p>
            <Link href={listingHref} className="text-xl hover:underline" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
              {b.listing.title}
            </Link>
          </div>
          <dl className="space-y-2 text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-1" style={{ borderBottom: '1px solid #d6cfbf' }}>
                <dt style={{ color: '#5e584c' }}>{k}</dt>
                <dd className="text-right" style={{ color: k === 'Total' ? '#14130f' : '#3a362d', fontWeight: k === 'Total' ? 600 : 400 }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs leading-relaxed" style={text}>
            <strong style={{ color: '#3a362d', fontWeight: 500 }}>{policy.label} cancellation.</strong> {policy.summary}
            {Number(b.cautionDeposit) > 0 ? ' The caution deposit is refunded within 48 hours of check-out.' : ''}
          </p>
        </section>

        {pro && (
          <section data-whos-coming className="p-5 md:p-6 flex items-start gap-4" style={{ background: '#fbf9f4', border: '1px solid rgba(20,19,15,0.15)' }}>
            {pro.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pro.logo} alt="" className="w-14 h-14 object-cover shrink-0" style={{ background: '#ece6d9' }} />
            ) : (
              <span className="w-14 h-14 shrink-0 flex items-center justify-center text-xl" style={{ background: '#ece6d9', color: '#7a5c24', fontFamily: 'var(--font-playfair)' }}>
                {pro.name.slice(0, 1)}
              </span>
            )}
            <div>
              <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                Who’s coming
              </p>
              <p className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                {pro.name}
              </p>
              {pro.contact && pro.contact !== pro.name && (
                <p className="text-sm" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
                  {pro.contact}
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                <ShieldCheck size={14} style={{ color: '#2f6b45' }} /> Vetted by Lux Catalog: identity and police character checked.
              </p>
            </div>
          </section>
        )}

        {/* Make the stay effortless: Private Services for guests with a stay. */}
        {night && b.status === 'confirmed' && b.userId === session.user.id && (
          <section data-cross-sell className="p-5 md:p-6 space-y-4" style={{ background: '#fbf9f4', border: '1px solid rgba(20,19,15,0.15)' }}>
            <div>
              <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                Private Services
              </p>
              <h2 className="text-xl md:text-2xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                Make your stay effortless
              </h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: '#3a362d', fontFamily: 'var(--font-inter)' }}>
                A private chef for your first night, a massage after the flight, a barber before the party. Vetted professionals come to you.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_GROUPS.map((g) => (
                <Link
                  key={g.key}
                  href={`/catalog/private-services#${g.key}`}
                  className="flex items-center justify-center text-center min-h-12 px-3 text-[11px] tracking-[0.14em] uppercase transition-colors hover:bg-[rgba(122,92,36,0.05)]"
                  style={{ border: '1px solid rgba(20,19,15,0.23)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
                >
                  {g.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {b.refunds.length > 0 && (
          <section className="p-5 space-y-2" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
            <p className="text-sm" style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}>
              Refunds
            </p>
            {b.refunds.filter((r) => r.status !== 'rejected').map((r) => (
              <div key={r.id} className="flex justify-between gap-3 text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
                <span style={{ color: '#5e584c' }}>{r.kind === 'caution' ? 'Caution deposit' : 'Refund'}</span>
                <span style={{ color: '#3a362d' }}>
                  {naira(Number(r.amount))} ·{' '}
                  {r.status === 'completed' ? 'sent' : r.status === 'processing' ? 'on its way' : r.status === 'failed' ? 'being retried by our team' : 'being approved'}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Guest actions, one per line: cancel (with the refund) and report a concern. */}
        <div className="flex flex-col items-start gap-1">
          {(() => {
            const cq = guestCancellationQuote(b)
            return b.userId === session.user.id && cq.ok ? <CancelBooking reference={b.reference} quote={cq} session={isSession} /> : null
          })()}
          {b.userId === session.user.id && (b.status === 'confirmed' || b.status === 'completed' || (b.status === 'cancelled' && !!b.paidAt)) && <ReportConcern reference={b.reference} />}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/bookings" className="inline-flex items-center justify-center min-h-12 px-6 text-xs tracking-[0.16em] uppercase" style={{ border: '1px solid #d6cfbf', color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            All my bookings
          </Link>
          {!holdLive && !requestLive && b.status !== 'confirmed' && b.status !== 'completed' && (
            <Link href={listingHref} className="inline-flex items-center justify-center min-h-12 px-6 text-xs tracking-[0.16em] uppercase" style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}>
              {isSession ? 'Choose another time' : 'Choose dates again'}
            </Link>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
