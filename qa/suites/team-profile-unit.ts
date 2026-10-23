// A person's own details: the pure rules (name, phone, which fields may be sent).
// Written before the build (2026-10-22). Run: npx tsx qa/suites/team-profile-unit.ts
import { cleanName, normalisePhone, parseProfileEdit, parseDetailsEdit } from '../../src/lib/team-profile'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))

console.log('1. Names')
check('spaces are trimmed and squeezed', cleanName('  Tola   Adeyemi ') === 'Tola Adeyemi')
check('accents and hyphens and apostrophes are fine', cleanName("Chiamaka Okafor-Eze") === 'Chiamaka Okafor-Eze' && cleanName("Ọlá O'Brien") === "Ọlá O'Brien" && cleanName('Zoë Núñez') === 'Zoë Núñez')
check('one letter is too short', cleanName('A') === null)
check('two letters is the minimum', cleanName('Al') === 'Al')
check('markup is refused', cleanName('<b>Tola</b>') === null && cleanName('Tola <script>') === null)
check('digits and symbols are refused', cleanName('Tola 2') === null && cleanName('Tola@home') === null && cleanName('Tola; drop table') === null)
check('longer than 80 is refused', cleanName('x'.repeat(81)) === null && cleanName('x'.repeat(80)) === 'x'.repeat(80))
check('empty and non-text are refused', cleanName('') === null && cleanName('   ') === null && cleanName(undefined) === null && cleanName(12 as never) === null && cleanName({} as never) === null)
check('control characters and zero-width characters are removed or refused', cleanName('Tola​Ojo') !== 'Tola​Ojo' && cleanName('Tola\nOjo') === 'Tola Ojo')

console.log('2. Phone numbers')
check('a Nigerian number with a leading 0 becomes +234', normalisePhone('08031234567') === '+2348031234567')
check('spaces and dashes are ignored', normalisePhone('0803 123 4567') === '+2348031234567' && normalisePhone('0803-123-4567') === '+2348031234567')
check('234 without the plus is understood', normalisePhone('2348031234567') === '+2348031234567')
check('+234 with a stray 0 is corrected', normalisePhone('+2340803 123 4567') === '+2348031234567')
check('an international number keeps its country code', normalisePhone('+44 7700 900123') === '+447700900123' && normalisePhone('+1 (415) 555-0132') === '+14155550132')
check('too short is refused', normalisePhone('12345') === null && normalisePhone('080') === null)
check('too long is refused', normalisePhone('+234803123456789012') === null)
check('letters are refused', normalisePhone('0803abc4567') === null && normalisePhone('call me') === null)
check('empty and non-text are refused', normalisePhone('') === null && normalisePhone(undefined) === null && normalisePhone(8031234567 as never) === null)
check('a Nigerian mobile with 10 digits and no 0 is understood', normalisePhone('8031234567') === '+2348031234567')

console.log('3. What a team member may send (their own profile)')
let r = parseProfileEdit({ name: 'Tola Ojo', phone: '0803 123 4567' })
check('name and phone are accepted and cleaned', r.ok && r.data.name === 'Tola Ojo' && r.data.phone === '+2348031234567', r)
r = parseProfileEdit({ name: 'Tola Ojo' })
check('name alone is accepted', r.ok && r.data.name === 'Tola Ojo' && !('phone' in r.data), r)
r = parseProfileEdit({ phone: '0803 123 4567' })
check('phone alone is accepted', r.ok && r.data.phone === '+2348031234567' && !('name' in r.data), r)
for (const k of ['role', 'permissions', 'email', 'id', 'userId', 'emailVerified', 'twoFactorEnabled', 'image', 'marketingConsent']) {
  r = parseProfileEdit({ name: 'Tola Ojo', [k]: 'x' })
  check(`"${k}" is refused, never silently ignored`, !r.ok && /not allowed|cannot|can.t/i.test(r.error), r)
}
check('an empty object is refused', !parseProfileEdit({}).ok)
check('null, arrays and text are refused', !parseProfileEdit(null).ok && !parseProfileEdit([] as never).ok && !parseProfileEdit('x' as never).ok)
r = parseProfileEdit({ name: '<x>' })
check('a bad name gives a plain message', !r.ok && /name/i.test(r.error), r)
r = parseProfileEdit({ phone: '1' })
check('a bad phone gives a plain message', !r.ok && /phone/i.test(r.error), r)
check('a prototype-pollution attempt is refused', !parseProfileEdit(JSON.parse('{"__proto__":{"role":"admin"},"name":"Tola Ojo"}')).ok || ({} as Record<string, unknown>).role === undefined)

console.log('4. What the administrator may send when correcting a member')
let d = parseDetailsEdit({ name: 'Tola Ojo-Bello', phone: '07031234567' })
check('name and phone are accepted', d.ok && d.data.name === 'Tola Ojo-Bello' && d.data.phone === '+2347031234567', d)
check('role, areas and email are refused here too', !parseDetailsEdit({ name: 'Tola Ojo', role: 'admin' }).ok && !parseDetailsEdit({ name: 'Tola Ojo', permissions: [] }).ok && !parseDetailsEdit({ email: 'x@y.com' }).ok)
check('an empty name is refused', !parseDetailsEdit({ name: '' }).ok)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
