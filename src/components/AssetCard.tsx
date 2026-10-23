'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, MapPin } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { categoryLabels } from '@/lib/utils'
import { findSubcategory, plainService } from '@/lib/taxonomy'
import PriceDisplay from '@/components/PriceDisplay'
import { modeBadge, priceCaption } from '@/lib/listing-views'

interface Asset {
  id: string
  title: string
  slug: string
  category: string
  location: string
  country: string
  priceDisplay: string
  price?: number | null
  images: string[]
  status: string
  featured?: boolean
  subcategory?: string | null
  mode?: string
}

interface AssetCardProps {
  asset: Asset
  href: string
  saved?: boolean
  onToggleSave?: (id: string) => void
}

export default function AssetCard({ asset, href, saved = false, onToggleSave }: AssetCardProps) {
  const [isSaved, setIsSaved] = useState(saved)
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const nextSaved = !isSaved
    setIsSaved(nextSaved)
    try {
      const res = await fetch('/api/saved', {
        method: nextSaved ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: asset.id }),
      })
      if (res.status === 401) {
        setIsSaved(!nextSaved)
        toast('Sign in to save assets to your collection')
        return
      }
      if (!res.ok) throw new Error()
      toast(nextSaved ? 'Saved to your collection' : 'Removed from saved')
      onToggleSave?.(asset.id)
    } catch {
      setIsSaved(!nextSaved)
      toast.error('Could not update your saved collection. Please try again.')
    }
  }

  // Services read as the service itself (Chef, Barber), not "Private Services".
  const categoryName = asset.category === 'private_services'
    ? plainService(findSubcategory('private_services', asset.subcategory)?.label ?? 'Services')
    : categoryLabels[asset.category] ?? asset.category
  const badge = modeBadge(asset.category, asset.subcategory ?? null, asset.mode ?? 'sale')
  const suffix = priceCaption(asset.category, asset.subcategory ?? null, asset.mode ?? 'sale').suffix
  const statusVariant =
    asset.status === 'available'
      ? 'available'
      : asset.status === 'under_offer'
      ? 'under_offer'
      : 'sold'

  return (
    <Link href={href} className="group block lux-card overflow-hidden">
      {/* Image */}
      <div className={`relative aspect-[4/3] overflow-hidden ${imgLoaded || imgError ? '' : 'skeleton-shimmer'}`}>
        {asset.images[0] && !imgError ? (
          <Image
            src={asset.images[0]}
            alt={asset.title}
            fill
            className="img-fade object-cover group-hover:scale-[1.03]"
            data-loaded={imgLoaded}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: '#fbf9f4' }}
          >
            <span className="text-lux-text-subtle text-xs tracking-widest uppercase">
              {categoryName}
            </span>
          </div>
        )}

        {/* Overlay gradient */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(8,12,8,0.7) 100%)' }}
        />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <Badge variant={statusVariant}>
            {asset.status === 'under_offer' ? 'Under Offer' : asset.status}
          </Badge>
        </div>

        {/* Featured badge */}
        {asset.featured && (
          <div className="absolute top-3 right-14">
            <Badge variant="gold-filled">Featured</Badge>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          className="absolute top-2 right-2 flex items-center justify-center w-11 h-11 transition-all duration-200 active:scale-90"
          style={{
            background: 'rgba(244,240,232,0.94)',
            border: '1px solid #d6cfbf',
          }}
          aria-label={isSaved ? 'Remove from saved' : 'Save to collection'}
          aria-pressed={isSaved}
        >
          <Heart
            size={16}
            className="transition-colors"
            style={{ color: '#14130f', fill: isSaved ? '#14130f' : 'transparent' }}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Category */}
        <p
          className="text-[11px] tracking-[0.2em] uppercase mb-2"
          style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
        >
          {categoryName}
          {badge ? ` · ${badge}` : ''}
        </p>

        {/* Title */}
        <h3
          className="text-base leading-snug mb-3 line-clamp-2"
          style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}
        >
          {asset.title}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-4">
          <MapPin size={11} style={{ color: '#5e584c', flexShrink: 0 }} />
          <span
            className="text-xs truncate"
            style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}
          >
            {asset.location}, {asset.country}
          </span>
        </div>

        {/* Price + Gold divider */}
        <div style={{ borderTop: '1px solid #d6cfbf', paddingTop: '1rem' }}>
          <p
            className="text-xl"
            style={{ fontFamily: 'var(--font-playfair)', color: '#14130f', fontStyle: !asset.price ? 'italic' : 'normal' }}
          >
            <PriceDisplay price={asset.price} priceDisplay={asset.priceDisplay} />
            {suffix && asset.price ? (
              <span className="ml-1.5 text-[11px] not-italic tracking-wider" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                {suffix}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </Link>
  )
}
