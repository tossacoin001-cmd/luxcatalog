import { NextResponse } from 'next/server'
import { audit, requireAdminApi } from '@/lib/admin-auth'
import { cleanAreas } from '@/lib/access'
import { createStaffInvitation } from '@/lib/invitations'
import { prisma } from '@/lib/prisma'

// Team management is admin-only. Team members get only the areas chosen
// here (lib/access); brand partners join through the partner application,
// not through this page.

const TEAM_ROLES = ['admin', 'team'] as const
type TeamRole = (typeof TEAM_ROLES)[number]
const isTeamRole = (r: unknown): r is TeamRole => TEAM_ROLES.includes(r as TeamRole)

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [members, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['admin', 'team'] } },
      select: { id: true, name: true, email: true, role: true, permissions: true, image: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.staffInvitation.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({
    members: members.map((m) => ({ id: m.id, userId: m.id, name: m.name, email: m.email, role: m.role, permissions: m.permissions, imageUrl: m.image })),
    invitations: invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, permissions: i.permissions, status: 'pending' })),
  })
}

// Invite, or resend an invitation (optionally changing its role and areas,
// e.g. turning an old "partner" invite into a team invite).
export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { email, role, resendId } = body

    // Resend: the raw token is never stored, so issue a fresh invitation
    // (createStaffInvitation retires the old link).
    if (typeof resendId === 'string') {
      const old = await prisma.staffInvitation.findUnique({ where: { id: resendId } })
      if (!old || old.acceptedAt) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
      const newRole: TeamRole = isTeamRole(role) ? role : old.role === 'admin' ? 'admin' : 'team'
      const permissions = body.permissions !== undefined ? cleanAreas(body.permissions) : old.permissions
      const { invitation, link, emailed } = await createStaffInvitation({ email: old.email, role: newRole, permissions, invitedById: admin.userId })
      await audit(admin.userId, 'team.invite.resend', invitation.email, { role: newRole, permissions, emailed })
      return NextResponse.json({ success: true, invitation: { id: invitation.id, email: invitation.email }, link, emailed })
    }

    if (typeof email !== 'string' || !email.includes('@') || !isTeamRole(role)) {
      return NextResponse.json({ error: 'Missing email or invalid role' }, { status: 400 })
    }
    const permissions = cleanAreas(body.permissions)
    const { invitation, link, emailed } = await createStaffInvitation({ email, role, permissions, invitedById: admin.userId })
    await audit(admin.userId, 'team.invite', invitation.email, { role, permissions, emailed })

    // The link is returned so the admin can also share it directly (e.g. on
    // WhatsApp) when email delivery isn't set up or is slow.
    return NextResponse.json({ success: true, invitation: { id: invitation.id, email: invitation.email }, link, emailed })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Unable to create invitation' }, { status: 500 })
  }
}

// Change a person's role and areas. Also moves an account that was invited
// as a partner (but is really staff) onto the team.
export async function PATCH(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { userId, role } = body
  if (typeof userId !== 'string' || !isTeamRole(role)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  if (userId === admin.userId) return NextResponse.json({ error: 'You cannot change your own access' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!user || user.role === 'customer') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role === 'partner') {
    // Only partners who never applied (old team invites) can be moved; real
    // brand partners stay partners.
    const applied = await prisma.partnerApplication.findUnique({ where: { userId }, select: { id: true } })
    if (applied) return NextResponse.json({ error: 'This is a brand partner with an application, not a team member' }, { status: 409 })
  }

  const permissions = role === 'team' ? cleanAreas(body.permissions) : []
  await prisma.user.update({ where: { id: userId }, data: { role, permissions } })
  await audit(admin.userId, 'team.member.update', userId, { from: user.role, role, permissions })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { type, id } = await req.json()

    if (type === 'invitation') {
      await prisma.staffInvitation.update({ where: { id }, data: { revokedAt: new Date() } })
      await audit(admin.userId, 'team.invite.revoke', id)
    } else if (type === 'member') {
      if (id === admin.userId) {
        return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 })
      }
      // Removing staff demotes to customer and ends every active session, so
      // access is cut immediately rather than when their session expires.
      await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { role: 'customer', permissions: [] } }),
        prisma.session.deleteMany({ where: { userId: id } }),
      ])
      await audit(admin.userId, 'team.member.remove', id)
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Remove team member error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
