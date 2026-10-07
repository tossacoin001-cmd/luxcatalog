'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell, { AuthError, AuthField, AuthSubmit } from '@/components/auth/AuthShell'
import { authClient, safeRedirect } from '@/lib/auth-client'

export default function TwoFactorForm({ redirectUrl }: { redirectUrl: string | null }) {
  const [useBackup, setUseBackup] = useState(false)
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const clean = code.trim()
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: clean, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code: clean.replace(/\s/g, ''), trustDevice })
    setLoading(false)
    if (error) {
      setError(
        error.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : useBackup
            ? 'That backup code is not valid.'
            : 'That code is not valid. Check your authenticator app and try again.'
      )
      return
    }
    window.location.href = safeRedirect(redirectUrl, '/admin')
  }

  return (
    <AuthShell
      title="Verify It's You"
      subtitle={useBackup ? 'Enter one of your saved backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
      footer={
        <Link href="/sign-in" className="text-lux-gold hover:text-lux-gold-light">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthError message={error} />
        <AuthField
          label={useBackup ? 'Backup Code' : 'Authentication Code'}
          inputMode={useBackup ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          autoFocus
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <label className="flex items-center gap-3 text-sm cursor-pointer" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
          <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} className="accent-[#C9A84C]" />
          Trust this device for 30 days
        </label>
        <AuthSubmit loading={loading}>Verify</AuthSubmit>
        <button
          type="button"
          onClick={() => {
            setUseBackup((b) => !b)
            setCode('')
            setError(null)
          }}
          className="w-full text-xs text-lux-gold hover:text-lux-gold-light"
          style={{ fontFamily: 'var(--font-inter)' }}
        >
          {useBackup ? 'Use authenticator app instead' : 'Lost your phone? Use a backup code'}
        </button>
      </form>
    </AuthShell>
  )
}
