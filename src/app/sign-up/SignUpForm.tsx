'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import AuthShell, { AuthError, AuthField, AuthNotice, AuthSubmit } from '@/components/auth/AuthShell'
import Turnstile, { captchaHeaders } from '@/components/auth/Turnstile'
import { authClient, safeRedirect } from '@/lib/auth-client'

export default function SignUpForm({
  redirectUrl,
  invite,
  invitedEmail,
}: {
  redirectUrl: string | null
  invite: string | null
  invitedEmail: string | null
}) {
  const [form, setForm] = useState({ name: '', email: invitedEmail ?? '', phone: '', password: '', confirm: '' })
  const [consent, setConsent] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetCaptcha, setResetCaptcha] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const inviteHref = invite ? `/invite?token=${encodeURIComponent(invite)}` : null
  const afterAuth = inviteHref ?? redirectUrl
  const signInHref = afterAuth ? `/sign-in?redirect_url=${encodeURIComponent(afterAuth)}` : '/sign-in'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.password.length < 10) return setError('Use at least 10 characters for your password.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')

    setLoading(true)
    const { error } = await authClient.signUp.email(
      {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        marketingConsent: consent,
        callbackURL: '/dashboard',
      },
      { headers: captchaHeaders(captcha) }
    )
    setLoading(false)
    if (error) {
      setResetCaptcha((n) => n + 1)
      if (error.status === 429) setError('Too many attempts. Please wait a minute and try again.')
      else if (error.code?.startsWith('USER_ALREADY_EXISTS')) setError('An account with this email already exists. Sign in instead.')
      else setError('We could not create your account. Please check your details and try again.')
      return
    }
    window.location.href = inviteHref ?? safeRedirect(redirectUrl)
  }

  return (
    <AuthShell
      title={invite ? 'Join the Team' : 'Create Account'}
      subtitle={invite ? 'Create your account to accept your invitation.' : undefined}
      footer={
        <>
          Already have an account?{' '}
          <Link href={signInHref} className="inline-flex items-center min-h-11 text-lux-gold hover:text-lux-gold-light">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {invite && <AuthNotice message="Use the same email address the invitation was sent to." />}
        <AuthError message={error} />
        <AuthField label="Full Name" autoComplete="name" required value={form.name} onChange={set('name')} />
        <AuthField label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <AuthField label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+234" />
        <AuthField
          label="Password (10+ characters)"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={form.password}
          onChange={set('password')}
        />
        <AuthField label="Confirm Password" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        <label className="flex items-start gap-3 text-sm leading-relaxed cursor-pointer" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 w-4 h-4 accent-[#C9A84C]" />
          <span>Send me the Lux Edit: hand-picked listings and private offers, weekly. You can change or stop this any time.</span>
        </label>
        <Turnstile onToken={onToken} resetKey={resetCaptcha} />
        <AuthSubmit loading={loading}>Create Account</AuthSubmit>
      </form>
    </AuthShell>
  )
}
