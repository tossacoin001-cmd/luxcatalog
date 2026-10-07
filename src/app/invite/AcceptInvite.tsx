'use client'

import { useState } from 'react'
import { AuthError, AuthNotice } from '@/components/auth/AuthShell'
import { signOut } from '@/lib/auth-client'

const buttonStyle = { background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }

export default function AcceptInvite({ token, invitedEmail, currentEmail }: { token: string; invitedEmail: string; currentEmail: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wrongAccount = invitedEmail !== currentEmail.toLowerCase()

  async function accept() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setLoading(false)
    if (!res.ok) {
      setError('We could not accept this invitation. It may have expired. Ask for a new one.')
      return
    }
    // Staff access needs 2FA; admin-auth sends them to set it up first.
    window.location.href = '/admin'
  }

  if (wrongAccount) {
    return (
      <div className="space-y-5">
        <AuthNotice message={`This invitation is for ${invitedEmail}, but you are signed in as ${currentEmail}.`} />
        <button
          type="button"
          onClick={async () => {
            await signOut()
            window.location.reload()
          }}
          className="w-full h-11 text-xs tracking-[0.18em] uppercase"
          style={buttonStyle}
        >
          Sign out and continue
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <AuthError message={error} />
      <AuthNotice message="After accepting, you will set up two-step verification. It is required for all staff accounts." />
      <button type="button" onClick={accept} disabled={loading} className="w-full h-11 text-xs tracking-[0.18em] uppercase disabled:opacity-60" style={buttonStyle}>
        {loading ? 'Please wait…' : 'Accept Invitation'}
      </button>
    </div>
  )
}
