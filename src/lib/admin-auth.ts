import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

// The one organization that represents Lux Catalog's internal team. Anyone
// invited into it gets admin panel access, scoped by role: org:admin (full
// access) or org:vendor (their own listings only). org:vendor isn't a real
// Clerk role, custom roles require Clerk's paid B2B add-on. Instead it's
// derived from the free org:member role plus a publicMetadata flag set at
// invite time, so "vendor" behaves identically everywhere else in the app
// without needing a paid plan to reach production.
export const LUX_CATALOG_ORG_ID = 'org_3GQXQNb9ygojG37baLMMn6JWlD9'

export type OrgRole = 'org:admin' | 'org:vendor' | 'org:member' | null

export function resolveRole(membership: { role: string; publicMetadata?: Record<string, unknown> } | undefined): OrgRole {
  if (!membership) return null
  if (membership.role === 'org:admin') return 'org:admin'
  if (membership.role === 'org:member' && membership.publicMetadata?.partnerType === 'vendor') return 'org:vendor'
  return 'org:member'
}

export async function getOrgRole(userId: string): Promise<OrgRole> {
  const clerk = await clerkClient()
  const { data } = await clerk.users.getOrganizationMembershipList({ userId })
  const membership = data.find((m) => m.organization.id === LUX_CATALOG_ORG_ID)
  return resolveRole(membership)
}

export async function isOrgAdmin(userId: string): Promise<boolean> {
  return (await getOrgRole(userId)) === 'org:admin'
}

// Server Components (pages): redirects rather than returning a status.
export async function requireAdmin(): Promise<string> {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!(await isOrgAdmin(userId))) redirect('/')
  return userId
}

// API routes: returns null so the caller can respond 401/403 appropriately.
export async function requireAdminApi(): Promise<{ userId: string } | null> {
  const { userId } = await auth()
  if (!userId) return null
  if (!(await isOrgAdmin(userId))) return null
  return { userId }
}

// Admin panel access for both full admin and vendor partners. Pages/routes
// using this must scope any data they touch to the caller's own listings
// when role is org:vendor, admin sees everything.
export async function requireStaff(): Promise<{ userId: string; role: OrgRole }> {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const role = await getOrgRole(userId)
  if (role !== 'org:admin' && role !== 'org:vendor') redirect('/')
  return { userId, role }
}

export async function requireStaffApi(): Promise<{ userId: string; role: OrgRole } | null> {
  const { userId } = await auth()
  if (!userId) return null
  const role = await getOrgRole(userId)
  if (role !== 'org:admin' && role !== 'org:vendor') return null
  return { userId, role }
}
