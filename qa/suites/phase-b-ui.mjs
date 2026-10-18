// Phase B in headless Chrome: sale / rent / lease tabs, homepage routes,
// the on-site concierge panel (WhatsApp last, never primary), requests from
// empty categories, the Contact form with its human check, and an audit of
// WhatsApp links on every public page.
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
const row = async (s, p) => { for (let i = 0; i < 20; i++) { const r = (await q(s, p))[0]; if (r) return r; await sleep(500) } return undefined }
const q = (s, p) => db.query(s, p).then((r) => r.rows)
const stamp = Date.now()
const ins = async (title, category, sub, mode, price, display) => {
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`
  await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,'A beautiful property for discerning clients.',$4,$5,'Ikoyi, Lagos','Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200'],'{}',ARRAY[]::text[],$6,$7,true,now())`, [title, slug, category, price, display, mode, sub])
  return slug
}
const SALE = await ins('Banana Villa SaleUI', 'real_estate', 'for_sale', 'sale', 2500000000, '₦2,500,000,000')
const RENT = await ins('Lekki Flat RentUI', 'real_estate', 'for_rent', 'rent', 25000000, '₦25,000,000')
const STAY = await ins('Ikoyi Loft StayUI', 'real_estate', 'luxury_shortlets', 'booking', 300000, '₦300,000')
const COMLEASE = await ins('Maitama Floor LeaseUI', 'commercial', 'for_lease', 'rent', 150000000, '₦150,000,000')
const COMSALE = await ins('Marina Tower SaleUI', 'commercial', 'for_sale', 'sale', 900000000, '₦900,000,000')
await q('delete from "RateLimit"')
// A view with no listings at all, for the empty state.
let emptyView = null
for (const [cat, db_cat, sub, path] of [['supercars', 'supercar', 'car_rental', '/catalog/supercars?view=car_rental'], ['yachts', 'yacht', 'aqua_homes', '/catalog/yachts?view=aqua_homes'], ['yachts', 'yacht', 'boat_cruises', '/catalog/yachts?view=boat_cruises']]) {
  if ((await q(`select count(*)::int n from "Listing" where category=$1 and subcategory=$2 and published`, [db_cat, sub]))[0].n === 0) { emptyView = { path, sub, cat }; break }
}
// supercars needs at least one sale listing so the tabs exist (tabs show for categories that have views).
await ins('Bugatti SaleUI', 'supercar', 'for_sale', 'sale', 800000000, '₦800,000,000')
await refreshCatalog(BASE, q)
// Pages are cached for 5 minutes: wait until the new listings show up in them.
for (const [p, must] of [['/catalog/real-estate', 'Banana Villa SaleUI'], ['/catalog/commercial', 'Maitama Floor LeaseUI'], ['/catalog/supercars', 'Bugatti SaleUI'], ['/catalog/yachts', ''], ['/', ''], ['/contact', '']]) {
  for (let i = 0; i < 40; i++) { const h = await (await fetch(BASE + p)).text(); if (!must || h.includes(must)) break; await sleep(1500) }
}

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9353', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pb-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9353/json')).json(); break } catch { await sleep(500) } }
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
const clickText = (sel, txt) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().toLowerCase().includes(${JSON.stringify(txt.toLowerCase())}) && !e.disabled && e.offsetParent); if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const visibleTitles = () => ev(`[...document.querySelectorAll('main h3, h3')].map(h => h.textContent.trim()).filter(Boolean)`)
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }

// WhatsApp audit: every visible wa.me link on the page, where it sits
// (footer or not) and whether it looks like a main (gold) button.
const AUDIT = `(() => {
  const links = [...document.querySelectorAll('a[href*="wa.me"]')].filter(a => a.offsetParent)
  return links.map(a => { const cs = getComputedStyle(a); const gold = /201, 168, 76|216, 184, 92|184, 148, 58/.test(cs.backgroundColor + cs.backgroundImage); return { inFooter: !!a.closest('footer') || a.hasAttribute('data-wa-fallback'), gold, text: a.textContent.trim().slice(0, 40) } })
})()`

