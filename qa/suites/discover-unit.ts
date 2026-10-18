// Discover v2: pure rules. Every kind of thing a guest can look for has its
// own questions, its own realistic budget bands and its own link into the
// booking pages. Run from the repo root: npx tsx qa/suites/discover-unit.ts
import { PILLARS, KINDS, bandsFor, kindMatchesListing, validateBrief, matchBrief, listingHref, describeBrief, type Brief } from '../../src/lib/discover-brief'
import { matchListings } from '../../src/lib/discover'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const L = (slug: string, category: string, subcategory: string | null, price: number | null, extra: Partial<{ title: string; location: string; description: string; priceDisplay: string }> = {}) => ({
  slug, title: extra.title ?? slug, category, subcategory, price, priceDisplay: extra.priceDisplay ?? (price ? `₦${price.toLocaleString('en-NG')}` : 'Price on application'),
  location: extra.location ?? 'Ikoyi, Lagos, Nigeria', description: extra.description ?? 'A fine listing.',
})
const day = (n: number) => new Date(Date.now() + 3_600_000 + n * 86_400_000).toISOString().slice(0, 10)

console.log('1. The first question is about what they want, not about money')
check('nine pillars, each with a plain label', PILLARS.length === 9 && PILLARS.every((p) => p.label.length > 2), PILLARS.map((p) => p.key))
check('every pillar has at least one kind and every kind belongs to a pillar', PILLARS.every((p) => p.kinds.length >= 1) && Object.values(KINDS).every((k) => PILLARS.some((p) => p.key === k.pillar)))
check('Homes asks buy or rent', eq(PILLARS.find((p) => p.key === 'homes')!.kinds, ['home_buy', 'home_rent']))
check('Cars asks buy or hire', eq(PILLARS.find((p) => p.key === 'cars')!.kinds, ['car_buy', 'car_hire']))
check('Yachts asks cruise, stay aboard or buy', eq(PILLARS.find((p) => p.key === 'yachts')!.kinds, ['yacht_cruise', 'yacht_stay', 'yacht_buy']))
check('Commercial asks buy or lease', eq(PILLARS.find((p) => p.key === 'commercial')!.kinds, ['commercial_buy', 'commercial_lease']))
check('Services is one kind with a choice of services', eq(PILLARS.find((p) => p.key === 'services')!.kinds, ['service']))
check('no pillar label contains the word Private', PILLARS.every((p) => !/private/i.test(p.label)), PILLARS.map((p) => p.label))

console.log('2. Each kind has its own realistic budget (the reported bug)')
const maxFinite = (k: Parameters<typeof bandsFor>[0]) => Math.max(...bandsFor(k).map((b) => (Number.isFinite(b.max) ? b.max : b.min)))
check('services: the top band starts below ₦1M (no ₦100M homes budgets)', maxFinite('service') <= 500_000, maxFinite('service'))
check('services labels never mention M or B amounts', bandsFor('service').every((b) => !/\d\s?[MB]\b/.test(b.label)), bandsFor('service').map((b) => b.label))
check('stays are priced per night (thousands to a million)', maxFinite('stay') <= 2_000_000 && bandsFor('stay').some((b) => /night/i.test(b.label) || /k|₦/.test(b.label)))
check('renting a home is priced per year (millions, not billions)', maxFinite('home_rent') <= 200_000_000 && maxFinite('home_rent') >= 30_000_000, maxFinite('home_rent'))
check('buying a home reaches billions', maxFinite('home_buy') >= 2_000_000_000)
check('car hire is a daily figure', maxFinite('car_hire') <= 1_000_000)
check('buying a car is tens to hundreds of millions', maxFinite('car_buy') >= 150_000_000 && maxFinite('car_buy') <= 1_000_000_000)
check('chauffeur and protection have different scales', maxFinite('protection') > maxFinite('chauffeur'))
check('decor is per piece (low millions)', maxFinite('decor') <= 20_000_000)
check('commercial lease is per year, sale is larger', maxFinite('commercial_buy') > maxFinite('commercial_lease'))
check('experiences have no budget bands (price on application)', bandsFor('experience').length === 0)
const contiguous = (k: Parameters<typeof bandsFor>[0]) => { const b = bandsFor(k).filter((x) => x.key !== 'any'); return b.every((x, i) => i === 0 || x.min === b[i - 1].max) && b[0].min === 0 && !Number.isFinite(b[b.length - 1].max) }
check('every kind with bands: contiguous, from zero, open at the top', (Object.keys(KINDS) as Parameters<typeof bandsFor>[0][]).filter((k) => bandsFor(k).length).every(contiguous))
check('every kind with bands ends with a "not sure yet" option', (Object.keys(KINDS) as Parameters<typeof bandsFor>[0][]).filter((k) => bandsFor(k).length).every((k) => bandsFor(k).at(-1)!.key === 'any'))
check('band labels differ between kinds that have different scales', new Set(['service', 'stay', 'home_rent', 'home_buy', 'car_hire', 'decor'].map((k) => bandsFor(k as 'service').map((b) => b.label).join('|'))).size === 6)

