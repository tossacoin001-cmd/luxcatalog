'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import AuthShell, { AuthError, AuthField, AuthNotice, AuthSubmit } from '@/components/auth/AuthShell'
import Turnstile, { captchaHeaders } from '@/components/auth/Turnstile'
import { authClient } from '@/lib/auth-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetCaptcha, setResetCaptcha] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await authClient.requestPasswordReset(
      { email: email.trim(), redirectTo: '/reset-password' },
      { headers: captchaHeaders(captcha) }
    )
    setLoading(false)
    if (error) {
      setResetCaptcha((n) => n + 1)
      setError(error.status === 429 ? 'Too many requests. Please wait a few minutes.' : 'Something went wrong. Please try again.')
      return
    }
    // Same message whether or not the account exists, so this form can't be
    // used to discover which emails are registered.
    setSent(true)
  }

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Enter your email and we will send you a link to choose a new password."
      footer={
        <Link href="/sign-in" className="text-lux-gold hover:text-lux-gold-light">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <AuthNotice message="If an account exists for that email, a reset link is on its way. It expires in one hour." />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthError message={error} />
          <AuthField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Turnstile onToken={onToken} resetKey={resetCaptcha} />
          <AuthSubmit loading={loading}>Send Reset Link</AuthSubmit>
        </form>
      )}
    </AuthShell>
  )
}
