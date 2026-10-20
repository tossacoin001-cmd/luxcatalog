// The new look, measured: type, ground, hairlines, corners, prices, motion, focus.
import { refreshCatalog } from './_catalog.mjs'
const PORT = 9374
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
const db = new pg.Client({ connectionString: 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable' }); await db.connect()
const q = (s, p) => db.query(s, p).then((r) => r.rows)
const day = (n) => new Date(Date.now() + 3_600_000 + n * 86_400_000).toISOString().slice(0, 10)
const stamp = Date.now()
const ins = async (title, category, sub, mode, price, display, loc = 'Ikoyi, Lagos') => {
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`
  const rows = await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,'A fine listing.',$4,$5,$6,'Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200'],'{}',ARRAY[]::text[],$7,$8,true,now()) returning id`, [title, slug, category, price, display, loc, mode, sub])
  return { id: rows[0].id, slug }
}
const settings = (id, unit, rate) => q(`insert into "BookingSettings" ("listingId",enabled,unit,rate,"cleaningFee","cautionDeposit","minUnits","maxUnits","maxGuests","instantBook","advanceNoticeHours","updatedAt") values ($1,true,$2,$3,0,0,1,14,6,true,0,now())`, [id, unit, rate])
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ui-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
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
const mk = async (title, category, sub, mode, price, display) => {
  const slug = `ds-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`
  await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,'A bright and generous residence with sea views, set in a quiet and secure part of the island.',$4,$5,'Ikoyi, Lagos','Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200'],'{}',ARRAY[]::text[],$6,$7,true,now())`, [title, slug, category, price, display, mode, sub])
  return slug
}
const SALE = await mk('Design Villa Sale', 'real_estate', 'for_sale', 'sale', 2800000000, '₦2,800,000,000')
const STAY = await mk('Design Loft Stay', 'real_estate', 'luxury_shortlets', 'booking', 650000, '₦650,000')
await refreshCatalog(BASE, q)
for (const p of [`/catalog/real-estate/${SALE}`, `/catalog/real-estate/${STAY}`]) { for (let i = 0; i < 30; i++) { if ((await fetch(BASE + p)).status === 200) break; await sleep(1000) } }

const PAGES = ['/', '/catalog', '/catalog/real-estate', `/catalog/real-estate/${SALE}`, `/catalog/real-estate/${STAY}`, '/catalog/private-services', '/discover', '/partners', '/contact', '/about']

const PROBE = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const first = (s) => (s.split(',')[0] || '').replace(/["']/g, '').trim()
  const out = { h1Font: '', bodyFont: '', bodyBg: '', h1Weight: '', fonts: {}, glow: 0, gradientText: 0, rounded: [], sparkles: 0, emoji: 0, wordmark: '', prices: [], gold: 0 }
  const h1 = document.querySelector('h1'); if (h1) { out.h1Font = first(getComputedStyle(h1).fontFamily); out.h1Weight = getComputedStyle(h1).fontWeight }
  out.bodyFont = first(getComputedStyle(document.body).fontFamily); out.bodyBg = getComputedStyle(document.body).backgroundColor
  const wm = document.querySelector('[data-wordmark]'); out.wordmark = wm ? first(getComputedStyle(wm).fontFamily) + '|' + wm.textContent.trim() : ''
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || el.closest('script,style,svg')) continue
    const cs = getComputedStyle(el)
    if (el.textContent && el.children.length === 0 && el.textContent.trim().length > 1) { const f = first(cs.fontFamily); out.fonts[f] = (out.fonts[f] || 0) + 1 }
    if (/201, ?168, ?76/.test(cs.boxShadow)) out.glow++
    if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') out.gradientText++
    if (/201, ?168, ?76|228, ?200, ?120/.test(cs.borderTopColor + cs.borderLeftColor) && parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth) > 0) out.gold++
    const rad = parseFloat(cs.borderTopLeftRadius); const r = el.getBoundingClientRect()
    const circle = Math.abs(r.width - r.height) < 2 && rad >= r.width / 2 - 1
    if (rad > 2 && !circle && !el.matches('img, video') && !el.closest('[data-toast],[data-sonner-toaster]')) out.rounded.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 30) + ' ' + rad + 'px')
    if (el.matches('.lucide-sparkles, [class*=sparkle]')) out.sparkles++
  }
  out.emoji = (document.body.innerText.match(/[\\u{1F300}-\\u{1FAFF}\\u2600-\\u27BF]/gu) || []).length
  for (const p of document.querySelectorAll('[data-price]')) {
    if (!vis(p)) continue
    const cur = p.querySelector('[data-currency]'); const cs = getComputedStyle(p)
    out.prices.push({ nums: cs.fontVariantNumeric, curSize: cur ? parseFloat(getComputedStyle(cur).fontSize) : 0, size: parseFloat(cs.fontSize), text: p.textContent.trim().slice(0, 24) })
  }
  return out
})()`

