// Private Services S1: pure rules (taxonomy, vetting, content filter, floors,
// agreement). Run from the repo root: npx tsx .services-unit.tmp.ts
import { SUBCATEGORIES, SERVICE_GROUPS, SERVICE_KEYS, specTemplate, DEFAULT_COMMISSION, resolvePlacement, findSubcategory } from '../../src/lib/taxonomy'
import { PARTNER_TYPES, partnerTypeSpec, isDocRequired, missingForSubmit } from '../../src/lib/partner-requirements'
import { findBannedTerms, SERVICE_FLOOR_DEFAULTS } from '../../src/lib/services'
import { requiredAgreements, agreementByKey } from '../../src/lib/agreements'
import { categoryLabels, categoryHrefs, categoryImages } from '../../src/lib/utils'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))

const EXPECTED = ['private_chef', 'mixologist', 'butler_staff', 'massage_spa', 'personal_training', 'barber', 'hair_stylist', 'makeup_artist', 'nail_technician', 'housekeeping', 'photographer']

console.log('1. Taxonomy')
const subs = SUBCATEGORIES.private_services ?? []
check('private_services has exactly the 11 approved services', JSON.stringify(subs.map((s) => s.key).sort()) === JSON.stringify([...EXPECTED].sort()), subs.map((s) => s.key))
check('SERVICE_KEYS lists the same 11', JSON.stringify([...SERVICE_KEYS].sort()) === JSON.stringify([...EXPECTED].sort()), SERVICE_KEYS)
check('every service is booked by session', subs.every((s) => s.mode === 'booking' && s.unit === 'session'), subs.map((s) => `${s.key}:${s.mode}/${s.unit}`))
const others = Object.entries(SUBCATEGORIES).filter(([c]) => c !== 'private_services').flatMap(([, v]) => v.map((s) => s.key))
check('service keys are not reused by any other category', EXPECTED.every((k) => !others.includes(k)), EXPECTED.filter((k) => others.includes(k)))
check('labels as approved', findSubcategory('private_services', 'private_chef')?.label === 'Private Chef' && findSubcategory('private_services', 'mixologist')?.label === 'Mixologist & Private Bar' && findSubcategory('private_services', 'housekeeping')?.label === 'Private Housekeeping' && findSubcategory('private_services', 'photographer')?.label === 'Photographer & Content')
check('four groups in order', JSON.stringify(SERVICE_GROUPS.map((g) => g.label)) === JSON.stringify(['Private Dining', 'Wellness', 'Grooming & Beauty', 'Home & Hosting']), SERVICE_GROUPS.map((g) => g.label))
const grouped = SERVICE_GROUPS.flatMap((g) => subs.filter((s) => s.group === g.key).map((s) => s.key))
check('each service belongs to exactly one group', grouped.length === 11 && new Set(grouped).size === 11, grouped)
check('dining = chef, mixologist, butler', JSON.stringify(subs.filter((s) => s.group === 'dining').map((s) => s.key)) === JSON.stringify(['private_chef', 'mixologist', 'butler_staff']))
check('wellness = massage, training', JSON.stringify(subs.filter((s) => s.group === 'wellness').map((s) => s.key)) === JSON.stringify(['massage_spa', 'personal_training']))
check('grooming = barber, hair, makeup, nails', JSON.stringify(subs.filter((s) => s.group === 'grooming').map((s) => s.key)) === JSON.stringify(['barber', 'hair_stylist', 'makeup_artist', 'nail_technician']))
check('hosting = housekeeping, photographer', JSON.stringify(subs.filter((s) => s.group === 'hosting').map((s) => s.key)) === JSON.stringify(['housekeeping', 'photographer']))
check('every service has a customer-facing blurb', subs.every((s) => (s.blurb ?? '').length >= 30), subs.filter((s) => (s.blurb ?? '').length < 30).map((s) => s.key))
check('every group has an anchor-safe key and tagline', SERVICE_GROUPS.every((g) => /^[a-z]+$/.test(g.key) && g.tagline.length > 10))
check('every service has a spec template with Coverage Area', EXPECTED.every((k) => specTemplate(k).includes('Coverage Area') && specTemplate(k).length >= 4), EXPECTED.filter((k) => !specTemplate(k).includes('Coverage Area')))
check('massage template asks for therapist and certification', specTemplate('massage_spa').includes('Therapist') && specTemplate('massage_spa').includes('Certification'))
check('chef template asks for cuisine and dietary options', specTemplate('private_chef').includes('Cuisine') && specTemplate('private_chef').includes('Dietary Options'))
const p1 = resolvePlacement('private_services', 'barber', 'sale', { allowModeOverride: false })
check('partner placement: barber stays booking', p1.subcategory === 'barber' && p1.mode === 'booking', p1)
const p2 = resolvePlacement('private_services', 'nonsense', undefined, { allowModeOverride: false })
check('unknown service falls back to Private Chef', p2.subcategory === 'private_chef', p2)

