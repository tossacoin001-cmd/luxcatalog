import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/utils'

const APP_URL = getAppUrl()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/saved', '/cart', '/checkout', '/api/'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
