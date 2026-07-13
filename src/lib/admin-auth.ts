import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

// The one organization that represents Lux Catalog's internal team. Anyone
// invited into it with the org:admin role gets admin panel access. This
// replaces the old single-account public_metadata.role flag so access can
// be shared with team members and partners through a real invite flow
// instead of one hardcoded account.
export const LUX_CATALOG_ORG_ID = 'org_3GQXQNb9ygojG37baLMMn6JWlD9'

export async function isOrgAdmin(userId: string): Promise<boolean> {
  const clerk = await clerkClient()
  const { data } = await clerk.users.getOrganizationMembershipList({ userId })
  return data.some((m) => m.organization.id === LUX_CATALOG_ORG_ID && m.role === 'org:admin')
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