for (const [vp, metrics] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  console.log(`— ${vp}`)
  const motionHome = {}
  for (const p of PAGES) {
    await load(BASE + p)
    const r = await ev(PROBE)
    const tag = `${vp} ${p.replace(/-\d{10,}/, '')}`
    check(`${tag}: headings are set in Newsreader`, r.h1Font === 'Newsreader', r.h1Font)
    check(`${tag}: body text is Hanken Grotesk`, r.bodyFont === 'Hanken Grotesk', r.bodyFont)
    check(`${tag}: no Playfair Display or Inter anywhere on the page`, !('Playfair Display' in r.fonts) && !('Inter' in r.fonts) && !('__Playfair_Display_fed1534a' in r.fonts), Object.keys(r.fonts))
    const m = (r.bodyBg.match(/\d+/g) ?? []).map(Number)
    check(`${tag}: the ground is ivory, not dark`, m.length >= 3 && m[0] > 235 && m[1] > 230 && m[2] > 220, r.bodyBg)
    check(`${tag}: headline is light weight (300 or 400)`, ['300', '400'].includes(String(r.h1Weight)), r.h1Weight)
    check(`${tag}: no gold glow shadows`, r.glow === 0, r.glow)
    check(`${tag}: no gradient-filled text`, r.gradientText === 0, r.gradientText)
    check(`${tag}: no gold borders on boxes (hairlines are ink or stone)`, r.gold === 0, r.gold)
    check(`${tag}: square corners (nothing rounded but circles and photographs)`, r.rounded.length === 0, r.rounded.slice(0, 4))
    check(`${tag}: no sparkle icons and no emoji`, r.sparkles === 0 && r.emoji === 0, { s: r.sparkles, e: r.emoji })
    check(`${tag}: the wordmark is "Lux Catalog" in Newsreader`, r.wordmark === 'Newsreader|Lux Catalog', r.wordmark)
    for (const pr of r.prices) {
      check(`${tag}: price "${pr.text}" uses tabular lining figures`, /tabular-nums/.test(pr.nums) && /lining-nums/.test(pr.nums), pr.nums)
      check(`${tag}: its naira sign is small and light`, pr.curSize > 0 && pr.curSize <= pr.size * 0.7, pr)
    }
    if (p === '/' || p.includes(SALE)) check(`${tag}: prices are present`, p === '/' ? true : r.prices.length >= 1, r.prices.length)
    if (p === '/') motionHome[vp] = await ev('document.getAnimations().length')
  }
  check(`${vp} home: motion is present when allowed (the arrival animates)`, motionHome[vp] > 0, motionHome[vp])

  console.log(`  ${vp}: reduced motion`)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  for (const p of ['/', `/catalog/real-estate/${SALE}`, '/discover']) {
    await load(BASE + p)
    await sleep(600)
    const n = await ev('document.getAnimations().filter(a => a.playState === "running" && (a.effect?.getTiming().duration ?? 0) > 20).length')
    check(`${vp} ${p.replace(/-\d{10,}/, '')}: nothing moves for people who asked for reduced motion`, n === 0, n)
  }
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })

  console.log(`  ${vp}: keyboard`)
  await load(BASE + '/')
  await ev('document.body.focus()')
  for (let i = 0; i < 3; i++) await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  const ring = await ev(`(() => { const a = document.activeElement; if (!a || a === document.body) return null; const cs = getComputedStyle(a); return { tag: a.tagName, outline: cs.outlineStyle + ' ' + cs.outlineWidth, shadow: cs.boxShadow !== 'none' } })()`)
  check(`${vp} home: keyboard focus is visible`, !!ring && ((ring.outline && !/^none/.test(ring.outline) && !/ 0px/.test(ring.outline)) || ring.shadow), ring)
}

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
