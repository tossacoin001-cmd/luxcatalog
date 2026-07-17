import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://luxcatalog.vercel.app'

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
