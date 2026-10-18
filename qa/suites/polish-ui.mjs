// Menu and overlays hold the page still while open; the services page is clean.
const PORT = 9372
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
const L1 = await ins('Pol Villa', 'real_estate', 'for_sale', 'sale', 900000000, '₦900,000,000')
const V1 = await ins('Pol Chef', 'private_services', 'private_chef', 'booking', 45000, '₦45,000')
await refreshCatalog(BASE, q)
for (const [p, must] of [['/catalog/real-estate', 'Pol Villa'], ['/catalog/private-services', 'Pol Chef'], ['/', '']]) {
  for (let i = 0; i < 40; i++) { const h = await (await fetch(BASE + p)).text(); if (!must || h.includes(must)) break; await sleep(1500) }
}
const scrollY = () => ev('Math.round(window.scrollY)')
const bodyLocked = () => ev(`(() => { const b = getComputedStyle(document.body), h = getComputedStyle(document.documentElement); return b.overflow === 'hidden' || h.overflow === 'hidden' || b.position === 'fixed' })()`)
const wheel = async (dy) => { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 200, y: 400, deltaX: 0, deltaY: dy }); await sleep(450) }
const swipe = async (dy) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 600 }] })
  for (let i = 1; i <= 8; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 600 - (dy / 8) * i }] }); await sleep(30) }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(450)
}
const tallPage = `${BASE}/catalog/real-estate`

console.log('— phone')
await send('Emulation.setDeviceMetricsOverride', PHONE)
await send('Emulation.setTouchEmulationEnabled', { enabled: true })

console.log('1. The menu holds the page still')
await load(tallPage)
await ev('window.scrollTo(0, 400)'); await sleep(500)
const y0 = await scrollY()
check('the page can be scrolled before the menu opens', y0 >= 300, y0)
check('nothing is locked yet', !(await bodyLocked()))
await click('button[aria-label="Toggle menu"], header button[aria-expanded]')
check('the menu opens', await waitFor(`!!document.querySelector('nav a[href="/catalog"]') && [...document.querySelectorAll('nav a')].some(a => a.offsetParent && /contact|catalog/i.test(a.href))`, 4000))
check('the page behind is locked', await bodyLocked())
await swipe(500); await wheel(600)
check('swiping or scrolling does not move the page behind', Math.abs((await scrollY()) - y0) <= 2, await scrollY())
check('the page does not jump to the top when the menu opens', Math.abs((await scrollY()) - y0) <= 2, await scrollY())
check('the menu itself can still scroll if it is long', await ev(`(() => { const n = document.querySelector('nav.overflow-y-auto, nav[class*="overflow-y"]'); return !n || getComputedStyle(n).overflowY === 'auto' || getComputedStyle(n).overflowY === 'scroll' })()`))
await shot('1-phone-menu-open.jpg')

console.log('2. Closing it gives the page back, at the same place')
await click('header button[aria-expanded="true"]')
check('the menu closes', await waitFor(`!document.querySelector('header button[aria-expanded="true"]')`, 3000))
check('the page is unlocked', !(await bodyLocked()))
check('and still at the same place', Math.abs((await scrollY()) - y0) <= 2, await scrollY())
await wheel(300)
check('the page scrolls again', (await scrollY()) > y0 + 100, await scrollY())

console.log('3. Tapping the dark area closes it and unlocks')
await click('header button[aria-expanded]')
await waitFor(`!!document.querySelector('header button[aria-expanded="true"]')`, 3000)
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 820 }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300)
await ev(`document.querySelector('.fixed.inset-0.z-40')?.click()`); await sleep(400)
check('tapping outside closes it', !(await ev(`!!document.querySelector('header button[aria-expanded="true"]')`)))
check('and the page is unlocked', !(await bodyLocked()))

console.log('4. Choosing a link unlocks the next page')
await load(tallPage)
await click('header button[aria-expanded]'); await waitFor(`!!document.querySelector('header button[aria-expanded="true"]')`, 3000)
await ev(`[...document.querySelectorAll('nav a')].find(a => a.offsetParent && a.getAttribute('href') === '/catalog')?.click()`)
check('the new page opens', await waitFor(`location.pathname === '/catalog'`, 12000))
await sleep(800)
check('and it is not stuck locked', !(await bodyLocked()))
await ev('window.scrollTo(0, 300)'); await sleep(400)
check('it scrolls', (await scrollY()) > 100)

console.log('5. Rotating or resizing while open does not break it')
await load(tallPage)
await click('header button[aria-expanded]'); await waitFor(`!!document.querySelector('header button[aria-expanded="true"]')`, 3000)
await send('Emulation.setDeviceMetricsOverride', DESKTOP); await sleep(800)
check('widening to desktop size lets go of the lock (the drawer is a phone control)', !(await bodyLocked()) || !(await ev(`!!document.querySelector('header button[aria-expanded="true"]')`)) , await bodyLocked())
await send('Emulation.setDeviceMetricsOverride', PHONE); await sleep(500)

