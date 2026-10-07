import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import AuthShell, { AuthError } from '@/components/auth/AuthShell'
import AcceptInvite from './AcceptInvite'
import { getSession } from '@/lib/admin-auth'
import { findUsableInvitation } from '@/lib/invitations'

export const metadata: Metadata = { title: 'Accept Invitation' }
export const dynamic = 'force-dynamic'

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const invitation = token ? await findUsableInvitation(token) : null

  if (!token || !invitation) {
    return (
      <AuthShell title="Invitation Unavailable">
        <AuthError message="This invitation is invalid, has expired, or was already used. Ask the person who invited you to send a new one." />
      </AuthShell>
    )
  }

  const session = await getSession()
  if (!session) {
    redirect(`/sign-up?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation.email)}`)
  }

  return (
    <AuthShell
      title="Accept Invitation"
      subtitle={`You have been invited to join Lux Catalog as ${invitation.role === 'admin' ? 'an admin' : 'a partner'}.`}
    >
      <AcceptInvite token={token} invitedEmail={invitation.email} currentEmail={session.user.email} />
    </AuthShell>
  )
}
