import { safeJsonLd } from '@/lib/seo'

// Structured data for search engines. The text is escaped so nothing in a
// listing title or description can close the script tag.
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />
}
