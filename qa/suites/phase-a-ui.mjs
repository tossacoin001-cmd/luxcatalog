// Phase A in headless Chrome (phone): guest enquiry and viewing request
// without an account, décor cart to Paystack, Discover with our own
// matching and brand icons.
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import pg from 'pg'

const BASE = 'http://localhost:3300'
const OUT = process.env.OUT
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') }); await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
const stamp = Date.now()
const ins = async (title, category, price) => { const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`; await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,'A beautiful piece for discerning clients.',$4,$5,'Ikoyi, Lagos','Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200'],'{}',ARRAY[]::text[],'sale','for_sale',true,now())`, [title, slug, category, price, `₦${price.toLocaleString('en-NG')}`]); return slug }
const VILLA = await ins('Ikoyi Garden Villa UI', 'real_estate', 1800000000)
const CHAIR = await ins('Velvet Accent Chair UI', 'decor', 650000)
await q('delete from "RateLimit"')
await fetch(`${BASE}/catalog/real-estate/${VILLA}`); await fetch(`${BASE}/catalog/decor/${CHAIR}`)

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9352', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pa-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9352/json')).json(); break } catch { await sleep(500) } }
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
const clickText = (sel, txt) => ev(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().toLowerCase().includes(${JSON.stringify(txt.toLowerCase())}) && !e.disabled && e.offsetParent); if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const click = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || el.disabled) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const day = (n) => { const d = new Date(Date.now() + 3_600_000); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await send('Network.clearBrowserCookies')

console.log('1. Guest enquiry without an account (phone)')
await load(`${BASE}/catalog/real-estate/${VILLA}`)
check('no "create an account to enquire" gate', await ev(`!document.body.textContent.includes('Create a free account')`))
check('open the enquiry form', await clickText('button', 'Enquire'))
check('form opens (no redirect to sign-up)', await waitFor(`location.pathname.startsWith('/catalog') && !!document.querySelector('[data-enquiry-form]')`, 5000), await ev('location.pathname'))
await setVal('[data-enquiry-form] input[name=name]', 'Tola Bakare')
await setVal('[data-enquiry-form] input[name=email]', `tola.ui${stamp}@example.com`)
await setVal('[data-enquiry-form] input[name=phone]', '+234 803 000 0000')
await setVal('[data-enquiry-form] textarea[name=message]', 'Is this villa still available? I would like the brochure and service charge.')
check('form fits the phone', await fits())
await shot('1-enquiry-form.jpg')
await clickText('[data-enquiry-form] button', 'Send')
check('thank-you shown', await waitFor(`/thank you|received/i.test(document.querySelector('[data-enquiry-form]')?.textContent ?? document.body.textContent)`, 10000))
const e = (await q(`select kind, "userId" from "Inquiry" where email=$1 order by "createdAt" desc limit 1`, [`tola.ui${stamp}@example.com`]))[0]
check('stored as a guest enquiry', e?.kind === 'enquiry' && e.userId === null, JSON.stringify(e))
await shot('2-enquiry-sent.jpg')

console.log('2. Viewing request (phone)')
await load(`${BASE}/catalog/real-estate/${VILLA}`)
check('"Schedule a viewing" offered', await clickText('button', 'Schedule a viewing'))
check('viewing form with date, time and mode', await waitFor(`!!document.querySelector('[data-enquiry-form] input[name=preferredDate]') && !!document.querySelector('[data-enquiry-form] select[name=preferredTime]') && !!document.querySelector('[data-enquiry-form] select[name=viewingMode]')`, 5000))
await setVal('[data-enquiry-form] input[name=name]', 'Tola Bakare')
await setVal('[data-enquiry-form] input[name=email]', `tola.view${stamp}@example.com`)
await setVal('[data-enquiry-form] input[name=preferredDate]', day(4))
await setVal('[data-enquiry-form] select[name=preferredTime]', 'afternoon')
await setVal('[data-enquiry-form] select[name=viewingMode]', 'video')
await setVal('[data-enquiry-form] textarea[name=message]', 'I am abroad, a video walkthrough would be ideal.')
await shot('3-viewing-form.jpg')
await clickText('[data-enquiry-form] button', 'Request')
check('viewing request confirmed', await waitFor(`/thank you/i.test(document.querySelector('[data-enquiry-form]')?.textContent ?? '')`, 10000))
const v = (await q(`select kind, to_char("preferredDate",'YYYY-MM-DD') d, "preferredTime", "viewingMode" from "Inquiry" where email=$1`, [`tola.view${stamp}@example.com`]))[0]
check('stored with date, time and mode', v?.kind === 'viewing' && v.d === day(4) && v.preferredTime === 'afternoon' && v.viewingMode === 'video', JSON.stringify(v))
check('no holding deposit anywhere on the page', await ev(`!/holding deposit/i.test(document.body.textContent)`))
await ev('window.scrollTo(0, innerHeight * 1.5)'); await sleep(800)
check('sticky bar says Enquire on a sale listing', await waitFor(`[...document.querySelectorAll('a,button')].some(b => b.offsetParent && /^enquire$/i.test(b.textContent.trim()))`, 4000))

console.log('3. Décor cart to Paystack (phone)')
await load(`${BASE}/catalog/decor/${CHAIR}`)
check('add to cart', await clickText('button', 'Add to cart') || await clickText('button', 'Add to bag'))
await sleep(800)
await load(`${BASE}/cart`)
check('cart shows the chair in Naira', await waitFor(`document.body.textContent.includes('Velvet Accent Chair UI') && document.body.textContent.includes('₦650,000')`, 5000))
await clickText('a,button', 'Checkout')
await waitFor(`location.pathname === '/checkout'`, 8000)
check('checkout says Paystack and Naira, not Stripe or USD', await ev(`/Paystack/.test(document.body.textContent) && !/Stripe/.test(document.body.textContent) && !/in USD/.test(document.body.textContent)`))
for (const [n, val] of [['name', 'Grace Guest'], ['email', `grace.cart${stamp}@example.com`], ['phone', '+234 803 111 2222'], ['address', '12 Ozumba Mbadiwe Avenue'], ['city', 'Lagos'], ['state', 'Lagos'], ['country', 'Nigeria']]) await setVal(`input[name=${n}]`, val)
check('checkout fits the phone', await fits())
await shot('4-checkout.jpg')
await clickText('button', 'Pay')
check('buyer is sent to Paystack', await waitFor(`location.hostname.includes('paystack')`, 25000), await ev('location.href'))
const o = (await q(`select "paymentProvider", total::text, "paymentRef" from "Order" where email=$1`, [`grace.cart${stamp}@example.com`]))[0]
check('order stored for Paystack in Naira', o?.paymentProvider === 'paystack' && Number(o.total) === 650000 && /^ORD-/.test(o.paymentRef ?? ''), JSON.stringify(o))

console.log('4. Discover (phone)')
await load(`${BASE}/discover`)
check('no emoji icons', await ev(`!/[\\u{1F300}-\\u{1FAFF}\\u2600-\\u27BF]/u.test(document.querySelector('main')?.textContent ?? document.body.textContent)`))
check('Stays and Services are offered', await ev(`['Stays','Services'].every(l => [...document.querySelectorAll('[data-discover-pillar]')].some(b => b.textContent.includes(l)))`))
// Pick what you want, answer what belongs to it, then ask for matches.
await clickText('[data-discover-pillar]', 'Interior Decor'); await sleep(300)
await click('[data-discover-next]'); await sleep(500)
await click('[data-discover-next]'); await sleep(500)
await clickText('[data-discover] button', 'Lagos Island'); await sleep(300)
await click('[data-discover-next]'); await sleep(700)
const shown = (await waitFor(`!!document.querySelector('[data-discover-results]')`, 20000)) ? await ev(`[...document.querySelectorAll('[data-result-card] h3')].map(h => h.textContent.trim()).filter(Boolean)`) : []
const listed = shown
const real = listed.length ? (await q(`select title from "Listing" where category='decor' and published and title = any($1)`, [listed])).map((x) => x.title) : []
check('results appear, all real décor pieces from the catalogue', real.length >= 1 && listed.every((t) => real.includes(t)), JSON.stringify({ shown: shown.slice(0, 6), real: real.slice(0, 6) }))
check('discover fits the phone', await fits())
await shot('5-discover-results.jpg')

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
