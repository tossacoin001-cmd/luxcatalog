// Private Services S3: pure aftercare rules (reminder window, concerns,
// stay prefill). Run from the repo root: npx tsx .services-s3-unit.tmp.ts
import { CONCERN_KINDS, MAX_CONCERNS_PER_BOOKING, REMINDER_HOURS, reminderDue, validateConcern, stayAddress, areaFromLocation } from '../../src/lib/aftercare'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const now = new Date('2026-12-11T06:00:00Z') // 07:00 Lagos, when the daily job runs
const inH = (h: number) => new Date(now.getTime() + h * 3_600_000)

console.log('1. Reminder window')
check('36-hour window', REMINDER_HOURS === 36)
check('a session later today is due', reminderDue(inH(10), now))
check('a session tomorrow evening is due', reminderDue(inH(35), now))
check('exactly 36 hours ahead is due', reminderDue(inH(36), now))
check('more than 36 hours ahead waits for tomorrow’s run', !reminderDue(inH(37), now))
check('a session already started is not reminded', !reminderDue(inH(-1), now))

console.log('2. Concerns')
check('five kinds, safety first and urgent', CONCERN_KINDS.length === 5 && CONCERN_KINDS[0].key === 'safety' && CONCERN_KINDS[0].urgent === true && CONCERN_KINDS.filter((k) => k.urgent).length === 1, CONCERN_KINDS)
check('kinds cover no-show, quality, payment and other', ['no_show', 'quality', 'billing', 'other'].every((k) => CONCERN_KINDS.some((c) => c.key === k)))
check('every kind has a plain label', CONCERN_KINDS.every((k) => k.label.length > 3))
check('a clear report passes', validateConcern('quality', 'The chef arrived but the food was cold and two courses were missing.') === null)
check('unknown kind refused', !!validateConcern('rude', 'Something happened during the session that I want to report.'))
check('too short refused', !!validateConcern('other', 'bad'))
check('very long refused', !!validateConcern('other', 'x'.repeat(2001)))
check('at most 5 reports per booking', MAX_CONCERNS_PER_BOOKING === 5)

console.log('3. Stay prefill')
const stay = { reference: 'LUX-ABC234', title: 'Ikoyi Penthouse', location: 'Ikoyi, Lagos' }
check('address names the stay and its reference', stayAddress(stay) === 'Ikoyi Penthouse, Ikoyi, Lagos (Lux Catalog stay LUX-ABC234). Flat/unit: ', stayAddress(stay))
check('area found from the stay location', areaFromLocation('Ikoyi, Lagos', ['Ikoyi', 'Victoria Island']) === 'Ikoyi')
check('VI shorthand recognised', areaFromLocation('Adeola Odeku, VI, Lagos', ['Ikoyi', 'Victoria Island']) === 'Victoria Island')
check('longest match wins (Lekki Phase 1 over Lekki)', areaFromLocation('Lekki Phase 1, Lagos', ['Lekki–Ajah', 'Lekki Phase 1']) === 'Lekki Phase 1')
check('no match leaves it for the guest', areaFromLocation('Abuja', ['Ikoyi']) === null)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
