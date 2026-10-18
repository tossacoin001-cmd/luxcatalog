// Private Services S2: pure session rules (Lagos time, slots, buffer,
// capacity, notice, pricing, cancellation windows, validation).
// Run from the repo root: npx tsx .services-s2-unit.tmp.ts
import {
  LAGOS_AREAS, WEEKDAYS, SLOT_STEP_MINUTES, lagosInstant, lagosParts, weekdayOf, daySlots, sessionQuote,
  sessionRefundShare, SESSION_POLICY_TEXT, validatePackage, validateHours, sessionLabel,
  type SessionRules, type ServicePackage,
} from '../../src/lib/sessions'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// 2026-12-12 is a Saturday, 2026-12-13 a Sunday.
const SAT = '2026-12-12', SUN = '2026-12-13'
const rules = (o: Partial<SessionRules> = {}): SessionRules => ({
  workingHours: { mon: { from: '09:00', to: '20:00' }, tue: { from: '09:00', to: '20:00' }, wed: { from: '09:00', to: '20:00' }, thu: { from: '09:00', to: '20:00' }, fri: { from: '09:00', to: '20:00' }, sat: { from: '09:00', to: '20:00' }, sun: null },
  bufferMinutes: 60, capacity: 1, advanceNoticeHours: 24, areas: [{ area: 'Ikoyi', fee: 0 }, { area: 'Victoria Island', fee: 5000 }],
  instantBook: true, cancellationPolicy: 'moderate', ...o,
})
const pkg = (o: Partial<ServicePackage> = {}): ServicePackage => ({ id: 'p1', name: 'Dinner', description: '', durationMinutes: 180, pricing: 'fixed', price: 60000, minGuests: 1, maxGuests: null, ...o })
const EARLY = new Date('2026-11-01T09:00:00Z') // well before the test dates