console.log('3. Which listings can answer which kind')
const m = (k: Parameters<typeof kindMatchesListing>[0], c: string, s: string | null) => kindMatchesListing(k, { category: c, subcategory: s })
check('home_buy: real estate for sale only', m('home_buy', 'real_estate', 'for_sale') && !m('home_buy', 'real_estate', 'for_rent') && !m('home_buy', 'real_estate', 'luxury_shortlets') && !m('home_buy', 'commercial', 'for_sale'))
check('home_rent: real estate for rent only', m('home_rent', 'real_estate', 'for_rent') && !m('home_rent', 'real_estate', 'for_sale'))
check('stay: shortlets in real estate and the legacy shortlet category', m('stay', 'real_estate', 'luxury_shortlets') && m('stay', 'shortlet', null) && m('stay', 'shortlet', 'luxury_shortlets') && !m('stay', 'real_estate', 'for_rent'))
check('car_buy / car_hire', m('car_buy', 'supercar', 'for_sale') && m('car_hire', 'supercar', 'car_rental') && !m('car_buy', 'supercar', 'car_rental'))
check('yacht kinds', m('yacht_cruise', 'yacht', 'boat_cruises') && m('yacht_stay', 'yacht', 'aqua_homes') && m('yacht_buy', 'yacht', 'for_sale') && !m('yacht_buy', 'yacht', 'boat_cruises'))
check('service: any private-services listing', m('service', 'private_services', 'barber') && !m('service', 'decor', 'for_sale'))
check('chauffeur and protection are separate', m('chauffeur', 'executive_services', 'chauffeur') && !m('chauffeur', 'executive_services', 'close_protection') && m('protection', 'executive_services', 'close_protection'))
check('decor, commercial sale, commercial lease', m('decor', 'decor', 'for_sale') && m('commercial_buy', 'commercial', 'for_sale') && m('commercial_lease', 'commercial', 'for_lease') && !m('commercial_lease', 'commercial', 'for_sale'))
check('experience: lifestyle listings', m('experience', 'lifestyle', 'private_jets') && m('experience', 'lifestyle', null))

