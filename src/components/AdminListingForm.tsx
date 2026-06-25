'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const categories = [
  { key: 'real_estate', label: 'Real Estate' },
  { key: 'supercar',    label: 'Supercars' },
  { key: 'yacht',       label: 'Yachts' },
  { key: 'decor',       label: 'Interior Decor' },
  { key: 'commercial',  label: 'Commercial' },
  { key: 'lifestyle',   label: 'Lifestyle' },
]

const inputStyle = {
  background: '#0f1a10',
  border: '1px solid #1e2e1f',
  color: '#f5f0e8',
  fontFamily: 'var(--font-inter)',
}

export default function AdminListingForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: 'real_estate',
    description: '',
    priceDisplay: '',
    location: '',
    country: '',
    images: '',
    features: '',
    status: 'available',
    featured: false,
  })

  const set = (key: string, val: string | boolean) => setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // In production: POST to /api/admin/listings
      await new Promise((r) => setTimeout(r, 800))
      toast.success('Listing created successfully.')
      router.push('/admin/listings')
    } catch {
      toast.error('Failed to create listing. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = 'w-full h-11 px-4 text-sm focus:outline-none transition-colors'
  const labelClass = 'block text-[10px] tracking-[0.15em] uppercase mb-2'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="p-8" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
        <p className="text-[10px] tracking-[0.2em] uppercase mb-6" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          Basic Information
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Title <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Cap Ferrat Clifftop Villa"
              required
              className={fieldClass}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
            />
          </div>

          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Category <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className={fieldClass}
              style={{ ...inputStyle, appearance: 'none' as const }}
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              className={fieldClass}
              style={{ ...inputStyle, appearance: 'none' as const }}
            >
              <option value="available">Available</option>
              <option value="under_offer">Under Offer</option>
              <option value="sold">Sold</option>
            </select>
          </div>

          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Price Display <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <input
              type="text"
              value={form.priceDisplay}
              onChange={(e) => set('priceDisplay', e.target.value)}
              placeholder="e.g. $48,000,000 or Price On Application"
              required
              className={fieldClass}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
            />
          </div>

          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Location <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Saint-Jean-Cap-Ferrat"
              required
              className={fieldClass}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
            />
          </div>

          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Country <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="e.g. France"
              required
              className={fieldClass}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Description <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Compelling editorial description of the asset…"
              rows={5}
              required
              className="w-full px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Image URLs (one per line)
            </label>
            <textarea
              value={form.images}
              onChange={(e) => set('images', e.target.value)}
              placeholder="https://images.unsplash.com/photo-example?w=1200&q=85"
              rows={3}
              className="w-full px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Features (comma-separated)
            </label>
            <input
              type="text"
              value={form.features}
              onChange={(e) => set('features', e.target.value)}
              placeholder="Infinity Pool, Private Beach Access, Home Cinema…"
              className={fieldClass}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="featured"
              checked={form.featured}
              onChange={(e) => set('featured', e.target.checked)}
              className="w-4 h-4 cursor-pointer"
              style={{ accentColor: '#C9A84C' }}
            />
            <label htmlFor="featured" className="text-sm cursor-pointer" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              Feature this listing on the homepage
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="px-10 py-4 text-xs tracking-[0.2em] uppercase transition-all disabled:opacity-60"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {loading ? 'Creating…' : 'Create Listing'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-8 py-4 text-xs tracking-[0.2em] uppercase transition-all"
          style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
