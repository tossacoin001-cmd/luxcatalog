'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarCheck2, ChevronLeft, ChevronRight, Loader2, Minus, Plus, ShieldCheck } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { useCurrency } from '@/components/CurrencyProvider'
import { BOOKING_WINDOW_DAYS, addDays, isDay, lagosToday, naira, toDate, toDay } from '@/lib/booking'
import { durationLabel, sessionQuote, type AreaFee, type ServicePackage } from '@/lib/sessions'
import { areaFromLocation, stayAddress, type StayRef } from '@/lib/aftercare'

type Info = {
  packages: ServicePackage[]
  areas: AreaFee[]
  instantBook: boolean
  advanceNoticeHours: number
  policy: { key: string; label: string; summary: string }
}

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const field = { background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const monthStart = (day: string) => `${day.slice(0, 7)}-01`
const addMonths = (first: string, n: number) => {
  const d = toDate(first)
  return toDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))
}
const monthEnd = (first: string) => addDays(addMonths(first, 1), -1)
const monthLabel = (first: string) => toDate(first).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const longLabel = (day: string) => toDate(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
function monthDays(first: string): (string | null)[] {
  const d = toDate(first)
  const lead = (d.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))]
}
// The address and notes typed on this device, kept through sign-up. Only
// read in the browser; the fields render after availability has loaded.
function readDraft(key: string): { address: string; notes: string } {
  if (typeof window === 'undefined') return { address: '', notes: '' }
  try {
    const d = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    return { address: typeof d?.address === 'string' ? d.address : '', notes: typeof d?.notes === 'string' ? d.notes : '' }
  } catch {
    return { address: '', notes: '' }
  }
}
const priceLabel = (p: ServicePackage) => `${naira(p.price)}${p.pricing === 'per_guest' ? ' per guest' : ''}`
const guestRange = (p: ServicePackage) =>
  p.pricing === 'per_guest' ? `${p.minGuests}${p.maxGuests ? `–${p.maxGuests}` : '+'} guests` : p.maxGuests ? `up to ${p.maxGuests} guests` : ''

