import { NextResponse } from 'next/server'
import { audit, getSession } from '@/lib/admin-auth'
import { findUsableInvitation } from '@/lib/invitations'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const { token } = await req.json().catch(() => ({ token: null }))
  if (typeof token !== 'string') return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const invitation = await findUsableInvitation(token)
  if (!invitation) return NextResponse.json({ error: 'This invitation is invalid, expired or already used' }, { status: 404 })

  // The invite is bound to the address it was sent to: a forwarded or leaked
  // link can't be redeemed by a different account.
  if (invitation.email !== session.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'wrong_account', invitedEmail: invitation.email }, { status: 403 })
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { role: invitation.role, permissions: invitation.role === 'team' ? invitation.permissions : [] },
    }),
    prisma.staffInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
  ])
  await audit(session.user.id, 'team.invite.accept', invitation.id, { role: invitation.role, permissions: invitation.permissions })

  return NextResponse.json({ success: true, role: invitation.role })
}
