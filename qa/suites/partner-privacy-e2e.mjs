// Partner requirements are private: a visitor sees who we partner with, never
// the document lists. A person sees the requirements for ONE kind of business
// only after choosing it, signed in, inside their own application.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BASE = process.env.BASE ?? 'http://localhost:3300'
let pass = 0, fail = 0
const check = (n, ok, x = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const get = async (path, init) => { const r = await fetch(BASE + path, { redirect: 'manual', ...init }); return { status: r.status, text: await r.text(), location: r.headers.get('location') } }
const src = readFileSync(fileURLToPath(new URL('../../src/lib/partner-requirements.ts', import.meta.url)), 'utf8')

// What counts as "a requirement": every document label and help text, and
// every declaration sentence, written in the requirements source.
const grab = (re) => [...src.matchAll(re)].map((m) => m[1].replaceAll("\\'", "'")).filter((s) => s.length > 6)
const labels = grab(/label: '((?:[^'\\]|\\.)+)'/g).filter((s) => !/^(Government ID)$/.test(s) || true)
const helps = grab(/help: '((?:[^'\\]|\\.)+)'/g)
const decls = grab(/text: '((?:[^'\\]|\\.)+)'/g)
const KINDS = ['property_host', 'fleet_owner', 'marine_operator', 'chauffeur_service', 'security_company', 'brand_retailer', 'agent', 'service_professional']
const typeLabels = KINDS.map((k) => (src.match(new RegExp(`key: '${k}',\\s*\\n\\s*label: '((?:[^'\\\\]|\\\\.)+)'`)) ?? [])[1]).filter(Boolean)
const docLabels = labels.filter((l) => !typeLabels.includes(l))
const distinct = [...docLabels, ...helps, ...decls].filter((s, i, a) => a.indexOf(s) === i)

console.log('1. What we are checking for')
check('the requirements source was read', distinct.length > 25 && typeLabels.length >= 6, { distinct: distinct.length, types: typeLabels.length })
const probes = distinct.filter((s) => s.length >= 12).slice(0, 400)

console.log('2. The public partner page shows kinds of partner, not requirements')
const page = await get('/partners')
const visible = page.text.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replaceAll('&#x27;', "'").replaceAll('&amp;', '&').replace(/\s+/g, ' ')
check('it opens', page.status === 200, `${page.status}`)
check('every kind of partner is named', typeLabels.every((l) => visible.includes(l)), typeLabels.filter((l) => !visible.includes(l)))
check('there is no "You’ll need" list', !/You.{0,6}ll need/i.test(visible))
const leaked = probes.filter((p) => visible.includes(p.replaceAll('’', "'")) || visible.includes(p))
check('none of the document labels, help texts or declarations appear in the visible text', leaked.length === 0, leaked.slice(0, 5))
const distinctive = ['NSCDC', 'CAC certificate', 'Certificate of incorporation', 'life jacket', 'insurance']
check('none of the telltale words appear on the page (licence bodies, certificates, insurance lists)', distinctive.filter((w) => new RegExp(w, 'i').test(visible)).length <= 1, distinctive.filter((w) => new RegExp(w, 'i').test(visible)))
const rawLeak = probes.filter((p) => page.text.includes(p.replaceAll("'", '&#x27;')) || page.text.includes(p))
check('nor anywhere in the raw page source (including data handed to the browser)', rawLeak.length === 0, rawLeak.slice(0, 5))
const scripts = [...page.text.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
let chunkLeak = []
for (const s of scripts) { const t = (await get(s.startsWith('http') ? new URL(s).pathname : s)).text; for (const p of probes) if (t.includes(p) || t.includes(p.replaceAll("'", "\\'"))) chunkLeak.push(p) }
check('nor in any script the page loads', chunkLeak.length === 0, [...new Set(chunkLeak)].slice(0, 5))
check('the page still explains how it works and that documents stay private', /applicants only|only to applicants|only after you choose/i.test(visible), visible.slice(0, 120))

console.log('3. Each kind of partner has its own way in')
const links = [...page.text.matchAll(/href="(\/partners\/apply\?type=([a-z_]+))"/g)].map((m) => m[2])
check('every kind links to the application with its own kind', KINDS.every((k) => links.includes(k)), { links })
check('the single generic "Start your application" button is still there', /href="\/partners\/apply"/.test(page.text) || /\/partners\/apply\?type=/.test(page.text))

console.log('4. Signing in does not lose the choice')
for (const k of ['fleet_owner', 'service_professional']) {
  const r = await get(`/partners/apply?type=${k}`)
  check(`${k}: a signed-out visitor is sent to sign up`, r.status >= 300 && r.status < 400 && /sign-up/.test(r.location ?? ''), `${r.status} ${r.location}`)
  check(`${k}: and the choice travels with them`, decodeURIComponent(r.location ?? '').includes(`/partners/apply?type=${k}`), r.location)
}
const bad = await get('/partners/apply?type=<script>alert(1)</script>')
check('an invalid kind is ignored (never echoed), still goes to sign up', bad.status >= 300 && bad.status < 400 && !/<script>alert/.test(decodeURIComponent(bad.location ?? '')), bad.location)
const odd = await get('/partners/apply?type=constructor')
check('a made-up kind such as "constructor" is not trusted', odd.status >= 300 && !/type=constructor/.test(decodeURIComponent(odd.location ?? '')), odd.location)

console.log('5. The application page (signed out) holds no requirements either')
const apply = await get('/partners/apply')
check('it does not render requirement text for anyone', apply.status >= 300 || probes.every((p) => !apply.text.includes(p)))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
