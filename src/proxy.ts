import { NextResponse } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'

// Route protection is handled inside individual page components via auth().
// clerkMiddleware() only runs when keys are present, so environments without
// them (e.g. a preview with no Clerk config) still get a safe pass-through
// instead of clerkMiddleware() throwing during initialization.
const hasClerkKeys = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY
)

// Admin lives in a genuinely separate Vercel project deployed from this same
// repo, not just a role-gated route on the public site. That project sets
// APP_TARGET=admin, which flips this middleware into "admin-only" mode: every
// non-admin path redirects into /admin. The public project leaves APP_TARGET
// unset, so /admin is unreachable there regardless of role, it redirects out
// to the admin deployment instead. This works today on the .vercel.app URLs
// and keeps working unchanged once a custom domain/subdomain is in place.
const APP_TARGET = process.env.APP_TARGET
const ADMIN_APP_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://luxcatalog-admin.vercel.app'
const ADMIN_ALLOWED_PREFIXES = ['/admin', '/sign-in', '/sign-up', '/api/admin', '/api/inquiries', '/api/fx-rate']

function targetSeparation(req: NextRequest): NextResponse | undefined {
  const path = req.nextUrl.pathname
  const isAdminPath = ADMIN_ALLOWED_PREFIXES.some((p) => path.startsWith(p))

  if (APP_TARGET === 'admin') {
    if (!isAdminPath) return NextResponse.redirect(new URL('/admin', req.url))
    return undefined
  }

  if (path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin', ADMIN_APP_URL))
  }
  return undefined
}

export default hasClerkKeys
  ? clerkMiddleware((_auth, req) => targetSeparation(req))
  : function handler(req: NextRequest) {
      return targetSeparation(req) ?? NextResponse.next()
    }

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
}
