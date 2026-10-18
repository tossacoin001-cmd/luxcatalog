// Discover v2 in headless Chrome, phone and desktop.
const PORT = 9371
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import pg from 'pg'
import { refreshCatalog } from './_catalog.mjs'

const BASE = 'http://localhost:3300'
const OUT = process.env.OUT
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') }); await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
const day = (n) => new Date(Date.now() + 3_600_000 + n * 86_400_000).toISOString().slice(0, 10)
const stamp = Date.now()
const ins = async (title, category, sub, mode, price, display, loc = 'Ikoyi, Lagos') => {
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`
  const rows = await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,'A fine listing.',$4,$5,$6,'Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200'],'{}',ARRAY[]::text[],$7,$8,true,now()) returning id`, [title, slug, category, price, display, loc, mode, sub])
  return { id: rows[0].id, slug }
}
const settings = (id, unit, rate) => q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","maxUnits","maxGuests","instantBook","advanceNoticeHours","updatedAt") values ($1,true,$2,$3,0,0,1,14,6,true,0,now())`, [id, unit, rate])
const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ui-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
async function load(url) { await send('Page.navigate', { url: 'about:blank' }); await sleep(100); await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1800) }
const waitFor = async (expr, ms = 10000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await sleep(200) } return false }
const fits = () => ev('document.documentElement.scrollWidth <= innerWidth + 1')
const setVal = (sel, value) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const click = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || el.disabled) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }

console.log('Setup')
await q('delete from "RateLimit"')
await q('TRUNCATE "Listing" CASCADE')
const S1 = await ins('Wk Loft Free', 'real_estate', 'luxury_shortlets', 'booking', 300000, '₦300,000'); await settings(S1.id, 'night', 300000)
const S2 = await ins('Wk Loft Taken', 'real_estate', 'luxury_shortlets', 'booking', 320000, '₦320,000'); await settings(S2.id, 'night', 320000)
await q(`insert into "UnavailableDate" (id,"listingId","startDate","endDate",source) values (gen_random_uuid(),$1,$2,$3,'manual')`, [S2.id, `${day(20)}T00:00:00Z`, `${day(27)}T00:00:00Z`])
const R1 = await ins('Wk Flat Rent', 'real_estate', 'for_rent', 'rent', 25000000, '₦25,000,000')
const V1 = await ins('Wk Chef Amaka', 'private_services', 'private_chef', 'booking', 45000, '₦45,000')
await q(`delete from "Listing" where category='yacht' and subcategory='for_sale'`)

const opt = (group, key) => `[data-discover-step] [data-group="${group}"] [data-option="${key}"]`
const optTexts = (group) => ev(`[...document.querySelectorAll('[data-discover-step] [data-group="${group}"] [data-option]')].map(b => b.textContent.trim())`)
const step = () => ev(`document.querySelector('[data-discover-step]')?.getAttribute('data-discover-step')`)
const next = () => click('[data-discover-next]')
const visibleText = () => ev(`document.querySelector('[data-discover]')?.innerText ?? ''`)
const cardText = (slug) => ev(`document.querySelector('[data-result-card="${slug}"]')?.innerText ?? ''`)
const cardAttr = (slug, a) => ev(`document.querySelector('[data-result-card="${slug}"]')?.getAttribute('${a}')`)
const cta = (slug) => ev(`document.querySelector('[data-result-card="${slug}"] a[data-result-cta]')?.getAttribute('href')`)