console.log('4. A brief is checked before it is used')
const ok = (b: unknown) => validateBrief(b)
check('a minimal brief is accepted', ok({ needs: [{ kind: 'home_rent' }] }).ok === true)
check('no needs is refused with a plain reason', ok({ needs: [] }).ok === false && ok({}).ok === false && ok(null).ok === false)
check('an unknown kind is refused', ok({ needs: [{ kind: 'spaceship' }] }).ok === false)
check('more than 6 needs is refused', ok({ needs: Array.from({ length: 7 }, () => ({ kind: 'decor' })) }).ok === false)
check('the same kind twice is merged, not duplicated', (() => { const r = ok({ needs: [{ kind: 'decor' }, { kind: 'decor' }] }); return r.ok && r.brief.needs.length === 1 })())
check('an unknown budget band for that kind is dropped, not trusted', (() => { const r = ok({ needs: [{ kind: 'service', budget: '2b_plus' }] }); return r.ok && r.brief.needs[0].budget === undefined })())
check('a valid budget band is kept', (() => { const k = bandsFor('service')[0].key; const r = ok({ needs: [{ kind: 'service', budget: k }] }); return r.ok && r.brief.needs[0].budget === k })())
check('unknown services are dropped, known kept', (() => { const r = ok({ needs: [{ kind: 'service', services: ['barber', 'wizard'] }] }); return r.ok && eq(r.brief.needs[0].services, ['barber']) })())
check('past dates are dropped', (() => { const r = ok({ needs: [{ kind: 'stay', start: day(-5), end: day(-2) }] }); return r.ok && !r.brief.needs[0].start && !r.brief.needs[0].end })())
check('dates beyond a year are dropped', (() => { const r = ok({ needs: [{ kind: 'stay', start: day(500), end: day(503) }] }); return r.ok && !r.brief.needs[0].start })())
check('an end before the start is dropped', (() => { const r = ok({ needs: [{ kind: 'stay', start: day(10), end: day(8) }] }); return r.ok && !r.brief.needs[0].end })())
check('good dates are kept', (() => { const r = ok({ needs: [{ kind: 'stay', start: day(10), end: day(13) }] }); return r.ok && r.brief.needs[0].start === day(10) && r.brief.needs[0].end === day(13) })())
check('guests are whole numbers between 1 and 50', (() => { const a = ok({ needs: [{ kind: 'stay', guests: 4 }] }); const b = ok({ needs: [{ kind: 'stay', guests: 400 }] }); const c = ok({ needs: [{ kind: 'stay', guests: 'x' }] }); return a.ok && a.brief.needs[0].guests === 4 && b.ok && !b.brief.needs[0].guests && c.ok && !c.brief.needs[0].guests })())
check('a service date must be a real day and time a known slot', (() => { const r = ok({ needs: [{ kind: 'service', date: 'tomorrow', time: 'midnight' }] }); return r.ok && !r.brief.needs[0].date && !r.brief.needs[0].time })())
check('hostile text never survives into the brief', JSON.stringify(ok({ needs: [{ kind: 'decor', budget: '<script>x</script>' }], location: ['<img onerror=1>'] })).indexOf('<') === -1)
check('location and taste are limited to known options', (() => { const r = ok({ needs: [{ kind: 'decor' }], location: ['lagos_island', 'mars'], lifestyle: ['art', 'x'] }); return r.ok && eq(r.brief.location, ['lagos_island']) && eq(r.brief.lifestyle, ['art']) })())

