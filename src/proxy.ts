import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

// Optimistic gate only: bounces visitors with no session cookie to sign-in
// before rendering protected pages. It does not validate the session, every
// protected page and API route still checks the session and role itself
// (admin-auth.ts), which is the real authorization.
const PROTECTED_PREFIXES = ['/admin', '/dashboard', '/saved', '/account']

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (!PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }
  if (getSessionCookie(req)) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/sign-in'
  url.search = `?redirect_url=${encodeURIComponent(pathname + search)}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/saved/:path*', '/account/:path*'],
}