for (const [vp, metrics] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  console.log(`— ${vp}`)
  await send('Emulation.setDeviceMetricsOverride', metrics)

  await q('delete from "RateLimit"')
  console.log('1. Sale and rent tabs')
  await load(`${BASE}/catalog/real-estate`)
  check(`${vp}: tabs shown`, await ev(`!!document.querySelector('[data-view-tabs]') && ['For Sale','For Rent','Luxury Shortlets'].every(l => document.querySelector('[data-view-tabs]').textContent.includes(l))`))
  check(`${vp}: "All" shows sale, rent and stay`, await waitFor(`['Banana Villa SaleUI','Lekki Flat RentUI','Ikoyi Loft StayUI'].every(t => document.body.innerText.includes(t))`, 5000))
  check(`${vp}: tap For Rent`, await clickText('[data-view-tabs] a, [data-view-tabs] button', 'For Rent'))
  check(`${vp}: only rentals shown, address updated`, await waitFor(`document.body.innerText.includes('Lekki Flat RentUI') && !document.body.innerText.includes('Banana Villa SaleUI') && !document.body.innerText.includes('Ikoyi Loft StayUI') && location.search.includes('view=for_rent')`, 6000), await ev('location.href + " :: " + document.body.innerText.split(String.fromCharCode(10)).filter(l=>/Villa|Loft|Flat/.test(l)).join(" ; ")'))
  check(`${vp}: the rental card says For rent and per year`, await ev(`(() => { const t = [...document.querySelectorAll('a')].find(a => a.textContent.includes('Lekki Flat RentUI'))?.textContent ?? ''; return /For rent/.test(t) && /per year/.test(t) })()`))
  check(`${vp}: For Rent tab is marked active`, await ev(`!!document.querySelector('[data-view-tabs] [aria-current="page"]') && document.querySelector('[data-view-tabs] [aria-current="page"]').textContent.includes('For Rent')`))
  await shot(`1-${vp}-rent.jpg`)
  await clickText('[data-view-tabs] a, [data-view-tabs] button', 'For Sale')
  check(`${vp}: For Sale shows only sales`, await waitFor(`document.body.innerText.includes('Banana Villa SaleUI') && !document.body.innerText.includes('Lekki Flat RentUI')`, 6000))
  await clickText('[data-view-tabs] a, [data-view-tabs] button', 'Luxury Shortlets')
  check(`${vp}: Shortlets view`, await waitFor(`document.body.innerText.includes('Ikoyi Loft StayUI') && !document.body.innerText.includes('Banana Villa SaleUI')`, 6000))
  await load(`${BASE}/catalog/real-estate?view=for_rent`)
  check(`${vp}: a shared ?view=for_rent address opens on rentals`, await waitFor(`document.body.innerText.includes('Lekki Flat RentUI') && !document.body.innerText.includes('Banana Villa SaleUI')`, 6000))
  check(`${vp}: tabs fit`, await fits())
  await load(`${BASE}/catalog/commercial?view=for_lease`)
  check(`${vp}: commercial lease view`, await waitFor(`document.body.innerText.includes('Maitama Floor LeaseUI') && !document.body.innerText.includes('Marina Tower SaleUI')`, 6000))
  if (emptyView) {
    await load(`${BASE}${emptyView.path}`)
    check(`${vp}: an empty view (${emptyView.sub}) offers an on-site request`, await waitFor(`!!document.querySelector('[data-brief-trigger]') && !document.querySelector('main a[href*="wa.me"]')`, 6000))
  }

  console.log('2. Homepage routes')
  await load(`${BASE}/`)
  check(`${vp}: For Rent chip goes to the rentals tab`, await ev(`!!document.querySelector('a[href="/catalog/real-estate?view=for_rent"]')`))
  await ev(`document.querySelector('a[href="/catalog/real-estate?view=for_rent"]').scrollIntoView({block:'center'})`); await sleep(1500)
  await click('a[href="/catalog/real-estate?view=for_rent"]')
  check(`${vp}: tapping it shows rentals`, await waitFor(`location.pathname === '/catalog/real-estate' && location.search.includes('for_rent') && document.body.innerText.includes('Lekki Flat RentUI') && !document.body.innerText.includes('Banana Villa SaleUI')`, 12000), await ev('location.href'))
  await load(`${BASE}/`)
  const heroButton = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.includes('Speak to a Concierge')); return !!b })()`)
  check(`${vp}: hero "Speak to a Concierge" is an on-site button`, heroButton)
  check(`${vp}: festive "Reserve Your Dates" is an on-site link`, await ev(`(() => { const a = [...document.querySelectorAll('a')].find(e => e.textContent.includes('Reserve Your Dates')); return !!a && a.getAttribute('href') === '/catalog/shortlets' })()`))

  console.log('3. The concierge panel')
  await clickText('button', 'Speak to a Concierge')
  check(`${vp}: the hero button opens the panel`, await waitFor(`!!document.querySelector('[data-concierge-panel]')`, 4000))
  check(`${vp}: topics offered`, await ev(`['home','car','stay','service','chauffeur','other'].every(k => !!document.querySelector('[data-concierge-panel] [data-topic="' + k + '"]'))`))
  await click('[data-concierge-panel] [data-topic="service"]')
  await setVal('[data-concierge-panel] input[name=name]', 'Tola Bakare')
  await setVal('[data-concierge-panel] input[name=email]', `tola.cp.${vp}${stamp}@example.com`)
  await setVal('[data-concierge-panel] textarea[name=message]', 'A private chef for six guests on 12 December in Ikoyi, no shellfish.')
  const order = await ev(`(() => { const p = document.querySelector('[data-concierge-panel]'); const form = p.querySelector('form'); const wa = p.querySelector('a[href*="wa.me"]'); if (!wa) return { wa: false }; const gold = /201, 168, 76|216, 184, 92/.test(getComputedStyle(wa).backgroundColor + getComputedStyle(wa).backgroundImage); return { wa: true, after: !!(form.compareDocumentPosition(wa) & Node.DOCUMENT_POSITION_FOLLOWING), gold } })()`)
  check(`${vp}: WhatsApp is offered only below the form, as a plain link`, order.wa && order.after && !order.gold, JSON.stringify(order))
  check(`${vp}: panel fits`, await fits())
  await shot(`2-${vp}-concierge.jpg`)
  await clickText('[data-concierge-panel] button', 'Send')
  check(`${vp}: thank-you shown`, await waitFor(`/thank you/i.test(document.querySelector('[data-concierge-panel]')?.textContent ?? '')`, 12000))
  const b1 = await row(`select kind, message, "userId" from "Inquiry" where email=$1`, [`tola.cp.${vp}${stamp}@example.com`])
  check(`${vp}: stored as a request with its topic`, b1?.kind === 'brief' && /^Looking for: /.test(b1.message) && b1.message.includes('private chef') && b1.userId === null, JSON.stringify(b1))

  console.log('4. Request from an empty view')
  await load(`${BASE}${emptyView?.path ?? '/catalog/yachts?view=aqua_homes'}`)
  const trig = await waitFor(`!!document.querySelector('[data-brief-trigger]')`, 8000)
  check(`${vp}: the empty view has an on-site request button`, trig)
  check(`${vp}: and no WhatsApp link in the page body`, await ev(`![...document.querySelectorAll('a[href*="wa.me"]')].some(a => a.offsetParent && !a.closest('footer') && !a.hasAttribute('data-wa-fallback'))`))
  await click('[data-brief-trigger]')
  check(`${vp}: the request form opens`, await waitFor(`!!document.querySelector('[data-brief-form] form')`, 4000))
  await setVal('[data-brief-form] input[name=name]', 'Ife Adeyemi')
  await setVal('[data-brief-form] input[name=email]', `ife.${vp}${stamp}@example.com`)
  await setVal('[data-brief-form] textarea[name=message]', 'A 30m motor yacht for a week in January, with crew.')
  await clickText('[data-brief-form] button', 'Send')
  check(`${vp}: thank-you shown`, await waitFor(`/thank you/i.test(document.querySelector('[data-brief-form]')?.textContent ?? '')`, 12000))
  const b2 = await row(`select kind, message from "Inquiry" where email=$1`, [`ife.${vp}${stamp}@example.com`])
  check(`${vp}: stored with the view as its topic`, b2?.kind === 'brief' && new RegExp('^Looking for: ' + (emptyView?.cat === 'supercars' ? 'Supercars' : 'Yachts'), 'i').test(b2.message), JSON.stringify(b2))

  await q('delete from "RateLimit"')
  console.log('5. Contact form')
  await load(`${BASE}/contact`)
  await ev(`window.__bodies = []; const f = window.fetch; window.fetch = (u, o) => { try { if (String(u).includes('/api/inquiries')) window.__bodies.push(JSON.parse(o.body)) } catch {} const p = f(u, o); if (String(u).includes('/api/inquiries')) p.then(async (r) => { window.__status = r.status + ' ' + (await r.clone().text()).slice(0, 120) }); return p }`)
  const formFirst = await ev(`(() => { const form = document.querySelector('main form') ?? document.querySelector('form'); const wa = [...document.querySelectorAll('a[href*="wa.me"]')].find(a => !a.closest('footer')); return !wa || !!(form.compareDocumentPosition(wa) & Node.DOCUMENT_POSITION_FOLLOWING) })()`)
  check(`${vp}: contact — the form comes before any WhatsApp link`, formFirst)
  check(`${vp}: contact — no gold WhatsApp button`, !(await ev(AUDIT)).some((a) => a.gold))
  await setVal('form input[placeholder="Your name"]', 'Ngozi Eze')
  await setVal('form input[type=email]', `ngozi.${vp}${stamp}@example.com`)
  await setVal('form textarea', 'Please send me options for a 4-bedroom home in Lekki, budget ₦400m.')
  await clickText('form button', 'Send')
  await waitFor(`window.__bodies.length > 0`, 8000)
  const body = await ev('window.__bodies[0]')
  check(`${vp}: contact — the request carries the human-check field and no hidden-trap text`, body && 'captcha' in body && !body.website, JSON.stringify(body))
  await sleep(1500)
  const cstat = await ev('window.__status'); check(`${vp}: contact — stored as an enquiry`, (await row(`select kind from "Inquiry" where email=$1`, [`ngozi.${vp}${stamp}@example.com`]))?.kind === 'enquiry', String(cstat))

  console.log('6. Listing pages')
  await load(`${BASE}/catalog/real-estate/${RENT}`)
  const price = await ev(`document.body.textContent`)
  check(`${vp}: rental page says Annual rent and per year`, /Annual rent/i.test(price) && /per year/.test(price))
  await ev('window.scrollTo(0, innerHeight * 1.5)'); await sleep(1200)
  check(`${vp}: no WhatsApp main action on a listing page`, !(await ev(AUDIT)).some((a) => !a.inFooter))
}

console.log('7. WhatsApp audit across public pages')
for (const [vp, metrics] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  for (const p of ['/', '/catalog', '/catalog/real-estate', '/catalog/commercial', '/catalog/supercars', '/catalog/yachts', '/catalog/lifestyle', '/catalog/decor', '/catalog/private-services', '/catalog/shortlets', '/discover', '/contact', '/about', '/partners', '/cart', '/sign-in']) {
    await load(BASE + p)
    await ev('window.scrollTo(0, document.body.scrollHeight * 0.5)'); await sleep(900)
    const links = await ev(AUDIT)
    check(`${vp} ${p}: no WhatsApp link outside the footer, none styled as a main button`, links.every((a) => a.inFooter && !a.gold), JSON.stringify(links.filter((a) => !a.inFooter || a.gold)))
  }
}

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
