// Lux in headless Chrome, desktop and phone (written before the build,
// 2026-10-22): the button opens a CHAT (not an enquiry form) with a greeting
// from the visitor's own hour, tappable questions, answers with real listing
// cards, availability, a person on request, memory across reopen, and it keeps
// working when browser storage is blocked.
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
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x).slice(0, 300)}`)))
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') }); await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
const day = (n) => new Date(Date.now() + 3_600_000 + n * 86_400_000).toISOString().slice(0, 10)
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const word = (iso) => `${Number(iso.slice(8))} ${MON[Number(iso.slice(5, 7)) - 1]}`
const stamp = Date.now()

console.log('Setup')
await q('delete from "RateLimit"')
const ins = async (title, category, sub, mode, price, display, loc = 'Ikoyi, Lagos') => {
  const slug = `lu-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`
  const rows = await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,'A fine listing.',$4,$5,$6,'Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600'],'{}',ARRAY[]::text[],$7,$8,true,now()) returning id`, [title, slug, category, price, display, loc, mode, sub])
  return { id: rows[0].id, slug, title }
}
const settings = (id, unit, rate) => q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","maxUnits","maxGuests","instantBook","advanceNoticeHours","updatedAt") values ($1,true,$2,$3,0,0,1,14,6,true,0,now())`, [id, unit, rate])
const XSS = await ins('<img src=x onerror="window.__xss=1"> Villa', 'real_estate', 'for_sale', 'sale', 450_000_000, '₦450,000,000')
const Loft = await ins('Lux Test Loft Free', 'real_estate', 'luxury_shortlets', 'booking', 300_000, '₦300,000'); await settings(Loft.id, 'night', 300_000)
const Taken = await ins('Lux Test Loft Taken', 'real_estate', 'luxury_shortlets', 'booking', 320_000, '₦320,000'); await settings(Taken.id, 'night', 320_000)
await q(`insert into "UnavailableDate" (id,"listingId","startDate","endDate",source) values (gen_random_uuid(),$1,$2,$3,'manual')`, [Taken.id, `${day(20)}T00:00:00Z`, `${day(27)}T00:00:00Z`])
const dates = `${word(day(21))} to ${word(day(24))}`

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9349', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lc-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9349/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map(); const errors = []
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text) }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
async function load(url) { await send('Page.navigate', { url: 'about:blank' }); await sleep(100); await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1500) }
const waitFor = async (expr, ms = 10000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await sleep(200) } return false }
const click = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || el.disabled) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const setVal = (sel, value) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
const fits = () => ev('document.documentElement.scrollWidth <= innerWidth + 1')
const hour = (h) => ev(`Date.prototype.getHours = () => ${h}; true`)
const openChat = async () => { await ev('window.scrollTo(0, innerHeight * 1.2)'); await sleep(900); await click('[data-lux-button]'); return waitFor(`!!document.querySelector('[data-lux-chat]')`, 5000) }
const closeChat = async () => { await click('[data-lux-chat] button[aria-label="Close"]'); return waitFor(`!document.querySelector('[data-lux-chat]')`, 4000) }
const cards = () => ev(`document.querySelectorAll('[data-lux-card]').length`)
const lastReply = () => ev(`(() => { const b = [...document.querySelectorAll('[data-lux-log] > div')].filter(d => !d.hasAttribute('data-lux-typing')); return b.length ? b[b.length - 1].innerText : '' })()`)
const typeAndSend = async (text) => { await setVal('[data-lux-input]', text); await click('[data-lux-send]') }
const waitReply = async (n) => waitFor(`document.querySelectorAll('[data-lux-log] > div').length >= ${n} && !document.querySelector('[data-lux-typing]')`, 15000)

