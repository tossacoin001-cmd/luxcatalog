'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, isBlocked, toDate, toDay, type Range, type Unit } from '@/lib/booking'

// Month-grid range picker. Shows two months side by side from tablet up,
// one on phones. Days before `earliest`, after `latest`, or closed are
// disabled. For stays ("night"), the check-out day may be the first day of
// a closed range (the next guest arrives that day); for hire ("day"),
// every day from first to last must be open.

export type Selection = { first: string | null; last: string | null }

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const monthStart = (day: string) => `${day.slice(0, 7)}-01`
const addMonths = (first: string, n: number) => {
  const d = toDate(first)
  return toDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))
}
const monthLabel = (first: string) => toDate(first).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const longLabel = (day: string) => toDate(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function monthDays(first: string): (string | null)[] {
  const d = toDate(first)
  const lead = (d.getUTCDay() + 6) % 7 // Monday first
  const count = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))]
}

export default function DateRangeCalendar({
  unit,
  earliest,
  latest,
  blocked,
  value,
  onChange,
  months: monthCount = 2,
}: {
  unit: Unit
  earliest: string
  latest: string
  blocked: Range[]
  value: Selection
  onChange: (v: Selection) => void
  // Months shown side by side from tablet up (always one on phones).
  months?: 1 | 2
}) {
  const [view, setView] = useState(() => monthStart(value.first ?? earliest))
  const minMonth = monthStart(earliest)
  const maxMonth = monthStart(latest)

  // While choosing the end, days after the first closed day are out of reach.
  const firstClosedAfterStart = useMemo(() => {
    if (!value.first || value.last) return null
    const next = blocked.filter((b) => b.start > value.first!).map((b) => b.start).sort()[0]
    return next ?? null
  }, [blocked, value.first, value.last])

  function state(day: string) {
    const outOfWindow = day < earliest || day > latest
    const closed = isBlocked(day, blocked)
    const choosingEnd = !!value.first && !value.last
    let disabled = outOfWindow || closed
    if (choosingEnd && day > value.first!) {
      // Stay: check-out may land on a closed day; hire: every day must be open.
      const limit = firstClosedAfterStart
      const pastLimit = limit ? (unit === 'night' ? day > limit : day >= limit) : false
      disabled = day > latest || pastLimit
    }
    const isFirst = day === value.first
    const isLast = day === value.last
    const inRange = !!value.first && !!value.last && day > value.first && day < value.last
    return { disabled, closed, isFirst, isLast, inRange }
  }

  function pick(day: string) {
    const { first, last } = value
    if (!first || last || day < first) return onChange({ first: day, last: null })
    if (day === first) return unit === 'day' ? onChange({ first, last: day }) : onChange({ first: null, last: null })
    onChange({ first, last: day })
  }

  const months = monthCount === 2 ? [view, addMonths(view, 1)] : [view]
  return (
    <div className="select-none" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setView(addMonths(view, -1))}
          disabled={view <= minMonth}
          aria-label="Previous month"
          className="inline-flex items-center justify-center w-11 h-11 disabled:opacity-25"
          style={{ color: '#C9A84C' }}
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-xs tracking-[0.18em] uppercase" style={{ color: '#9a8f7a' }} aria-live="polite">
          {value.first && !value.last ? (unit === 'night' ? 'Now choose check-out' : 'Now choose the last day') : unit === 'night' ? 'Choose check-in' : 'Choose the first day'}
        </p>
        <button
          type="button"
          onClick={() => setView(addMonths(view, 1))}
          disabled={view >= maxMonth}
          aria-label="Next month"
          className="inline-flex items-center justify-center w-11 h-11 disabled:opacity-25"
          style={{ color: '#C9A84C' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className={monthCount === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-6' : ''}>
        {months.map((m, mi) => (
          <div key={m} className={mi === 1 ? 'hidden sm:block' : ''}>
            <p className="text-center text-sm mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              {monthLabel(m)}
            </p>
            <div className="grid grid-cols-7 text-center text-[11px] mb-1" style={{ color: '#908673' }} aria-hidden>
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1" role="grid" aria-label={monthLabel(m)}>
              {monthDays(m).map((day, i) => {
                if (!day) return <span key={`e${i}`} />
                const s = state(day)
                const selected = s.isFirst || s.isLast
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={s.disabled}
                    onClick={() => pick(day)}
                    aria-pressed={selected}
                    aria-label={`${longLabel(day)}${s.closed ? ', unavailable' : ''}`}
                    className="h-10 text-sm transition-colors disabled:cursor-not-allowed"
                    style={{
                      background: selected ? '#C9A84C' : s.inRange ? 'rgba(201,168,76,0.16)' : 'transparent',
                      color: selected ? '#080c08' : s.disabled ? '#4a4538' : '#e8e0d0',
                      textDecoration: s.closed && !selected ? 'line-through' : 'none',
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {Number(day.slice(8))}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
