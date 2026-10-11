// Private Services: rules for booking a professional by the session.
// Shared by the server (authoritative) and the browser (live preview), so the
// times and price a guest sees are exactly what they get. Pure: no database.
//
// Times are Lagos wall-clock times (UTC+1 all year, no daylight saving).
// A session is [start, start + package duration). Around every booked
// session the provider keeps `bufferMinutes` free to travel; `capacity` is
// how many sessions they can run at once (1 for a solo professional).

import { BOOKING_WINDOW_DAYS, daysBetween, isDay, lagosToday, type Policy, type Range } from '@/lib/booking'

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type DayHours = { from: string; to: string }
export type WorkingHours = Partial<Record<Weekday, DayHours | null>>
export type AreaFee = { area: string; fee: number }

export type ServicePackage = {
  id: string
  name: string
  description: string
  durationMinutes: number
  pricing: 'fixed' | 'per_guest'
  price: number
  minGuests: number
  maxGuests: number | null
}

export type SessionRules = {
  workingHours: WorkingHours
  bufferMinutes: number
  capacity: number
  advanceNoticeHours: number
  areas: AreaFee[]
  instantBook: boolean
  cancellationPolicy: Policy
}

export type Busy = { start: Date; end: Date }

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const WEEKDAY_LABEL: Record<Weekday, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
export const SLOT_STEP_MINUTES = 30

// Where professionals travel to. Prime areas first.
export const LAGOS_AREAS = [
  'Ikoyi',
  'Banana Island',
  'Victoria Island',
  'Eko Atlantic',
  'Oniru',
  'Lekki Phase 1',
  'Lekki–Ajah',
  'Ikeja GRA',
  'Mainland',
]

const MIN = 60_000
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// Lagos day + time -> the exact instant.
export function lagosInstant(day: string, time: string): Date {
  return new Date(`${day}T${time}:00+01:00`)
}

// The exact instant -> Lagos day and time.
export function lagosParts(d: Date): { day: string; time: string } {
  const l = new Date(d.getTime() + 60 * MIN)
  return { day: l.toISOString().slice(0, 10), time: l.toISOString().slice(11, 16) }
}

export function weekdayOf(day: string): Weekday {
  return WEEKDAYS[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]
}

// Start times (Lagos "HH:MM") a package can be booked at on `day`.
export function daySlots(rules: SessionRules, pkg: Pick<ServicePackage, 'durationMinutes'>, day: string, busy: Busy[], closed: Range[], now = new Date()): string[] {
  if (!isDay(day)) return []
  if (daysBetween(lagosToday(now), day) > BOOKING_WINDOW_DAYS) return []
  if (closed.some((c) => c.start <= day && day < c.end)) return []
  const hours = rules.workingHours[weekdayOf(day)]
  if (!hours || !TIME.test(hours.from) || !TIME.test(hours.to)) return []
  const open = minutes(hours.from), close = minutes(hours.to)
  const earliest = now.getTime() + Math.max(0, rules.advanceNoticeHours) * 3_600_000
  const buffer = Math.max(0, rules.bufferMinutes) * MIN
  const slots: string[] = []
  for (let m = open; m + pkg.durationMinutes <= close; m += SLOT_STEP_MINUTES) {
    const start = lagosInstant(day, hhmm(m)).getTime()
    if (start < earliest) continue
    const end = start + pkg.durationMinutes * MIN
    const clashes = busy.filter((b) => start < b.end.getTime() + buffer && b.start.getTime() - buffer < end).length
    if (clashes < Math.max(1, rules.capacity)) slots.push(hhmm(m))
  }
  return slots
}

export type SessionQuote =
  | { ok: true; guests: number; rate: number; base: number; travelFee: number; total: number }
  | { ok: false; error: string }

const money = (n: number) => Math.round(n * 100) / 100