console.log('5. Matching: the right kind, the right money')
const stock = [
  L('sale-1', 'real_estate', 'for_sale', 1_200_000_000), L('sale-2', 'real_estate', 'for_sale', 90_000_000), L('rent-1', 'real_estate', 'for_rent', 25_000_000), L('rent-2', 'real_estate', 'for_rent', 120_000_000),
  L('stay-1', 'real_estate', 'luxury_shortlets', 300_000), L('stay-2', 'shortlet', null, 900_000), L('stay-3', 'real_estate', 'luxury_shortlets', 3_000_000),
  L('car-b', 'supercar', 'for_sale', 400_000_000), L('car-h', 'supercar', 'car_rental', 300_000), L('yc-1', 'yacht', 'boat_cruises', 800_000), L('yc-2', 'yacht', 'aqua_homes', 500_000), L('yc-3', 'yacht', 'for_sale', 900_000_000),
  L('svc-chef', 'private_services', 'private_chef', 45_000), L('svc-barber', 'private_services', 'barber', 25_000), L('svc-spa', 'private_services', 'massage_spa', 60_000),
  L('drv', 'executive_services', 'chauffeur', 120_000), L('sec', 'executive_services', 'close_protection', 450_000),
  L('art', 'decor', 'for_sale', 2_500_000), L('tower', 'commercial', 'for_sale', 900_000_000), L('floor', 'commercial', 'for_lease', 150_000_000), L('jet', 'lifestyle', 'private_jets', null),
]
const band = (k: Parameters<typeof bandsFor>[0], i: number) => bandsFor(k)[i].key
const slugs = (g: { matches: { slug: string }[] }) => g.matches.map((x) => x.slug)
const one = (need: Brief['needs'][number]) => matchBrief({ needs: [need] }, stock)[0]
check('buying a home never returns a rental or a stay', (() => { const g = one({ kind: 'home_buy' }); return slugs(g).every((s) => s.startsWith('sale')) && slugs(g).length === 2 })(), slugs(one({ kind: 'home_buy' })))
check('renting a home never returns a sale', (() => { const g = one({ kind: 'home_rent' }); return slugs(g).every((s) => s.startsWith('rent')) })())
check('a stay finds shortlets from both categories', (() => { const s = slugs(one({ kind: 'stay' })); return ['stay-1', 'stay-2', 'stay-3'].every((x) => s.includes(x)) })())
check('services never return a yacht or a home', slugs(one({ kind: 'service' })).every((s) => s.startsWith('svc')))
check('a budget band puts in-budget listings first', (() => { const g = one({ kind: 'home_buy', budget: band('home_buy', 0) }); return slugs(g)[0] === 'sale-2' })(), slugs(one({ kind: 'home_buy', budget: band('home_buy', 0) })))
check('a rent budget under ₦30M ranks the ₦25M flat above the ₦120M one', (() => { const g = one({ kind: 'home_rent', budget: band('home_rent', 1) }); return slugs(g)[0] === 'rent-1' })(), slugs(one({ kind: 'home_rent', budget: band('home_rent', 1) })))
check('something far above the budget is left out, not pushed on the guest', (() => { const s = slugs(one({ kind: 'stay', budget: band('stay', 0) })); return !s.includes('stay-3') && !s.includes('stay-2') })(), slugs(one({ kind: 'stay', budget: band('stay', 0) })))
check('"not sure yet" applies no money filter', slugs(one({ kind: 'stay', budget: 'any' })).length === 3)
check('a service budget reads against session prices', (() => { const g = one({ kind: 'service', budget: band('service', 0) }); return slugs(g)[0] === 'svc-barber' })(), slugs(one({ kind: 'service', budget: band('service', 0) })))
check('chosen services narrow the results', eq(slugs(one({ kind: 'service', services: ['barber'] })), ['svc-barber']))
check('a requested service nobody offers is reported as missing, by name', (() => { const g = one({ kind: 'service', services: ['barber', 'makeup_artist'] }); return eq(g.missing, ['Makeup Artist']) && slugs(g).includes('svc-barber') })(), one({ kind: 'service', services: ['barber', 'makeup_artist'] }).missing)
check('a kind with nothing in stock is empty and says what to ask for', (() => { const g = matchBrief({ needs: [{ kind: 'home_buy' }] }, stock.filter((x) => !x.slug.startsWith('sale')))[0]; return g.empty && g.matches.length === 0 && /home/i.test(g.label) })())
check('experiences match with no price', slugs(one({ kind: 'experience' })).includes('jet'))
check('chauffeur and protection stay apart', eq(slugs(one({ kind: 'chauffeur' })), ['drv']) && eq(slugs(one({ kind: 'protection' })), ['sec']))
check('several needs give one group each, in the order asked', (() => { const g = matchBrief({ needs: [{ kind: 'service' }, { kind: 'home_rent' }, { kind: 'car_hire' }] }, stock); return eq(g.map((x) => x.kind), ['service', 'home_rent', 'car_hire']) })())
check('a group shows at most 4 matches', matchBrief({ needs: [{ kind: 'stay' }] }, [...stock, ...Array.from({ length: 10 }, (_, i) => L(`extra-${i}`, 'shortlet', null, 200_000))])[0].matches.length === 4)
check('the same listing is never in two groups', (() => { const g = matchBrief({ needs: [{ kind: 'home_buy' }, { kind: 'commercial_buy' }] }, stock); const all = g.flatMap(slugs); return new Set(all).size === all.length })())
check('area preference lifts a matching listing', (() => { const g = matchBrief({ needs: [{ kind: 'stay' }], location: ['abuja'] }, [L('lag', 'shortlet', null, 300_000), L('abj', 'shortlet', null, 300_000, { location: 'Maitama, Abuja, Nigeria' })])[0]; return slugs(g)[0] === 'abj' })())
check('taste lifts a matching listing', (() => { const g = matchBrief({ needs: [{ kind: 'stay' }], lifestyle: ['art'] }, [L('plain', 'shortlet', null, 300_000), L('arty', 'shortlet', null, 300_000, { description: 'A gallery-style home with sculpture.' })])[0]; return slugs(g)[0] === 'arty' })())
check('every match explains itself and never says "undefined"', matchBrief({ needs: [{ kind: 'stay' }] }, stock)[0].matches.every((x) => x.reason.length > 10 && !/undefined|null/.test(x.reason)))
check('scores are whole numbers from 1 to 100, highest first', (() => { const s = matchBrief({ needs: [{ kind: 'stay', budget: band('stay', 1) }] }, stock)[0].matches.map((x) => x.score); return s.every((x) => Number.isInteger(x) && x >= 1 && x <= 100) && s.every((x, i) => i === 0 || x <= s[i - 1]) })())
check('it can only return listings it was given', matchBrief({ needs: [{ kind: 'home_buy' }, { kind: 'service' }] }, stock.slice(0, 5)).flatMap(slugs).every((s) => stock.slice(0, 5).some((l) => l.slug === s)))
check('nothing at all in stock: every group is empty, none throws', matchBrief({ needs: [{ kind: 'home_buy' }, { kind: 'stay' }] }, []).every((g) => g.empty))

