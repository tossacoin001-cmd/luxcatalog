import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { requireAdminApi, LUX_CATALOG_ORG_ID } from '@/lib/admin-auth'

export async function GET() {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clerk = await clerkClient()
  const [members, invitations] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({ organizationId: LUX_CATALOG_ORG_ID }),
    clerk.organizations.getOrganizationInvitationList({ organizationId: LUX_CATALOG_ORG_ID, status: ['pending'] }),
  ])

  return NextResponse.json({
    members: members.data.map((m) => ({
      id: m.id,
      userId: m.publicUserData?.userId,
      name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(' ') || null,
      email: m.publicUserData?.identifier,
      role: m.role,
      imageUrl: m.publicUserData?.imageUrl,
    })),
    invitations: invitations.data.map((i) => ({
      id: i.id,
      email: i.emailAddress,
      role: i.role,
      status: i.status,
    })),
  })
}

export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { email, role } = await req.json()
    if (!email || !['org:admin', 'org:vendor', 'org:member'].includes(role)) {
      return NextResponse.json({ error: 'Missing email or invalid role' }, { status: 400 })
    }

    const clerk = await clerkClient()
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: LUX_CATALOG_ORG_ID,
      emailAddress: email,
      role,
      inviterUserId: admin.userId,
    })

    return NextResponse.json({ success: true, invitation: { id: invitation.id, email: invitation.emailAddress } })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Unable to send invitation' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { type, id } = await req.json()
    const clerk = await clerkClient()

    if (type === 'invitation') {
      await clerk.organizations.revokeOrganizationInvitation({
        organizationId: LUX_CATALOG_ORG_ID,
        invitationId: id,
        requestingUserId: admin.userId,
      })
    } else if (type === 'member') {
      await clerk.organizations.deleteOrganizationMembership({
        organizationId: LUX_CATALOG_ORG_ID,
        userId: id,
      })
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Remove team member error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
