'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { WEEKDAYS, WEEKDAY_LABEL, durationLabel, type AreaFee, type ServicePackage, type Weekday, type WorkingHours } from '@/lib/sessions'

type Settings = {
  enabled: boolean
  instantBook: boolean
  cancellationPolicy: 'flexible' | 'moderate' | 'strict'
  advanceNoticeHours: number
  bufferMinutes: number
  capacity: number
  workingHours: WorkingHours
  areas: AreaFee[]
  packages: (Omit<ServicePackage, 'id'> & { id?: string })[]
}

const text = { color: '#5e584c', fontFamily: 'var(--font-inter)' }
const field = { background: '#f4f0e8', border: '1px solid #d6cfbf', color: '#14130f', fontFamily: 'var(--font-inter)' }
const card = { background: '#fbf9f4', border: '1px solid #d6cfbf' }
const labelCls = 'block text-[11px] tracking-[0.15em] uppercase mb-1.5'
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720]
const NOTICE = [[0, 'No notice'], [3, '3 hours'], [12, '12 hours'], [24, '24 hours'], [48, '2 days'], [72, '3 days'], [168, '1 week']] as const
const BUFFER = [[0, 'None'], [30, '30 minutes'], [60, '1 hour'], [90, '1½ hours'], [120, '2 hours']] as const
const POLICIES = [['flexible', 'Flexible: free until 24h before'], ['moderate', 'Moderate: free until 48h before'], ['strict', 'Strict: free until 7 days before']] as const

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="p-5 md:p-6 space-y-4" style={card}>
      <div>
        <h2 className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
          {title}
        </h2>
        {hint && (
          <p className="text-xs mt-1 leading-relaxed" style={text}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

// Partner/team: set up how a Private Service is booked online.
export default function ServiceBookingManager({ listingId, published }: { listingId: string; published: boolean }) {
  const [s, setS] = useState<Settings | null>(null)
  const [areasAll, setAreasAll] = useState<string[]>([])
  const [floor, setFloor] = useState<number | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/listings/${listingId}/services`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => {
        if (cancelled) return
        setS(d.settings)
        setAreasAll(d.areasAll)
        setFloor(d.floor)
        setLoadError(false)
      })
      .catch(() => !cancelled && setLoadError(true))
    return () => {
      cancelled = true
    }
  }, [listingId, attempt])

  if (loadError) {
    return (
      <p className="text-sm" style={text}>
        Settings couldn&apos;t load.{' '}
        <button type="button" className="underline" style={{ color: '#7a5c24' }} onClick={() => setAttempt((n) => n + 1)}>
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

  const set = (patch: Partial<Settings>) => setS((cur) => (cur ? { ...cur, ...patch } : cur))
  const setPkg = (i: number, patch: Partial<Settings['packages'][number]>) => set({ packages: s.packages.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const setDay = (d: Weekday, v: { from: string; to: string } | null) => set({ workingHours: { ...s.workingHours, [d]: v } })
  const areaOn = (a: string) => s.areas.find((x) => x.area === a)
  const toggleArea = (a: string) => set({ areas: areaOn(a) ? s.areas.filter((x) => x.area !== a) : [...s.areas, { area: a, fee: 0 }] })
  const floorText = floor ? `Minimum ₦${floor.toLocaleString('en-NG')}` : null

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/services`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(s),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not save. Please try again.')
      setS(d.settings)
      toast.success(d.settings.enabled ? 'Saved. Guests can book online.' : 'Saved.')
    } catch (err) {
      setError((err as Error).message)
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-service-manager className="space-y-6">
      <label className="flex items-start gap-3 p-5 cursor-pointer" style={{ ...card, borderColor: s.enabled ? 'rgba(47,107,69,0.45)' : '#d6cfbf' }}>
        <input type="checkbox" name="enabled" checked={s.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="mt-1 w-5 h-5 shrink-0 accent-[#7a5c24]" />
        <span>
          <span className="block text-base" style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}>
            Take bookings online
          </span>
          <span className="block text-xs mt-1 leading-relaxed" style={text}>
            {published ? 'Guests pick a package, day, time and address, and pay securely.' : 'Your listing goes live after our team approves it; bookings open then.'}
          </span>
        </span>
      </label>

      <Section title="Packages" hint={`What guests can book. The listing shows your cheapest package as its "From" price.${floorText ? ` ${floorText} on Lux Catalog.` : ''}`}>
        {s.packages.map((p, i) => (
          <div key={p.id ?? `new-${i}`} data-package-row className="p-4 space-y-3" style={{ border: '1px solid #d6cfbf', background: '#f4f0e8' }}>
            <div className="flex items-start gap-2">
              <label className="block flex-1">
                <span className={labelCls} style={text}>
                  Name
                </span>
                <input name="name" value={p.name} onChange={(e) => setPkg(i, { name: e.target.value })} placeholder="e.g. Seven-course dinner" className="w-full h-11 px-3 text-base md:text-sm" style={field} />
              </label>
              <button type="button" aria-label={`Remove ${p.name || 'package'}`} onClick={() => set({ packages: s.packages.filter((_, j) => j !== i) })} className="mt-6 w-11 h-11 inline-flex items-center justify-center shrink-0" style={{ color: '#5e584c' }}>
                <Trash2 size={16} />
              </button>
            </div>
            <label className="block">
              <span className={labelCls} style={text}>
                What’s included
              </span>
              <textarea name="description" rows={2} value={p.description} onChange={(e) => setPkg(i, { description: e.target.value })} className="w-full px-3 py-2 text-base md:text-sm resize-y" style={field} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls} style={text}>
                  Length
                </span>
                <select name="duration" value={p.durationMinutes} onChange={(e) => setPkg(i, { durationMinutes: Number(e.target.value) })} className="w-full h-11 px-2 text-sm" style={field}>
                  {DURATIONS.map((m) => (
                    <option key={m} value={m}>
                      {durationLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls} style={text}>
                  Priced
                </span>
                <select name="pricing" value={p.pricing} onChange={(e) => setPkg(i, { pricing: e.target.value as 'fixed' | 'per_guest' })} className="w-full h-11 px-2 text-sm" style={field}>
                  <option value="fixed">Per session</option>
                  <option value="per_guest">Per guest</option>
                </select>
              </label>
              <label className="block col-span-2">
                <span className={labelCls} style={text}>
                  Price (₦){p.pricing === 'per_guest' ? ' per guest' : ''}
                </span>
                <input name="price" inputMode="numeric" value={p.price || ''} onChange={(e) => setPkg(i, { price: Number(e.target.value.replace(/\D/g, '')) })} className="w-full h-11 px-3 text-base md:text-sm" style={field} />
                <span className="block mt-1 text-[11px]" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                  {floorText ? `${floorText}${p.pricing === 'per_guest' ? ' per guest' : ''}. ` : ''}Include ingredients, products and your time.
                </span>
              </label>
              <label className="block">
                <span className={labelCls} style={text}>
                  Min guests
                </span>
                <input name="minGuests" inputMode="numeric" value={p.minGuests} onChange={(e) => setPkg(i, { minGuests: Number(e.target.value.replace(/\D/g, '')) || 1 })} className="w-full h-11 px-3 text-base md:text-sm" style={field} />
              </label>
              <label className="block">
                <span className={labelCls} style={text}>
                  Max guests
                </span>
                <input name="maxGuests" inputMode="numeric" value={p.maxGuests ?? ''} placeholder="No limit" onChange={(e) => setPkg(i, { maxGuests: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} className="w-full h-11 px-3 text-base md:text-sm" style={field} />
              </label>
            </div>
          </div>
        ))}
        {s.packages.length < 8 && (
          <button
            type="button"
            onClick={() => set({ packages: [...s.packages, { name: '', description: '', durationMinutes: 120, pricing: 'fixed', price: 0, minGuests: 1, maxGuests: null }] })}
            className="inline-flex items-center gap-2 min-h-11 px-4 text-xs tracking-[0.14em] uppercase"
            style={{ border: '1px dashed rgba(20,19,15,0.25)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
          >
            <Plus size={14} /> Add package
          </button>
        )}
      </Section>

      <Section title="Working hours" hint="When sessions can start and must finish, in Lagos time.">
        <div className="space-y-2">
          {WEEKDAYS.map((d) => {
            const h = s.workingHours[d]
            return (
              <div key={d} data-day-row={d} className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 w-32 min-h-11 cursor-pointer">
                  <input type="checkbox" checked={!!h} onChange={(e) => setDay(d, e.target.checked ? { from: '10:00', to: '20:00' } : null)} className="w-5 h-5 accent-[#7a5c24]" />
                  <span className="text-sm" style={{ color: h ? '#14130f' : '#5e584c', fontFamily: 'var(--font-inter)' }}>
                    {WEEKDAY_LABEL[d]}
                  </span>
                </label>
                {h ? (
                  <span className="flex items-center gap-2">
                    <select name="from" value={h.from} onChange={(e) => setDay(d, { ...h, from: e.target.value })} className="h-11 px-2 text-sm" style={field} aria-label={`${WEEKDAY_LABEL[d]} start`}>
                      {TIMES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <span style={text}>to</span>
                    <select name="to" value={h.to} onChange={(e) => setDay(d, { ...h, to: e.target.value })} className="h-11 px-2 text-sm" style={field} aria-label={`${WEEKDAY_LABEL[d]} end`}>
                      {[...TIMES.slice(1), '23:59'].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </span>
                ) : (
                  <span className="text-xs" style={text}>
                    Day off
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Areas you travel to" hint="Guests choose their area; the travel fee is added to their total. Leave ₦0 for no fee.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {areasAll.map((a) => {
            const on = areaOn(a)
            return (
              <div key={a} data-area={a} className="flex items-center gap-2 p-2" style={{ border: `1px solid ${on ? 'rgba(20,19,15,0.20)' : '#d6cfbf'}` }}>
                <label className="flex items-center gap-2 flex-1 min-h-11 cursor-pointer">
                  <input type="checkbox" checked={!!on} onChange={() => toggleArea(a)} className="w-5 h-5 accent-[#7a5c24]" />
                  <span className="text-sm" style={{ color: on ? '#14130f' : '#5e584c', fontFamily: 'var(--font-inter)' }}>
                    {a}
                  </span>
                </label>
                {on && (
                  <span className="flex items-center gap-1">
                    <span className="text-xs" style={text}>
                      ₦
                    </span>
                    <input
                      name="fee"
                      inputMode="numeric"
                      aria-label={`${a} travel fee`}
                      value={on.fee || ''}
                      placeholder="0"
                      onChange={(e) => set({ areas: s.areas.map((x) => (x.area === a ? { ...x, fee: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)) })}
                      className="w-24 h-11 px-2 text-base md:text-sm"
                      style={field}
                    />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Booking rules">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className={labelCls} style={text}>
              How guests book
            </span>
            <select name="instant" value={s.instantBook ? 'instant' : 'request'} onChange={(e) => set({ instantBook: e.target.value === 'instant' })} className="w-full h-11 px-2 text-sm" style={field}>
              <option value="instant">Instant: they pay and it’s confirmed</option>
              <option value="request">On request: you accept first (12 hours)</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls} style={text}>
              Cancellation
            </span>
            <select name="policy" value={s.cancellationPolicy} onChange={(e) => set({ cancellationPolicy: e.target.value as Settings['cancellationPolicy'] })} className="w-full h-11 px-2 text-sm" style={field}>
              {POLICIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls} style={text}>
              Notice you need
            </span>
            <select name="notice" value={s.advanceNoticeHours} onChange={(e) => set({ advanceNoticeHours: Number(e.target.value) })} className="w-full h-11 px-2 text-sm" style={field}>
              {NOTICE.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls} style={text}>
              Travel time between sessions
            </span>
            <select name="buffer" value={s.bufferMinutes} onChange={(e) => set({ bufferMinutes: Number(e.target.value) })} className="w-full h-11 px-2 text-sm" style={field}>
              {BUFFER.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className={labelCls} style={text}>
              Sessions at the same time
            </span>
            <input name="capacity" inputMode="numeric" value={s.capacity} onChange={(e) => set({ capacity: Number(e.target.value.replace(/\D/g, '')) || 1 })} className="w-full sm:w-32 h-11 px-3 text-base md:text-sm" style={field} />
            <span className="block mt-1 text-[11px]" style={text}>
              1 if you work alone. A team of three vetted professionals can take 3.
            </span>
          </label>
        </div>
      </Section>

      {error && (
        <p role="alert" className="text-sm p-3" style={{ background: 'rgba(138,59,46,0.08)', color: '#8a3b2e', fontFamily: 'var(--font-inter)' }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="sheen w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-12 px-10 text-xs tracking-[0.2em] uppercase disabled:opacity-50"
        style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
      >
        {saving && <Loader2 size={14} className="animate-spin" />} Save
      </button>
    </div>
  )
}
