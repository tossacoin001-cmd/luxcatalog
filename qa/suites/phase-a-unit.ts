// Phase A: pure rules. Cart validation (décor orders), enquiry and viewing
// request validation, and our own Discover matching (no AI provider).
// Run from the repo root: npx tsx qa/suites/phase-a-unit.ts
import { validateCart, MAX_QTY } from '../../src/lib/orders'
import { validateEnquiry, VIEWING_TIMES, VIEWING_MODES } from '../../src/lib/enquiry'
import { matchListings } from '../../src/lib/discover'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const now = new Date('2026-11-01T09:00:00Z')

console.log('1. Cart')
let c = validateCart([{ listingId: 'a', quantity: 2 }, { listingId: 'b', quantity: 1 }])
check('a normal cart passes', c.ok && c.items.length === 2, c)
c = validateCart([{ listingId: 'a', quantity: 1 }, { listingId: 'a', quantity: 2 }])
check('the same item twice is merged', c.ok && c.items.length === 1 && c.items[0].quantity === 3, c)
for (const q of [0, -1, 1.5, NaN, '2' as unknown as number]) check(`quantity ${String(q)} refused`, !validateCart([{ listingId: 'a', quantity: q }]).ok)
check(`more than ${MAX_QTY} of one item refused`, !validateCart([{ listingId: 'a', quantity: MAX_QTY + 1 }]).ok && MAX_QTY === 10)
check('empty cart refused', !validateCart([]).ok)
check('missing listing id refused', !validateCart([{ listingId: '', quantity: 1 }]).ok)
check('more than 20 different items refused', !validateCart(Array.from({ length: 21 }, (_, i) => ({ listingId: `x${i}`, quantity: 1 }))).ok)

console.log('2. Enquiries')
const base = { name: 'Tola Bakare', email: 'tola@example.com', phone: '+234 803 000 0000', message: 'Is the Banana Island villa still available? I would like the full brochure.' }
check('a normal enquiry passes', validateEnquiry(base, now).ok)
check('name required', !validateEnquiry({ ...base, name: ' ' }, now).ok)
check('valid email required', !validateEnquiry({ ...base, email: 'tola@' }, now).ok)
check('message required (at least a few words)', !validateEnquiry({ ...base, message: 'hi' }, now).ok)
check('very long message refused', !validateEnquiry({ ...base, message: 'x'.repeat(3001) }, now).ok)
check('very long name refused', !validateEnquiry({ ...base, name: 'x'.repeat(121) }, now).ok)
check('times offered for viewings', JSON.stringify(VIEWING_TIMES.map((t) => t.key)) === JSON.stringify(['morning', 'afternoon', 'evening']))
check('in person or video', JSON.stringify(VIEWING_MODES.map((m) => m.key)) === JSON.stringify(['in_person', 'video']))
const viewing = { ...base, kind: 'viewing', preferredDate: '2026-11-05', preferredTime: 'morning', viewingMode: 'in_person' }
let v = validateEnquiry(viewing, now)
check('a viewing request passes', v.ok && v.data.kind === 'viewing' && v.data.preferredDate?.toISOString().slice(0, 10) === '2026-11-05' && v.data.preferredTime === 'morning' && v.data.viewingMode === 'in_person', v)
check('viewing needs a date', !validateEnquiry({ ...viewing, preferredDate: '' }, now).ok)
check('viewing today or in the past refused', !validateEnquiry({ ...viewing, preferredDate: '2026-11-01' }, now).ok && !validateEnquiry({ ...viewing, preferredDate: '2026-10-20' }, now).ok)
check('viewing more than 90 days ahead refused', !validateEnquiry({ ...viewing, preferredDate: '2027-03-01' }, now).ok)
check('unknown time refused', !validateEnquiry({ ...viewing, preferredTime: 'midnight' }, now).ok)
check('unknown mode refused', !validateEnquiry({ ...viewing, viewingMode: 'teleport' }, now).ok)
v = validateEnquiry({ ...base, kind: 'something' }, now)
check('unknown kind becomes a normal enquiry', v.ok && v.data.kind === 'enquiry', v)
check('text is trimmed', validateEnquiry({ ...base, name: '  Tola Bakare  ' }, now).ok && validateEnquiry({ ...base, name: '  Tola Bakare  ' }, now).data?.name === 'Tola Bakare')

console.log('3. Our own Discover matching')
const L = [
  { slug: 'ikoyi-villa', title: 'Ikoyi Waterfront Villa', category: 'real_estate', price: 1_200_000_000, location: 'Ikoyi, Lagos', description: 'Private waterfront family home with staff quarters.' },
  { slug: 'lekki-flat', title: 'Lekki Phase 1 Apartment', category: 'real_estate', price: 85_000_000, location: 'Lekki Phase 1, Lagos', description: 'Modern apartment.' },
  { slug: 'g-wagon', title: 'Mercedes G63', category: 'supercar', price: 450_000_000, location: 'Victoria Island, Lagos', description: 'Bold and iconic.' },
  { slug: 'abuja-office', title: 'Maitama Office Floor', category: 'commercial', price: null, location: 'Maitama, Abuja', description: 'Grade A office for lease.' },
]
let m = matchListings({ categories: ['real_estate'], budget: '500m_2b', location: ['lagos_island'], lifestyle: ['family'] }, L)
check('best match first: Ikoyi villa (category, budget, area, family)', m[0]?.slug === 'ikoyi-villa', m)
check('only chosen categories', m.every((x) => L.find((l) => l.slug === x.slug)!.category === 'real_estate'), m)
check('each match explains why', m.every((x) => x.reason.length > 10), m)
m = matchListings({ categories: ['supercar', 'real_estate'], budget: 'under_100m' }, L)
check('budget ranks the in-budget home first', m[0]?.slug === 'lekki-flat', m)
m = matchListings({ categories: ['commercial'], location: ['abuja'] }, L)
check('price on application still matches', m[0]?.slug === 'abuja-office', m)
m = matchListings({ categories: ['yacht'] }, L)
check('nothing in a category returns an empty list (not other things)', m.length === 0, m)
m = matchListings({}, L)
check('no answers: everything, at most 6', m.length === 4 && m.length <= 6)
m = matchListings({ categories: 'real_estate' as unknown as string[] }, L)
check('single values are accepted as well as lists', m.length === 2, m)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
