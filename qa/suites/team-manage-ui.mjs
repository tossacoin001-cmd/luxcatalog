// Browser checks, desktop and phone (written before the build, 2026-10-22):
// - cancelling an invitation and removing a member work even when the browser
//   blocks its own pop-up boxes (the in-page confirmation is used instead);
// - the administrator corrects a member's name and phone on the Team page;
// - a team member edits their own name and phone and sees a payment-method
//   section, but no controls for role or areas;
// - the administrator deletes an enquiry and clears the closed ones.
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

function makeJar() {
  const jar = new Map()
  const api = async (path, body, method) => {
    const res = await fetch(BASE + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { origin: BASE, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
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
const stamp = Date.now(), password = 'correct-horse-battery-7'
const db = new pg.Client({ connectionString: (process.env.TEST_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/template1?sslmode=disable') }); await db.connect()
const one = async (s, p) => (await db.query(s, p)).rows[0]
const secure = async (J, email, role, perms) => {
  await db.query('delete from "RateLimit"')
  await J.api('/api/auth/sign-up/email', { name: 'Temp Name', email, password })
  await db.query(`update "User" set role=$2::"UserRole", permissions=$3 where email=$1`, [email, role, perms])
  const en = await J.api('/api/auth/two-factor/enable', { password })
  await J.api('/api/auth/two-factor/verify-totp', { code: totp(new URL(en.totpURI).searchParams.get('secret')) })
}

console.log('Setup')
const A = makeJar(), T = makeJar()
const aEmail = `ada.tmu${stamp}@test.local`, tEmail = `tola.tmu${stamp}@test.local`, mEmail = `mide.tmu${stamp}@test.local`
await secure(A, aEmail, 'admin', [])
await secure(T, tEmail, 'team', ['enquiries'])
await db.query(`update "User" set name='Tolla Misspelt', phone='0803' where email=$1`, [tEmail])
const mJar = makeJar(); await secure(mJar, mEmail, 'team', ['orders'])         // a second member to remove
const invite = async (n) => { const e = `inv${n}.tmu${stamp}@test.local`; await A.api('/api/admin/team', { email: e, role: 'team', permissions: ['enquiries'] }); return e }
const mkEnq = async (label, status) => (await one(`insert into "Inquiry" (id,name,email,message,kind,status) values (gen_random_uuid(),$1,$2,'A message to delete','enquiry',$3::"InquiryStatus") returning id`, [label, `${label}${stamp}@example.com`, status])).id

const chrome = spawn((process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'), ['--headless=new', '--remote-debugging-port=9347', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tm-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch('http://127.0.0.1:9347/json')).json(); break } catch { await sleep(500) } }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }); writeFileSync(join(OUT, n), Buffer.from(r.result.data, 'base64')) }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
const useJar = async (J) => { await send('Network.clearBrowserCookies'); for (const [name, value] of J.jar) await send('Network.setCookie', { name, value, url: BASE }) }
async function load(url) { await send('Page.navigate', { url }); for (let i = 0; i < 200; i++) { await sleep(250); if ((await ev('document.readyState')) === 'complete') break } await sleep(1500) }
const waitFor = async (expr, ms = 8000) => { for (let i = 0; i < ms / 200; i++) { if (await ev(expr)) return true; await sleep(200) } return false }
const click = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el || el.disabled) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
const setVal = (sel, value) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
const fits = () => ev('document.documentElement.scrollWidth <= innerWidth + 1')
// A browser that blocks its own pop-up boxes: confirm() answers "no" without asking.
const blockPopups = () => ev('window.confirm = () => false; window.alert = () => {}; true')

for (const [vp, metrics] of [['desktop', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }], ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }]]) {
  await send('Emulation.setDeviceMetricsOverride', metrics)

  console.log(`1. ${vp}: cancel an invitation (browser pop-ups blocked)`)
  await useJar(A)
  const invA = await invite(`a${vp}`), invB = await invite(`b${vp}`)
  await load(BASE + '/admin/team')
  await blockPopups()
  const revokeSel = (e) => `[data-invite-row="${e}"] button[aria-label^="Revoke invitation"]`
  check(`${vp}: the invitation is listed`, await ev(`!!document.querySelector('[data-invite-row="${invA}"]')`))
  check(`${vp}: the cancel button is at least 44px`, await ev(`(() => { const b = document.querySelector('${revokeSel(invA)}'); const r = b?.getBoundingClientRect(); return !!r && r.width >= 44 && r.height >= 44 })()`))
  check(`${vp}: tapping cancel opens an in-page question`, (await click(revokeSel(invA))) && await waitFor(`!!document.querySelector('[role="alertdialog"][data-confirm]')`, 3000))
  check(`${vp}: the question names the person and fits the screen`, await ev(`document.querySelector('[data-confirm]')?.textContent.includes('${invA}')`) && await fits())
  await shot(`${vp}-confirm.jpg`)
  check(`${vp}: "Keep it" closes the question and revokes nothing`, (await click('[data-confirm-no]')) && await waitFor(`!document.querySelector('[data-confirm]')`, 3000))
  check(`${vp}: the invitation is still pending in the database`, (await one(`select "revokedAt" from "StaffInvitation" where email=$1 order by "createdAt" desc limit 1`, [invA])).revokedAt === null)
  await click(revokeSel(invA)); await waitFor(`!!document.querySelector('[data-confirm]')`, 3000)
  check(`${vp}: Escape also closes it`, (await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }), await waitFor(`!document.querySelector('[data-confirm]')`, 3000)))
  await click(revokeSel(invA)); await waitFor(`!!document.querySelector('[data-confirm]')`, 3000)
  check(`${vp}: confirming revokes it`, (await click('[data-confirm-yes]')) && await waitFor(`!document.querySelector('[data-invite-row="${invA}"]')`, 8000))
  check(`${vp}: revoked in the database`, (await one(`select "revokedAt" from "StaffInvitation" where email=$1 order by "createdAt" desc limit 1`, [invA])).revokedAt !== null)
  check(`${vp}: the other invitation is untouched`, (await one(`select "revokedAt" from "StaffInvitation" where email=$1`, [invB])).revokedAt === null && await ev(`!!document.querySelector('[data-invite-row="${invB}"]')`))
  const old = await fetch(BASE + '/invite?token=nope'); check(`${vp}: a revoked link shows the plain unavailable page`, old.status === 200)

  console.log(`2. ${vp}: the administrator corrects a member's details`)
  await load(BASE + '/admin/team')
  await blockPopups()
  const row = `[data-member-row="${tEmail}"]`
  check(`${vp}: the member is listed with an Edit details button`, await ev(`!!document.querySelector('${row} [data-edit-details]')`))
  check(`${vp}: opens inline fields for name and phone`, (await click(`${row} [data-edit-details]`)) && await waitFor(`!!document.querySelector('${row} input[name=name]') && !!document.querySelector('${row} input[name=phone]')`, 3000))
  await setVal(`${row} input[name=name]`, 'Tola Ojo'); await setVal(`${row} input[name=phone]`, '0803 555 0101')
  await shot(`${vp}-edit-details.jpg`)
  check(`${vp}: Save details`, await click(`${row} [data-save-details]`))
  check(`${vp}: saved in the database (name and +234 phone)`, await (async () => { for (let i = 0; i < 30; i++) { const u = await one(`select name, phone, role from "User" where email=$1`, [tEmail]); if (u.name === 'Tola Ojo' && u.phone === '+2348035550101') return u.role === 'team'; await sleep(250) } return false })())
  await db.query(`update "User" set name='Tolla Misspelt', phone='0803' where email=$1`, [tEmail])

  console.log(`3. ${vp}: remove a member (browser pop-ups blocked)`)
  await load(BASE + '/admin/team'); await blockPopups()
  const mrow = `[data-member-row="${mEmail}"]`
  check(`${vp}: Remove opens the in-page question`, (await click(`${mrow} [data-remove-member]`)) && await waitFor(`!!document.querySelector('[data-confirm]')`, 3000))
  check(`${vp}: "Keep" leaves them on the team`, (await click('[data-confirm-no]')) && (await one(`select role from "User" where email=$1`, [mEmail])).role === 'team')
  await click(`${mrow} [data-remove-member]`); await waitFor(`!!document.querySelector('[data-confirm]')`, 3000)
  check(`${vp}: confirming removes them`, (await click('[data-confirm-yes]')) && await waitFor(`!document.querySelector('${mrow}')`, 8000) && (await one(`select role from "User" where email=$1`, [mEmail])).role === 'customer')
  await db.query(`update "User" set role='team', permissions=ARRAY['orders'] where email=$1`, [mEmail])

  console.log(`4. ${vp}: a team member edits their own profile`)
  await useJar(T)
  await load(BASE + '/admin/profile')
  check(`${vp}: the profile has an edit form with name and phone`, await ev(`!!document.querySelector('form[data-team-profile] input[name=name]') && !!document.querySelector('form[data-team-profile] input[name=phone]')`))
  check(`${vp}: there is no field for role, areas or email`, await ev(`!document.querySelector('form[data-team-profile] [name=role], form[data-team-profile] [name=permissions], form[data-team-profile] input[name=email]:not([readonly]):not([disabled])')`))
  check(`${vp}: the email is shown (read-only)`, await ev(`document.body.textContent.includes(${JSON.stringify(tEmail)})`))
  check(`${vp}: the payment-method section is there`, await ev(`!!document.querySelector('[data-payment-method]') && /payment method|bank account/i.test(document.querySelector('[data-payment-method]').textContent)`))
  await setVal('form[data-team-profile] input[name=name]', 'Tola Ojo'); await setVal('form[data-team-profile] input[name=phone]', '08035550102')
  await shot(`${vp}-profile.jpg`)
  check(`${vp}: Save`, await click('[data-save-profile]'))
  check(`${vp}: shows it was saved`, await waitFor(`!!document.querySelector('[data-saved]')`, 6000))
  const u = await one(`select name, phone, role, permissions from "User" where email=$1`, [tEmail])
  check(`${vp}: stored (name, +234 phone), role and areas unchanged`, u.name === 'Tola Ojo' && u.phone === '+2348035550102' && u.role === 'team' && JSON.stringify(u.permissions) === '["enquiries"]', u)
  await load(BASE + '/admin/profile')
  check(`${vp}: the new name shows after reload`, await ev(`document.body.textContent.includes('Tola Ojo')`) && await fits())
  await setVal('form[data-team-profile] input[name=phone]', '12'); await click('[data-save-profile]')
  check(`${vp}: a bad phone shows a plain message and keeps the old one`, await waitFor(`/phone/i.test(document.querySelector('[data-profile-error]')?.textContent ?? '')`, 6000) && (await one(`select phone from "User" where email=$1`, [tEmail])).phone === '+2348035550102')
  await db.query(`update "User" set name='Tolla Misspelt', phone='0803' where email=$1`, [tEmail])

  console.log(`5. ${vp}: the administrator deletes enquiries`)
  await useJar(A)
  const d1 = await mkEnq(`delone${vp}`, 'new'), c1 = await mkEnq(`closeda${vp}`, 'closed'), c2 = await mkEnq(`closedb${vp}`, 'closed'), k1 = await mkEnq(`keep${vp}`, 'new')
  await load(BASE + '/admin/inquiries'); await blockPopups()
  check(`${vp}: each enquiry has a delete button`, await ev(`!!document.querySelector('[data-enquiry-row="${d1}"] [data-delete-enquiry]')`))
  check(`${vp}: delete asks first (in the page)`, (await click(`[data-enquiry-row="${d1}"] [data-delete-enquiry]`)) && await waitFor(`!!document.querySelector('[data-confirm]')`, 3000))
  check(`${vp}: keeping it leaves the enquiry`, (await click('[data-confirm-no]')) && (await db.query(`select 1 from "Inquiry" where id=$1`, [d1])).rowCount === 1)
  await click(`[data-enquiry-row="${d1}"] [data-delete-enquiry]`); await waitFor(`!!document.querySelector('[data-confirm]')`, 3000)
  check(`${vp}: confirming deletes it`, (await click('[data-confirm-yes]')) && await waitFor(`!document.querySelector('[data-enquiry-row="${d1}"]')`, 8000) && (await db.query(`select 1 from "Inquiry" where id=$1`, [d1])).rowCount === 0)
  check(`${vp}: a "Delete closed" button exists`, await ev(`!!document.querySelector('[data-delete-closed]')`))
  await click('[data-delete-closed]'); await waitFor(`!!document.querySelector('[data-confirm]')`, 3000)
  check(`${vp}: the question says how many will go`, await ev(`/\\b[2-9]\\b|\\d{2,}/.test(document.querySelector('[data-confirm]')?.textContent ?? '')`))
  await click('[data-confirm-yes]')
  check(`${vp}: closed enquiries are cleared, new ones kept`, await waitFor(`!document.querySelector('[data-enquiry-row="${c1}"]') && !!document.querySelector('[data-enquiry-row="${k1}"]')`, 8000) && (await db.query(`select 1 from "Inquiry" where id = any($1)`, [[c1, c2]])).rowCount === 0 && (await db.query(`select 1 from "Inquiry" where id=$1`, [k1])).rowCount === 1)
  check(`${vp}: no sideways scroll`, await fits())
  await shot(`${vp}-enquiries.jpg`)
  await db.query(`delete from "Inquiry" where id=$1`, [k1])
}

console.log(`\n${pass} passed, ${fail} failed`)
await db.end(); ws.close(); chrome.kill()
process.exit(fail ? 1 : 0)
