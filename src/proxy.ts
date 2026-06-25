import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const isProtectedRoute = createRouteMatcher(['/saved(.*)', '/dashboard(.*)'])
const isAdminRoute = createRouteMatcher(['/admin(.*)'])

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    const { userId, sessionClaims } = await auth()
    if (!userId) return NextResponse.redirect(new URL('/sign-in', req.url))
    const role = (sessionClaims?.metadata as { role?: string })?.role
    if (role !== 'admin') return NextResponse.redirect(new URL('/', req.url))
  }
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export default async function handler(req: NextRequest, evt: any) {
  // Pass through all requests when Clerk keys aren't configured
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    return NextResponse.next()
  }
  return clerkHandler(req, evt)
}

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
