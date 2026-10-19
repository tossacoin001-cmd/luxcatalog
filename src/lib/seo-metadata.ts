import type { Metadata } from 'next'
import { SITE } from '@/lib/seo'

// One way to describe a page to search engines and link previews, so every
// page gets a canonical address, a preview image and matching Open Graph and
// Twitter text. `title` is the page's own words; the brand is added here (the
// preview title must carry it, since Next only adds it to the browser title).
export function pageMeta(opts: { title: string; description: string; path: string; fullTitle?: string }): Metadata {
  const shown = opts.fullTitle ?? `${opts.title} | ${SITE.name}`
  return {
    ...(opts.fullTitle ? { title: { absolute: opts.fullTitle } } : { title: opts.title }),
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: 'website',
      siteName: SITE.name,
      locale: SITE.locale,
      title: shown,
      description: opts.description,
      url: opts.path,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${SITE.name}: luxury in ${SITE.city}` }],
    },
    twitter: { card: 'summary_large_image', title: shown, description: opts.description, images: ['/opengraph-image'] },
  }
}
