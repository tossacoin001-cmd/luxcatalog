// Whole-site audit in headless Chrome, phone and desktop: errors, missing files, overflow, headings, alt text, names, labels, contrast, tap size, links.
const PORT = 9373
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

// What the page itself reports about trouble.
const trouble = { exceptions: [], failed: [], badStatus: [], consoleErrors: [] }
const origOnMessage = ws.onmessage
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown') trouble.exceptions.push((m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text ?? '').slice(0, 160))
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) trouble.failed.push(`${m.params.errorText} ${m.params.requestId}`)
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && m.params.response.url.startsWith(BASE)) trouble.badStatus.push(`${m.params.response.status} ${m.params.response.url.replace(BASE, '')}`)
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') trouble.consoleErrors.push(m.params.entry.text.slice(0, 160) + ' ' + (m.params.entry.url ?? '').replace(BASE, ''))
}
await send('Log.enable')
const reset = () => { for (const k of Object.keys(trouble)) trouble[k].length = 0 }

// Realistic data: the audit looks at what a visitor would see, so start from a small real catalogue.
await q('delete from "RateLimit"')
await q('TRUNCATE "Listing" CASCADE')
const PHOTO = 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200'
const seed = async (title, category, sub, mode, price, display) => { const slug = 'audit-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-'); await q(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,'Ikoyi, Lagos','Nigeria',ARRAY[$7],'{}',ARRAY[]::text[],$8,$9,true,now())`, [title, slug, category, title + ': a generous residence in a quiet, secure part of the island.', price, display, PHOTO, mode, sub]); return slug }
const L1 = await seed('Audit Villa for Sale', 'real_estate', 'for_sale', 'sale', 900000000, '₦900,000,000')
const L2 = await seed('Audit Flat to Rent', 'real_estate', 'for_rent', 'rent', 25000000, '₦25,000,000')
const L3 = await seed('Audit Loft Stay', 'real_estate', 'luxury_shortlets', 'booking', 300000, '₦300,000')
await seed('Audit Supercar', 'supercar', 'for_sale', 'sale', 400000000, '₦400,000,000')
await seed('Audit Yacht', 'yacht', 'for_sale', 'sale', 900000000, '₦900,000,000')
await seed('Audit Sculpture', 'decor', 'for_sale', 'sale', 2500000, '₦2,500,000')
await refreshCatalog(BASE, q)
const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text()
const fromMap = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => new URL(m[1]).pathname)
const EXTRA = ['/sign-in', '/sign-up', '/forgot-password', '/cart', '/partners/apply?type=fleet_owner', '/this-page-does-not-exist']
const PAGES = [...new Set([...fromMap, ...EXTRA])]
const NOT_FOUND_OK = new Set(['/this-page-does-not-exist'])

const PROBE = `(() => {
  const out = { h1: document.querySelectorAll('h1').length, title: document.title, overflow: document.documentElement.scrollWidth - innerWidth,
    noAlt: [], unnamed: [], unlabelled: [], small: [], contrast: [], links: [] }
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0' }
  for (const i of document.querySelectorAll('img')) if (vis(i) && !i.hasAttribute('alt')) out.noAlt.push((i.getAttribute('src') || '').slice(0, 60))
  for (const b of document.querySelectorAll('button, a[href], [role=button]')) {
    if (!vis(b)) continue
    const name = (b.getAttribute('aria-label') || b.textContent || b.getAttribute('title') || '').trim()
    const imgAlt = b.querySelector('img[alt]:not([alt=""])')
    if (!name && !imgAlt) out.unnamed.push((b.outerHTML || '').slice(0, 90))
    const r = b.getBoundingClientRect()
    if ((r.height < 40 || r.width < 40) && !b.closest('footer') && !b.matches('a') ) out.small.push(Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + name.slice(0, 30))
    if (b.matches('a') && r.height < 40 && !b.closest('p, li, footer, nav[aria-label=Breadcrumb]') ) out.small.push(Math.round(r.width) + 'x' + Math.round(r.height) + ' link ' + name.slice(0, 30))
  }
  for (const f of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')) {
    if (!vis(f)) continue
    const has = f.getAttribute('aria-label') || f.getAttribute('aria-labelledby') || (f.id && document.querySelector('label[for="' + CSS.escape(f.id) + '"]')) || f.closest('label')
    if (!has) out.unlabelled.push((f.getAttribute('name') || f.type) + ' ' + (f.getAttribute('placeholder') || '').slice(0, 24))
  }
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b) }
  const bgOf = (el) => { let base = { r: 255, g: 255, b: 255, a: 1 }; const stack = []; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break } } let cur = base; for (const c of stack.reverse()) cur = { r: c.r * c.a + cur.r * (1 - c.a), g: c.g * c.a + cur.g * (1 - c.a), b: c.b * c.a + cur.b * (1 - c.a), a: 1 }; return cur }
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const t = walker.currentNode; const txt = t.textContent.trim(); if (txt.length < 3) continue
    const el = t.parentElement; if (!el || seen.has(el) || !vis(el) || el.closest('script, style, noscript')) continue
    seen.add(el)
    const cs = getComputedStyle(el); const fg = parse(cs.color); const bg = bgOf(el); if (!fg || !bg) continue
    const op = parseFloat(cs.opacity); const f2 = { r: fg.r * fg.a * op + bg.r * (1 - fg.a * op), g: fg.g * fg.a * op + bg.g * (1 - fg.a * op), b: fg.b * fg.a * op + bg.b * (1 - fg.a * op) }
    const L1 = lum(f2), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
    if (ratio < need) out.contrast.push(ratio.toFixed(2) + '<' + need + ' "' + txt.slice(0, 28) + '" ' + cs.color)
  }
  for (const a of document.querySelectorAll('a[href]')) { const h = a.getAttribute('href'); if (h && h.startsWith('/') && !h.startsWith('//')) out.links.push(h.split('#')[0] || '/') }
  return out
})()`

const checkedLinks = new Map()
const results = []
for (const [vp, metrics] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  console.log(`— ${vp}`)
  for (const p of PAGES) {
    reset()
    await load(BASE + p)
    await ev('window.scrollTo(0, document.body.scrollHeight)'); await sleep(600); await ev('window.scrollTo(0, 0)'); await sleep(300)
    const r = await ev(PROBE)
    const is404 = NOT_FOUND_OK.has(p)
    const status = (await fetch(BASE + p, { redirect: 'manual' })).status
    check(`${vp} ${p}: opens (${is404 ? '404 expected' : status})`, is404 ? status === 404 : status < 400)
    if (!r) { check(`${vp} ${p}: could be read`, false); continue }
    { const own = trouble.consoleErrors.filter((x) => !(is404 && x.includes(p))); check(`${vp} ${p}: no script errors`, trouble.exceptions.length === 0 && own.length === 0, [...trouble.exceptions, ...own].slice(0, 3)) }
    check(`${vp} ${p}: nothing it asks for is missing (images, scripts, fonts)`, trouble.failed.length === 0 && trouble.badStatus.filter((x) => !is404 || !x.includes(p)).length === 0, [...trouble.failed, ...trouble.badStatus].slice(0, 4))
    check(`${vp} ${p}: no sideways scrolling`, r.overflow <= 1, r.overflow)
    check(`${vp} ${p}: one heading level 1 and a title`, (r.h1 === 1 || is404) && !!r.title, { h1: r.h1, title: r.title })
    check(`${vp} ${p}: every image has an alt attribute`, r.noAlt.length === 0, r.noAlt.slice(0, 3))
    check(`${vp} ${p}: every button and link has a name`, r.unnamed.length === 0, r.unnamed.slice(0, 3))
    check(`${vp} ${p}: every field has a label`, r.unlabelled.length === 0, r.unlabelled.slice(0, 3))
    check(`${vp} ${p}: text is readable (WCAG AA contrast)`, r.contrast.length === 0, { count: r.contrast.length, sample: r.contrast.slice(0, 4) })
    if (vp === 'phone') check(`phone ${p}: buttons are big enough to tap (40 px)`, r.small.length === 0, { count: r.small.length, sample: r.small.slice(0, 4) })
    for (const l of r.links) checkedLinks.set(l, p)
  }
}

console.log('— links')
const broken = []
for (const [l, from] of checkedLinks) {
  if (/^\/(api|_next)\b/.test(l)) continue
  const s = (await fetch(BASE + l, { redirect: 'manual' })).status
  if (s >= 400) broken.push(`${s} ${l} (from ${from})`)
}
check(`every internal link goes somewhere (${checkedLinks.size} checked)`, broken.length === 0, broken.slice(0, 8))

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
