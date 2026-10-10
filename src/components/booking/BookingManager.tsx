'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarX2, Loader2, X } from 'lucide-react'
import DateRangeCalendar, { type Selection } from '@/components/booking/DateRangeCalendar'
import { BOOKING_WINDOW_DAYS, POLICY_TEXT, addDays, lagosToday, naira, toDate, type Policy } from '@/lib/booking'

type Settings = {
  enabled: boolean
  unit: 'night' | 'day'
  rate: number
  cleaningFee: number
  cautionDeposit: number
  minUnits: number
  maxUnits: number
  maxGuests: number | null
  instantBook: boolean
  cancellationPolicy: Policy
  checkInTime: string
  checkOutTime: string
  hoursPerDay: number | null
  advanceNoticeHours: number
}
type Block = { id: string; start: string; end: string; note: string | null; source: string }

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const card = { background: '#0f1a10', border: '1px solid #1e2e1f' }
const inputCls = 'w-full h-11 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]'
const inputStyle = { background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }
const fmt = (day: string) => toDate(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[0.15em] uppercase mb-2" style={text}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="block mt-1 text-xs" style={text}>
          {hint}
        </span>
      )}
    </label>
  )
}

export default function BookingManager({ listingId, published }: { listingId: string; published: boolean }) {
  const [s, setS] = useState<Settings | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Selection>({ first: null, last: null })
  const [note, setNote] = useState('')
  const [closing, setClosing] = useState(false)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const get = async (path: string) => {
      const res = await fetch(path, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(res.status === 401 ? 'Your session has expired. Sign in again.' : data.error || `Could not load (${res.status})`)
      return data
    }
    Promise.all([get(`/api/admin/listings/${listingId}/booking`), get(`/api/admin/listings/${listingId}/blocks`)])
      .then(([b, c]) => {
        if (cancelled) return
        setS(b.settings)
        setBlocks(c.blocks ?? [])
        setLoadError(null)
      })
      .catch((err) => !cancelled && setLoadError((err as Error).message || 'Could not load booking settings'))
    return () => {
      cancelled = true
    }
  }, [listingId, attempt])

  if (loadError) {
    return (
      <p className="text-sm p-4" role="alert" style={{ background: 'rgba(232,92,76,0.08)', color: '#e8b4b4', fontFamily: 'var(--font-inter)' }}>
        {loadError}{' '}
        <button type="button" onClick={() => { setLoadError(null); setAttempt((n) => n + 1) }} className="underline" style={{ color: '#C9A84C' }}>
          Try again
        </button>
      </p>
    )
  }
  if (!s) {
    return (
      <p className="flex items-center gap-2 text-sm" style={text}>
        <Loader2 size={14} className="animate-spin" /> Loading…
      </p>
    )
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v })
  const num = (v: string) => (v === '' ? 0 : Number(v))
  const per = s.unit === 'night' ? 'night' : 'day'

  async function save(next = s!) {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/booking`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setS(next)
      toast.success(next.enabled ? 'Saved. Guests can now pick dates on this listing.' : 'Saved.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function closeDates() {
    if (!sel.first) return
    const last = sel.last ?? sel.first
    setClosing(true)
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/blocks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ first: sel.first, last, note }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBlocks((b) => [...b, data.block].sort((x, y) => x.start.localeCompare(y.start)))
      setSel({ first: null, last: null })
      setNote('')
      toast.success('Dates closed.')
    } catch (err) {
      toast.error((err as Error).message || 'Could not close those dates')
    } finally {
      setClosing(false)
    }
  }

  async function reopen(id: string) {
    const res = await fetch(`/api/admin/listings/${listingId}/blocks`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ blockId: id }) })
    if (res.ok) {
      setBlocks((b) => b.filter((x) => x.id !== id))
      toast.success('Dates reopened.')
    } else toast.error('Could not reopen those dates')
  }

  return (
    <div className="space-y-10">
      {/* Online booking switch */}
      <section className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ ...card, borderColor: s.enabled ? 'rgba(111,191,115,0.4)' : '#1e2e1f' }}>
        <div>
          <p className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {s.enabled ? 'Online booking is on' : 'Online booking is off'}
          </p>
          <p className="text-sm mt-1" style={text}>
            {s.enabled
              ? 'Guests pick dates and see the exact price on the listing.'
              : 'Guests can only send an enquiry. Set your price below, then turn booking on.'}
            {!published && ' This listing is not published yet, so guests can’t see it.'}
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => save({ ...s, enabled: !s.enabled })}
          className="shrink-0 min-h-11 px-6 text-xs tracking-[0.16em] uppercase disabled:opacity-50"
          style={s.enabled ? { border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' } : { background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {s.enabled ? 'Turn off' : 'Turn on booking'}
        </button>
      </section>

      {/* Pricing and rules */}
      <section className="space-y-5">
        <h2 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          Price and rules
        </h2>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Priced per">
            <select value={s.unit} onChange={(e) => set('unit', e.target.value as Settings['unit'])} className={inputCls} style={inputStyle}>
              <option value="night">Night (stays)</option>
              <option value="day">Day (cars, chauffeurs, protection)</option>
            </select>
          </Field>
          <Field label={`Price per ${per} (₦)`} hint={s.rate ? naira(s.rate) : undefined}>
            <input type="number" min={0} inputMode="numeric" value={s.rate || ''} onChange={(e) => set('rate', num(e.target.value))} className={inputCls} style={inputStyle} />
          </Field>
          {s.unit === 'night' && (
            <Field label="Cleaning fee (₦, once per stay)">
              <input type="number" min={0} inputMode="numeric" value={s.cleaningFee || ''} onChange={(e) => set('cleaningFee', num(e.target.value))} className={inputCls} style={inputStyle} />
            </Field>
          )}
          <Field label="Refundable caution deposit (₦)" hint="Charged with the booking, returned within 48 hours of check-out unless you report damage.">
            <input type="number" min={0} inputMode="numeric" value={s.cautionDeposit || ''} onChange={(e) => set('cautionDeposit', num(e.target.value))} className={inputCls} style={inputStyle} />
          </Field>
          <Field label={`Minimum ${per}s`}>
            <input type="number" min={1} value={s.minUnits} onChange={(e) => set('minUnits', num(e.target.value))} className={inputCls} style={inputStyle} />
          </Field>
          <Field label={`Maximum ${per}s`}>
            <input type="number" min={1} value={s.maxUnits} onChange={(e) => set('maxUnits', num(e.target.value))} className={inputCls} style={inputStyle} />
          </Field>
          {s.unit === 'night' ? (
            <>
              <Field label="Check-in from">
                <input type="time" value={s.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Check-out by">
                <input type="time" value={s.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value)} className={inputCls} style={inputStyle} />
              </Field>
              <Field label="Maximum guests">
                <input type="number" min={1} value={s.maxGuests ?? ''} onChange={(e) => set('maxGuests', e.target.value === '' ? null : num(e.target.value))} className={inputCls} style={inputStyle} />
              </Field>
            </>
          ) : (
            <Field label="Hours included per day">
              <input type="number" min={1} max={24} value={s.hoursPerDay ?? ''} onChange={(e) => set('hoursPerDay', e.target.value === '' ? null : num(e.target.value))} className={inputCls} style={inputStyle} />
            </Field>
          )}
          <Field label="Notice needed before a booking starts">
            <select value={s.advanceNoticeHours} onChange={(e) => set('advanceNoticeHours', num(e.target.value))} className={inputCls} style={inputStyle}>
              <option value={0}>Same day</option>
              <option value={24}>1 day</option>
              <option value={48}>2 days</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
          </Field>
          <Field label="Booking type">
            <select value={s.instantBook ? 'instant' : 'request'} onChange={(e) => set('instantBook', e.target.value === 'instant')} className={inputCls} style={inputStyle}>
              <option value="instant">Instant: guests book and pay at once</option>
              <option value="request">On request: you accept within 12 hours</option>
            </select>
          </Field>
        </div>
        <Field label="Cancellation policy">
          <div className="grid sm:grid-cols-3 gap-3">
            {(Object.keys(POLICY_TEXT) as Policy[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set('cancellationPolicy', p)}
                aria-pressed={s.cancellationPolicy === p}
                className="text-left p-4"
                style={{ ...card, borderColor: s.cancellationPolicy === p ? '#C9A84C' : '#1e2e1f' }}
              >
                <span className="block text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                  {POLICY_TEXT[p].label}
                </span>
                <span className="block mt-1 text-xs leading-relaxed" style={text}>
                  {POLICY_TEXT[p].summary}
                </span>
              </button>
            ))}
          </div>
        </Field>
        <button
          type="button"
          disabled={saving}
          onClick={() => save()}
          className="inline-flex items-center gap-2 min-h-12 px-8 text-xs tracking-[0.18em] uppercase disabled:opacity-50"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {saving && <Loader2 size={14} className="animate-spin" />} Save price and rules
        </button>
      </section>

      {/* Calendar */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Calendar
          </h2>
          <p className="text-sm mt-1" style={text}>
            Close days you&apos;re not available (personal use, maintenance, bookings taken elsewhere). Tap the first and last day, then close them.
          </p>
        </div>
        <div className="p-5" style={card}>
          <DateRangeCalendar unit="day" earliest={lagosToday()} latest={addDays(lagosToday(), BOOKING_WINDOW_DAYS)} blocked={blocks} value={sel} onChange={setSel} />
          {sel.first && (
            <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end">
              <Field label="Reason (only you and our team see this)">
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. Owner stay" className={inputCls} style={inputStyle} />
              </Field>
              <button
                type="button"
                disabled={closing}
                onClick={closeDates}
                className="shrink-0 inline-flex items-center justify-center gap-2 min-h-11 px-5 text-xs tracking-[0.14em] uppercase disabled:opacity-50"
                style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
              >
                <CalendarX2 size={14} /> Close {fmt(sel.first)}
                {sel.last && sel.last !== sel.first ? ` – ${fmt(sel.last)}` : ''}
              </button>
            </div>
          )}
        </div>
        {blocks.length > 0 && (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 p-3" style={card}>
                <span className="text-sm" style={{ color: '#d6cdbd', fontFamily: 'var(--font-inter)' }}>
                  {fmt(b.start)}
                  {addDays(b.start, 1) !== b.end ? ` – ${fmt(addDays(b.end, -1))}` : ''}
                  {b.note && <span style={text}> · {b.note}</span>}
                </span>
                <button type="button" onClick={() => reopen(b.id)} aria-label={`Reopen ${fmt(b.start)}`} className="inline-flex items-center justify-center w-11 h-11" style={{ color: '#908673' }}>
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