// The authoritative price of a session.
export function sessionQuote(rules: Pick<SessionRules, 'areas'>, pkg: ServicePackage, input: { guests: number; area: string }): SessionQuote {
  const guests = Math.floor(Number(input.guests))
  if (!(guests >= 1)) return { ok: false, error: 'Choose how many guests' }
  if (pkg.pricing === 'per_guest' && guests < pkg.minGuests) return { ok: false, error: `This package is for at least ${pkg.minGuests} guests` }
  if (pkg.maxGuests && guests > pkg.maxGuests) return { ok: false, error: `This package is for up to ${pkg.maxGuests} guests` }
  const area = rules.areas.find((a) => a.area === input.area)
  if (!area) return { ok: false, error: `This professional doesn’t cover ${input.area || 'that area'} yet` }
  const base = money(pkg.pricing === 'per_guest' ? pkg.price * guests : pkg.price)
  const travelFee = money(area.fee)
  return { ok: true, guests, rate: pkg.price, base, travelFee, total: money(base + travelFee) }
}

// Share of the package price refunded if the guest cancels at `now`
// (the travel fee is always refunded: nobody has travelled yet).
export function sessionRefundShare(policy: Policy, start: Date, now = new Date()): number {
  const h = (start.getTime() - now.getTime()) / 3_600_000
  if (h < 0) return 0
  if (policy === 'flexible') return h >= 24 ? 1 : 0.5
  if (policy === 'moderate') return h >= 48 ? 1 : h >= 24 ? 0.5 : 0
  return h >= 168 ? 1 : h >= 48 ? 0.5 : 0
}

export const SESSION_POLICY_TEXT: Record<Policy, { label: string; summary: string }> = {
  flexible: { label: 'Flexible', summary: 'Full refund up to 24 hours before the session. After that, 50% refund.' },
  moderate: { label: 'Moderate', summary: 'Full refund up to 48 hours before the session. 50% refund until 24 hours before. No refund after that.' },
  strict: { label: 'Strict', summary: 'Full refund up to 7 days before the session. 50% refund until 48 hours before. No refund after that.' },
}

// Why a package can't be saved, or null. `floor` is the minimum price (per
// guest for per-guest packages) partners may charge.
export function validatePackage(p: Partial<ServicePackage>, floor?: number): string | null {
  if (!p.name?.trim()) return 'Give each package a name'
  const d = Number(p.durationMinutes)
  if (!Number.isInteger(d) || d < 30 || d > 720 || d % 15) return `“${p.name.trim()}”: choose a length between 30 minutes and 12 hours`
  if (p.pricing !== 'fixed' && p.pricing !== 'per_guest') return `“${p.name.trim()}”: choose per session or per guest`
  const price = Number(p.price)
  if (!(price > 0)) return `“${p.name.trim()}”: add a price`
  if (floor && price < floor) return `“${p.name.trim()}”: the minimum price is ₦${floor.toLocaleString('en-NG')}${p.pricing === 'per_guest' ? ' per guest' : ''}`
  const min = Number(p.minGuests ?? 1), max = p.maxGuests == null ? null : Number(p.maxGuests)
  if (!Number.isInteger(min) || min < 1 || min > 200) return `“${p.name.trim()}”: the minimum guests must be between 1 and 200`
  if (max !== null && (!Number.isInteger(max) || max < min || max > 500)) return `“${p.name.trim()}”: the maximum guests must be at least the minimum`
  return null
}

export function validateHours(h: WorkingHours): string | null {
  const days = WEEKDAYS.filter((d) => h[d])
  if (!days.length) return 'Choose at least one working day'
  for (const d of days) {
    const x = h[d]!
    if (!TIME.test(x.from) || !TIME.test(x.to)) return `${WEEKDAY_LABEL[d]}: choose a start and end time`
    if (minutes(x.to) <= minutes(x.from)) return `${WEEKDAY_LABEL[d]}: the end time must be after the start time`
  }
  return null
}

// "Sat 12 Dec 2026, 18:00–22:00" in Lagos time.
export function sessionLabel(start: Date, end: Date) {
  const s = lagosParts(start), e = lagosParts(end)
  const d = new Date(`${s.day}T00:00:00Z`)
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' })
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} ${part({ month: 'short' })} ${part({ year: 'numeric' })}, ${s.time}–${e.time}`
}

export const durationLabel = (m: number) =>
  m % 60 === 0 ? `${m / 60} hour${m === 60 ? '' : 's'}` : m < 60 ? `${m} minutes` : `${Math.floor(m / 60)}h ${m % 60}m`
