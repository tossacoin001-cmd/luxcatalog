// Booking rules shared by the server (authoritative) and the browser (live
// preview), so the price a guest sees is the price they are charged.
// Pure: no database, no Node APIs.
//
// Dates are whole days written YYYY-MM-DD and handled at UTC midnight.
// Every stay or hire is a range [start, endExclusive):
// - unit "night" (stays): the guest picks check-in and check-out; check-out
//   day is free for the next guest. Nights = days between.
// - unit "day" (hire): the guest picks the first and last day; both count.

export type Unit = 'night' | 'day'
export type Policy = 'flexible' | 'moderate' | 'strict'

export type BookingRules = {
  unit: Unit
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

export type Range = { start: string; end: string } // end exclusive

const DAY = 86_400_000
export const BOOKING_WINDOW_DAYS = 365

export const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
export const toDate = (day: string) => new Date(`${day}T00:00:00Z`)
export const toDay = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (day: string, n: number) => toDay(new Date(toDate(day).getTime() + n * DAY))
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY)

// Today in Lagos (UTC+1, no daylight saving), as YYYY-MM-DD.
export const lagosToday = (now = new Date()) => toDay(new Date(now.getTime() + 3_600_000))

// The first day a booking may start, given the listing's notice period.
export const earliestStart = (rules: Pick<BookingRules, 'advanceNoticeHours'>, now = new Date()) =>
  addDays(lagosToday(now), Math.ceil(Math.max(0, rules.advanceNoticeHours) / 24))

// Turn what the guest picked into the stored range.
export function selectionToRange(unit: Unit, first: string, last: string): Range {
  return { start: first, end: unit === 'day' ? addDays(last, 1) : last }
}

export const unitsIn = (r: Range) => daysBetween(r.start, r.end)

export const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end

export function isBlocked(day: string, blocked: Range[]) {
  return blocked.some((b) => b.start <= day && day < b.end)
}

export const unitLabel = (unit: Unit, n = 1) => (unit === 'night' ? (n === 1 ? 'night' : 'nights') : n === 1 ? 'day' : 'days')

export const POLICY_TEXT: Record<Policy, { label: string; summary: string }> = {
  flexible: { label: 'Flexible', summary: 'Full refund up to 24 hours before check-in. After that, 50% refund.' },
  moderate: { label: 'Moderate', summary: 'Full refund up to 5 days before check-in. 50% refund until 24 hours before. No refund after that.' },
  strict: { label: 'Strict', summary: '50% refund up to 7 days before check-in. No refund after that. Full refund within 48 hours of booking if check-in is at least 14 days away.' },
}

// Share of the booking (excluding the caution deposit, which is always
// returned) refunded if the guest cancels at `now`.
export function refundShare(policy: Policy, start: string, bookedAt: Date, now = new Date()): number {
  const hoursToStart = (toDate(start).getTime() - now.getTime()) / 3_600_000
  if (policy === 'flexible') return hoursToStart >= 24 ? 1 : 0.5
  if (policy === 'moderate') return hoursToStart >= 120 ? 1 : hoursToStart >= 24 ? 0.5 : 0
  const sinceBooking = (now.getTime() - bookedAt.getTime()) / 3_600_000
  if (sinceBooking <= 48 && hoursToStart >= 14 * 24) return 1
  return hoursToStart >= 7 * 24 ? 0.5 : 0
}

export type Quote =
  | {
      ok: true
      range: Range
      units: number
      unit: Unit
      rate: number
      base: number
      cleaningFee: number
      total: number // what the booking costs
      cautionDeposit: number // refundable, charged with it
      dueNow: number // total + caution deposit
    }
  | { ok: false; error: string }

const money = (n: number) => Math.round(n * 100) / 100

// The authoritative price and availability check for a requested range.
export function quote(rules: BookingRules, range: Range, blocked: Range[], opts: { guests?: number; now?: Date } = {}): Quote {
  if (!isDay(range.start) || !isDay(range.end)) return { ok: false, error: 'Choose your dates' }
  const units = unitsIn(range)
  const word = (n: number) => `${n} ${unitLabel(rules.unit, n)}`
  if (units < 1) return { ok: false, error: rules.unit === 'night' ? 'Check-out must be after check-in' : 'Choose at least one day' }
  const first = earliestStart(rules, opts.now)
  if (range.start < first) return { ok: false, error: `The earliest start for this listing is ${first}` }
  if (daysBetween(lagosToday(opts.now), range.start) > BOOKING_WINDOW_DAYS) return { ok: false, error: 'Bookings open up to a year ahead' }
  if (units < rules.minUnits) return { ok: false, error: `Minimum booking is ${word(rules.minUnits)}` }
  if (units > rules.maxUnits) return { ok: false, error: `Maximum booking is ${word(rules.maxUnits)}` }
  if (rules.maxGuests && opts.guests && opts.guests > rules.maxGuests) return { ok: false, error: `This listing hosts up to ${rules.maxGuests} guests` }
  if (blocked.some((b) => overlaps(range, b))) return { ok: false, error: 'Some of those dates are no longer available' }
  const base = money(rules.rate * units)
  const total = money(base + rules.cleaningFee)
  return {
    ok: true,
    range,
    units,
    unit: rules.unit,
    rate: rules.rate,
    base,
    cleaningFee: rules.cleaningFee,
    total,
    cautionDeposit: rules.cautionDeposit,
    dueNow: money(total + rules.cautionDeposit),
  }
}

export const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
