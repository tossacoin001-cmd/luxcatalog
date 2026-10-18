// The gate on public listings, in one place, so every route enforces the same
// rule and the rule can be tested without a server.
//
// Nothing goes in front of customers until an admin approves it: a partner's
// submission, a team member's submission, and any edit either of them makes.
// Only an admin publishes, unpublishes, features a listing or sets hire terms.
// An edit only changes the fields it sends (so "Publish" never wipes anything).

export type ListingRole = 'admin' | 'team' | 'partner'

export const APPROVAL_MESSAGE = 'Submitted for admin approval. It will go live once an admin approves it.'
export const ONLY_ADMIN_PUBLISHES = 'Only an admin can publish or unpublish a listing. Your changes are saved and waiting for approval.'
export const ONLY_ADMIN_PROMOTES = 'Only an admin can feature a listing or set hire terms.'
export const ONLY_ADMIN_DELETES_LIVE = 'Only an admin can delete a live listing.'

const STATUSES = ['available', 'under_offer', 'sold'] as const
export type ListingStatusValue = (typeof STATUSES)[number]

export const isAdminRole = (role: string) => role === 'admin'

// What a brand-new listing starts as.
export function createRules(role: ListingRole) {
  const admin = role === 'admin'
  return {
    published: admin,
    // Promotional levers and a made-up status are admin-only.
    canPromote: admin,
    status: (requested: unknown): ListingStatusValue => (admin && STATUSES.includes(requested as ListingStatusValue) ? (requested as ListingStatusValue) : 'available'),
    needsApproval: !admin,
  }
}

type Body = Record<string, unknown>
const has = (b: Body, k: string) => Object.prototype.hasOwnProperty.call(b, k)
const asksToPromote = (b: Body) =>
  b.featured === true || b.hireAvailable === true || (has(b, 'hireRatePerDay') && !!b.hireRatePerDay) || (has(b, 'hireRateDisplay') && !!b.hireRateDisplay)

export type AdminWrite = { published?: boolean; featured?: boolean; hireAvailable?: boolean; hireRatePerDay?: number | null; hireRateDisplay?: string | null }

export type EditDecision =
  | { ok: false; status: 403; error: string }
  | {
      ok: true
      // true: the listing goes back to review (a non-admin changed it)
      sendToReview: boolean
      // admin only: which promotional/publish fields the request really sent
      write: AdminWrite
    }

export function editRules(role: ListingRole, body: Body): EditDecision {
  if (role === 'admin') {
    const write: AdminWrite = {}
    if (typeof body.published === 'boolean') write.published = body.published
    if (has(body, 'featured')) write.featured = !!body.featured
    if (has(body, 'hireAvailable')) write.hireAvailable = !!body.hireAvailable
    if (has(body, 'hireRatePerDay')) write.hireRatePerDay = body.hireRatePerDay ? Number(body.hireRatePerDay) : null
    if (has(body, 'hireRateDisplay')) write.hireRateDisplay = body.hireRateDisplay ? String(body.hireRateDisplay) : null
    return { ok: true, sendToReview: false, write }
  }
  // A partner's form never carries these; ignore a stray value rather than
  // fail their edit (their listing returns to review either way).
  if (role === 'partner') return { ok: true, sendToReview: true, write: {} }
  // Team: refuse loudly so nobody believes they published or promoted.
  if (typeof body.published === 'boolean') return { ok: false, status: 403, error: ONLY_ADMIN_PUBLISHES }
  if (asksToPromote(body)) return { ok: false, status: 403, error: ONLY_ADMIN_PROMOTES }
  return { ok: true, sendToReview: true, write: {} }
}

// Deleting: an admin anything; a team member only a draft; a partner only
// their own (checked by the route, which knows the owner).
export function deleteRule(role: ListingRole, listing: { published: boolean }): { ok: true } | { ok: false; status: 403; error: string } {
  if (role === 'team' && listing.published) return { ok: false, status: 403, error: ONLY_ADMIN_DELETES_LIVE }
  return { ok: true }
}

// What kind of change an edit is, for the audit log.
export function editAction(write: { published?: boolean }): 'listing.publish' | 'listing.unpublish' | 'listing.edit' {
  return write.published === true ? 'listing.publish' : write.published === false ? 'listing.unpublish' : 'listing.edit'
}
