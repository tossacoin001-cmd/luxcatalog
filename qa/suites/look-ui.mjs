// Founder feedback 2026-10-11, desktop and phone:
// - homepage pillars are not numbered; pillar write-ups and the section intro
//   are bold and easy to read (bright, large enough, strong weight);
// - product page: the title is NOT on the photo (photo unobscured), and is
//   shown boldly and elegantly beneath it; the description is easy to read.
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
const stamp = Date.now()

// A published listing with a bright photo and a long title.
const slug = `look-villa-${stamp}`
const title = 'Banana Island Waterfront Villa with Private Jetty'
await db.query(`insert into "Listing" (id,title,slug,category,description,price,"priceDisplay",location,country,images,specs,features,mode,subcategory,published,"updatedAt") values (gen_random_uuid(),$2,$1,'real_estate','A seven-bedroom waterfront villa with a private jetty, cinema and staff quarters, minutes from Ikoyi.',2500000000,'₦2,500,000,000','Banana Island, Lagos','Nigeria',ARRAY['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&q=80','https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=80'],'{"Bedrooms":"7"}',ARRAY['Private jetty','Cinema'],'sale','for_sale',true,now())`, [slug, title])
await fetch(`${BASE}/`); await fetch(`${BASE}/catalog/real-estate/${slug}`)

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9344', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lk-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9344/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable')
async function load(url) { await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1500) }

// Readability helpers run in the page: WCAG contrast against the page
// background, computed weight and size.
const HELPERS = `
  window.__lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) };
  window.__contrast = (el) => { const L1 = __lum(getComputedStyle(el).color), L2 = __lum('rgb(8,12,8)'); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) };
  window.__style = (el) => { const s = getComputedStyle(el); return { weight: Number(s.fontWeight), size: parseFloat(s.fontSize), contrast: __contrast(el), text: el.textContent.trim().slice(0, 60) } };
  true`

