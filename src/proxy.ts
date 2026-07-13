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

// Once ADMIN_HOST is set (after the admin.<domain> subdomain is live), the
// admin panel becomes genuinely unreachable from the public host and vice
// versa, not just role-gated within the same app. Until the custom domain
// is purchased and ADMIN_HOST is configured, this is a no-op so nothing
// changes from today's behavior.
const ADMIN_HOST = process.env.ADMIN_HOST
const ADMIN_ALLOWED_PREFIXES = ['/admin', '/sign-in', '/sign-up', '/api/admin', '/api/inquiries', '/api/fx-rate']

function hostSeparation(req: NextRequest): NextResponse | undefined {
  if (!ADMIN_HOST) return undefined

  const host = req.headers.get('host') ?? ''
  const isAdminHost = host === ADMIN_HOST
  const path = req.nextUrl.pathname
  const isAdminPath = ADMIN_ALLOWED_PREFIXES.some((p) => path.startsWith(p))

  if (isAdminHost && !isAdminPath) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }
  if (!isAdminHost && path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return undefined
}

export default hasClerkKeys
  ? clerkMiddleware((_auth, req) => hostSeparation(req))
  : function handler(req: NextRequest) {
      return hostSeparation(req) ?? NextResponse.next()
    }

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
}
