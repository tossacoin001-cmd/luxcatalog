// The whole Service Professional journey through the real screens, in
// headless Chrome (phone for the professional, desktop for the admin):
// apply → documents → standards → review (banned word caught) → submit →
// admin approves → professional signs Schedule H → lists a service (form
// limited to approved services, floor shown, server errors shown in plain
// words) → admin approves the listing (price kept) → live under its service,
// title shown beneath the photo.
import { spawn } from 'node:child_process'
import { createHmac } from 'node:crypto'
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

function makeJar() {
  const jar = new Map()
  const api = async (path, body, method) => {
    const res = await fetch(BASE + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { origin: BASE, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
    for (const c of res.headers.getSetCookie()) { const [p] = c.split(';'); const i = p.indexOf('='); jar.set(p.slice(0, i), p.slice(i + 1)) }
    return res.json().catch(() => null)
  }
  return { jar, api }
}
function totp(secret) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) bits += alpha.indexOf(ch).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const h = createHmac('sha1', key).update(buf).digest(); const o = h[h.length - 1] & 0xf
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0')
}
const enable2fa = async (j) => { const en = await j.api('/api/auth/two-factor/enable', { password }); await j.api('/api/auth/two-factor/verify-totp', { code: totp(new URL(en.totpURI).searchParams.get('secret')) }) }
const stamp = Date.now(), password = 'correct-horse-battery-7'

await q('delete from "RateLimit"')
const A = makeJar(); const aEmail = `ada.flow${stamp}@test.local`
await A.api('/api/auth/sign-up/email', { name: 'Ada Admin', email: aEmail, password })
await q(`update "User" set role='admin' where email=$1`, [aEmail])
await enable2fa(A)
await q('delete from "RateLimit"')
const P = makeJar(); const pEmail = `tolu.flow${stamp}@test.local`
await P.api('/api/auth/sign-up/email', { name: 'Tolu Ade', email: pEmail, password })
const pid = (await q(`select id from "User" where email=$1`, [pEmail]))[0].id
const pdfPath = join(OUT, 'doc.pdf'); writeFileSync(pdfPath, `%PDF-1.4\n% flow test\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`)
const photo = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80'

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9345', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'sf-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9345/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
  // Accept confirm() dialogs (admin "Approve this partner?").
  if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true })
  // Local runs have no Vercel Blob credentials: answer the photo upload with
  // a hosted image so the rest of the form runs for real.
  if (m.method === 'Fetch.requestPaused') send('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }], body: Buffer.from(JSON.stringify({ url: photo })).toString('base64') })
}
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('DOM.enable')
await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/admin/upload*', requestStage: 'Request' }] })
async function signInAs(j) { await send('Network.clearBrowserCookies'); for (const [name, value] of j.jar) await send('Network.setCookie', { name, value, url: BASE }) }
async function load(url) { await send('Page.navigate', { url: 'about:blank' }); await sleep(100); await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1500) }
const waitFor = async (expr, ms = 10000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await sleep(200) } return false }
const fits = () => ev('document.documentElement.scrollWidth <= innerWidth + 1')
const clickText = (sel, text) => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.trim().includes(${JSON.stringify(text)}) && !e.disabled); if (!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true })()`)
const typeInto = (labelText, value) => ev(`(() => { const lab = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(${JSON.stringify(labelText)})); const inp = lab?.querySelector('input,textarea') ?? lab?.parentElement.querySelector('input,textarea'); if (!inp) return false; const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, ${JSON.stringify(value)}); inp.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
const setField = (selector, value) => ev(`(() => { const inp = document.querySelector(${JSON.stringify(selector)}); if (!inp) return false; const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : inp.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, ${JSON.stringify(value)}); inp.dispatchEvent(new Event(inp.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true })()`)
const toast = () => ev(`[...document.querySelectorAll('[data-sonner-toast]')].map(t => t.textContent).join(' | ')`)
const step = (name) => clickText('ol[aria-label="Application steps"] button', name)
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
const DESKTOP = { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }
const title = `Chef Tolu Seven-Course Dinner ${stamp}`