for (const [vp, metrics] of [['desktop', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }]]) {
  console.log(`— ${vp}`)
  await send('Emulation.setDeviceMetricsOverride', metrics)

  await load(`${BASE}/`)
  await ev(HELPERS)
  const titles = ['Prime Real Estate', 'Supercars', 'Superyachts', 'Chauffeur & Private Guards', 'Private Services']
  const pillars = await ev(`(() => { const hs = [...document.querySelectorAll('h3')].filter(h => ${JSON.stringify(titles)}.includes(h.textContent.trim())); return hs.map(h => { const card = h.closest('article'); const tag = card.querySelector('[data-pillar-tagline]'); return { title: h.textContent.trim(), cardText: card.textContent, tag: tag ? __style(tag) : null } }) })()`)
  check(`${vp}: five pillars found`, pillars?.length === 5, pillars?.map((p) => p.title))
  check(`${vp}: pillars are not numbered`, pillars?.every((p) => !/0[1-9]\s*·/.test(p.cardText)), pillars?.filter((p) => /0[1-9]\s*·/.test(p.cardText)).map((p) => p.title))
  check(`${vp}: every pillar has its write-up`, pillars?.every((p) => p.tag && p.tag.text.length > 10), pillars?.map((p) => p.tag?.text))
  check(`${vp}: pillar write-ups are bold (weight ≥ 600)`, pillars?.every((p) => p.tag?.weight >= 600), pillars?.map((p) => p.tag?.weight))
  check(`${vp}: pillar write-ups are large enough (≥ 15px)`, pillars?.every((p) => p.tag?.size >= 15), pillars?.map((p) => p.tag?.size))
  check(`${vp}: pillar write-ups are bright (contrast ≥ 10:1)`, pillars?.every((p) => p.tag?.contrast >= 10), pillars?.map((p) => p.tag?.contrast.toFixed(1)))
  const intro = await ev(`(() => { const el = document.querySelector('[data-pillars-intro]'); return el ? __style(el) : null })()`)
  check(`${vp}: section intro is easy to read (≥ 16px, weight ≥ 500, contrast ≥ 10:1)`, intro && intro.size >= 16 && intro.weight >= 500 && intro.contrast >= 10, intro)
  check(`${vp}: homepage has no sideways scroll`, await ev('document.documentElement.scrollWidth <= innerWidth + 1'))
  await ev(`[...document.querySelectorAll('h3')].find(h => h.textContent.trim() === 'Prime Real Estate').scrollIntoView({block:'center'})`)
  await sleep(1500)
  await shot(`${vp}-pillars.jpg`)

  await load(`${BASE}/catalog/real-estate/${slug}`)
  await ev(HELPERS)
  const p = await ev(`(() => {
    const img = document.querySelector('img[alt$="photo 1"]');
    const gallery = img?.closest('[data-gallery]');
    const h1 = document.querySelector('h1');
    if (!gallery || !h1) return { missing: !gallery ? 'gallery' : 'h1' };
    const g = gallery.getBoundingClientRect(), h = h1.getBoundingClientRect();
    const overlays = [...gallery.querySelectorAll('[data-gallery-shade]')].map(o => getComputedStyle(o).backgroundImage);
    const alphas = overlays.join(' ').match(/rgba\\([^)]*,\\s*([\\d.]+)\\)/g)?.map(s => Number(s.match(/([\\d.]+)\\)$/)[1])) ?? [];
    const desc = document.querySelector('[data-listing-description]');
    return { h1Text: h1.textContent.trim(), inGallery: gallery.contains(h1), h1Top: h.top + scrollY, galleryBottom: g.bottom + scrollY, h1: __style(h1), maxShade: Math.max(0, ...alphas), shades: overlays.length, desc: desc ? __style(desc) : null, crumbs: !!gallery.querySelector('nav[aria-label="Breadcrumb"], nav') }
  })()`)
  check(`${vp}: product title is the listing name`, p?.h1Text === title, p)
  check(`${vp}: title is not on the photo`, p && p.inGallery === false && p.h1Top >= p.galleryBottom - 1, p)
  check(`${vp}: photo is not darkened (shade ≤ 0.35)`, p && p.maxShade <= 0.35, p && { maxShade: p.maxShade, shades: p.shades })
  check(`${vp}: title is bold (weight ≥ 600)`, p?.h1?.weight >= 600, p?.h1)
  check(`${vp}: title is large (${vp === 'phone' ? '≥ 28px' : '≥ 40px'})`, p?.h1?.size >= (vp === 'phone' ? 28 : 40), p?.h1)
  check(`${vp}: title is bright (contrast ≥ 12:1)`, p?.h1?.contrast >= 12, p?.h1)
  check(`${vp}: description is easy to read (≥ 15px, contrast ≥ 9:1)`, p?.desc && p.desc.size >= 15 && p.desc.contrast >= 9, p?.desc)
  check(`${vp}: breadcrumbs still on the photo`, p?.crumbs === true)
  // With the photo no longer darkened, the way back needs its own backing to
  // stay readable over a bright photo.
  const crumbBg = await ev(`(() => { const el = [...document.querySelectorAll('[data-gallery] nav[aria-label="Breadcrumb"] > a, [data-gallery] nav[aria-label="Breadcrumb"] > ol')].find(e => e.offsetParent); if (!el) return null; const m = getComputedStyle(el).backgroundColor.match(/[\\d.]+/g)?.map(Number) ?? []; return m.length === 4 ? m[3] : m.length === 3 ? 1 : 0 })()`)
  check(`${vp}: breadcrumbs sit on a dark backing (alpha ≥ 0.5)`, crumbBg !== null && crumbBg >= 0.5, crumbBg)
  check(`${vp}: product page has no sideways scroll`, await ev('document.documentElement.scrollWidth <= innerWidth + 1'))
  await shot(`${vp}-product-top.jpg`)
  await ev(`document.querySelector('h1').scrollIntoView({block:'center'})`); await sleep(600)
  await shot(`${vp}-product-title.jpg`)
}

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