for (const [vp, metrics] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  console.log(`— ${vp}`)
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await q('delete from "RateLimit"')

  console.log('1. First screen: what are you looking for?')
  await load(`${BASE}/discover`)
  check(`${vp}: the first step is the pillars`, (await step()) === 'pillars')
  const pillars = await ev(`[...document.querySelectorAll('[data-discover-pillar]')].map(b => [b.getAttribute('data-discover-pillar'), b.textContent.trim()])`)
  check(`${vp}: nine pillars, each with an icon and a plain name`, pillars.length === 9 && (await ev(`[...document.querySelectorAll('[data-discover-pillar]')].every(b => b.querySelector('svg'))`)), pillars)
  check(`${vp}: no question about money on this screen`, !/budget|₦/i.test(await visibleText()))
  check(`${vp}: no pillar name uses the word Private`, pillars.every(([, l]) => !/private/i.test(l)), pillars.map((p) => p[1]))
  check(`${vp}: a clear heading and a step counter`, /looking for/i.test(await visibleText()) && !!(await ev(`document.querySelector('[data-discover-progress]')?.textContent`)))
  check(`${vp}: Next waits for a choice`, (await ev(`document.querySelector('[data-discover-next]')?.disabled`)) === true)
  check(`${vp}: tap targets are at least 44px`, await ev(`[...document.querySelectorAll('[data-discover-pillar], [data-discover-next]')].every(b => b.getBoundingClientRect().height >= 44)`))
  check(`${vp}: fits the screen`, await fits())
  await shot(`1-${vp}-pillars.jpg`)

  console.log('2. A service shopper sees service money, not billions')
  await click('[data-discover-pillar="services"]')
  check(`${vp}: the pillar shows as chosen`, (await ev(`document.querySelector('[data-discover-pillar="services"]').getAttribute('aria-pressed')`)) === 'true')
  check(`${vp}: Next is now available`, (await ev(`document.querySelector('[data-discover-next]')?.disabled`)) === false)
  await next()
  check(`${vp}: the next step is about services`, (await step()) === 'detail-services', await step())
  const svcs = await optTexts('services')
  check(`${vp}: all 11 services are offered, none called Private`, svcs.length === 11 && svcs.every((s) => !/private/i.test(s)), svcs)
  const svcBudget = await optTexts('budget')
  check(`${vp}: the budget options are session-sized`, svcBudget.length >= 3 && svcBudget.every((b) => !/\d\s?[MB]\b/.test(b)) && svcBudget.some((b) => /k/i.test(b)), svcBudget)
  check(`${vp}: none of the old home-sized budgets appear`, !/₦100M|₦500M|₦2B/.test(await visibleText()))
  check(`${vp}: it asks for a date, a time and guests`, !!(await ev(`!!document.querySelector('input[name=date]') && !!document.querySelector('[name=time]') && !!document.querySelector('[name=guests]')`)))
  check(`${vp}: at most four groups of questions on one screen`, (await ev(`document.querySelectorAll('[data-discover-step] [data-group]').length`)) <= 4)
  await shot(`2-${vp}-services.jpg`)

  console.log('3. Going back keeps the answer; adding a second need is natural')
  await click('[data-discover-back]')
  check(`${vp}: back returns to the pillars`, (await step()) === 'pillars')
  check(`${vp}: the services choice is still there`, (await ev(`document.querySelector('[data-discover-pillar="services"]').getAttribute('aria-pressed')`)) === 'true')
  await click('[data-discover-pillar="homes"]')
  await click('[data-discover-pillar="stays"]')
  await next()
  check(`${vp}: with three pillars, the services step still comes first`, (await step()) === 'detail-services')
  await click(opt('services', 'private_chef'))
  await click(opt('budget', 'svc_40_100k'))
  await setVal('input[name=date]', day(9)); await setVal('[name=time]', '18:00'); await setVal('[name=guests]', '6')
  check(`${vp}: the chosen options show as chosen`, (await ev(`document.querySelector('${opt('services', 'private_chef')}').getAttribute('aria-pressed')`)) === 'true')
  await next()

  console.log('4. Homes: buy and rent have different money')
  check(`${vp}: next is the homes step`, (await step()) === 'detail-homes', await step())
  const intents = await optTexts('intent')
  check(`${vp}: it asks buy or rent first`, intents.length === 2 && intents.some((x) => /buy/i.test(x)) && intents.some((x) => /rent/i.test(x)), intents)
  check(`${vp}: no budget is shown until buy or rent is chosen`, (await optTexts('budget')).length === 0)
  await click(opt('intent', 'home_rent'))
  const rentBudget = await optTexts('budget')
  check(`${vp}: renting shows yearly figures (millions)`, rentBudget.some((b) => /₦10M/.test(b)) && !rentBudget.some((b) => /₦2B|₦500M/.test(b)) && /year/i.test(await visibleText()), rentBudget)
  await click(opt('intent', 'home_buy'))
  const buyBudget = await optTexts('budget')
  check(`${vp}: switching to buy changes the figures to buying prices`, buyBudget.some((b) => /₦100M/.test(b)) && buyBudget.some((b) => /B/.test(b)) && JSON.stringify(buyBudget) !== JSON.stringify(rentBudget), buyBudget)
  await click(opt('intent', 'home_rent'))
  await click(opt('budget', 'rent_10_30m'))
  check(`${vp}: bedrooms can be chosen`, (await optTexts('bedrooms')).length >= 3)
  await next()

  console.log('5. Stays: dates and guests')
  check(`${vp}: next is the stays step`, (await step()) === 'detail-stays', await step())
  check(`${vp}: it asks for check-in, check-out and guests`, !!(await ev(`!!document.querySelector('input[name=start]') && !!document.querySelector('input[name=end]') && !!document.querySelector('[name=guests]')`)))
  const stayBudget = await optTexts('budget')
  check(`${vp}: stay budgets are per night`, stayBudget.some((b) => /k/.test(b)) && !stayBudget.some((b) => /₦100M|₦2B/.test(b)) && /night/i.test(await visibleText()), stayBudget)
  check(`${vp}: past dates cannot be chosen`, (await ev(`document.querySelector('input[name=start]').min`)) >= day(0))
  await setVal('input[name=start]', day(21)); await setVal('input[name=end]', day(24)); await setVal('[name=guests]', '2')
  await next()

  console.log('6. Where and taste, optional')
  check(`${vp}: the last question is optional and says so`, (await step()) === 'where' && !!(await ev(`!!document.querySelector('[data-discover-skip]')`)))
  check(`${vp}: area and taste are offered`, (await optTexts('location')).length >= 4 && (await optTexts('taste')).length >= 4)
  await click(opt('location', 'lagos_island'))
  await shot(`6-${vp}-where.jpg`)
  await next()

  console.log('7. Results, grouped by what was asked')
  const got = await waitFor(`!!document.querySelector('[data-discover-results]')`, 15000)
  check(`${vp}: results appear`, got)
  const order = await ev(`[...document.querySelectorAll('[data-result-group]')].map(g => g.getAttribute('data-result-group')).join()`)
  check(`${vp}: one group per need, in order (services, homes, stays)`, order === 'service,home_rent,stay', order)
  check(`${vp}: the chef is in the services group`, await ev(`!!document.querySelector('[data-result-group="service"] [data-result-card="${V1.slug}"]')`))
  check(`${vp}: the flat is in the homes group`, await ev(`!!document.querySelector('[data-result-group="home_rent"] [data-result-card="${R1.slug}"]')`))
  check(`${vp}: the free loft says Available`, (await cardAttr(S1.slug, 'data-availability')) === 'available' && /available/i.test(await cardText(S1.slug)))
  check(`${vp}: the closed loft says it is not free on those dates`, (await cardAttr(S2.slug, 'data-availability')) === 'unavailable' && /not free|unavailable|taken/i.test(await cardText(S2.slug)))
  check(`${vp}: the free loft links into booking with the dates and guests`, (await cta(S1.slug)) === `/catalog/real-estate/${S1.slug}?start=${day(21)}&end=${day(24)}&guests=2`, await cta(S1.slug))
  check(`${vp}: the chef links with the date, time and guests`, (await cta(V1.slug)) === `/catalog/private-services/${V1.slug}?date=${day(9)}&time=${encodeURIComponent('18:00')}&guests=6`, await cta(V1.slug))
  check(`${vp}: prices carry their unit (per year, per night)`, /per year/.test(await cardText(R1.slug)) && /per night/.test(await cardText(S1.slug)))
  check(`${vp}: no percentage "match" numbers dressed up as science`, !/\d+\s?%/.test(await visibleText()))
  check(`${vp}: nothing says undefined or null`, !/undefined|null|\[object/.test(await visibleText()))
  check(`${vp}: fits the screen`, await fits())
  await shot(`7-${vp}-results.jpg`)

  console.log('8. Following a result lands on the right page with the choice kept')
  await click(`[data-result-card="${S1.slug}"] a[data-result-cta]`)
  check(`${vp}: the listing page opens with the dates in the address`, await waitFor(`location.pathname === '/catalog/real-estate/${S1.slug}' && location.search.includes('start=${day(21)}')`, 15000), await ev('location.href'))
  check(`${vp}: the booking panel shows the chosen stay`, await waitFor(`/3 nights/.test(document.body.innerText)`, 20000))

  console.log('9. Nothing in stock: a person is offered, with the answers ready')
  await load(`${BASE}/discover`)
  await click('[data-discover-pillar="yachts"]'); await next()
  await click(opt('intent', 'yacht_buy')); await next()
  await click('[data-discover-skip]')
  await waitFor(`!!document.querySelector('[data-discover-results]')`, 15000)
  check(`${vp}: an empty group says so kindly`, await ev(`!!document.querySelector('[data-result-group="yacht_buy"]') && /specialist|source|find/i.test(document.querySelector('[data-result-group="yacht_buy"]').innerText)`))
  await click('[data-result-group="yacht_buy"] [data-brief-trigger]')
  check(`${vp}: the request form opens`, await waitFor(`!!document.querySelector('[data-brief-form] textarea')`, 6000))
  const msg = await ev(`document.querySelector('[data-brief-form] textarea')?.value ?? ''`)
  check(`${vp}: the form is already filled with what they asked for`, /yacht/i.test(msg) && !/yacht_buy|undefined/.test(msg), msg)

  console.log('10. If the engine is down, a human picks it up')
  await load(`${BASE}/discover`)
  await ev(`(() => { const f = window.fetch; window.fetch = (u, o) => String(u).includes('/api/ai/match') ? Promise.resolve(new Response('{"error":"x"}', { status: 500 })) : f(u, o) })()`)
  await click('[data-discover-pillar="decor"]'); await next(); await next(); await click('[data-discover-skip]')
  check(`${vp}: a gentle handoff, not an error`, (await waitFor(`/specialist|together/i.test(document.querySelector('[data-discover]')?.innerText ?? '')`, 12000)) && !/500|error|failed/i.test(await visibleText()))
  check(`${vp}: the request button carries their answers`, await ev(`!!document.querySelector('[data-discover] [data-brief-trigger]')`))
  check(`${vp}: no WhatsApp as a main action`, !(await ev(`[...document.querySelectorAll('[data-discover] a[href*="wa.me"]')].some(a => !a.hasAttribute('data-wa-fallback'))`)))

  console.log('11. Start over')
  await load(`${BASE}/discover`)
  await click('[data-discover-pillar="decor"]'); await next(); await next(); await click('[data-discover-skip]')
  await waitFor(`!!document.querySelector('[data-discover-results]')`, 15000)
  await click('[data-discover-restart]')
  check(`${vp}: start over returns to the pillars with nothing chosen`, (await step()) === 'pillars' && (await ev(`document.querySelectorAll('[data-discover-pillar][aria-pressed="true"]').length`)) === 0)
}

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