console.log('1. Apply (phone)')
await send('Emulation.setDeviceMetricsOverride', PHONE)
await signInAs(P)
await load(BASE + '/partners/apply')
check('choose Service professional', await clickText('button', 'Service professional'))
check('draft autosaved', await waitFor(`document.body.textContent.includes('All changes saved')`))
await step('Business'); await sleep(600)
check('no service is pre-chosen for a new professional', await ev(`[...document.querySelectorAll('button[aria-pressed]')].every(b => b.getAttribute('aria-pressed') === 'false')`))
check('services question shown', await ev(`document.body.textContent.includes('Which services do you offer?')`))
await typeInto('Trading or brand name', 'Chef Tolu Private Dining')
await typeInto('Contact person', 'Tolu Ade')
await typeInto('Phone / WhatsApp', '+234 803 555 0101')
await typeInto('City', 'Lagos')
await typeInto('About your business', 'Private chef and sensual massage at home across Ikoyi, Victoria Island and Lekki. Ten years in five-star kitchens.')
check('pick Private Chef', await clickText('button[aria-pressed]', 'Private Chef'))
await sleep(400)
check('pick Massage & Spa', await clickText('button[aria-pressed]', 'Massage & Spa'))
check('both services selected on screen', await waitFor(`[...document.querySelectorAll('button[aria-pressed="true"]')].map(b => b.textContent.trim()).join('|') === 'Private Chef|Massage & Spa'`, 3000), await ev(`[...document.querySelectorAll('button[aria-pressed="true"]')].map(b => b.textContent.trim()).join('|')`))
check('business step saved', await waitFor(`document.body.textContent.includes('All changes saved')`, 8000))
check('business step fits the phone', await fits())
await shot('1-business.jpg')

await step('Documents'); await sleep(800)
const rows = await ev(`[...document.querySelectorAll('input[type=file]')].length`)
check('7 document rows for an individual (no CAC)', rows === 7, rows)
const tag = (label) => `[...document.querySelectorAll('p')].find(p => p.textContent.trim().startsWith(${JSON.stringify(label)}))?.querySelector('span')?.textContent.trim()`
check('certificate marked required because massage/chef chosen', (await ev(tag('Training or certification'))) === 'Required', await ev(tag('Training or certification')))
check('police certificate required', (await ev(tag('Police character certificate'))) === 'Required')
check('insurance shown as optional', (await ev(tag('Liability insurance'))) === 'Optional', await ev(tag('Liability insurance')))
const { root } = (await send('DOM.getDocument', { depth: -1 })).result
const { nodeIds } = (await send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'input[type=file]' })).result
for (let i = 0; i < 6; i++) {
  await send('DOM.setFileInputFiles', { nodeId: nodeIds[i], files: [pdfPath] })
  await waitFor(`document.querySelectorAll('[aria-label="Uploaded"]').length >= ${i + 1}`, 15000)
}
check('six required documents uploaded', (await ev(`document.querySelectorAll('[aria-label="Uploaded"]').length`)) === 6, await ev(`document.querySelectorAll('[aria-label="Uploaded"]').length`))
check('documents step fits the phone', await fits())
await shot('2-documents.jpg')

await step('Standards'); await sleep(600)
const boxes = await ev(`document.querySelectorAll('label input[type=checkbox]').length`)
check('seven commitments to accept', boxes === 7, boxes)
for (let i = 0; i < boxes; i++) { await ev(`document.querySelectorAll('label input[type=checkbox]')[${i}].click()`); await sleep(250) }
check('all commitments ticked', await waitFor(`[...document.querySelectorAll('label input[type=checkbox]')].every(b => b.checked)`))
await waitFor(`document.body.textContent.includes('All changes saved')`, 8000)
await shot('3-standards.jpg')