console.log('1. Lagos time')
check('Lagos 19:00 is 18:00 UTC', lagosInstant(SAT, '19:00').toISOString() === '2026-12-12T18:00:00.000Z', lagosInstant(SAT, '19:00').toISOString())
check('Lagos 00:30 is the previous day 23:30 UTC', lagosInstant(SAT, '00:30').toISOString() === '2026-12-11T23:30:00.000Z')
check('lagosParts reverses it', eq(lagosParts(new Date('2026-12-12T18:00:00Z')), { day: SAT, time: '19:00' }), lagosParts(new Date('2026-12-12T18:00:00Z')))
check('late UTC evening is the next Lagos day', lagosParts(new Date('2026-12-12T23:30:00Z')).day === SUN)
check('weekday of a date', weekdayOf(SAT) === 'sat' && weekdayOf(SUN) === 'sun' && weekdayOf('2026-12-14') === 'mon')
check('seven weekdays, Monday first', eq(WEEKDAYS, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
check('slots every 30 minutes', SLOT_STEP_MINUTES === 30)
check('areas cover prime Lagos', ['Ikoyi', 'Victoria Island', 'Lekki Phase 1', 'Banana Island', 'Eko Atlantic', 'Lekki–Ajah', 'Ikeja GRA', 'Mainland'].every((a) => LAGOS_AREAS.includes(a)), LAGOS_AREAS)

console.log('2. Slots')
let s = daySlots(rules(), pkg(), SAT, [], [], EARLY)
check('first slot at opening time', s[0] === '09:00', s)
check('last slot finishes by closing (20:00 − 3h = 17:00)', s[s.length - 1] === '17:00', s)
check('every 30 minutes in between', s.length === 17 && s[1] === '09:30', s.length)
check('day off has no slots', daySlots(rules(), pkg(), SUN, [], [], EARLY).length === 0)
check('session longer than the day has no slots', daySlots(rules(), pkg({ durationMinutes: 720 }), SAT, [], [], EARLY).length === 0)
// Notice: now is Friday 11 Dec 10:00 Lagos; 24h notice → Saturday from 10:00.
const FRI10 = lagosInstant('2026-12-11', '10:00')
s = daySlots(rules(), pkg(), SAT, [], [], FRI10)
check('notice: nothing earlier than 24h from now', s[0] === '10:00', s[0])
check('notice: same day has nothing left', daySlots(rules(), pkg(), '2026-12-11', [], [], FRI10).length === 0)
check('zero notice still never offers the past', daySlots(rules({ advanceNoticeHours: 0 }), pkg(), '2026-12-11', [], [], FRI10)[0] === '10:00')
// An existing 12:00–15:00 session with a 60-minute buffer blocks 11:00–16:00.
const busy = [{ start: lagosInstant(SAT, '12:00'), end: lagosInstant(SAT, '15:00') }]
s = daySlots(rules(), pkg({ durationMinutes: 120 }), SAT, busy, [], EARLY)
check('a session may end exactly when the buffer starts (09:00–11:00)', s.includes('09:00'), s)
check('nothing that would overlap the buffer (09:30–15:30)', !s.some((t) => t >= '09:30' && t <= '15:30'), s)
check('the next slot starts when the buffer ends (16:00)', s.includes('16:00'), s)
check('zero buffer: back to back allowed', daySlots(rules({ bufferMinutes: 0 }), pkg({ durationMinutes: 120 }), SAT, busy, [], EARLY).includes('10:00'))
check('capacity 2: one booking leaves room', daySlots(rules({ capacity: 2 }), pkg({ durationMinutes: 120 }), SAT, busy, [], EARLY).includes('12:00'))
const busy2 = [...busy, { start: lagosInstant(SAT, '12:30'), end: lagosInstant(SAT, '14:00') }]
check('capacity 2: two overlapping bookings fill it', !daySlots(rules({ capacity: 2 }), pkg({ durationMinutes: 120 }), SAT, busy2, [], EARLY).includes('12:00'))
check('a closed day has no slots', daySlots(rules(), pkg(), SAT, [], [{ start: SAT, end: '2026-12-13' }], EARLY).length === 0)
check('a closed range around the day blocks it', daySlots(rules(), pkg(), SAT, [], [{ start: '2026-12-10', end: '2026-12-15' }], EARLY).length === 0)
check('a closed day next to it does not', daySlots(rules(), pkg(), SAT, [], [{ start: '2026-12-13', end: '2026-12-14' }], EARLY).length === 17)
check('more than a year ahead: no slots', daySlots(rules(), pkg(), '2028-01-08', [], [], EARLY).length === 0)
check('bad date: no slots', daySlots(rules(), pkg(), 'not-a-day', [], [], EARLY).length === 0)

console.log('3. Price')
let q = sessionQuote(rules(), pkg(), { guests: 2, area: 'Ikoyi' })
check('fixed price, free area', q.ok && q.base === 60000 && q.travelFee === 0 && q.total === 60000, q)
q = sessionQuote(rules(), pkg(), { guests: 2, area: 'Victoria Island' })
check('travel fee added for the area', q.ok && q.travelFee === 5000 && q.total === 65000, q)
q = sessionQuote(rules(), pkg(), { guests: 2, area: 'Ikeja GRA' })
check('area not served is refused', !q.ok && /doesn’t cover Ikeja GRA|does not cover Ikeja GRA/.test(q.error), q)
const chef = pkg({ pricing: 'per_guest', price: 45000, minGuests: 4, maxGuests: 10, durationMinutes: 240 })
q = sessionQuote(rules(), chef, { guests: 6, area: 'Victoria Island' })
check('per guest: 6 × ₦45,000 + travel', q.ok && q.base === 270000 && q.total === 275000 && q.guests === 6 && q.rate === 45000, q)
q = sessionQuote(rules(), chef, { guests: 3, area: 'Ikoyi' })
check('per guest: below the minimum is refused', !q.ok && /at least 4 guests/.test(q.error), q)
q = sessionQuote(rules(), chef, { guests: 11, area: 'Ikoyi' })
check('per guest: above the maximum is refused', !q.ok && /up to 10 guests/.test(q.error), q)
q = sessionQuote(rules(), pkg({ maxGuests: 2 }), { guests: 3, area: 'Ikoyi' })
check('fixed price also respects a guest limit', !q.ok, q)
q = sessionQuote(rules(), pkg(), { guests: 0, area: 'Ikoyi' })
check('at least one guest', !q.ok, q)

console.log('4. Cancellation windows')
const start = lagosInstant(SAT, '19:00')
const before = (h: number) => new Date(start.getTime() - h * 3_600_000)
check('flexible: full up to 24h', sessionRefundShare('flexible', start, before(24)) === 1 && sessionRefundShare('flexible', start, before(23.9)) === 0.5)
check('flexible: half until the start, nothing after', sessionRefundShare('flexible', start, before(1)) === 0.5 && sessionRefundShare('flexible', start, before(-1)) === 0)
check('moderate: full up to 48h', sessionRefundShare('moderate', start, before(48)) === 1 && sessionRefundShare('moderate', start, before(47)) === 0.5)
check('moderate: half until 24h, then nothing', sessionRefundShare('moderate', start, before(24)) === 0.5 && sessionRefundShare('moderate', start, before(23)) === 0)
check('strict: full up to 7 days', sessionRefundShare('strict', start, before(168)) === 1 && sessionRefundShare('strict', start, before(167)) === 0.5)
check('strict: half until 48h, then nothing', sessionRefundShare('strict', start, before(48)) === 0.5 && sessionRefundShare('strict', start, before(47)) === 0)
check('policy wording in hours, for every policy', ['flexible', 'moderate', 'strict'].every((p) => /hours|days/.test(SESSION_POLICY_TEXT[p as 'flexible'].summary)))

console.log('5. Validation')
check('a good package passes', validatePackage(pkg(), 50000) === null, validatePackage(pkg(), 50000))
check('name required', !!validatePackage(pkg({ name: ' ' })))
check('duration 30 minutes to 12 hours', !!validatePackage(pkg({ durationMinutes: 15 })) && !!validatePackage(pkg({ durationMinutes: 780 })) && validatePackage(pkg({ durationMinutes: 30 })) === null)
check('duration in 15-minute steps', !!validatePackage(pkg({ durationMinutes: 50 })))
check('price must be positive', !!validatePackage(pkg({ price: 0 })))
check('price below the floor names the minimum', /₦50,000/.test(validatePackage(pkg({ price: 40000 }), 50000) ?? ''), validatePackage(pkg({ price: 40000 }), 50000))
check('per guest: minimum ≤ maximum', !!validatePackage(pkg({ pricing: 'per_guest', minGuests: 6, maxGuests: 4 })))
check('unknown pricing refused', !!validatePackage(pkg({ pricing: 'hourly' as never })))
check('good hours pass', validateHours(rules().workingHours) === null, validateHours(rules().workingHours))
check('closing before opening refused', !!validateHours({ mon: { from: '18:00', to: '09:00' } }))
check('bad time refused', !!validateHours({ mon: { from: '9am', to: '17:00' } }))
check('at least one working day', !!validateHours({}))

console.log('6. Labels')
check('session label in Lagos time', sessionLabel(lagosInstant(SAT, '18:00'), lagosInstant(SAT, '22:00')) === 'Sat 12 Dec 2026, 18:00–22:00', sessionLabel(lagosInstant(SAT, '18:00'), lagosInstant(SAT, '22:00')))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
