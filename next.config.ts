import type { NextConfig } from 'next'

// Sent on every response: no other site may frame Lux Catalog (protects the
// admin panel and checkout from clickjacking), browsers must not guess file
// types, full URLs are not leaked to other sites, and powerful browser
// features are switched off since the site never uses them.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

// Pages and responses that must never appear in search results: accounts,
// carts, sign-in, admin and every API response. (robots.txt asks politely;
// this header tells search engines even when they arrive by a link.)
const PRIVATE = '/(admin|dashboard|account|saved|cart|checkout|bookings|sign-in|sign-up|forgot-password|reset-password|invite|two-factor)(.*)'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Pages only: API responses set their own policy (private ID images
      // and documents are served with a strict sandbox that must not be
      // replaced).
      { source: '/((?!api/).*)', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }] },
      { source: PRIVATE, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]
  },
}

export default nextConfig
