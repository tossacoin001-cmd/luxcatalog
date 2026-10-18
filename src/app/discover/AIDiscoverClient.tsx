'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, RotateCcw, Sparkles, MessageCircle, CheckCircle2, CircleSlash,
  Landmark, BedDouble, Car, Sailboat, ConciergeBell, ShieldCheck, Sofa, Building2, Plane, type LucideIcon,
} from 'lucide-react'
import RequestButton from '@/components/concierge/RequestButton'
import {
  PILLARS, KINDS, SERVICE_OPTIONS, LOCATION_OPTIONS, TASTE_OPTIONS, BEDROOM_OPTIONS, TIME_SLOTS, timeLabel,
  bandsFor, describeBrief, type Brief, type Need, type KindKey, type PillarKey, type Group,
} from '@/lib/discover-brief'

const ICONS: Record<PillarKey, LucideIcon> = {
  homes: Landmark, stays: BedDouble, cars: Car, yachts: Sailboat, services: ConciergeBell, security: ShieldCheck, decor: Sofa, commercial: Building2, experiences: Plane,
}
const UNIT_TITLE: Record<string, string> = { year: ' (per year)', night: ' (per night)', day: ' (per day)', slot: ' (per cruise)', session: ' (per session)', total: '', none: '' }

type Answer = { kind?: KindKey; budget?: string; services?: string[]; bedrooms?: number; start?: string; end?: string; date?: string; time?: string; guests?: number }

const lagosToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)
const gold = { color: '#C9A84C', fontFamily: 'var(--font-inter)' }
const muted = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const field = { background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }
const label = 'block text-[11px] tracking-[0.15em] uppercase mb-1.5'

function Chip({ on, onClick, children, option }: { on: boolean; onClick: () => void; children: React.ReactNode; option: string }) {
  return (
    <button
      type="button"
      data-option={option}
      aria-pressed={on}
      onClick={onClick}
      className="min-h-11 px-4 py-2 text-left text-[13px] leading-snug transition-colors"
      style={{
        border: `1px solid ${on ? '#C9A84C' : '#1e2e1f'}`,
        background: on ? 'rgba(201,168,76,0.12)' : '#0f1a10',
        color: on ? '#C9A84C' : '#d8cfbc',
        fontFamily: 'var(--font-inter)',
      }}
    >
      {children}
    </button>
  )
}

function Group({ name, title, children }: { name: string; title: string; children: React.ReactNode }) {
  return (
    <div data-group={name} role="group" aria-label={title} className="mb-8">
      <p className={label} style={muted}>{title}</p>
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </div>
  )
}

