'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell, { AuthError, AuthField, AuthNotice, AuthSubmit } from '@/components/auth/AuthShell'
import { authClient } from '@/lib/auth-client'

export default function ResetPasswordForm({ token, linkError }: { token: string | null; linkError: boolean }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidLink = linkError || !token

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 10) return setError('Use at least 10 characters for your password.')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! })
    setLoading(false)
    if (error) {
      setError('This reset link is invalid or has expired. Please request a new one.')
      return
    }
    setDone(true)
  }

  return (
    <AuthShell
      title="Choose a New Password"
      footer={
        <Link href="/sign-in" className="text-lux-gold hover:text-lux-gold-light">
          Back to sign in
        </Link>
      }
    >
      {invalidLink ? (
        <div className="space-y-5">
          <AuthError message="This reset link is invalid or has expired." />
          <Link
            href="/forgot-password"
            className="block w-full h-11 leading-[2.75rem] text-center text-xs tracking-[0.18em] uppercase"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Request a New Link
          </Link>
        </div>
      ) : done ? (
        <div className="space-y-5">
          <AuthNotice message="Your password has been updated. For your security, all other sessions were signed out." />
          <Link
            href="/sign-in"
            className="block w-full h-11 leading-[2.75rem] text-center text-xs tracking-[0.18em] uppercase"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthError message={error} />
          <AuthField
            label="New Password (10+ characters)"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <AuthField label="Confirm Password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <AuthSubmit loading={loading}>Update Password</AuthSubmit>
        </form>
      )}
    </AuthShell>
  )
}
