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

export default hasClerkKeys
  ? clerkMiddleware()
  : function handler(req: NextRequest) {
      return NextResponse.next()
    }

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
}
