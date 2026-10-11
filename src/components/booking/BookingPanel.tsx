'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarCheck2, Loader2, ShieldCheck } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useCurrency } from '@/components/CurrencyProvider'
import DateRangeCalendar, { type Selection } from '@/components/booking/DateRangeCalendar'
import { BOOKING_WINDOW_DAYS, POLICY_TEXT, addDays, isDay, lagosToday, naira, toDate, unitLabel, type BookingRules, type Quote, type Range } from '@/lib/booking'

type Availability = { rules: BookingRules; earliestStart: string; blocked: Range[] }

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const fmt = (day: string) => toDate(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// The booking side panel for listings that take online bookings. Guests pick
// dates and see the server's exact price. Phase 4a: the request goes to the
// concierge team as a dated enquiry; online payment arrives in Phase 4b.
export default function BookingPanel({ listingId }: { listingId: string; listingTitle?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const { data: session, isPending: sessionPending } = useSession()
  const { rate: fx } = useCurrency()
  // Charged in Naira; the dollar figure is a guide for international guests.
  const usd = (n: number) => (fx ? `≈ $${Math.round(n * fx).toLocaleString('en-US')}` : null)

  const [avail, setAvail] = useState<Availability | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [sel, setSel] = useState<Selection>(() => {
    const s = search.get('start'), e = search.get('end')
    return isDay(s) ? { first: s, last: isDay(e) ? e : null } : { first: null, last: null }
  })
  const [guests, setGuests] = useState<number>(() => Number(search.get('guests')) || 1)
  const [result, setResult] = useState<{ key: string; quote: Quote } | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Availability: state only changes when the request settles.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/listings/${listingId}/availability`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: Availability) => !cancelled && (setAvail(data), setLoadError(false)))
      .catch(() => !cancelled && setLoadError(true))
    return () => {
      cancelled = true
    }
  }, [listingId, attempt])
  const retry = () => {
    setLoadError(false)
    setAttempt((n) => n + 1)
  }

  // Keep the choice in the address so it survives sign-in and sharing.
  useEffect(() => {
    const p = new URLSearchParams(search.toString())
    for (const [k, v] of [['start', sel.first], ['end', sel.last], ['guests', guests > 1 ? String(guests) : null]] as const) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    const next = p.toString()
    if (next !== search.toString()) router.replace(`${pathname}${next ? `?${next}` : ''}#enquire`, { scroll: false })
  }, [sel, guests, pathname, router, search])

  // The quote belongs to one exact selection; anything else is "checking".
  const quoteKey = sel.first && sel.last ? `${sel.first}|${sel.last}|${guests}` : null
  const q = result && result.key === quoteKey ? result.quote : null
  const quoting = !!quoteKey && !q
  useEffect(() => {
    if (!quoteKey) return
    let cancelled = false
    const [first, last, g] = quoteKey.split('|')
    fetch(`/api/listings/${listingId}/quote?start=${first}&end=${last}&guests=${g}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: Quote) => !cancelled && setResult({ key: quoteKey, quote: data }))
      .catch(() => !cancelled && setResult({ key: quoteKey, quote: { ok: false, error: 'Could not get a price. Check your connection.' } }))
    return () => {
      cancelled = true
    }
  }, [quoteKey, listingId])

  const latest = useMemo(() => addDays(lagosToday(), BOOKING_WINDOW_DAYS), [])

  async function request() {
    if (!q?.ok || !avail || sessionPending) return
    // Only once we know they're signed out; a slow session check must not
    // send a signed-in guest to sign-up.
    if (!session) {
      const back = `${pathname}?${search.toString()}#enquire`
      router.push(`/sign-up?redirect_url=${encodeURIComponent(back)}`)
      return
    }
    setSending(true)
    // The server re-prices and holds the dates. Instant booking then goes to
    // Paystack's secure checkout; on-request listings wait for the host.
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listingId, start: sel.first, end: sel.last, guests }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(`${pathname}?${search.toString()}#enquire`)}`)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Could not start your booking. Please try again.')
      if (data.requested) {
        setSent(data.reference)
        setSending(false)
        toast.success('Request sent. The host will reply within 12 hours.')
        return
      }
      if (!data.url) throw new Error('Could not start the payment. Please try again.')
      window.location.assign(data.url)
    } catch (err) {
      toast.error((err as Error).message)
      setResult(null)
      setSending(false)
    }
  }

  if (loadError) {
    return (
      <p className="text-sm" style={text}>
        Availability couldn&apos;t load.{' '}
        <button type="button" onClick={retry} className="underline" style={{ color: '#C9A84C' }}>
          Try again
        </button>
      </p>
    )
  }
  if (!avail) {
    return (
      <div className="flex items-center gap-2 text-sm py-6" style={text}>
        <Loader2 size={14} className="animate-spin" /> Loading availability…
      </div>
    )
  }

  const r = avail.rules
  const per = unitLabel(r.unit)
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
          From
        </p>
        <p className="text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-playfair)', color: '#C9A84C' }}>
          {naira(r.rate)} <span className="text-sm" style={text}>/ {per}</span>
        </p>
        {usd(r.rate) && (
          <p className="text-xs" style={text}>
            {usd(r.rate)} / {per}
          </p>
        )}
        <p className="text-xs mt-1" style={text}>
          {r.unit === 'night'
            ? `Check-in from ${r.checkInTime} · check-out by ${r.checkOutTime}`
            : `${r.hoursPerDay ? `${r.hoursPerDay} hours a day, ` : ''}chauffeur-driven`}
          {r.minUnits > 1 ? ` · minimum ${r.minUnits} ${unitLabel(r.unit, r.minUnits)}` : ''}
        </p>
      </div>

      <DateRangeCalendar months={1} unit={r.unit} earliest={avail.earliestStart} latest={latest} blocked={avail.blocked} value={sel} onChange={(v) => { setSel(v); setSent(null) }} />

      {r.maxGuests && (
        <label className="flex items-center justify-between gap-3 text-sm" style={text}>
          Guests
          <select
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="h-11 px-3 text-sm"
            style={{ background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8' }}
          >
            {Array.from({ length: r.maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}

      <div aria-live="polite">
        {quoting && (
          <p className="flex items-center gap-2 text-sm" style={text}>
            <Loader2 size={14} className="animate-spin" /> Checking price…
          </p>
        )}
        {!quoting && q && !q.ok && (
          <p className="text-sm p-3" style={{ background: 'rgba(232,92,76,0.08)', color: '#e8b4b4', fontFamily: 'var(--font-inter)' }}>
            {q.error}
          </p>
        )}
        {!quoting && q?.ok && (
          <div className="space-y-2 text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
            <p className="text-xs" style={text}>
              {fmt(sel.first!)} → {fmt(sel.last!)}
            </p>
            <Row label={`${naira(q.rate)} × ${q.units} ${unitLabel(q.unit, q.units)}`} value={naira(q.base)} />
            {q.cleaningFee > 0 && <Row label="Cleaning" value={naira(q.cleaningFee)} />}
            <div style={{ height: 1, background: '#1e2e1f' }} />
            <Row label="Total" value={naira(q.total)} strong />
            {usd(q.total) && <p className="text-right text-xs" style={text}>{usd(q.total)} · charged in Naira</p>}
            {q.cautionDeposit > 0 && <Row label="Refundable caution deposit" value={naira(q.cautionDeposit)} muted />}
          </div>
        )}
      </div>

      {sent ? (
        <p className="flex items-start gap-2 text-sm p-3" style={{ background: 'rgba(111,191,115,0.08)', color: '#b9e0bb', fontFamily: 'var(--font-inter)' }}>
          <CalendarCheck2 size={16} className="shrink-0 mt-0.5" />
          <span>
            Request sent. The host replies within 12 hours and you only pay once they accept.{' '}
            <a href={`/bookings/${sent}`} className="underline">
              View your request
            </a>
          </span>
        </p>
      ) : (
        <button
          type="button"
          onClick={request}
          disabled={!q?.ok || sending || sessionPending}
          className="sheen w-full inline-flex items-center justify-center gap-2 min-h-[52px] text-xs tracking-[0.2em] uppercase disabled:opacity-50"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {sending && <Loader2 size={14} className="animate-spin" />}
          {q?.ok ? (r.instantBook ? `Reserve & pay ${naira(q.dueNow)}` : 'Request to book') : r.unit === 'night' ? 'Choose your dates' : 'Choose your days'}
        </button>
      )}
      {q?.ok && !sent && (
        <p className="text-center text-xs" style={text}>
          {r.instantBook
            ? 'Secure payment by Paystack: card, bank transfer or USSD. Instant confirmation.'
            : 'No payment now. The host replies within 12 hours; you pay securely once they accept.'}
        </p>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed" style={text}>
        <ShieldCheck size={14} className="shrink-0 mt-0.5" style={{ color: '#C9A84C' }} />
        <span>
          <strong style={{ color: '#d6cdbd', fontWeight: 500 }}>{POLICY_TEXT[r.cancellationPolicy].label} cancellation.</strong> {POLICY_TEXT[r.cancellationPolicy].summary}
          {r.cautionDeposit > 0 ? ' The caution deposit is refunded within 48 hours of check-out.' : ''}
        </span>
      </p>
    </div>
  )
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: muted ? '#908673' : '#d6cdbd' }}>{label}</span>
      <span style={{ color: strong ? '#f5f0e8' : muted ? '#908673' : '#d6cdbd', fontWeight: strong ? 600 : 400 }}>{value}</span>
    </div>
  )
}
