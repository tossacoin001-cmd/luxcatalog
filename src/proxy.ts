import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Route protection is handled inside individual page components via auth()
// Keeping proxy minimal to avoid Clerk initialization issues in edge context
export default function handler(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
}
