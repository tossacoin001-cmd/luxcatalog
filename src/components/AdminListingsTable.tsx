'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { categoryLabels } from '@/lib/utils'

interface ListingRow {
  id: string
  title: string
  category: string
  priceDisplay: string
  status: string
  featured: boolean
  published: boolean
  marginRequested?: boolean
  submittedBy?: string
  inquiryCount?: number
  soldCount?: number
}

export default function AdminListingsTable({
  listings,
  canPublish,
  showSubmittedBy = false,
}: {
  listings: ListingRow[]
  canPublish: boolean
  showSubmittedBy?: boolean
}) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/listings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Listing deleted.')
      router.refresh()
    } catch {
      toast.error('Failed to delete listing.')
    } finally {
      setDeletingId(null)
    }
  }

  const handlePublish = async (id: string) => {
    setPublishingId(id)
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: true }),
      })
      if (!res.ok) throw new Error()
      toast.success('Listing approved and live.')
      router.refresh()
    } catch {
      toast.error('Failed to approve listing.')
    } finally {
      setPublishingId(null)
    }
  }

  if (listings.length === 0) {
    return (
      <p className="py-16 text-center text-sm" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
        No listings yet. Click &ldquo;+ Add Listing&rdquo; to create the first one.
      </p>
    )
  }

  const headers = [
    'Title',
    'Category',
    ...(showSubmittedBy ? ['Submitted By'] : []),
    'Price',
    'Status',
    'Review',
    'Activity',
    'Featured',
    'Actions',
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e2e1f' }}>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left pb-3 pr-6 text-[10px] tracking-[0.15em] uppercase"
                style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr
              key={listing.id}
              style={{ borderBottom: '1px solid #1e2e1f', opacity: deletingId === listing.id ? 0.4 : 1 }}
              className="hover:bg-lux-surface transition-colors group"
            >
              <td className="py-4 pr-6">
                <span style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>{listing.title}</span>
              </td>
              <td className="py-4 pr-6">
                <span className="text-[10px] tracking-wider uppercase" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                  {categoryLabels[listing.category] ?? listing.category}
                </span>
              </td>
              {showSubmittedBy && (
                <td className="py-4 pr-6">
                  <span className="text-xs" style={{ color: listing.submittedBy === 'House' ? '#5a5248' : '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                    {listing.submittedBy}
                  </span>
                </td>
              )}
              <td className="py-4 pr-6">
                <span className="text-xs" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                  {listing.priceDisplay}
                </span>
                {listing.marginRequested && (
                  <p className="text-[9px] tracking-wider uppercase mt-1" style={{ color: '#9a8f7a' }}>
                    Margin requested
                  </p>
                )}
              </td>
              <td className="py-4 pr-6">
                <Badge variant={listing.status as 'available' | 'under_offer' | 'sold'}>
                  {listing.status === 'under_offer' ? 'Under Offer' : listing.status}
                </Badge>
              </td>
              <td className="py-4 pr-6">
                <span
                  className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1"
                  style={
                    listing.published
                      ? { border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }
                      : { border: '1px solid #3a3028', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
                  }
                >
                  {listing.published ? 'Live' : 'Pending Review'}
                </span>
              </td>
              <td className="py-4 pr-6">
                <span className="text-xs" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                  {listing.soldCount ? `${listing.soldCount} sold` : `${listing.inquiryCount ?? 0} enquiries`}
                </span>
              </td>
              <td className="py-4 pr-6">
                <span className="text-xs" style={{ color: listing.featured ? '#C9A84C' : '#3a3028', fontFamily: 'var(--font-inter)' }}>
                  {listing.featured ? '★ Yes' : 'No'}
                </span>
              </td>
              <td className="py-4">
                <div className="flex gap-4 items-center">
                  {canPublish && !listing.published && (
                    <button
                      type="button"
                      disabled={publishingId === listing.id}
                      onClick={() => handlePublish(listing.id)}
                      className="text-xs tracking-wider hover:text-lux-gold transition-colors disabled:opacity-60"
                      style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                    >
                      {publishingId === listing.id ? 'Approving…' : 'Approve'}
                    </button>
                  )}
                  <Link
                    href={`/admin/listings/${listing.id}/edit`}
                    className="text-xs tracking-wider hover:text-lux-gold transition-colors"
                    style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === listing.id}
                    onClick={() => handleDelete(listing.id, listing.title)}
                    className="text-xs tracking-wider transition-colors hover:text-lux-sold disabled:opacity-60"
                    style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}
                  >
                    {deletingId === listing.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
