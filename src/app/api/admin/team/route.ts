import { NextResponse } from 'next/server'
import { audit, requireAdminApi } from '@/lib/admin-auth'
import { createStaffInvitation } from '@/lib/invitations'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [members, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['admin', 'partner'] } },
      select: { id: true, name: true, email: true, role: true, image: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.staffInvitation.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return NextResponse.json({
    members: members.map((m) => ({ id: m.id, userId: m.id, name: m.name, email: m.email, role: m.role, imageUrl: m.image })),
    invitations: invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, status: 'pending' })),
  })
}

export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { email, role } = await req.json()
    if (typeof email !== 'string' || !email.includes('@') || !['admin', 'partner'].includes(role)) {
      return NextResponse.json({ error: 'Missing email or invalid role' }, { status: 400 })
    }

    const { invitation, link, emailed } = await createStaffInvitation({ email, role, invitedById: admin.userId })
    await audit(admin.userId, 'team.invite', invitation.email, { role, emailed })

    // The link is returned so the admin can also share it directly (e.g. on
    // WhatsApp) when email delivery isn't set up or is slow.
    return NextResponse.json({ success: true, invitation: { id: invitation.id, email: invitation.email }, link, emailed })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Unable to create invitation' }, { status: 500 })
  }
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
        prisma.user.update({ where: { id }, data: { role: 'customer' } }),
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