console.log('6. Other overlays lock the page too')
await load(`${BASE}/catalog/real-estate/${L1.slug}`)
await ev('window.scrollTo(0, 500)'); await sleep(500)
const yL = await scrollY()
await ev(`[...document.querySelectorAll('button')].find(b => /Enquire About This Asset/i.test(b.textContent))?.click()`)
check('the enquiry form opens', await waitFor(`!!document.querySelector('[data-enquiry-form]')`, 5000))
check('the page behind is locked', await bodyLocked())
await swipe(500)
check('and does not move', Math.abs((await scrollY()) - yL) <= 2, await scrollY())
await ev(`document.querySelector('[data-enquiry-form] button[aria-label="Close"]')?.click()`); await sleep(500)
check('closing it unlocks', !(await bodyLocked()))
check('at the same place', Math.abs((await scrollY()) - yL) <= 2, await scrollY())
await load(`${BASE}/catalog/real-estate`)
await ev('window.scrollTo(0, 700)'); await sleep(1200)
const yC = await scrollY()
const cb = await waitFor(`!!document.querySelector('[data-concierge-button]')`, 6000)
check('the concierge button is there after scrolling', cb)
await click('[data-concierge-button]')
check('the concierge panel opens', await waitFor(`!!document.querySelector('[data-concierge-panel]')`, 4000))
check('the page behind is locked', await bodyLocked())
await swipe(400)
check('and does not move', Math.abs((await scrollY()) - yC) <= 2, await scrollY())
await ev(`document.querySelector('[data-concierge-panel] button[aria-label="Close"]')?.click()`); await sleep(500)
check('closing the panel unlocks', !(await bodyLocked()))
await load(`${BASE}/catalog/private-services`)
await click('[data-brief-trigger]')
check('a request form from the services page opens', await waitFor(`!!document.querySelector('[data-brief-form]')`, 4000))
check('and locks the page', await bodyLocked())
await ev(`document.querySelector('[data-brief-form] button[aria-label="Close"]')?.click()`); await sleep(500)
check('and unlocks when closed', !(await bodyLocked()))
check('two overlays never leave it stuck (open menu then enquiry, close both)', await (async () => {
  await load(tallPage); await click('header button[aria-expanded]'); await sleep(400); await click('header button[aria-expanded="true"]'); await sleep(400)
  return !(await bodyLocked())
})())

console.log('— desktop')
await send('Emulation.setDeviceMetricsOverride', DESKTOP)
await send('Emulation.setTouchEmulationEnabled', { enabled: false })
await load(`${BASE}/catalog/real-estate/${L1.slug}`)
await ev('window.scrollTo(0, 400)'); await sleep(500)
const yD = await scrollY()
await ev(`[...document.querySelectorAll('button')].find(b => /Enquire About This Asset/i.test(b.textContent))?.click()`)
await waitFor(`!!document.querySelector('[data-enquiry-form]')`, 5000)
check('desktop: the enquiry form locks the page', await bodyLocked())
await wheel(700)
check('desktop: mouse wheel does not move the page behind', Math.abs((await scrollY()) - yD) <= 2, await scrollY())
check('desktop: the layout does not shift sideways when locked (scrollbar compensated)', await ev(`document.documentElement.scrollWidth <= innerWidth + 1`))
await ev(`document.querySelector('[data-enquiry-form] button[aria-label="Close"]')?.click()`); await sleep(500)
check('desktop: closing unlocks', !(await bodyLocked()))
await wheel(300)
check('desktop: the page scrolls again', (await scrollY()) > yD + 100, await scrollY())

console.log('7. The services page is clean')
for (const [vp, metrics] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await load(`${BASE}/catalog/private-services`)
  const h1 = await ev(`document.querySelector('h1')?.textContent.trim()`)
  check(`${vp}: the page title is just "Services"`, h1 === 'Services', h1)
  const words = await ev(`(() => { const c = document.body.cloneNode(true); c.querySelectorAll('header, footer, nav[aria-label="Primary"], script, style, [data-concierge-button], [data-concierge-panel]').forEach(n => n.remove()); return (c.innerText.match(/.{0,30}\\bprivate\\b.{0,30}/gi) ?? []) })()`)
  check(`${vp}: the word "Private" appears nowhere in the page content`, words.length === 0, words)
  const heads = await ev(`[...document.querySelectorAll('h2, h3')].map(h => h.textContent.trim())`)
  check(`${vp}: service names read clean (Chef, Barber, Housekeeping)`, ['Chef', 'Barber', 'Housekeeping'].every((n) => heads.some((h) => h === n)), heads)
  check(`${vp}: the groups are named Dining, Wellness, Grooming & Beauty, Home & Hosting`, (await ev(`['Dining','Wellness','Grooming & Beauty','Home & Hosting'].every(n => document.body.textContent.includes(n))`)))
  check(`${vp}: the request buttons say Request Barber, never Request Private Barber`, await ev(`[...document.querySelectorAll('[data-brief-trigger]')].every(b => !/private/i.test(b.textContent)) && [...document.querySelectorAll('[data-brief-trigger]')].some(b => /Request (Barber|Housekeeping)/.test(b.textContent))`))
  check(`${vp}: the catalogue still names the category Private Services (only this page drops it)`, (await (await fetch(BASE + '/catalog')).text()).includes('Private Services'))
  check(`${vp}: the breadcrumb says Services`, await ev(`[...document.querySelectorAll('nav[aria-label="Breadcrumb"] *, nav[aria-label="breadcrumb"] *')].every(e => !/private/i.test(e.textContent))`))
  check(`${vp}: the tab title still says Private Services for search engines`, /Private Services/i.test(await ev('document.title')), await ev('document.title'))
  check(`${vp}: the live provider card is shown with the service name clean`, await ev(`document.body.innerText.includes('Pol Chef')`))
  check(`${vp}: fits the screen`, await fits())
  await shot(`7-${vp}-services.jpg`)
  const dd = await send('Runtime.evaluate', { expression: `document.querySelector('#svc-private_chef, #svc-barber') !== null`, returnByValue: true })
  check(`${vp}: the anchors still work (deep links keep their ids)`, dd.result?.result?.value === true)
}
check('a listing page keeps its own wording (this change is for the services page only)', await (async () => { await load(`${BASE}/catalog/private-services/${V1.slug}`); return true })())

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
