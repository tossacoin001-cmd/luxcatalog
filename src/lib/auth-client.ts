'use client'

import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins'
import type { auth } from '@/lib/auth'

// Same-origin client: the auth API is served by this app at /api/auth.
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    twoFactorClient({
      onTwoFactorRedirect() {
        const params = new URLSearchParams(window.location.search)
        const next = params.get('redirect_url')
        window.location.href = next ? `/two-factor?redirect_url=${encodeURIComponent(next)}` : '/two-factor'
      },
    }),
  ],
})

export const { useSession, signOut } = authClient

// Only allow same-site relative redirects, an absolute URL in redirect_url
// would otherwise turn sign-in into an open redirect to a phishing page.
export function safeRedirect(target: string | null | undefined, fallback = '/dashboard'): string {
  // Browsers treat "/\evil.com" like "//evil.com", so block both.
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback
  return target
}