for (const [vp, metrics] of [['desktop', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }]]) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await q('delete from "RateLimit"')

  console.log(`1. ${vp}: it opens as a chat, with a greeting from the visitor's own hour`)
  await load(BASE + '/')
  await ev(`try { sessionStorage.clear(); localStorage.clear() } catch {} ; true`)
  await load(BASE + '/')
  await hour(9)
  check(`${vp}: the floating button appears after scrolling and says Lux, not concierge`, await waitFor(`(window.scrollTo(0, innerHeight * 1.2), !!document.querySelector('[data-lux-button]'))`, 6000) && await ev(`!/concierge/i.test(document.querySelector('[data-lux-button]').getAttribute('aria-label') + document.querySelector('[data-lux-button]').textContent)`))
  check(`${vp}: the icon is a round monogram (an image with a circle and an "L"), at least 56px, never a plain box`, await ev(`(() => { const b = document.querySelector('[data-lux-button]'); const r = b.getBoundingClientRect(); const svg = b.querySelector('svg'); return r.width >= 56 && Math.abs(r.width - r.height) < 2 && !!svg && svg.querySelectorAll('circle').length >= 3 && /L/.test(svg.textContent) && !/ask lux/i.test([...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('')) })()`))
  check(`${vp}: it is alive: it breathes, a ring pulses, an arc circles and a green dot blinks`, await ev(`(() => { const n = (sel) => document.querySelector('[data-lux-button] ' + sel); return ['.lux-orb-body', '.lux-pulse', '.lux-orbit', '.lux-dot'].every(s => getComputedStyle(n(s)).animationName !== 'none') })()`))
  await sleep(1000) // let it finish sliding in
  check(`${vp}: it sits in the bottom corner, clear of the screen edge`, await ev(`(() => { const r = document.querySelector('[data-lux-button]').getBoundingClientRect(); return r.right <= innerWidth - 8 && r.bottom <= innerHeight - 8 && r.left > innerWidth / 2 && r.top > innerHeight / 2 })()`))
  check(`${vp}: after a few seconds it says hello once, in the visitor's own hour, with a 44px close button`, await waitFor(`!!document.querySelector('[data-lux-nudge]')`, 9000) && await ev(`/^(Good (morning|afternoon|evening)|Still up|Hello).*Need a hand\\?$/.test(document.querySelector('[data-lux-nudge]').innerText.trim()) && document.querySelector('[data-lux-nudge] button[aria-label="Dismiss"]').getBoundingClientRect().width >= 44`))
  await shot(`${vp}-lux-orb.jpg`)
  check(`${vp}: dismissing the hello removes it and it does not come back this visit`, (await click('[data-lux-nudge] button[aria-label="Dismiss"]')) && await waitFor(`!document.querySelector('[data-lux-nudge]')`, 3000) && !(await waitFor(`!!document.querySelector('[data-lux-nudge]')`, 3500)))
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  check(`${vp}: for people who asked for reduced motion nothing on the icon moves`, await ev(`(() => { const n = (sel) => document.querySelector('[data-lux-button] ' + sel); return ['.lux-orb-body', '.lux-pulse', '.lux-orbit', '.lux-dot'].every(s => getComputedStyle(n(s)).animationName === 'none') })()`))
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  check(`${vp}: tapping it opens the chat`, await openChat())
  check(`${vp}: morning greeting at 9am`, await ev(`/^Good morning/.test(document.querySelector('[data-lux-greeting]')?.innerText ?? '')`))
  check(`${vp}: the greeting ends with a question and the panel is called Lux`, await ev(`/\\?\\s*$/.test(document.querySelector('[data-lux-greeting]').innerText) && /^Lux/.test(document.querySelector('[data-lux-chat] [data-wordmark]').innerText)`))
  check(`${vp}: it is a chat, not an enquiry form (no topic buttons, no message box, no Send request)`, await ev(`!document.querySelector('[data-lux-chat] textarea, [data-lux-chat] [data-topic], [data-concierge-panel]') && !/send request/i.test(document.querySelector('[data-lux-chat]').innerText)`))
  check(`${vp}: 5 to 7 tappable questions, each at least 44px tall`, await ev(`(() => { const c = [...document.querySelectorAll('[data-lux-chip]')]; return c.length >= 5 && c.length <= 7 && c.every(b => b.getBoundingClientRect().height >= 44) })()`))
  check(`${vp}: the message box has a label, 16px text (no zoom on phones) and a 44px send button`, await ev(`(() => { const i = document.querySelector('[data-lux-input]'); const s = document.querySelector('[data-lux-send]'); return !!document.querySelector('label[for="' + i.id + '"]') && parseFloat(getComputedStyle(i).fontSize) >= 16 && s.getBoundingClientRect().width >= 44 && s.getBoundingClientRect().height >= 44 })()`))
  check(`${vp}: the chat fits the screen`, await fits() && await ev(`(() => { const r = document.querySelector('[data-lux-chat]').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= -1 })()`))
  check(`${vp}: the message box has focus`, await ev(`document.activeElement?.hasAttribute('data-lux-input')`))
  await shot(`${vp}-lux-open.jpg`)
  check(`${vp}: Escape closes it`, (await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }), await waitFor(`!document.querySelector('[data-lux-chat]')`, 4000)))
  for (const [h, re] of [[15, 'Good afternoon'], [19, 'Good evening'], [2, '(Still up|Good evening)']]) {
    await hour(h); await openChat()
    check(`${vp}: at ${h}:00 it says "${re}"`, await ev(`/^${re}/.test(document.querySelector('[data-lux-greeting]')?.innerText ?? '')`))
    await closeChat()
  }
  await hour(9)

  console.log(`2. ${vp}: tapping a question answers with real listings`)
  await openChat()
  check(`${vp}: tap "Find a home to buy"`, await ev(`(() => { const b = [...document.querySelectorAll('[data-lux-chip]')].find(x => /home to buy/i.test(x.innerText)); if (!b) return false; b.click(); return true })()`))
  check(`${vp}: their words appear as a message, then Lux answers`, await waitFor(`/I want to buy a home/.test(document.querySelector('[data-lux-log]').innerText)`, 4000) && await waitReply(3))
  check(`${vp}: the answer carries listing cards`, await waitFor(`document.querySelectorAll('[data-lux-card]').length >= 1`, 8000), await lastReply())
  check(`${vp}: each card has a name, a price and a link into the catalogue`, await ev(`[...document.querySelectorAll('[data-lux-card]')].every(c => c.innerText.trim().length > 5 && /₦/.test(c.innerText) && /\\/catalog\\//.test(c.querySelector('a').getAttribute('href')))`))
  check(`${vp}: a listing title containing markup is shown as plain text and never runs`, await ev(`window.__xss === undefined && [...document.querySelectorAll('[data-lux-card]')].some(c => c.innerText.includes('<img'))`))
  check(`${vp}: follow-up questions appear after the answer`, await ev(`document.querySelectorAll('[data-lux-chip]').length >= 2`))
  check(`${vp}: still fits the screen`, await fits())
  await shot(`${vp}-lux-answer.jpg`)

  console.log(`3. ${vp}: typing works, and the dates are checked`)
  await typeAndSend(`a shortlet from ${dates}`)
  check(`${vp}: Lux answers with the free loft marked free on those dates`, await waitFor(`[...document.querySelectorAll('[data-lux-card]')].some(c => /Lux Test Loft Free/.test(c.innerText) && /free on your dates/i.test(c.innerText))`, 15000))
  check(`${vp}: the booked loft is never shown as free`, await ev(`![...document.querySelectorAll('[data-lux-card]')].some(c => /Lux Test Loft Taken/.test(c.innerText) && /free on your dates/i.test(c.innerText))`))
  check(`${vp}: the free one has a link that carries the dates`, await ev(`[...document.querySelectorAll('[data-lux-card]')].filter(c => /Lux Test Loft Free/.test(c.innerText)).some(c => /start=/.test(c.querySelector('a').getAttribute('href')) && /Book these dates/i.test(c.innerText))`))
  await shot(`${vp}-lux-dates.jpg`)
  await typeAndSend('hello there')
  check(`${vp}: pressing the send button with text clears the box`, await waitFor(`document.querySelector('[data-lux-input]').value === ''`, 3000))
  check(`${vp}: Send is disabled while the box is empty`, await ev(`document.querySelector('[data-lux-send]').disabled === true`))

  console.log(`4. ${vp}: it remembers, and starts again when asked`)
  const before = await ev(`document.querySelector('[data-lux-log]').innerText.length`)
  await closeChat(); await openChat()
  check(`${vp}: reopening shows the same conversation`, await ev(`document.querySelector('[data-lux-log]').innerText.length >= ${Math.floor(before * 0.8)} && document.querySelectorAll('[data-lux-card]').length >= 1`))
  check(`${vp}: "start a new chat" clears it and brings back the greeting and the questions`, (await click('[data-lux-chat] button[aria-label="Start a new chat"]')) && await waitFor(`document.querySelectorAll('[data-lux-card]').length === 0 && document.querySelectorAll('[data-lux-chip]').length >= 5`, 4000))
  await closeChat()

  console.log(`5. ${vp}: a person, on request`)
  await openChat()
  check(`${vp}: tap "Speak to a person"`, await ev(`(() => { const b = [...document.querySelectorAll('[data-lux-chip]')].find(x => /speak to a person/i.test(x.innerText)); if (!b) return false; b.click(); return true })()`))
  check(`${vp}: a short form (name, email) appears inside the chat`, await waitFor(`!!document.querySelector('[data-lux-handoff] input[name=name]') && !!document.querySelector('[data-lux-handoff] input[name=email]')`, 10000))
  await setVal('[data-lux-handoff] input[name=name]', 'Ife Chat'); await setVal('[data-lux-handoff] input[name=email]', `ife.lux.${vp}${stamp}@example.com`)
  await shot(`${vp}-lux-handoff.jpg`)
  check(`${vp}: send to the team`, await click('[data-lux-handoff] button[type=submit]'))
  check(`${vp}: a thank-you appears in the chat`, await waitFor(`/thank you/i.test(document.querySelector('[data-lux-log]').innerText)`, 10000))
  let row; for (let i = 0; i < 30 && !row; i++) { row = (await q(`select kind, message, "userId" from "Inquiry" where email=$1`, [`ife.lux.${vp}${stamp}@example.com`]))[0]; if (!row) await sleep(300) }
  check(`${vp}: the team receives it as one request with the whole conversation`, row?.kind === 'brief' && /Visitor:/.test(row.message) && /Lux:/.test(row.message) && /speak to a person/i.test(row.message), JSON.stringify({ row, recent: await q(`select email, kind, "createdAt" from "Inquiry" order by "createdAt" desc limit 3`), log: await ev(`document.querySelector('[data-lux-log]')?.innerText.slice(-300)`) }))
  await closeChat()

  console.log(`6. ${vp}: it still works when browser storage is blocked`)
  await load(BASE + '/')
  await ev(`Storage.prototype.setItem = () => { throw new Error('blocked') }; Storage.prototype.getItem = () => { throw new Error('blocked') }; true`)
  check(`${vp}: opens and answers with storage blocked`, await openChat() && (await typeAndSend('hire a supercar'), await waitFor(`!!document.querySelector('[data-lux-log]') && document.querySelectorAll('[data-lux-log] > div').length >= 3`, 15000)))
  await closeChat()

  console.log(`7. ${vp}: on a listing page`)
  await load(`${BASE}/catalog/real-estate/${Loft.slug}`)
  check(`${vp}: there is an "Ask Lux about this" button on the page`, await ev(`!![...document.querySelectorAll('button')].find(b => /ask lux about this/i.test(b.innerText))`))
  await ev(`[...document.querySelectorAll('button')].find(b => /ask lux about this/i.test(b.innerText))?.click()`)
  check(`${vp}: the chat opens with questions about that listing`, await waitFor(`!!document.querySelector('[data-lux-chat]')`, 5000) && await ev(`[...document.querySelectorAll('[data-lux-chip]')].some(c => /free on my dates/i.test(c.innerText))`))
  await closeChat()
  await load(BASE + '/discover')
  check(`${vp}: no stray script errors during all of it`, errors.filter((e) => !/blocked/.test(e ?? '')).length === 0, errors.slice(0, 3))
}

console.log(`\n${pass} passed, ${fail} failed`)
await db.end(); ws.close(); chrome.kill()
process.exit(fail ? 1 : 0)
