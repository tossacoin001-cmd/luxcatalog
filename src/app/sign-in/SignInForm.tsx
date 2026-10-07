'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import AuthShell, { AuthError, AuthField, AuthSubmit } from '@/components/auth/AuthShell'
import Turnstile, { captchaHeaders } from '@/components/auth/Turnstile'
import { authClient, safeRedirect } from '@/lib/auth-client'

export default function SignInForm({ redirectUrl }: { redirectUrl: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetCaptcha, setResetCaptcha] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])

  const next = safeRedirect(redirectUrl)
  const signUpHref = redirectUrl ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}` : '/sign-up'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await authClient.signIn.email(
      { email: email.trim(), password },
      { headers: captchaHeaders(captcha) }
    )
    setLoading(false)
    if (error) {
      setResetCaptcha((n) => n + 1)
      setError(
        error.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : 'Email or password is incorrect.'
      )
      return
    }
    // Accounts with 2FA get twoFactorRedirect; the client plugin navigates.
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) return
    window.location.href = next
  }

  return (
    <AuthShell
      title="Welcome Back"
      footer={
        <>
          New to Lux Catalog?{' '}
          <Link href={signUpHref} className="inline-flex items-center min-h-11 text-lux-gold hover:text-lux-gold-light">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthError message={error} />
        <AuthField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="text-right -mt-2">
          <Link href="/forgot-password" className="inline-flex items-center min-h-11 text-xs text-lux-gold hover:text-lux-gold-light" style={{ fontFamily: 'var(--font-inter)' }}>
            Forgot password?
          </Link>
        </div>
        <Turnstile onToken={onToken} resetKey={resetCaptcha} />
        <AuthSubmit loading={loading}>Sign In</AuthSubmit>
      </form>
    </AuthShell>
  )
}
