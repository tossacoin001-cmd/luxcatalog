import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { categoryHrefs } from '@/lib/utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://luxcatalog.vercel.app'

const staticPages = ['/', '/about', '/catalog', '/discover', '/contact', '/privacy', '/terms']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await prisma.listing.findMany({
    where: { published: true },
    select: { category: true, slug: true, updatedAt: true },
  })

  const listingEntries: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${APP_URL}${categoryHrefs[l.category] ?? '/catalog'}/${l.slug}`,
    lastModified: l.updatedAt,
  }))

  const staticEntries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${APP_URL}${path}`,
  }))

  const categoryEntries: MetadataRoute.Sitemap = Object.values(categoryHrefs).map((href) => ({
    url: `${APP_URL}${href}`,
  }))

  return [...staticEntries, ...categoryEntries, ...listingEntries]
}
