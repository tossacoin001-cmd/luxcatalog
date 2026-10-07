import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Roles live on our own User row. 'partner' manages only their own listings,
// 'admin' sees everything. Staff access always requires 2FA, a stolen
// password alone never reaches the admin panel.
export type Role = 'customer' | 'partner' | 'admin'
export type StaffRole = Exclude<Role, 'customer'>

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function getUserId(): Promise<string | null> {
  return (await getSession())?.user.id ?? null
}

// Role is read from the database on every check rather than trusted from the
// session payload, so demoting someone takes effect on their next request.
async function loadStaff(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, twoFactorEnabled: true },
  })
  if (!user || user.role === 'customer') return null
  return { role: user.role as StaffRole, twoFactorEnabled: !!user.twoFactorEnabled }
}

export async function getRole(userId: string): Promise<Role> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  return (user?.role as Role) ?? 'customer'
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getRole(userId)) === 'admin'
}

// Server Components (pages): redirects rather than returning a status.
async function requirePage(allowed: StaffRole[]): Promise<{ userId: string; role: StaffRole }> {
  const userId = await getUserId()
  if (!userId) redirect('/sign-in?redirect_url=/admin')
  const staff = await loadStaff(userId)
  if (!staff || !allowed.includes(staff.role)) redirect('/')
  if (!staff.twoFactorEnabled) redirect('/account?setup=2fa')
  return { userId, role: staff.role }
}

// API routes: returns null so the caller can respond 401/403 appropriately.
async function requireApi(allowed: StaffRole[]): Promise<{ userId: string; role: StaffRole } | null> {
  const userId = await getUserId()
  if (!userId) return null
  const staff = await loadStaff(userId)
  if (!staff || !allowed.includes(staff.role) || !staff.twoFactorEnabled) return null
  return { userId, role: staff.role }
}

export async function requireAdmin(): Promise<string> {
  return (await requirePage(['admin'])).userId
}

export async function requireAdminApi(): Promise<{ userId: string } | null> {
  const staff = await requireApi(['admin'])
  return staff ? { userId: staff.userId } : null
}

// Admin panel access for both full admin and partners. Pages/routes using
// this must scope any data they touch to the caller's own listings when
// role is 'partner', admin sees everything.
export async function requireStaff(): Promise<{ userId: string; role: StaffRole }> {
  return requirePage(['admin', 'partner'])
}

export async function requireStaffApi(): Promise<{ userId: string; role: StaffRole } | null> {
  return requireApi(['admin', 'partner'])
}

export async function audit(actorId: string | null, action: string, target?: string, detail?: Record<string, unknown>) {
  const h = await headers()
  const ipAddress = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  await prisma.auditLog.create({
    data: { actorId, action, target, detail: detail as never, ipAddress },
  })
}
