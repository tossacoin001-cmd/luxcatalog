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

// Admin previously ran as a separate Vercel deployment using Clerk's
// satellite-domain feature to share a session across two origins. Satellite
// domains (and the custom org:vendor role that went with them) require
// Clerk's paid B2B add-on, so admin is back to being a role-gated section of
// this same site (requireAdmin/requireStaff in each page), same origin,
// no paid Clerk feature required to reach production.
export default hasClerkKeys
  ? clerkMiddleware()
  : function handler(_req: NextRequest) {
      return NextResponse.next()
    }

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
}
