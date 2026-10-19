// One administrator: the pure rule. Run: npx tsx qa/suites/owner-unit.ts
import { isTrustedAdmin, ownerEmailFromEnv, ONLY_ONE_ADMIN } from '../../src/lib/owner'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))

console.log('1. Reading the owner address from the environment')
check('a plain address is kept, lower-cased', ownerEmailFromEnv('Owner@Example.com') === 'owner@example.com')
check('spaces around it are ignored', ownerEmailFromEnv('  owner@example.com  ') === 'owner@example.com')
check('a leading byte-order mark is ignored', ownerEmailFromEnv('﻿owner@example.com') === 'owner@example.com')
check('empty, blank and undefined mean "not set"', ownerEmailFromEnv('') === null && ownerEmailFromEnv('   ') === null && ownerEmailFromEnv(undefined) === null)
check('something that is not an address is treated as not an address, never as a wildcard', ownerEmailFromEnv('*') === null && ownerEmailFromEnv('admin') === null)
check('two addresses are refused (there is one owner)', ownerEmailFromEnv('a@x.com,b@x.com') === null)

console.log('2. Who is trusted as an administrator')
const owner = 'owner@example.com'
check('the owner, with the admin role, is trusted', isTrustedAdmin({ role: 'admin', email: 'owner@example.com' }, owner))
check('the match ignores letter case', isTrustedAdmin({ role: 'admin', email: 'Owner@Example.COM' }, owner))
check('another account with the admin role is NOT trusted', !isTrustedAdmin({ role: 'admin', email: 'someone@example.com' }, owner))
check('a lookalike address is not trusted', !isTrustedAdmin({ role: 'admin', email: 'owner@example.com.evil.test' }, owner) && !isTrustedAdmin({ role: 'admin', email: 'xowner@example.com' }, owner) && !isTrustedAdmin({ role: 'admin', email: 'owner+1@example.com' }, owner))
check('the owner’s address without the admin role is not an admin', !isTrustedAdmin({ role: 'team', email: 'owner@example.com' }, owner) && !isTrustedAdmin({ role: 'customer', email: 'owner@example.com' }, owner))
check('a missing email is never trusted', !isTrustedAdmin({ role: 'admin', email: '' }, owner) && !isTrustedAdmin({ role: 'admin', email: undefined as never }, owner))
check('with no owner set the existing admin rule applies (so tests and first setup work)', isTrustedAdmin({ role: 'admin', email: 'anyone@example.com' }, null))
check('with no owner set, a non-admin is still not an admin', !isTrustedAdmin({ role: 'team', email: 'anyone@example.com' }, null))
check('an unknown role is never an admin', !isTrustedAdmin({ role: 'root' as never, email: owner }, owner))

console.log('3. The message')
check('it says there is one administrator and that it cannot be granted', /one administrator/i.test(ONLY_ONE_ADMIN) && /cannot|can’t|can't/i.test(ONLY_ONE_ADMIN), ONLY_ONE_ADMIN)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