console.log('2. Commission')
for (const k of EXPECTED) {
  const r = DEFAULT_COMMISSION.find((c) => c.subcategory === k)
  if (!r || r.ratePercent !== 20 || r.payoutTiming !== 'after_completion') check(`commission for ${k}`, false, r)
}
check('every service defaults to 20%, paid after completion', EXPECTED.every((k) => { const r = DEFAULT_COMMISSION.find((c) => c.subcategory === k); return r?.ratePercent === 20 && r.payoutTiming === 'after_completion' }))
check('existing commissions unchanged', DEFAULT_COMMISSION.find((c) => c.subcategory === 'luxury_shortlets')?.ratePercent === 15 && DEFAULT_COMMISSION.find((c) => c.subcategory === 'car_rental')?.ratePercent === 18)

console.log('3. Labels and links')
check('category label', categoryLabels.private_services === 'Private Services', categoryLabels.private_services)
check('category link', categoryHrefs.private_services === '/catalog/private-services', categoryHrefs.private_services)
check('category image', /^https:\/\//.test(categoryImages.private_services ?? ''))

console.log('4. Vetting (partner type)')
const sp = partnerTypeSpec('service_professional')
check('Service Professional partner type exists', !!sp && sp.label === 'Service professional', sp?.label)
check('it may list in all 11 services and nothing else', JSON.stringify([...(sp?.collections ?? [])].sort()) === JSON.stringify([...EXPECTED].sort()), sp?.collections)
const doc = (k: string) => sp?.docs.find((d) => d.kind === k)
check('government ID required', doc('government_id')?.required === true)
check('CAC only for companies', doc('cac_certificate')?.required === 'company')
check('proof of address required', doc('proof_of_address')?.required === true)
check('police character certificate required', doc('police_clearance')?.required === true && /Police/i.test(doc('police_clearance')?.label ?? ''))
check('portfolio required', doc('portfolio')?.required === true)
check('two references required', doc('references')?.required === true)
check('insurance optional with expiry', doc('liability_insurance')?.required === false && doc('liability_insurance')?.expires === true)
const cert = doc('trade_certificate')!
check('trade certificate exists and is optional in general', !!cert && cert.required === false)
check('…but required for massage', isDocRequired(cert, 'individual', ['barber', 'massage_spa']))
check('…required for chefs', isDocRequired(cert, 'individual', ['private_chef']))
check('…required for personal trainers', isDocRequired(cert, 'individual', ['personal_training']))
check('…not required for a barber only', !isDocRequired(cert, 'individual', ['barber']))
check('isDocRequired still works without collections (old callers)', isDocRequired(doc('government_id')!, 'individual') && !isDocRequired(cert, 'individual'))
check('declarations include conduct, discretion, hygiene and attendance', ['conduct', 'discretion', 'hygiene', 'in_person'].every((k) => sp?.declarations.some((d) => d.key === k)), sp?.declarations.map((d) => d.key))
check('common declarations kept', ['accurate', 'standards', 'no_circumvention'].every((k) => sp?.declarations.some((d) => d.key === k)))
check('other partner types cannot list services', PARTNER_TYPES.filter((t) => t.key !== 'service_professional').every((t) => t.collections.every((c) => !EXPECTED.includes(c))))

const base = {
  partnerType: 'service_professional', legalForm: 'individual', businessName: 'Chef Amaka Kitchen', contactName: 'Amaka Obi', phone: '+234 803 111 2222', city: 'Lagos',
  about: 'Private chef for intimate dinners and brunches across Ikoyi, VI and Lekki. Ten years in hotel kitchens.', cacNumber: null,
  collections: ['private_chef', 'massage_spa'],
  declarations: Object.fromEntries(sp!.declarations.map((d) => [d.key, new Date().toISOString()])),
  documents: ['government_id', 'proof_of_address', 'police_clearance', 'portfolio', 'references', 'trade_certificate'].map((kind) => ({ kind, expiresAt: null })),
}
check('complete service application has nothing missing', missingForSubmit(base).length === 0, missingForSubmit(base))
let m = missingForSubmit({ ...base, documents: base.documents.filter((d) => d.kind !== 'trade_certificate') })
check('massage/chef applicant without certificate is told to upload it', m.length === 1 && /Training or certification/.test(m[0]), m)
m = missingForSubmit({ ...base, collections: ['barber'], documents: base.documents.filter((d) => d.kind !== 'trade_certificate') })
check('barber without certificate can submit', m.length === 0, m)
m = missingForSubmit({ ...base, about: 'Relaxing nuru and body to body massage at your home, available 24/7.' })
check('banned words in the description block submission', m.some((x) => /nuru/i.test(x) && /body to body/i.test(x)), m)
m = missingForSubmit({ ...base, documents: base.documents.filter((d) => d.kind !== 'police_clearance') })
check('missing police certificate reported', m.some((x) => /Police/.test(x)), m)
const fleet = { ...base, partnerType: 'fleet_owner', collections: ['car_rental'], about: 'Chauffeur-driven luxury fleet: Range Rover, Maybach and G-Wagon across Lagos.', documents: [], declarations: {} }
check('other partner types are not content-filtered (regression)', !missingForSubmit({ ...fleet, about: fleet.about + ' Sensual leather seats.' }).some((x) => /Remove/.test(x)))

console.log('5. Content filter')
const t = (s: string) => findBannedTerms(s)
check('flags nuru', t('Nuru massage').includes('nuru'))
check('flags body to body in any spelling', t('BODY-TO-BODY therapy').includes('body to body') && t('body to body').includes('body to body') && t('Body2Body').includes('body to body'))
check('flags happy ending, erotic, sensual, tantric, escort', ['happy ending', 'erotic', 'sensual', 'tantric', 'escort'].every((w) => t(`we offer ${w} sessions`).length > 0))
check('flags extra services and b2b massage', t('Extra services available').length > 0 && t('b2b massage').length > 0)
check('flags terms hidden across fields', findBannedTerms('Swedish massage', ['Hot stone', 'Erotic add-on'], { Treatments: 'Tantric' }).length === 2)
check('passes normal massage copy', t('Swedish, deep tissue, hot stone and prenatal massage by a certified therapist.').length === 0)
check('passes an intimate dinner for two', t('An intimate dinner for two with a sommelier-paired menu.').length === 0)
check('no false positives inside other words', t('Consensual, sensational and escorted airport arrivals').length === 0, t('Consensual, sensational and escorted airport arrivals'))
check('no false positive for Essex or Nurul', t('Trained in Essex by Chef Nurul Huda').length === 0, t('Trained in Essex by Chef Nurul Huda'))
check('ignores non-string values safely', findBannedTerms(null, undefined, 42, { a: null }).length === 0)

console.log('6. Price floors')
check('a floor for every service', EXPECTED.every((k) => typeof SERVICE_FLOOR_DEFAULTS[k] === 'number' && SERVICE_FLOOR_DEFAULTS[k] > 0), SERVICE_FLOOR_DEFAULTS)
check('no floors for unknown keys', Object.keys(SERVICE_FLOOR_DEFAULTS).every((k) => EXPECTED.includes(k)))
check('defaults pre-filled from research (chef ₦35k/guest, massage ₦50k, makeup ₦60k)', SERVICE_FLOOR_DEFAULTS.private_chef === 35000 && SERVICE_FLOOR_DEFAULTS.massage_spa === 50000 && SERVICE_FLOOR_DEFAULTS.makeup_artist === 60000)

console.log('7. Agreement')
const req = requiredAgreements('service_professional').map((a) => a.key)
check('service professionals sign master + services schedule', JSON.stringify(req) === JSON.stringify(['master', 'schedule_services']), req)
const sch = agreementByKey('schedule_services')!
check('schedule titled "Schedule H: Private Services", v1.0, awaiting legal review', sch?.title === 'Schedule H: Private Services' && sch.version === '1.0' && sch.reviewed === false, sch?.title)
const body = JSON.stringify(sch?.clauses ?? [])
check('zero tolerance for sexual misconduct', /sexual/i.test(body) && /immediately/i.test(body))
check('no photos or posting about clients or homes', /photograph/i.test(body) && /social media/i.test(body))
check('only the vetted professional attends', /vetted/i.test(body) && /substitute/i.test(body))
check('all-inclusive prices and no off-platform payment', /ingredients/i.test(body) && /through Lux Catalog/i.test(body))
check('no-show refunds the client in full', /no-show/i.test(body) && /full refund/i.test(body))
check('no other partner type gets this schedule', PARTNER_TYPES.filter((p) => p.key !== 'service_professional').every((p) => !requiredAgreements(p.key).some((a) => a.key === 'schedule_services')))
check('existing types still get their own schedules', JSON.stringify(requiredAgreements('fleet_owner').map((a) => a.key)) === JSON.stringify(['master', 'schedule_vehicle']))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
