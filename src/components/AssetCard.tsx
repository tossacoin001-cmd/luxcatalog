'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, MapPin } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { formatPrice, categoryLabels } from '@/lib/utils'

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

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsSaved(!isSaved)
    toast(isSaved ? 'Removed from saved' : 'Saved to your collection')
    onToggleSave?.(asset.id)
  }

  const statusVariant =
    asset.status === 'available'
      ? 'available'
      : asset.status === 'under_offer'
      ? 'under_offer'
      : 'sold'

  return (
    <Link href={href} className="group block lux-card overflow-hidden">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {asset.images[0] && !imgError ? (
          <Image
            src={asset.images[0]}
            alt={asset.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setImgError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: '#0f1a10' }}
          >
            <span className="text-lux-text-subtle text-xs tracking-widest uppercase">
              {categoryLabels[asset.category] ?? asset.category}
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
          <div className="absolute top-3 right-10">
            <Badge variant="gold-filled">Featured</Badge>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          className="absolute top-3 right-3 p-2 transition-all duration-200"
          style={{
            background: 'rgba(8,12,8,0.6)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(201,168,76,0.2)',
          }}
          aria-label={isSaved ? 'Unsave' : 'Save'}
        >
          <Heart
            size={14}
            className="transition-colors"
            style={{ color: isSaved ? '#C9A84C' : '#9a8f7a', fill: isSaved ? '#C9A84C' : 'transparent' }}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Category */}
        <p
          className="text-[10px] tracking-[0.2em] uppercase mb-2"
          style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
        >
          {categoryLabels[asset.category] ?? asset.category}
        </p>

        {/* Title */}
        <h3
          className="text-base leading-snug mb-3 group-hover:text-lux-gold transition-colors duration-300 line-clamp-2"
          style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}
        >
          {asset.title}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-4">
          <MapPin size={11} style={{ color: '#5a5248', flexShrink: 0 }} />
          <span
            className="text-xs truncate"
            style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}
          >
            {asset.location}, {asset.country}
          </span>
        </div>

        {/* Price + Gold divider */}
        <div style={{ borderTop: '1px solid #1e2e1f', paddingTop: '1rem' }}>
          <p
            className="text-sm tracking-wide"
            style={{ fontFamily: 'var(--font-playfair)', color: '#C9A84C', fontStyle: !asset.price ? 'italic' : 'normal' }}
          >
            {formatPrice(asset.price ?? null, asset.priceDisplay)}
          </p>
        </div>
      </div>
    </Link>
  )
}
