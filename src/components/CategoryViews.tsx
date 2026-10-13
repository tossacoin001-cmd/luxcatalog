'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import AssetCard from '@/components/AssetCard'
import RequestButton from '@/components/concierge/RequestButton'
import { inView, normalizeView, viewsFor } from '@/lib/listing-views'

export type CategoryListing = {
  id: string; title: string; slug: string; category: string; subcategory: string | null; mode: string
  location: string; country: string; priceDisplay: string; price: number | null; images: string[]; status: string; featured: boolean
}

type Props = { category: string; categorySlug: string; categoryLabel: string; listings: CategoryListing[] }

// The category's listings with tabs (For Sale / For Rent / ...) where it has
// them. The page itself stays cached at the edge: the view is read from the
// address in the browser, so a shared ?view=for_rent link opens on rentals.
export function CategoryViews({ category, categorySlug, categoryLabel, listings, view }: Props & { view: string | null }) {
  const pathname = usePathname()
  const views = viewsFor(category)
  const shown = inView(listings, view)
  const viewLabel = views.find((v) => v.key === view)?.label
  const tab = (active: boolean) => ({
    border: `1px solid ${active ? '#C9A84C' : '#1e2e1f'}`,
    background: active ? 'rgba(201,168,76,0.12)' : 'transparent',
    color: active ? '#e4c878' : '#9a8f7a',
    fontFamily: 'var(--font-inter)',
  })
  const topic = viewLabel ? `${categoryLabel}: ${viewLabel}` : categoryLabel

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-12 py-10">
      {views.length > 0 && (
        <nav data-view-tabs aria-label={`${categoryLabel} views`} className="flex flex-wrap gap-2 mb-8">
          <Link href={pathname} scroll={false} aria-current={view === null ? 'page' : undefined} className="inline-flex items-center min-h-11 px-4 text-[11px] tracking-[0.16em] uppercase" style={tab(view === null)}>
            All
          </Link>
          {views.map((v) => (
            <Link key={v.key} href={`${pathname}?view=${v.key}`} scroll={false} aria-current={view === v.key ? 'page' : undefined} className="inline-flex items-center min-h-11 px-4 text-[11px] tracking-[0.16em] uppercase" style={tab(view === v.key)}>
              {v.label}
            </Link>
          ))}
        </nav>
      )}
      {shown.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {viewLabel ? `No ${viewLabel.toLowerCase()} listed yet` : `No ${categoryLabel.toLowerCase()} listed yet`}
          </p>
          <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            New pieces arrive privately before they are listed. Tell us what you are looking for and a specialist will find it for you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <RequestButton topic={topic} label={`Find ${topic.toLowerCase()} for me`} className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase" style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
              Tell us what you want
            </RequestButton>
            <Link href="/catalog" className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase transition-colors hover:bg-[rgba(201,168,76,0.08)]" style={{ border: '1px solid rgba(201,168,76,0.45)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
              Browse all collections
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shown.map((asset) => (
            <AssetCard key={asset.id} asset={asset} href={`/catalog/${categorySlug}/${asset.slug}`} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CategoryViewsFromAddress(props: Props) {
  const view = normalizeView(props.category, useSearchParams().get('view'))
  return <CategoryViews {...props} view={view} />
}
