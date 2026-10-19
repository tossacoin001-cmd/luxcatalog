import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/utils'

const APP_URL = getAppUrl()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private, personal and sign-in pages never belong in search results.
      disallow: ['/admin', '/dashboard', '/saved', '/cart', '/checkout', '/api/', '/account', '/bookings', '/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/invite', '/two-factor'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
