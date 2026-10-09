import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AREA_KEYS, cleanAreas, type Area } from '@/lib/access'

// Roles live on our own User row:
// - 'partner': an outside brand or owner; manages only their own listings.
// - 'team': Lux Catalog staff; reaches only the areas an admin gave them
//   (User.permissions, see lib/access).
// - 'admin': everything, including managing the team and bulk email.
// Anything not explicitly opened to an area stays admin-only. Staff access
// always requires 2FA; a stolen password alone never reaches the admin panel.
export type Role = 'customer' | 'partner' | 'team' | 'admin'
export type StaffRole = Exclude<Role, 'customer'>
export type Staff = { userId: string; role: StaffRole; areas: Area[] }

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function getUserId(): Promise<string | null> {
  return (await getSession())?.user.id ?? null
}

// Role and permissions are read from the database on every check rather
// than trusted from the session payload, so changes take effect at once.
async function loadStaff(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, twoFactorEnabled: true, permissions: true },
  })
  if (!user || user.role === 'customer') return null
  const role = user.role as StaffRole
  const areas: Area[] = role === 'admin' ? AREA_KEYS : role === 'team' ? cleanAreas(user.permissions) : []
  return { role, areas, twoFactorEnabled: !!user.twoFactorEnabled }
}

export async function getRole(userId: string): Promise<Role> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  return (user?.role as Role) ?? 'customer'
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getRole(userId)) === 'admin'
}

// Can this user work in an area (admin, or a team member given it)?
export async function can(userId: string, area: Area): Promise<boolean> {
  const staff = await loadStaff(userId)
  return !!staff && staff.twoFactorEnabled && staff.areas.includes(area)
}

// The signed-in staff member's role and areas (for menus), or null.
export async function currentStaff(): Promise<Staff | null> {
  const userId = await getUserId()
  if (!userId) return null
  const staff = await loadStaff(userId)
  return staff ? { userId, role: staff.role, areas: staff.areas } : null
}

type Rule = { roles: StaffRole[]; area?: Area }
const allowed = (staff: { role: StaffRole; areas: Area[] }, rule: Rule) =>
  rule.roles.includes(staff.role) || (!!rule.area && staff.role === 'team' && staff.areas.includes(rule.area))

// Server Components (pages): redirects rather than returning a status.
async function requirePage(rule: Rule): Promise<Staff> {
  const userId = await getUserId()
  if (!userId) redirect('/sign-in?redirect_url=/admin')
  const staff = await loadStaff(userId)
  if (!staff) redirect('/')
  if (!staff.twoFactorEnabled) redirect('/account?setup=2fa')
  if (!allowed(staff, rule)) redirect(staff.role === 'team' ? '/admin?denied=1' : '/')
  return { userId, role: staff.role, areas: staff.areas }
}

// API routes: returns null so the caller can respond 401/403 appropriately.
async function requireApi(rule: Rule): Promise<Staff | null> {
  const userId = await getUserId()
  if (!userId) return null
  const staff = await loadStaff(userId)
  if (!staff || !staff.twoFactorEnabled || !allowed(staff, rule)) return null
  return { userId, role: staff.role, areas: staff.areas }
}

// Admin only: team management, bulk email, anything not opened to an area.
export async function requireAdmin(): Promise<string> {
  return (await requirePage({ roles: ['admin'] })).userId
}

export async function requireAdminApi(): Promise<{ userId: string } | null> {
  const staff = await requireApi({ roles: ['admin'] })
  return staff ? { userId: staff.userId } : null
}

// Admins, plus team members given this area.
export async function requireArea(area: Area): Promise<Staff> {
  return requirePage({ roles: ['admin'], area })
}

export async function requireAreaApi(area: Area): Promise<Staff | null> {
  return requireApi({ roles: ['admin'], area })
}

// Any staff member: the dashboard. Pages using this must scope data to the
// caller's own listings when role is 'partner', and to their areas when
// role is 'team'.
export async function requireStaff(): Promise<Staff> {
  return requirePage({ roles: ['admin', 'team', 'partner'] })
}

export async function requireStaffApi(): Promise<Staff | null> {
  return requireApi({ roles: ['admin', 'team', 'partner'] })
}

// Listings: partners (their own), admins, and team members with Listings.
export async function requireListings(): Promise<Staff> {
  return requirePage({ roles: ['admin', 'partner'], area: 'listings' })
}

export async function requireListingsApi(): Promise<Staff | null> {
  return requireApi({ roles: ['admin', 'partner'], area: 'listings' })
}

export async function audit(actorId: string | null, action: string, target?: string, detail?: Record<string, unknown>) {
  const h = await headers()
  const ipAddress = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  await prisma.auditLog.create({
    data: { actorId, action, target, detail: detail as never, ipAddress },
  })
}