await step('Review'); await sleep(800)
check('review blocks the banned word', await ev(`document.body.textContent.includes('Remove these words') && document.body.textContent.includes('sensual')`))
check('submit disabled while it is there', await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Submit application'))?.disabled === true`))
await shot('4-review-blocked.jpg')
await step('Business'); await sleep(600)
await typeInto('About your business', 'Private chef and certified massage therapist at home across Ikoyi, Victoria Island and Lekki. Ten years in five-star kitchens and spas.')
await waitFor(`document.body.textContent.includes('All changes saved')`, 8000)
await step('Review'); await sleep(800)
check('review says everything is in place', await waitFor(`document.body.textContent.includes('Everything is in place')`))
check('submit application', await clickText('button', 'Submit application'))
check('applicant sees it is with the team', await waitFor(`document.body.textContent.includes('Your application is with our team')`, 40000))
await shot('5-submitted.jpg')
const app = (await q(`select id, status from "PartnerApplication" where "userId"=$1`, [pid]))[0]
check('stored as submitted', app?.status === 'submitted', app)

console.log('2. Admin approves (desktop)')
await send('Emulation.setDeviceMetricsOverride', DESKTOP)
await signInAs(A)
await load(BASE + '/admin/applications')
check('queue lists the professional', await ev(`document.body.textContent.includes('Chef Tolu Private Dining')`))
await load(`${BASE}/admin/applications/${app.id}`)
check('review shows vetting documents', await ev(`['Police character certificate','Portfolio','Two references','Training or certification'].every(l => document.body.textContent.includes(l))`))
check('click Approve partner', await clickText('button', 'Approve partner'))
// The "are you sure?" is now an in-page box (browsers can block their own pop-ups).
check('the in-page question appears and is answered Yes', await waitFor(`!!document.querySelector('[data-confirm]')`, 5000) && await ev(`(document.querySelector('[data-confirm-yes]')?.click(), true)`))
// Wait for the screen to confirm, then read the database once (the local
// PGlite database mixes up queries that overlap a server transaction).
check('admin sees the approval confirmed', await waitFor(`[...document.querySelectorAll('[data-sonner-toast]')].some(t => t.textContent.includes('Approved'))`, 15000), await toast())
await sleep(1000)
const role = (await q(`select role from "User" where id=$1`, [pid]))[0].role
check('applicant is now a partner', role === 'partner', role)
await shot('6-admin-approved.jpg')

console.log('3. Sign Schedule H (phone)')
await enable2fa(P)
await send('Emulation.setDeviceMetricsOverride', PHONE)
await signInAs(P)
await load(BASE + '/partners/agreement')
check('agreement page shows Schedule H', await ev(`document.body.textContent.includes('Schedule H: Private Services')`))
check('commission shown: Private Chef 20%', await ev(`document.body.textContent.includes('Private Chef: 20% commission')`))
for (let n = 0; n < 2; n++) {
  await ev(`(() => { const box = document.querySelector('input[type=checkbox]:not(:checked)'); box?.click() })()`)
  await sleep(300)
  await ev(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Sign agreement') && !b.disabled)?.click()`)
  check(`signature ${n + 1} recorded`, await waitFor(`document.querySelectorAll('a[href*="/api/partner-agreements/"]').length >= ${n + 1}`, 15000))
  await sleep(800)
}
check('told they are all set', await waitFor(`document.body.textContent.includes('all set')`))
await shot('7-signed.jpg')

console.log('4. List a service (phone)')
await load(BASE + '/admin/listings/new')
check('new-listing form opens', (await ev('location.pathname')) === '/admin/listings/new', await ev('location.pathname'))
const cats = await ev(`[...document.querySelector('form select').options].map(o => o.value)`)
check('category limited to Private Services', JSON.stringify(cats) === '["private_services"]', cats)
const subs = await ev(`[...document.querySelectorAll('form select')][1] ? [...[...document.querySelectorAll('form select')][1].options].map(o => o.value) : null`)
check('services limited to the two approved', JSON.stringify(subs) === '["private_chef","massage_spa"]', subs)
check('price is required and labelled as a starting price', await ev(`(() => { const i = document.querySelector('input[name="price"]'); return !!i && i.required && document.body.textContent.includes('Starting price') })()`))
check('floor shown for Private Chef', await ev(`document.body.textContent.includes('Minimum ₦35,000')`))
await setField('form select:nth-of-type(1)', 'private_services')
await ev(`(() => { const s = [...document.querySelectorAll('form select')][1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'massage_spa'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
check('floor follows the service (Massage & Spa ₦50,000)', await waitFor(`document.body.textContent.includes('Minimum ₦50,000')`, 3000))
await ev(`(() => { const s = [...document.querySelectorAll('form select')][1]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'private_chef'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
check('chef template rows added', await waitFor(`[...document.querySelectorAll('form input')].some(i => i.value === 'Cuisine')`, 3000))
check('massage rows cleared when switching back to chef', await ev(`![...document.querySelectorAll('form input')].some(i => ['Therapist', 'Treatments'].includes(i.value))`), await ev(`[...document.querySelectorAll('form input')].map(i => i.value).filter(Boolean).join('|')`))
await setField('form input[type=text]', title)
await setField('input[name="price"]', '20000')
await ev(`(() => { const i = [...document.querySelectorAll('form input')].find(x => x.placeholder?.startsWith('e.g. Lekki')); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Ikoyi, Lagos'); i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
await setField('form textarea', 'Seven courses of modern Nigerian cuisine cooked in your home, with service, wine pairing advice and full clean-up.')
const { root: r2 } = (await send('DOM.getDocument', { depth: -1 })).result
const photoInput = (await send('DOM.querySelector', { nodeId: r2.nodeId, selector: 'form input[type=file]' })).result.nodeId
const jpg = join(OUT, 'dish.jpg'); writeFileSync(jpg, Buffer.from(await (await fetch(photo.replace('w=1600', 'w=400'))).arrayBuffer()))
await send('DOM.setFileInputFiles', { nodeId: photoInput, files: [jpg] })
check('photo added', await waitFor(`!!document.querySelector('form img')`, 10000))
check('form fits the phone', await fits())
await shot('8-listing-form.jpg')
await clickText('button[type=submit]', 'Submit for Review')
check('below-floor price explained in plain words', await waitFor(`[...document.querySelectorAll('[data-sonner-toast]')].some(t => t.textContent.includes('minimum price for Private Chef') && t.textContent.includes('₦35,000'))`, 10000), await toast())
await shot('9-floor-error.jpg')
await setField('input[name="price"]', '45000')
await setField('form textarea', 'Seven courses cooked in your home, followed by an erotic show.')
await sleep(300)
await clickText('button[type=submit]', 'Submit for Review')
check('banned word explained in plain words', await waitFor(`[...document.querySelectorAll('[data-sonner-toast]')].some(t => t.textContent.includes('erotic'))`, 10000), await toast())
check('nothing saved yet', (await q(`select count(*)::int n from "Listing" where "ownerId"=$1`, [pid]))[0].n === 0)
await setField('form textarea', 'Seven courses of modern Nigerian cuisine cooked in your home, with service, wine pairing advice and full clean-up.')
await sleep(300)
await clickText('button[type=submit]', 'Submit for Review')
check('submitted and back on My Listings', await waitFor(`location.pathname === '/admin/listings' && document.body.textContent.includes(${JSON.stringify(title)})`, 25000), await ev('location.pathname'))
check('shown as pending review', await ev(`/Awaiting admin approval|Pending Review/.test(document.body.textContent)`))
await shot('10-my-listings.jpg')
const listing = (await q(`select id, slug, price::text, subcategory, published from "Listing" where "ownerId"=$1`, [pid]))[0]
check('saved as a Private Chef listing at ₦45,000, unpublished', listing?.subcategory === 'private_chef' && Number(listing.price) === 45000 && listing.published === false, listing)

console.log('5. Admin approves the listing (desktop)')
await send('Emulation.setDeviceMetricsOverride', DESKTOP)
await signInAs(A)
await load(BASE + '/admin/listings')
await ev(`(() => { const row = [...document.querySelectorAll('tr')].find(r => r.textContent.includes(${JSON.stringify(title)})); [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Approve')?.click() })()`)
check('admin sees "approved and live"', await waitFor(`[...document.querySelectorAll('[data-sonner-toast]')].some(t => t.textContent.includes('approved and live'))`, 15000), await toast())
await sleep(1000)
const live = (await q(`select published, price::text from "Listing" where id=$1`, [listing.id]))[0]
check('listing approved and live', live?.published === true, live)
check('approval kept the price', Number(live?.price) === 45000, live)

console.log('6. Live for customers (phone)')
await send('Emulation.setDeviceMetricsOverride', PHONE)
await signInAs({ jar: new Map() })
await fetch(BASE + '/catalog/private-services')
await load(BASE + '/catalog/private-services')
check('listed under Private Chef', await ev(`document.getElementById('svc-private_chef')?.textContent.includes(${JSON.stringify(title)})`))
await ev(`document.querySelector('#svc-private_chef a[href*="${listing.slug}"]')?.click()`)
check('card opens the service page', await waitFor(`location.pathname === '/catalog/private-services/${listing.slug}'`, 10000), await ev('location.pathname'))
await sleep(1500)
check('title shown beneath the photo', await ev(`(() => { const h1 = document.querySelector('h1'); const g = document.querySelector('[data-gallery]'); return !!h1 && !!g && !g.contains(h1) && h1.textContent.includes(${JSON.stringify(title)}) })()`))
check('From ₦45,000 per guest', await ev(`document.body.textContent.includes('₦45,000') && document.body.textContent.includes('per guest')`))
check('service page fits the phone', await fits())
await shot('11-service-page.jpg')

console.log(`\n${pass} passed, ${fail} failed`)
ws.close(); chrome.kill(); await db.end()
process.exit(fail ? 1 : 0)
