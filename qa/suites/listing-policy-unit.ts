// The gate on public listings: pure rules. Run: npx tsx qa/suites/listing-policy-unit.ts
import { createRules, editRules, deleteRule, editAction, APPROVAL_MESSAGE, type ListingRole } from '../../src/lib/listing-policy'

let pass = 0, fail = 0
const check = (n: string, ok: boolean, x: unknown = '') => (ok ? (pass++, console.log(`  PASS ${n}`)) : (fail++, console.log(`  FAIL ${n} ${typeof x === 'string' ? x : JSON.stringify(x)}`)))
const roles: ListingRole[] = ['admin', 'team', 'partner']

console.log('1. A new listing')
check('an admin’s listing is live at once', createRules('admin').published === true)
check('a team member’s listing is not', createRules('team').published === false)
check('a partner’s listing is not', createRules('partner').published === false)
check('only an admin can promote at creation', createRules('admin').canPromote && !createRules('team').canPromote && !createRules('partner').canPromote)
check('only an admin needs no approval', !createRules('admin').needsApproval && createRules('team').needsApproval && createRules('partner').needsApproval)
check('a made-up status is refused for everyone', roles.every((r) => createRules(r).status('nonsense') === 'available' && createRules(r).status(undefined) === 'available' && createRules(r).status(42) === 'available'))
check('a real status is honoured only for an admin', createRules('admin').status('under_offer') === 'under_offer' && createRules('team').status('under_offer') === 'available' && createRules('partner').status('sold') === 'available')
check('the approval message is a plain sentence', /admin/.test(APPROVAL_MESSAGE) && /live/.test(APPROVAL_MESSAGE))

console.log('2. Editing as an admin: only what is sent changes')
const adminEdit = (b: Record<string, unknown>) => { const d = editRules('admin', b); return d.ok ? d : null }
let d = adminEdit({ published: true })
check('Publish alone changes only published', !!d && JSON.stringify(d.write) === '{"published":true}' && d.sendToReview === false, d)
d = adminEdit({ title: 'New title' })
check('a title-only edit touches no promotional field', !!d && Object.keys(d.write).length === 0, d)
d = adminEdit({ featured: true, hireAvailable: true, hireRatePerDay: 150000, hireRateDisplay: '₦150,000 / day' })
check('promotional fields are written when sent', !!d && d.write.featured === true && d.write.hireAvailable === true && d.write.hireRatePerDay === 150000 && d.write.hireRateDisplay === '₦150,000 / day', d)
d = adminEdit({ featured: false, hireAvailable: false, hireRatePerDay: '', hireRateDisplay: '' })
check('switching them off is an explicit write', !!d && d.write.featured === false && d.write.hireAvailable === false && d.write.hireRatePerDay === null && d.write.hireRateDisplay === null, d)
d = adminEdit({ published: false })
check('an admin can unpublish', !!d && d.write.published === false)
d = adminEdit({ published: 'yes' })
check('a non-boolean published is ignored, not trusted', !!d && !('published' in d.write), d)
check('an admin edit never sends a listing to review', adminEdit({ title: 'x' })!.sendToReview === false)

console.log('3. Editing as a team member')
const team = (b: Record<string, unknown>) => editRules('team', b)
let t = team({ title: 'x', description: 'y' })
check('a normal edit is allowed and goes to review', t.ok && t.sendToReview === true, t)
check('it writes no admin fields', t.ok && Object.keys(t.write).length === 0, t)
t = team({ published: true })
check('publishing is refused with a plain reason', !t.ok && t.status === 403 && /admin/i.test(t.error), t)
t = team({ published: false })
check('unpublishing is refused too', !t.ok && t.status === 403, t)
t = team({ title: 'x', published: true })
check('publishing hidden inside a normal edit is refused', !t.ok, t)
check('featuring is refused', !team({ featured: true }).ok)
check('hire availability is refused', !team({ hireAvailable: true }).ok)
check('a hire price is refused', !team({ hireRatePerDay: 90000 }).ok)
check('a hire label is refused', !team({ hireRateDisplay: '₦90,000 / day' }).ok)
t = team({ featured: false, hireAvailable: false, hireRatePerDay: '', hireRateDisplay: '' })
check('an edit form that sends the switched-off defaults still works (and writes nothing)', t.ok && Object.keys(t.write).length === 0, t)
check('a hostile body does not throw', (() => { try { editRules('team', Object.create(null)); editRules('team', { __proto__: { published: true } } as never); return true } catch { return false } })())

console.log('4. Editing as a partner (their form never carries admin fields)')
let p = editRules('partner', { title: 'x', published: true, featured: true })
check('stray admin fields are ignored, the listing goes to review', p.ok && p.sendToReview === true && Object.keys(p.write).length === 0, p)

console.log('5. Deleting')
check('an admin deletes anything', deleteRule('admin', { published: true }).ok && deleteRule('admin', { published: false }).ok)
const live = deleteRule('team', { published: true })
check('a team member cannot delete a live listing', !live.ok && live.status === 403 && /admin/i.test(live.error), live)
check('a team member can remove a draft', deleteRule('team', { published: false }).ok)
check('partners pass the rule (the route checks ownership)', deleteRule('partner', { published: true }).ok)

console.log('6. Audit wording')
check('publish, unpublish and edit are told apart', editAction({ published: true }) === 'listing.publish' && editAction({ published: false }) === 'listing.unpublish' && editAction({}) === 'listing.edit')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