// Booking a Private Service: package → guests → day → time → where. The
// price is worked out with the same rules the server uses, and the server
// re-checks everything before holding the time.
export default function SessionBookingPanel({ listingId }: { listingId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const { data: session, isPending: sessionPending } = useSession()
  const { rate: fx } = useCurrency()
  const usd = (n: number) => (fx ? `≈ $${Math.round(n * fx).toLocaleString('en-US')}` : null)
  const draftKey = `lux-session-draft-${listingId}`

  const [info, setInfo] = useState<Info | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [pkgId, setPkgId] = useState<string | null>(() => search.get('package'))
  const [guests, setGuests] = useState<number | null>(() => Number(search.get('guests')) || null)
  const [date, setDate] = useState<string | null>(() => (isDay(search.get('date')) ? search.get('date') : null))
  const [time, setTime] = useState<string | null>(() => search.get('time'))
  const [area, setArea] = useState<string>(() => search.get('area') ?? '')
  // The address and notes stay on this device only (they survive sign-up
  // but never go in the page address).
  const [address, setAddress] = useState(() => readDraft(draftKey).address)
  const [notes, setNotes] = useState(() => readDraft(draftKey).notes)
  const [view, setView] = useState(() => monthStart(isDay(search.get('date')) ? search.get('date')! : lagosToday()))
  const [days, setDays] = useState<{ key: string; days: Record<string, string[]> } | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  // The guest's own Lux Catalog stays on the chosen day (for the address).
  const [stays, setStays] = useState<{ date: string; list: StayRef[] } | null>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ address, notes }))
    } catch {}
  }, [draftKey, address, notes])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/listings/${listingId}/sessions`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { info: Info }) => {
        if (cancelled) return
        setInfo(d.info)
        setLoadError(false)
        // One package: choose it for the guest.
        setPkgId((cur) => (cur && d.info.packages.some((p) => p.id === cur) ? cur : d.info.packages.length === 1 ? d.info.packages[0].id : null))
      })
      .catch(() => !cancelled && setLoadError(true))
    return () => {
      cancelled = true
    }
  }, [listingId, attempt])

  const pkg = info?.packages.find((p) => p.id === pkgId) ?? null
  const minG = pkg ? (pkg.pricing === 'per_guest' ? pkg.minGuests : 1) : 1
  const maxG = pkg?.maxGuests ?? 30
  const g = Math.min(Math.max(guests ?? minG, minG), maxG)

  // Free times for the month on screen.
  const today = lagosToday()
  const latest = addDays(today, BOOKING_WINDOW_DAYS)
  const from = view < today ? today : view
  const to = monthEnd(view) > latest ? latest : monthEnd(view)
  const daysKey = pkg && from <= to ? `${pkg.id}|${from}|${to}|${attempt}` : null
  const monthDaysFree = days && days.key === daysKey ? days.days : null
  useEffect(() => {
    if (!daysKey) return
    let cancelled = false
    const [p, f, t] = daysKey.split('|')
    fetch(`/api/listings/${listingId}/sessions?package=${p}&from=${f}&to=${t}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { days: Record<string, string[]> }) => !cancelled && setDays({ key: daysKey, days: d.days }))
      .catch(() => !cancelled && setDays({ key: daysKey, days: {} }))
    return () => {
      cancelled = true
    }
  }, [daysKey, listingId])
  const slots = date && monthDaysFree?.[date] ? monthDaysFree[date] : date && date.slice(0, 7) === view.slice(0, 7) && monthDaysFree ? [] : null

  // Keep the choice in the page address so it survives sign-in and sharing.
  useEffect(() => {
    const p = new URLSearchParams(search.toString())
    for (const [k, v] of [['package', pkgId], ['guests', pkg ? String(g) : null], ['date', date], ['time', time], ['area', area || null]] as const) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    const next = p.toString()
    if (next !== search.toString()) router.replace(`${pathname}${next ? `?${next}` : ''}#enquire`, { scroll: false })
  }, [pkgId, pkg, g, date, time, area, pathname, router, search])

  const signedIn = !!session
  useEffect(() => {
    if (!date || !signedIn) return
    let cancelled = false
    fetch(`/api/bookings/stays?date=${date}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { stays: [] }))
      .then((d: { stays: StayRef[] }) => !cancelled && setStays({ date, list: d.stays ?? [] }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [date, signedIn])
  const staysToday = stays && stays.date === date ? stays.list : []

  function applyStay(s: StayRef) {
    setAddress(stayAddress(s))
    const a = info ? areaFromLocation(s.location, info.areas.map((x) => x.area)) : null
    if (a) setArea(a)
  }

  const q = info && pkg && area ? sessionQuote({ areas: info.areas }, pkg, { guests: g, area }) : null
  const timeOk = !!(date && time && slots?.includes(time))
  const addressOk = address.trim().length >= 10
  const ready = !!(q?.ok && timeOk && addressOk)

  function choosePackage(id: string) {
    setPkgId(id)
    setTime(null)
    setSent(null)
  }

  async function book() {
    if (!ready || !info || sessionPending) return
    if (!session) {
      router.push(`/sign-up?redirect_url=${encodeURIComponent(`${pathname}?${search.toString()}#enquire`)}`)
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listingId, session: { packageId: pkgId, date, time, guests: g, area, address, notes } }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(`${pathname}?${search.toString()}#enquire`)}`)
        return
      }
      if (!res.ok) {
        // Someone may have just taken the time: show fresh availability.
        if (res.status === 409) {
          setTime(null)
          setAttempt((n) => n + 1)
        }
        throw new Error(data.error || 'Could not start your booking. Please try again.')
      }
      try {
        sessionStorage.removeItem(draftKey)
      } catch {}
      if (data.requested) {
        setSent(data.reference)
        setSending(false)
        toast.success('Request sent. The professional will reply within 12 hours.')
        return
      }
      if (!data.url) throw new Error('Could not start the payment. Please try again.')
      window.location.assign(data.url)
    } catch (err) {
      toast.error((err as Error).message)
      setSending(false)
    }
  }

  if (loadError) {
    return (
      <p className="text-sm" style={text}>
        Availability couldn&apos;t load.{' '}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="underline" style={{ color: '#C9A84C' }}>
          Try again
        </button>
      </p>
    )
  }
  if (!info) {
    return (
      <div className="flex items-center gap-2 text-sm py-6" style={text}>
        <Loader2 size={14} className="animate-spin" /> Loading availability…
      </div>
    )
  }

  const minMonth = monthStart(today)
  const maxMonth = monthStart(latest)
  const label = 'block text-[11px] tracking-[0.18em] uppercase mb-2'

  return (
    <div data-session-panel className="space-y-6">
      {/* 1. Package */}
      <div>
        <p className={label} style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
          Choose a package
        </p>
        <div className="space-y-2">
          {info.packages.map((p) => {
            const on = p.id === pkgId
            return (
              <button
                key={p.id}
                type="button"
                data-package={p.id}
                aria-pressed={on}
                onClick={() => choosePackage(p.id)}
                className="w-full text-left p-4 transition-colors"
                style={{ background: on ? 'rgba(201,168,76,0.1)' : '#080c08', border: `1px solid ${on ? '#C9A84C' : '#1e2e1f'}` }}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-base" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                    {p.name}
                  </span>
                  <span className="text-sm shrink-0 text-right" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                    {priceLabel(p)}
                  </span>
                </span>
                <span className="block mt-1 text-xs" style={text}>
                  {durationLabel(p.durationMinutes)}
                  {guestRange(p) ? ` · ${guestRange(p)}` : ''}
                </span>
                {p.description && (
                  <span className="block mt-1 text-xs leading-relaxed" style={{ color: '#cfc6b5', fontFamily: 'var(--font-inter)' }}>
                    {p.description}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {pkg && (
        <>
          {/* 2. Guests */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm" style={{ color: '#d6cdbd', fontFamily: 'var(--font-inter)' }}>
              Guests
            </span>
            <span className="flex items-center gap-1">
              <button type="button" data-guests="dec" aria-label="Fewer guests" disabled={g <= minG} onClick={() => setGuests(g - 1)} className="w-11 h-11 inline-flex items-center justify-center disabled:opacity-30" style={field}>
                <Minus size={14} />
              </button>
              <span data-guests-count className="w-10 text-center text-base" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                {g}
              </span>
              <button type="button" data-guests="inc" aria-label="More guests" disabled={g >= maxG} onClick={() => setGuests(g + 1)} className="w-11 h-11 inline-flex items-center justify-center disabled:opacity-30" style={field}>
                <Plus size={14} />
              </button>
            </span>
          </div>

          {/* 3. Day */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button type="button" aria-label="Previous month" disabled={view <= minMonth} onClick={() => setView(addMonths(view, -1))} className="w-11 h-11 inline-flex items-center justify-center disabled:opacity-30" style={{ color: '#C9A84C' }}>
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                {monthLabel(view)}
              </span>
              <button type="button" aria-label="Next month" disabled={view >= maxMonth} onClick={() => setView(addMonths(view, 1))} className="w-11 h-11 inline-flex items-center justify-center disabled:opacity-30" style={{ color: '#C9A84C' }}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEK.map((w) => (
                <span key={w} className="text-[10px] tracking-wider uppercase py-1" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                  {w}
                </span>
              ))}
              {monthDays(view).map((d, i) => {
                if (!d) return <span key={`x${i}`} />
                const free = !!monthDaysFree?.[d]?.length
                const on = d === date
                return (
                  <button
                    key={d}
                    type="button"
                    data-day={d}
                    disabled={!free}
                    aria-pressed={on}
                    aria-label={`${longLabel(d)}${free ? '' : ', unavailable'}`}
                    onClick={() => {
                      setDate(d)
                      setTime(null)
                    }}
                    className="h-10 text-sm disabled:cursor-not-allowed"
                    style={{
                      fontFamily: 'var(--font-inter)',
                      background: on ? '#C9A84C' : 'transparent',
                      color: on ? '#080c08' : free ? '#f5f0e8' : '#4a4f45',
                      border: `1px solid ${on ? '#C9A84C' : free ? '#1e2e1f' : 'transparent'}`,
                      textDecoration: free ? 'none' : 'line-through',
                    }}
                  >
                    {Number(d.slice(8))}
                  </button>
                )
              })}
            </div>
            {!monthDaysFree && (
              <p className="mt-2 flex items-center gap-2 text-xs" style={text}>
                <Loader2 size={12} className="animate-spin" /> Checking free days…
              </p>
            )}
            {monthDaysFree && !Object.values(monthDaysFree).some((s) => s.length) && (
              <p className="mt-2 text-xs" style={text}>
                No free days this month. Try the next month or ask the concierge.
              </p>
            )}
          </div>

          {/* 4. Time */}
          {date && (
            <div>
              <p className={label} style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                {longLabel(date)}: start time
              </p>
              {slots === null ? (
                <p className="flex items-center gap-2 text-xs" style={text}>
                  <Loader2 size={12} className="animate-spin" /> Checking times…
                </p>
              ) : slots.length ? (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      data-time={t}
                      aria-pressed={t === time}
                      onClick={() => setTime(t)}
                      className="min-h-11 text-sm"
                      style={{ fontFamily: 'var(--font-inter)', background: t === time ? '#C9A84C' : '#080c08', color: t === time ? '#080c08' : '#f5f0e8', border: `1px solid ${t === time ? '#C9A84C' : '#1e2e1f'}` }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={text}>
                  No times left that day. Please choose another day.
                </p>
              )}
            </div>
          )}

          {/* 5. Where */}
          <div className="space-y-3">
            {staysToday.map((st) => (
              <button
                key={st.reference}
                type="button"
                onClick={() => applyStay(st)}
                className="w-full text-left p-3 text-sm"
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px dashed rgba(201,168,76,0.5)', color: '#e4c878', fontFamily: 'var(--font-inter)' }}
              >
                At my Lux Catalog stay: {st.title}
                <span className="block text-xs mt-0.5" style={text}>
                  {st.location} · fills in the address; add your flat or unit
                </span>
              </button>
            ))}
            <label className="block">
              <span className={label} style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                Area
              </span>
              <select name="area" value={area} onChange={(e) => setArea(e.target.value)} className="w-full h-11 px-3 text-sm" style={field}>
                <option value="">Choose your area</option>
                {info.areas.map((a) => (
                  <option key={a.area} value={a.area}>
                    {a.area}
                    {a.fee > 0 ? ` · +${naira(a.fee)} travel` : ' · no travel fee'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label} style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                Full address
              </span>
              <textarea
                name="address"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, building, flat and any gate or estate details"
                className="w-full px-3 py-2 text-base md:text-sm resize-y"
                style={field}
              />
              <span className="block mt-1 text-[11px]" style={text}>
                Shared with your professional only once your booking is paid.
              </span>
            </label>
            <label className="block">
              <span className={label} style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                Notes (optional)
              </span>
              <textarea
                name="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, preferences, the occasion…"
                className="w-full px-3 py-2 text-base md:text-sm resize-y"
                style={field}
              />
            </label>
          </div>

          {/* Price */}
          <div aria-live="polite">
            {q && !q.ok && (
              <p className="text-sm p-3" style={{ background: 'rgba(232,92,76,0.08)', color: '#e8b4b4', fontFamily: 'var(--font-inter)' }}>
                {q.error}
              </p>
            )}
            {q?.ok && (
              <div className="space-y-2 text-sm" style={{ fontFamily: 'var(--font-inter)' }}>
                <Row label={pkg.pricing === 'per_guest' ? `${q.guests} guests × ${naira(q.rate)}` : pkg.name} value={naira(q.base)} />
                {q.travelFee > 0 && <Row label={`Travel (${area})`} value={naira(q.travelFee)} />}
                <div style={{ height: 1, background: '#1e2e1f' }} />
                <div data-total>
                  <Row label="Total" value={naira(q.total)} strong />
                </div>
                {usd(q.total) && <p className="text-right text-xs" style={text}>{usd(q.total)} · charged in Naira</p>}
              </div>
            )}
          </div>

          {sent ? (
            <p className="flex items-start gap-2 text-sm p-3" style={{ background: 'rgba(111,191,115,0.08)', color: '#b9e0bb', fontFamily: 'var(--font-inter)' }}>
              <CalendarCheck2 size={16} className="shrink-0 mt-0.5" />
              <span>
                Request sent. The professional replies within 12 hours and you only pay once they accept.{' '}
                <a href={`/bookings/${sent}`} className="underline">
                  View your request
                </a>
              </span>
            </p>
          ) : (
            <button
              type="button"
              onClick={book}
              disabled={!ready || sending || sessionPending}
              className="sheen w-full inline-flex items-center justify-center gap-2 min-h-[52px] text-xs tracking-[0.2em] uppercase disabled:opacity-50"
              style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              {!date || !time ? 'Choose a day and time' : !area ? 'Choose your area' : !addressOk ? 'Add your address' : q?.ok ? (info.instantBook ? `Reserve & pay ${naira(q.total)}` : 'Request to book') : 'Check your choice'}
            </button>
          )}
          {ready && !sent && (
            <p className="text-center text-xs" style={text}>
              {info.instantBook
                ? 'Secure payment by Paystack: card, bank transfer or USSD. Instant confirmation.'
                : 'No payment now. The professional replies within 12 hours; you pay securely once they accept.'}
            </p>
          )}
        </>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed" style={text}>
        <ShieldCheck size={14} className="shrink-0 mt-0.5" style={{ color: '#C9A84C' }} />
        <span>
          Every professional is identity and police checked by Lux Catalog.{' '}
          <strong style={{ color: '#d6cdbd', fontWeight: 500 }}>{info.policy.label} cancellation.</strong> {info.policy.summary}
        </span>
      </p>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: '#d6cdbd' }}>{label}</span>
      <span style={{ color: strong ? '#f5f0e8' : '#d6cdbd', fontWeight: strong ? 600 : 400 }}>{value}</span>
    </div>
  )
}
