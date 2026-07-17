'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'

const inputStyle = {
  background: '#0f1a10',
  border: '1px solid #1e2e1f',
  color: '#f5f0e8',
  fontFamily: 'var(--font-inter)',
}

export interface PartnerProfileValues {
  brandName: string
  logo: string | null
  bio: string
}

// Every partner sets this up once before they can submit a listing. It's what
// lets an approved listing show "Listed by [Brand]" instead of going out
// anonymously, and what feeds the public Trusted Partners strip once an admin
// features it.
export default function PartnerProfileForm({ profile, redirectAfterSave }: { profile?: PartnerProfileValues; redirectAfterSave?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [brandName, setBrandName] = useState(profile?.brandName ?? '')
  const [logo, setLogo] = useState<string | null>(profile?.logo ?? null)
  const [bio, setBio] = useState(profile?.bio ?? '')

  const handleLogo = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogo(data.url)
    } catch {
      toast.error('Logo upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, logo, bio }),
      })
      if (!res.ok) throw new Error()
      toast.success('Profile saved.')
      router.push(redirectAfterSave ?? '/admin')
      router.refresh()
    } catch {
      toast.error('Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = 'w-full h-11 px-4 text-sm focus:outline-none transition-colors'
  const labelClass = 'block text-[10px] tracking-[0.15em] uppercase mb-2'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="p-8" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
        <div className="space-y-5">
          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Brand Name <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. how you want to appear on approved listings"
              required
              className={fieldClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Logo
            </label>
            {logo ? (
              <div className="flex items-center gap-4 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="" className="w-16 h-16 object-cover" style={{ background: '#162318' }} />
                <button
                  type="button"
                  onClick={() => setLogo(null)}
                  className="text-xs tracking-wider flex items-center gap-1"
                  style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}
                >
                  <X size={12} /> Remove
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => handleLogo(e.target.files)}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:tracking-wider file:uppercase disabled:opacity-60"
                style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
              />
            )}
            {uploading && (
              <p className="flex items-center gap-2 mt-2 text-xs" style={{ color: '#9a8f7a' }}>
                <Loader2 size={12} className="animate-spin" /> Uploading…
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Short Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line or two about your business, shown alongside your listings…"
              rows={3}
              className="w-full px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || uploading}
        className="px-10 py-4 text-xs tracking-[0.2em] uppercase transition-all disabled:opacity-60"
        style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
      >
        {loading ? 'Saving…' : 'Save Profile'}
      </button>
    </form>
  )
}