console.log('6. Dates: free, taken and unchecked')
const need = { kind: 'stay' as const, start: day(10), end: day(13), guests: 2 }
const avail = { 'stay-1': 'available', 'stay-2': 'unavailable' } as const
const g1 = matchBrief({ needs: [need] }, stock, avail)[0]
const by = (slug: string) => g1.matches.find((x) => x.slug === slug)
check('a free listing is marked available', by('stay-1')?.availability === 'available')
check('a listing taken on those dates is marked unavailable and ranked last', by('stay-2')?.availability === 'unavailable' && g1.matches.at(-1)!.slug === 'stay-2', g1.matches.map((x) => [x.slug, x.availability]))
check('one not checked says so honestly', by('stay-3')?.availability === 'unchecked')
check('no dates given: nothing is marked available', matchBrief({ needs: [{ kind: 'stay' }] }, stock, avail)[0].matches.every((x) => x.availability === 'unchecked'))
check('an unavailable match reason says the dates are taken', /not free|taken|unavailable/i.test(by('stay-2')!.reason))
check('an available match reason says it is free', /free|available/i.test(by('stay-1')!.reason))

console.log('7. Links carry the guest into the booking page')
const href = (n: Parameters<typeof listingHref>[0], slug: string, cat: string) => listingHref(n, { slug, category: cat })
check('a stay link carries dates and guests', href({ kind: 'stay', start: day(10), end: day(13), guests: 3 }, 'loft', 'real_estate') === `/catalog/real-estate/loft?start=${day(10)}&end=${day(13)}&guests=3`, href({ kind: 'stay', start: day(10), end: day(13), guests: 3 }, 'loft', 'real_estate'))
check('a legacy shortlet link uses its own path', href({ kind: 'stay', start: day(10), end: day(13) }, 'villa', 'shortlet').startsWith('/catalog/shortlets/villa?start='))
check('car hire carries dates', href({ kind: 'car_hire', start: day(5), end: day(7) }, 'rolls', 'supercar') === `/catalog/supercars/rolls?start=${day(5)}&end=${day(7)}`)
check('a service link carries date, time and guests', href({ kind: 'service', date: day(6), time: '18:00', guests: 6 }, 'chef', 'private_services') === `/catalog/private-services/chef?date=${day(6)}&time=${encodeURIComponent('18:00')}&guests=6`, href({ kind: 'service', date: day(6), time: '18:00', guests: 6 }, 'chef', 'private_services'))
check('a sale link is plain', href({ kind: 'home_buy' }, 'villa', 'real_estate') === '/catalog/real-estate/villa')
check('a link with nothing to carry has no stray ? or &', !/[?&]$/.test(href({ kind: 'stay' }, 'loft', 'real_estate')) && !href({ kind: 'stay' }, 'loft', 'real_estate').includes('?'))

console.log('8. The brief reads like a person wrote it (for the team and for the concierge)')
const text = describeBrief({ needs: [{ kind: 'service', services: ['barber', 'private_chef'], date: day(6), time: '18:00', guests: 6, budget: band('service', 1) }, { kind: 'home_rent', bedrooms: 3, budget: band('home_rent', 2) }], location: ['lagos_island'] })
check('it names each need in words', /Barber/.test(text) && /Private Chef|Chef/.test(text) && /rent/i.test(text))
check('it carries dates, guests and area', text.includes(day(6)) && /6 guests/.test(text) && /Ikoyi|Lagos Island/.test(text))
check('it carries the budget in the guest’s own words', /₦/.test(text), text)
check('it carries no raw keys', !/home_rent|private_chef|lagos_island|undefined/.test(text), text)
check('an empty-ish brief still reads cleanly', !/undefined|null|\[object/.test(describeBrief({ needs: [{ kind: 'decor' }] })))

console.log('9. The old quiz format keeps working until it is retired')
const old = matchListings({ categories: ['real_estate'], budget: ['100m_500m'] }, [{ slug: 'a', title: 'A', category: 'real_estate', price: 200_000_000, location: 'Ikoyi', description: '' }])
check('legacy preferences still match', old.length === 1 && old[0].slug === 'a')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
