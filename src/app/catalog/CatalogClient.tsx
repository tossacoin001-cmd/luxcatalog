'use client'

import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import AssetCard from '@/components/AssetCard'
import { EASE_OUT_EXPO } from '@/components/motion/Reveal'
import { categoryHrefs, categoryLabels } from '@/lib/utils'

interface Listing {
  id: string
  title: string
  slug: string
  category: string
  location: string
  country: string
  priceDisplay: string
  price: number | null
  images: string[]
  status: string
  featured: boolean
}

const categories = [
  { key: 'all', label: 'All Categories' },
  ...Object.entries(categoryLabels).map(([key, label]) => ({ key, label })),
]

const statusFilters = [
  { key: 'all', label: 'Any Status' },
  { key: 'available', label: 'Available' },
  { key: 'under_offer', label: 'Under Offer' },
  { key: 'sold', label: 'Sold' },
]

const sortOptions = [
  { key: 'featured', label: 'Featured First' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'newest', label: 'Newest' },
]

export default function CatalogClient({ listings: allListings }: { listings: Listing[] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('featured')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let list = [...allListings]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.location.toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q) ||
          categoryLabels[l.category]?.toLowerCase().includes(q)
      )
    }

    if (category !== 'all') list = list.filter((l) => l.category === category)
    if (status !== 'all') list = list.filter((l) => l.status === status)

    if (sort === 'featured') list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    if (sort === 'price_asc') list = [...list].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    if (sort === 'price_desc') list = [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))

    return list
  }, [search, category, status, sort, allListings])

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-12 py-10">
      {/* Search + filter bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#908673' }} />
          <input
            type="text"
            placeholder="Search by name, city or country…"
            aria-label="Search the catalog"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-10 pr-11 text-base md:text-sm focus:outline-none transition-colors"
            style={{
              background: '#0f1a10',
              border: '1px solid #1e2e1f',
              color: '#f5f0e8',
              fontFamily: 'var(--font-inter)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11" aria-label="Clear search">
              <X size={14} style={{ color: '#908673' }} />
            </button>
          )}
        </div>

        <div className="flex gap-3">
          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort listings"
            className="flex-1 md:flex-none md:min-w-[180px] h-12 px-4 pr-8 text-xs tracking-wider focus:outline-none appearance-none cursor-pointer"
            style={{
              background: '#0f1a10',
              border: '1px solid #1e2e1f',
              color: '#9a8f7a',
              fontFamily: 'var(--font-inter)',
            }}
          >
            {sortOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>

          {/* Filter toggle (mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center justify-center gap-2 h-12 px-4 text-xs tracking-wider transition-colors"
            aria-expanded={showFilters}
            style={{
              background: showFilters ? '#C9A84C' : '#0f1a10',
              border: '1px solid #1e2e1f',
              color: showFilters ? '#080c08' : '#9a8f7a',
              fontFamily: 'var(--font-inter)',
            }}
          >
            <SlidersHorizontal size={13} />
            {status !== 'all' ? 'Filters (1)' : 'Filters'}
          </button>
        </div>
      </div>

      {/* Mobile: categories as a swipeable chip rail, always visible. */}
      <div className="md:hidden -mx-5 px-5 mb-6 flex gap-2 overflow-x-auto no-scrollbar snap-x" role="group" aria-label="Category">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            aria-pressed={category === c.key}
            className="snap-start shrink-0 min-h-11 px-4 text-xs tracking-[0.12em] uppercase transition-colors duration-300"
            style={{
              fontFamily: 'var(--font-inter)',
              background: category === c.key ? '#C9A84C' : 'transparent',
              border: `1px solid ${category === c.key ? '#C9A84C' : '#1e2e1f'}`,
              color: category === c.key ? '#080c08' : '#9a8f7a',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex gap-8">
        {/* Sidebar filters: desktop always visible, mobile toggled */}
        <aside
          className={`${showFilters ? 'block' : 'hidden'} md:block w-full md:w-52 flex-shrink-0`}
        >
          {/* Category filter (desktop; mobile uses the chip rail) */}
          <div className="mb-8 hidden md:block">
            <p
              className="text-[11px] tracking-[0.2em] uppercase mb-4"
              style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              Category
            </p>
            <div className="flex flex-col gap-2">
              {categories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className="text-left text-xs min-h-10 px-3 transition-all"
                  style={{
                    fontFamily: 'var(--font-inter)',
                    background: category === c.key ? 'rgba(201,168,76,0.08)' : 'transparent',
                    border: category === c.key ? '1px solid rgba(201,168,76,0.3)' : '1px solid transparent',
                    color: category === c.key ? '#C9A84C' : '#9a8f7a',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status filter */}
          <div className="mb-8">
            <p
              className="text-[11px] tracking-[0.2em] uppercase mb-4"
              style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              Status
            </p>
            <div className="flex flex-col gap-2">
              {statusFilters.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key)}
                  className="text-left text-xs min-h-10 px-3 transition-all"
                  style={{
                    fontFamily: 'var(--font-inter)',
                    background: status === s.key ? 'rgba(201,168,76,0.08)' : 'transparent',
                    border: status === s.key ? '1px solid rgba(201,168,76,0.3)' : '1px solid transparent',
                    color: status === s.key ? '#C9A84C' : '#9a8f7a',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          {(category !== 'all' || status !== 'all' || search) && (
            <button
              onClick={() => { setCategory('all'); setStatus('all'); setSearch('') }}
              className="min-h-11 text-xs tracking-wider underline"
              style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}
            >
              Clear all filters
            </button>
          )}
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {/* Result count */}
          <p
            aria-live="polite"
            className="text-xs tracking-wider mb-6"
            style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}
          >
            {filtered.length} asset{filtered.length !== 1 ? 's' : ''} found
          </p>

          {filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-lg mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                No assets match your criteria
              </p>
              <p className="text-sm" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                Try broadening your search or clearing filters.
              </p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((asset, i) => (
                  <motion.div
                    key={asset.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE_OUT_EXPO, delay: Math.min(i, 8) * 0.04 } }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                  >
                    <AssetCard asset={asset} href={`${categoryHrefs[asset.category] ?? '/catalog'}/${asset.slug}`} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
