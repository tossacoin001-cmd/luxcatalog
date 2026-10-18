// Phase B: pure rules for lease/sale clarity and "tell us what you want"
// requests. Run from the repo root: npx tsx qa/suites/phase-b-unit.ts
import { viewsFor, normalizeView, priceCaption, modeBadge } from '../../src/lib/listing-views'
import { validateEnquiry, briefMessage, topicFromMessage, BRIEF_TOPICS } from '../../src/lib/enquiry'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const keys = (c: string) => viewsFor(c).map((v) => v.key)
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

console.log('1. Views per category')
check('real estate: sale, rent, short stays', eq(keys('real_estate'), ['for_sale', 'for_rent', 'luxury_shortlets']), keys('real_estate'))
check('commercial: sale and lease', eq(keys('commercial'), ['for_sale', 'for_lease']), keys('commercial'))
check('supercars: sale and car rental', eq(keys('supercar'), ['for_sale', 'car_rental']), keys('supercar'))
check('yachts: sale, cruises, aqua homes', eq(keys('yacht'), ['for_sale', 'boat_cruises', 'aqua_homes']), keys('yacht'))
check('labels are plain words', eq(viewsFor('real_estate').map((v) => v.label), ['For Sale', 'For Rent', 'Luxury Shortlets']), viewsFor('real_estate').map((v) => v.label))
check('single-purpose categories have no tabs', ['decor', 'lifestyle_x', 'shortlet'].every((c) => viewsFor(c).length === 0), ['decor', 'shortlet'].map((c) => viewsFor(c).length))
check('executive services and private services use their own pages (no tabs)', viewsFor('private_services').length === 0 && viewsFor('executive_services').length === 0)
check('a valid view is kept', normalizeView('real_estate', 'for_rent') === 'for_rent')
check('an unknown view becomes "all"', normalizeView('real_estate', 'nonsense') === null && normalizeView('real_estate', undefined) === null)
check('a view from another category is refused', normalizeView('commercial', 'for_rent') === null)
check('arrays from the address are handled', normalizeView('real_estate', ['for_rent', 'for_sale']) === 'for_rent')

console.log('2. Price wording')
const cap = (c: string, s: string | null, m = 'sale') => priceCaption(c, s, m)
check('sale: Asking price, no suffix', eq(cap('real_estate', 'for_sale'), { label: 'Asking price', suffix: '' }), cap('real_estate', 'for_sale'))
check('rent: Annual rent per year', eq(cap('real_estate', 'for_rent', 'rent'), { label: 'Annual rent', suffix: 'per year' }), cap('real_estate', 'for_rent', 'rent'))
check('commercial lease: Annual rent per year', eq(cap('commercial', 'for_lease', 'rent'), { label: 'Annual rent', suffix: 'per year' }))
check('shortlet: Nightly rate per night', eq(cap('real_estate', 'luxury_shortlets', 'booking'), { label: 'Nightly rate', suffix: 'per night' }))
check('car rental: Daily rate per day', eq(cap('supercar', 'car_rental', 'booking'), { label: 'Daily rate', suffix: 'per day' }))
check('private services: From', eq(cap('private_services', 'private_chef', 'booking'), { label: 'From', suffix: '' }))
check('a rent-mode listing with no subcategory still says rent', eq(cap('real_estate', null, 'rent'), { label: 'Annual rent', suffix: 'per year' }), cap('real_estate', null, 'rent'))
check('unknown falls back to Asking price', eq(cap('decor', null, 'sale'), { label: 'Asking price', suffix: '' }))
check('badges', modeBadge('real_estate', 'for_sale', 'sale') === 'For sale' && modeBadge('real_estate', 'for_rent', 'rent') === 'For rent' && modeBadge('commercial', 'for_lease', 'rent') === 'For lease' && modeBadge('real_estate', 'luxury_shortlets', 'booking') === 'Short stay' && modeBadge('supercar', 'car_rental', 'booking') === 'Rental')
check('no badge for décor or unknown', modeBadge('decor', 'for_sale', 'sale') === null && modeBadge('lifestyle', null, 'request') === null)

console.log('3. Requests ("tell us what you are looking for")')
const base = { name: 'Tola Bakare', email: 'tola@example.com', phone: '', message: 'Looking for a three-bedroom in Ikoyi under ₦300m, move-in before December.' }
const v = validateEnquiry({ ...base, kind: 'brief' })
check('a request is accepted as its own kind', v.ok && v.data.kind === 'brief', v)
check('no viewing fields on a request', v.ok && v.data.preferredDate === null && v.data.preferredTime === null && v.data.viewingMode === null)
check('too-short request refused', !validateEnquiry({ ...base, kind: 'brief', message: 'hi' }).ok)
check('topics offered', BRIEF_TOPICS.length >= 6 && BRIEF_TOPICS.every((t) => t.key && t.label), BRIEF_TOPICS.length)
check('topics include home, car, stay, private service, chauffeur, other', ['home', 'car', 'stay', 'service', 'chauffeur', 'other'].every((k) => BRIEF_TOPICS.some((t) => t.key === k)), BRIEF_TOPICS.map((t) => t.key))
const m = briefMessage('Private chef', 'Dinner for 6 on 12 December in Ikoyi.')
check('the topic is kept at the top of the message', m === 'Looking for: Private chef\n\nDinner for 6 on 12 December in Ikoyi.', m)
check('the topic can be read back', topicFromMessage(m) === 'Private chef' && topicFromMessage('just a message') === null)
check('no topic: the message is unchanged', briefMessage('', 'Hello there friend') === 'Hello there friend')
check('very long topics are cut', briefMessage('x'.repeat(200), 'Hello there friend').split('\n')[0].length <= 'Looking for: '.length + 80)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
