'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface PartnerRow {
  userId: string
  brandName: string
  logo: string | null
  bio: string | null
  featured: boolean
  listingCount: number
}

export default function PartnerAdminTable({ partners }: { partners: PartnerRow[] }) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)

  const toggleFeatured = async (userId: string, next: boolean) => {
    setSavingId(userId)
    try {
      const res = await fetch(`/api/admin/partners/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: next }),
      })
      if (!res.ok) throw new Error()
      toast.success(next ? 'Added to Trusted Partners strip.' : 'Removed from Trusted Partners strip.')
      router.refresh()
    } catch {
      toast.error('Failed to update. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  if (partners.length === 0) {
    return (
      <p className="py-16 text-center text-sm" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
        No partner profiles yet. They&rsquo;ll appear here once an invited partner sets one up.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {partners.map((p) => (
        <div key={p.userId} className="flex items-center justify-between p-5" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
          <div className="flex items-center gap-4 min-w-0">
            {p.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo} alt="" className="w-12 h-12 object-cover flex-shrink-0" style={{ background: '#162318' }} />
            ) : (
              <div className="w-12 h-12 flex-shrink-0" style={{ background: '#162318' }} />
            )}
            <div className="min-w-0">
              <p className="text-sm truncate" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>{p.brandName}</p>
              <p className="text-xs truncate" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                {p.listingCount} listing{p.listingCount === 1 ? '' : 's'}{p.bio ? ` · ${p.bio}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={savingId === p.userId}
            onClick={() => toggleFeatured(p.userId, !p.featured)}
            className="text-xs tracking-[0.15em] uppercase px-4 py-2 flex-shrink-0 transition-colors disabled:opacity-60"
            style={
              p.featured
                ? { background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }
                : { border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
            }
          >
            {savingId === p.userId ? 'Saving…' : p.featured ? 'Featured' : 'Feature on Homepage'}
          </button>
        </div>
      ))}
    </div>
  )
}
