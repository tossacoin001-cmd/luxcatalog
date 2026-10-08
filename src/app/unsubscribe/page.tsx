import Link from 'next/link'
import type { Metadata } from 'next'
import AuthShell, { AuthError, AuthNotice } from '@/components/auth/AuthShell'
import { findPrefsByToken, isUnsubKind, UNSUB_KINDS } from '@/lib/notify/unsubscribe'

export const metadata: Metadata = { title: 'Email Preferences', robots: { index: false } }
export const dynamic = 'force-dynamic'

const button = { background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; k?: string; done?: string }> }) {
  const { t, k, done } = await searchParams
  const prefs = await findPrefsByToken(t)
  const valid = !!prefs && isUnsubKind(k)

  if (!valid) {
    return (
      <AuthShell title="Link Expired">
        <AuthError message="This unsubscribe link isn't valid any more. Sign in to manage your email preferences." />
        <Link href="/account/notifications" className="mt-6 flex items-center justify-center min-h-12 text-xs tracking-[0.18em] uppercase" style={button}>
          Manage Emails
        </Link>
      </AuthShell>
    )
  }

  const label = UNSUB_KINDS[k].label

  if (done === '1') {
    return (
      <AuthShell title="You're Unsubscribed">
        <AuthNotice message={`You won't receive ${label} any more. Booking confirmations and account emails will still arrive.`} />
        <div className="mt-6 flex flex-col gap-3">
          <Link href="/account/notifications" className="flex items-center justify-center min-h-12 text-xs tracking-[0.18em] uppercase" style={button}>
            Choose What You Receive
          </Link>
          <Link href="/" className="flex items-center justify-center min-h-11 text-xs tracking-[0.18em] uppercase" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Back to Lux Catalog
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Unsubscribe?" subtitle={`Stop receiving ${label}.`}>
      <form action="/api/unsubscribe" method="post" className="space-y-4">
        <input type="hidden" name="t" value={t} />
        <input type="hidden" name="k" value={k} />
        <button type="submit" className="w-full min-h-12 text-xs tracking-[0.18em] uppercase" style={button}>
          Yes, Unsubscribe
        </button>
        <Link href="/account/notifications" className="flex items-center justify-center min-h-11 text-xs tracking-[0.18em] uppercase" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          Change how often instead
        </Link>
      </form>
    </AuthShell>
  )
}