export default function DiscoverClient() {
  const [picked, setPicked] = useState<PillarKey[]>([])
  const [answers, setAnswers] = useState<Partial<Record<PillarKey, Answer>>>({})
  const [location, setLocation] = useState<string[]>([])
  const [taste, setTaste] = useState<string[]>([])
  const [at, setAt] = useState(0)
  const [phase, setPhase] = useState<'ask' | 'loading' | 'results' | 'failed'>('ask')
  const [result, setResult] = useState<{ summary: string; groups: Group[] } | null>(null)

  const steps = ['pillars', ...picked.map((p) => `detail-${p}`), 'where']
  const stepId = steps[Math.min(at, steps.length - 1)]
  const today = lagosToday()

  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const setAnswer = (p: PillarKey, patch: Partial<Answer>) => setAnswers((a) => ({ ...a, [p]: { ...a[p], ...patch } }))
  const kindOf = (p: PillarKey): KindKey | undefined => answers[p]?.kind ?? (PILLARS.find((x) => x.key === p)!.kinds.length === 1 ? PILLARS.find((x) => x.key === p)!.kinds[0] : undefined)

  const brief = (): Brief => ({
    // Only the things they have actually answered (a category with no
    // choice yet has no kind, and must never reach the rules).
    needs: picked.filter((p) => !!kindOf(p)).map((p) => {
      const a = answers[p] ?? {}
      const kind = kindOf(p) as KindKey
      const f = KINDS[kind].fields
      const need: Need = { kind }
      if (a.budget) need.budget = a.budget
      if (f.includes('services') && a.services?.length) need.services = a.services
      if (f.includes('bedrooms') && a.bedrooms) need.bedrooms = a.bedrooms
      if (f.includes('dates') && a.start) { need.start = a.start; if (a.end) need.end = a.end }
      if (f.includes('date') && a.date) need.date = a.date
      if (f.includes('time') && a.time) need.time = a.time
      if (f.includes('guests') && a.guests) need.guests = a.guests
      return need
    }),
    ...(location.length ? { location } : {}),
    ...(taste.length ? { lifestyle: taste } : {}),
  })

  async function submit() {
    setPhase('loading')
    try {
      const res = await fetch('/api/ai/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief: brief() }) })
      const data = await res.json()
      if (!res.ok) throw new Error()
      setResult(data)
      setPhase('results')
    } catch {
      // Never show a technical reason to a visitor: a person picks it up.
      setPhase('failed')
    }
  }

  const restart = () => {
    setPicked([]); setAnswers({}); setLocation([]); setTaste([]); setAt(0); setResult(null); setPhase('ask')
  }

  const canNext = stepId === 'pillars' ? picked.length > 0 : stepId.startsWith('detail-') ? !!kindOf(stepId.slice(7) as PillarKey) : true
  const goNext = () => (stepId === 'where' ? submit() : setAt((n) => n + 1))
  const goBack = () => setAt((n) => Math.max(0, n - 1))

  // Words for a person, built only when a handoff is actually shown.
  const handoffText = () => { const b = brief(); return describeBrief(b.needs.length ? b : { needs: [{ kind: 'experience' }] }) }

  if (phase === 'loading') {
    return (
      <div data-discover className="max-w-xl mx-auto px-6 py-28 text-center" role="status">
        <Sparkles size={22} className="mx-auto mb-5" style={{ color: '#C9A84C' }} />
        <p className="text-sm" style={muted}>Finding what is available for you…</p>
      </div>
    )
  }

  if (phase === 'failed') {
    return (
      <div data-discover className="max-w-xl mx-auto px-6 md:px-12 py-24 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-7" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <Sparkles size={22} style={{ color: '#C9A84C' }} />
        </div>
        <h2 className="text-2xl md:text-3xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>Let’s find it together</h2>
        <p className="text-sm leading-relaxed mb-10" style={muted}>
          Our matching is taking a short break. A specialist can pick up right where you left off; your answers are ready to send along.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <RequestButton topic="Help finding the right match" label="Ask a specialist" initialMessage={handoffText()} className="inline-flex items-center gap-2 px-8 min-h-12 text-xs tracking-[0.2em] uppercase" style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
            <MessageCircle size={14} /> Ask a specialist
          </RequestButton>
          <button type="button" data-discover-restart onClick={restart} className="inline-flex items-center gap-2 min-h-12 px-6 text-xs tracking-wider" style={muted}>
            <RotateCcw size={12} /> Try again
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'results' && result) {
    const b = brief()
    return (
      <div data-discover className="max-w-4xl mx-auto px-5 md:px-12 py-12" >
        <div data-discover-results>
          <div className="p-6 mb-10" style={{ background: '#0f1a10', border: '1px solid rgba(201,168,76,0.2)' }}>
            <div className="flex items-start gap-3">
              <Sparkles size={16} style={{ color: '#C9A84C', flexShrink: 0, marginTop: 2 }} />
              <p className="text-sm leading-relaxed" style={muted}>{result.summary}</p>
            </div>
          </div>

          <div className="space-y-14">
            {result.groups.map((g, i) => (
              <section key={g.kind} data-result-group={g.kind}>
                <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>{g.label}</h2>
                {g.matches.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {g.matches.map((m) => (
                      <article key={m.slug} data-result-card={m.slug} data-availability={m.availability} className="flex flex-col" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
                        {m.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.image} alt="" loading="lazy" className="w-full h-44 object-cover" style={{ opacity: m.availability === 'unavailable' ? 0.55 : 1 }} />
                        )}
                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="text-lg mb-1" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>{m.title}</h3>
                          <p className="text-sm mb-3" style={gold}>
                            {m.priceDisplay}
                            {m.priceNote ? <span style={muted}> {m.priceNote}</span> : null}
                          </p>
                          {m.availability !== 'unchecked' && (
                            <p className="inline-flex items-center gap-1.5 text-xs mb-3" style={{ color: m.availability === 'available' ? '#7fb98a' : '#b98a7f', fontFamily: 'var(--font-inter)' }}>
                              {m.availability === 'available' ? <CheckCircle2 size={14} /> : <CircleSlash size={14} />}
                              {m.availability === 'available' ? 'Available on your dates' : 'Not free on those dates'}
                            </p>
                          )}
                          <p className="text-xs leading-relaxed mb-5" style={muted}>{m.reason}</p>
                          <Link
                            href={m.href}
                            data-result-cta
                            className="mt-auto inline-flex items-center justify-center gap-2 min-h-11 px-5 text-[11px] tracking-[0.16em] uppercase"
                            style={m.availability === 'available' ? { background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' } : { border: '1px solid rgba(201,168,76,0.45)', ...gold }}
                          >
                            {m.availability === 'available' ? 'View and book' : m.availability === 'unavailable' ? 'See other dates' : 'View'} <ArrowRight size={13} />
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {(g.empty || g.missing.length > 0) && (
                  <div className="mt-5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
                    <p className="text-sm leading-relaxed" style={muted}>
                      {g.missing.length > 0 ? `We will arrange ${g.missing.join(', ')} for you personally.` : g.askUs}
                    </p>
                    <RequestButton
                      topic={g.label}
                      label={`Ask us about ${g.label.toLowerCase()}`}
                      initialMessage={describeBrief({ ...b, needs: [b.needs[i]] })}
                      className="shrink-0 inline-flex items-center justify-center gap-2 min-h-11 px-5 text-[11px] tracking-[0.14em] uppercase"
                      style={{ border: '1px solid rgba(201,168,76,0.45)', ...gold }}
                    >
                      <MessageCircle size={14} /> Ask a specialist
                    </RequestButton>
                  </div>
                )}
              </section>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-between gap-4 pt-8" style={{ borderTop: '1px solid #1e2e1f' }}>
            <RequestButton topic="Help finding the right match" label="Ask a specialist" initialMessage={handoffText()} className="inline-flex items-center gap-2 min-h-11 px-6 text-[11px] tracking-[0.16em] uppercase" style={{ border: '1px solid rgba(201,168,76,0.45)', ...gold }}>
              <MessageCircle size={14} /> Not quite right? Ask a specialist
            </RequestButton>
            <button type="button" data-discover-restart onClick={restart} className="inline-flex items-center gap-2 min-h-11 text-xs tracking-wider" style={muted}>
              <RotateCcw size={12} /> Start over
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- Asking ----
  const detailPillar = stepId.startsWith('detail-') ? (stepId.slice(7) as PillarKey) : null
  const pillar = detailPillar ? PILLARS.find((p) => p.key === detailPillar)! : null
  const kind = detailPillar ? kindOf(detailPillar) : undefined
  const a = (detailPillar && answers[detailPillar]) || {}
  const meta = kind ? KINDS[kind] : null
  const bands = kind ? bandsFor(kind) : []

  return (
    <div data-discover className="max-w-3xl mx-auto px-5 md:px-12 py-10 md:py-14">
      <div data-discover-step={stepId}>
        <p data-discover-progress className="text-[11px] tracking-[0.25em] uppercase mb-6" style={gold}>
          Step {Math.min(at, steps.length - 1) + 1} of {steps.length}
        </p>

        {stepId === 'pillars' && (
          <>
            <h2 className="text-2xl md:text-3xl mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>What are you looking for?</h2>
            <p className="text-sm mb-8" style={muted}>Choose as many as you like. We will ask only what matters for each.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
              {PILLARS.map((p) => {
                const Icon = ICONS[p.key]
                const on = picked.includes(p.key)
                return (
                  <button
                    key={p.key}
                    type="button"
                    data-discover-pillar={p.key}
                    aria-pressed={on}
                    onClick={() => setPicked((cur) => toggle(cur, p.key))}
                    className="min-h-28 p-4 flex flex-col items-start gap-2 text-left transition-colors"
                    style={{ border: `1px solid ${on ? '#C9A84C' : '#1e2e1f'}`, background: on ? 'rgba(201,168,76,0.12)' : '#0f1a10' }}
                  >
                    <Icon size={22} style={{ color: '#C9A84C' }} />
                    <span className="text-[15px]" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>{p.label}</span>
                    <span className="text-[11px] leading-snug" style={muted}>{p.line}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {pillar && detailPillar && (
          <>
            <h2 className="text-2xl md:text-3xl mb-8" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>{pillar.label}</h2>

            {pillar.kinds.length > 1 && (
              <Group name="intent" title="What would you like to do?">
                {pillar.kinds.map((k) => (
                  <Chip key={k} option={k} on={kind === k} onClick={() => setAnswer(detailPillar, { kind: k, budget: undefined })}>{KINDS[k].choice}</Chip>
                ))}
              </Group>
            )}

            {meta && (
              <>
                {meta.fields.includes('services') && (
                  <Group name="services" title="Which services? (choose any)">
                    {SERVICE_OPTIONS.map((s) => (
                      <Chip key={s.key} option={s.key} on={!!a.services?.includes(s.key)} onClick={() => setAnswer(detailPillar, { services: toggle(a.services ?? [], s.key) })}>{s.label}</Chip>
                    ))}
                  </Group>
                )}

                {(meta.fields.includes('dates') || meta.fields.includes('date')) && (
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {meta.fields.includes('dates') ? (
                      <>
                        <label className="block"><span className={label} style={muted}>{kind === 'stay' || kind === 'yacht_stay' ? 'Check-in' : 'From'}</span>
                          <input name="start" type="date" min={today} value={a.start ?? ''} onChange={(e) => setAnswer(detailPillar, { start: e.target.value, end: a.end && a.end < e.target.value ? '' : a.end })} className="w-full h-11 px-3 text-base sm:text-sm" style={field} /></label>
                        <label className="block"><span className={label} style={muted}>{kind === 'stay' || kind === 'yacht_stay' ? 'Check-out' : 'Until'}</span>
                          <input name="end" type="date" min={a.start || today} value={a.end ?? ''} onChange={(e) => setAnswer(detailPillar, { end: e.target.value })} className="w-full h-11 px-3 text-base sm:text-sm" style={field} /></label>
                      </>
                    ) : (
                      <label className="block"><span className={label} style={muted}>Date</span>
                        <input name="date" type="date" min={today} value={a.date ?? ''} onChange={(e) => setAnswer(detailPillar, { date: e.target.value })} className="w-full h-11 px-3 text-base sm:text-sm" style={field} /></label>
                    )}
                    {meta.fields.includes('time') && (
                      <label className="block"><span className={label} style={muted}>Time</span>
                        <select name="time" value={a.time ?? ''} onChange={(e) => setAnswer(detailPillar, { time: e.target.value })} className="w-full h-11 px-2 text-sm" style={field}>
                          <option value="">Any time</option>
                          {TIME_SLOTS.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
                        </select></label>
                    )}
                    {meta.fields.includes('guests') && (
                      <label className="block"><span className={label} style={muted}>Guests</span>
                        <input name="guests" type="number" min={1} max={50} inputMode="numeric" value={a.guests ?? ''} onChange={(e) => setAnswer(detailPillar, { guests: e.target.value ? Number(e.target.value) : undefined })} className="w-full h-11 px-3 text-base sm:text-sm" style={field} /></label>
                    )}
                  </div>
                )}

                {!meta.fields.includes('dates') && !meta.fields.includes('date') && meta.fields.includes('guests') && (
                  <label className="block mb-8 max-w-[10rem]"><span className={label} style={muted}>Guests</span>
                    <input name="guests" type="number" min={1} max={50} inputMode="numeric" value={a.guests ?? ''} onChange={(e) => setAnswer(detailPillar, { guests: e.target.value ? Number(e.target.value) : undefined })} className="w-full h-11 px-3 text-base sm:text-sm" style={field} /></label>
                )}

                {meta.fields.includes('bedrooms') && (
                  <Group name="bedrooms" title="Bedrooms (at least)">
                    {BEDROOM_OPTIONS.map((o) => (
                      <Chip key={o.key} option={o.key} on={a.bedrooms === Number(o.key)} onClick={() => setAnswer(detailPillar, { bedrooms: a.bedrooms === Number(o.key) ? undefined : Number(o.key) })}>{o.label}</Chip>
                    ))}
                  </Group>
                )}

                {bands.length > 0 ? (
                  <Group name="budget" title={`Budget${UNIT_TITLE[meta.unit] ?? ''}`}>
                    {bands.map((b) => (
                      <Chip key={b.key} option={b.key} on={a.budget === b.key} onClick={() => setAnswer(detailPillar, { budget: a.budget === b.key ? undefined : b.key })}>{b.label}</Chip>
                    ))}
                  </Group>
                ) : (
                  <p className="text-sm mb-8" style={muted}>These are arranged for you personally, so there is no fixed price. Tell us a little more at the end.</p>
                )}
              </>
            )}
          </>
        )}

        {stepId === 'where' && (
          <>
            <h2 className="text-2xl md:text-3xl mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>Anything else that matters?</h2>
            <p className="text-sm mb-8" style={muted}>Optional. It only helps us choose better.</p>
            <Group name="location" title="Where">
              {LOCATION_OPTIONS.map((o) => <Chip key={o.key} option={o.key} on={location.includes(o.key)} onClick={() => setLocation((l) => toggle(l, o.key))}>{o.label}</Chip>)}
            </Group>
            <Group name="taste" title="Your taste">
              {TASTE_OPTIONS.map((o) => <Chip key={o.key} option={o.key} on={taste.includes(o.key)} onClick={() => setTaste((l) => toggle(l, o.key))}>{o.label}</Chip>)}
            </Group>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-4" style={{ borderTop: '1px solid #1e2e1f' }}>
        {at > 0 ? (
          <button type="button" data-discover-back onClick={goBack} className="inline-flex items-center gap-2 min-h-12 px-3 text-xs tracking-[0.15em] uppercase" style={muted}>
            <ArrowLeft size={14} /> Back
          </button>
        ) : <span />}
        <div className="flex items-center gap-3">
          {stepId === 'where' && (
            <button type="button" data-discover-skip onClick={submit} className="min-h-12 px-4 text-xs tracking-[0.15em] uppercase" style={muted}>Skip</button>
          )}
          <button
            type="button"
            data-discover-next
            disabled={!canNext}
            onClick={goNext}
            className="inline-flex items-center gap-2 min-h-12 px-7 text-xs tracking-[0.2em] uppercase transition-opacity disabled:opacity-40"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            {stepId === 'where' ? 'See my matches' : 'Next'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
