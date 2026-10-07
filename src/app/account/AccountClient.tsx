'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { renderSVG } from 'uqr'
import { ShieldCheck, ShieldAlert, LogOut } from 'lucide-react'
import { AuthError, AuthField, AuthNotice, AuthSubmit } from '@/components/auth/AuthShell'
import { authClient, signOut } from '@/lib/auth-client'

interface AccountUser {
  name: string
  email: string
  emailVerified: boolean
  phone: string | null
  role: 'customer' | 'partner' | 'admin'
  twoFactorEnabled: boolean
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-6 md:p-8 space-y-5" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
      <h2 className="text-xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }

export default function AccountClient({ user, requireTwoFactor }: { user: AccountUser; requireTwoFactor: boolean }) {
  const router = useRouter()

  return (
    <div className="space-y-8">
      {requireTwoFactor && (
        <AuthNotice message="Staff access requires two-step verification. Set it up below to open the admin panel." />
      )}

      <Section title="Profile">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm" style={text}>
          <div>
            <dt className="text-[11px] tracking-[0.15em] uppercase mb-1">Name</dt>
            <dd style={{ color: '#f5f0e8' }}>{user.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-[0.15em] uppercase mb-1">Email</dt>
            <dd style={{ color: '#f5f0e8' }}>
              {user.email}{' '}
              <span className="text-[11px] uppercase ml-1" style={{ color: user.emailVerified ? '#6fbf73' : '#C9A84C' }}>
                {user.emailVerified ? 'Verified' : 'Unverified'}
              </span>
            </dd>
          </div>
          {user.phone && (
            <div>
              <dt className="text-[11px] tracking-[0.15em] uppercase mb-1">Phone</dt>
              <dd style={{ color: '#f5f0e8' }}>{user.phone}</dd>
            </div>
          )}
        </dl>
        {!user.emailVerified && <ResendVerification email={user.email} />}
      </Section>

      <TwoFactorSection enabled={user.twoFactorEnabled} onChange={() => router.refresh()} />

      <ChangePasswordSection />

      <button
        type="button"
        onClick={async () => {
          await signOut()
          window.location.href = '/'
        }}
        className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase hover:text-lux-gold transition-colors"
        style={text}
      >
        <LogOut size={14} /> Sign Out
      </button>
    </div>
  )
}

function ResendVerification({ email }: { email: string }) {
  const [sending, setSending] = useState(false)
  return (
    <button
      type="button"
      disabled={sending}
      onClick={async () => {
        setSending(true)
        const { error } = await authClient.sendVerificationEmail({ email, callbackURL: '/account' })
        setSending(false)
        if (error) toast.error('Could not send the email. Please try again shortly.')
        else toast.success('Verification email sent.')
      }}
      className="text-xs text-lux-gold hover:text-lux-gold-light disabled:opacity-60"
      style={{ fontFamily: 'var(--font-inter)' }}
    >
      {sending ? 'Sending…' : 'Resend verification email'}
    </button>
  )
}

type Setup = { totpURI: string; backupCodes: string[] }

function TwoFactorSection({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<Setup | null>(null)
  const [savedCodes, setSavedCodes] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const qrSvg = useMemo(() => (setup ? renderSVG(setup.totpURI, { border: 2 }) : null), [setup])
  const secret = useMemo(() => (setup ? new URL(setup.totpURI).searchParams.get('secret') : null), [setup])

  async function start(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await authClient.twoFactor.enable({ password })
    setLoading(false)
    if (error || !data) return setError('Password is incorrect.')
    if (data.method !== 'totp') return setError('Authenticator setup is unavailable. Please try again.')
    setSetup({ totpURI: data.totpURI, backupCodes: data.backupCodes })
    setPassword('')
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, '') })
    setLoading(false)
    if (error) return setError('That code is not valid. Check the time on your phone and try again.')
    setSavedCodes(setup!.backupCodes)
    setSetup(null)
    setCode('')
    toast.success('Two-step verification is on.')
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await authClient.twoFactor.disable({ password })
    setLoading(false)
    if (error) return setError('Password is incorrect.')
    setPassword('')
    toast.success('Two-step verification is off.')
    onChange()
  }

  return (
    <Section title="Two-Step Verification">
      <p className="flex items-center gap-2 text-sm" style={{ ...text, color: enabled || savedCodes ? '#6fbf73' : '#C9A84C' }}>
        {enabled || savedCodes ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
        {enabled || savedCodes ? 'On: sign-in also asks for a code from your authenticator app.' : 'Off: anyone with your password can sign in.'}
      </p>
      <AuthError message={error} />

      {savedCodes ? (
        <div className="space-y-4">
          <AuthNotice message="Save these backup codes somewhere safe (not on this phone). Each one works once if you lose your authenticator. They will not be shown again." />
          <pre className="grid grid-cols-2 gap-2 p-4 text-sm" style={{ background: '#162318', color: '#f5f0e8' }}>
            {savedCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </pre>
          <button
            type="button"
            onClick={() => {
              setSavedCodes(null)
              onChange()
            }}
            className="h-11 px-8 text-xs tracking-[0.18em] uppercase"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            I have saved them
          </button>
        </div>
      ) : setup ? (
        <form onSubmit={confirm} className="space-y-5">
          <p className="text-sm" style={text}>
            Scan this with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code it shows.
          </p>
          {qrSvg && <div className="w-48 h-48 bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
          {secret && (
            <p className="text-xs break-all" style={text}>
              Can&apos;t scan? Enter this key manually: <span style={{ color: '#f5f0e8' }}>{secret}</span>
            </p>
          )}
          <AuthField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
          <AuthSubmit loading={loading}>Confirm &amp; Turn On</AuthSubmit>
        </form>
      ) : enabled ? (
        <form onSubmit={disable} className="space-y-5">
          <AuthField label="Password (to turn off)" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-8 text-xs tracking-[0.18em] uppercase disabled:opacity-60"
            style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
          >
            Turn Off
          </button>
        </form>
      ) : (
        <form onSubmit={start} className="space-y-5">
          <AuthField label="Confirm your password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <AuthSubmit loading={loading}>Set Up Two-Step Verification</AuthSubmit>
        </form>
      )}
    </Section>
  )
}

function ChangePasswordSection() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.next.length < 10) return setError('Use at least 10 characters for your new password.')
    if (form.next !== form.confirm) return setError('New passwords do not match.')
    setLoading(true)
    const { error } = await authClient.changePassword({
      currentPassword: form.current,
      newPassword: form.next,
      revokeOtherSessions: true,
    })
    setLoading(false)
    if (error) return setError('Current password is incorrect.')
    setForm({ current: '', next: '', confirm: '' })
    toast.success('Password updated. Other devices have been signed out.')
  }

  return (
    <Section title="Change Password">
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthError message={error} />
        <AuthField label="Current Password" type="password" autoComplete="current-password" required value={form.current} onChange={set('current')} />
        <AuthField label="New Password (10+ characters)" type="password" autoComplete="new-password" required minLength={10} value={form.next} onChange={set('next')} />
        <AuthField label="Confirm New Password" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        <AuthSubmit loading={loading}>Update Password</AuthSubmit>
      </form>
    </Section>
  )
}
