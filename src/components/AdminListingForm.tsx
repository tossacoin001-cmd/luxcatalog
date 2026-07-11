'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { categoryLabels } from '@/lib/utils'

const categories = Object.entries(categoryLabels).map(([key, label]) => ({ key, label }))

const inputStyle = {
  background: '#0f1a10',
  border: '1px solid #1e2e1f',
  color: '#f5f0e8',
  fontFamily: 'var(--font-inter)',
}

export interface AdminListingFormValues {
  id?: string
  title: string
  category: string
  description: string
  priceDisplay: string
  price: string
  location: string
  country: string
  images: string[]
  features: string
  status: string
  featured: boolean
  hireAvailable: boolean
  hireRateDisplay: string
}

const emptyForm: AdminListingFormValues = {
  title: '',
  category: 'real_estate',
  description: '',
  priceDisplay: '',
  price: '',
  location: '',
  country: '',
  images: [],
  features: '',
  status: 'available',
  featured: false,
  hireAvailable: false,
  hireRateDisplay: '',
}

export default function AdminListingForm({ listing }: { listing?: AdminListingFormValues }) {
  const router = useRouter()
  const isEdit = !!listing?.id
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState<AdminListingFormValues>(listing ?? emptyForm)

  const set = <K extends keyof AdminListingFormValues>(key: K, val: AdminListingFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const body = new FormData()
        body.append('file', file)
        const res = await fetch('/api/admin/upload', { method: 'POST', body })
        if (!res.ok) throw new Error()
        const data = await res.json()
        uploaded.push(data.url)
      }
      set('images', [...form.images, ...uploaded])
      toast.success(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} uploaded.`)
    } catch {
      toast.error('One or more photos failed to upload. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (url: string) => set('images', form.images.filter((i) => i !== url))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...form,
        features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
      }
      const res = await fetch(
        isEdit ? `/api/admin/listings/${listing!.id}` : '/api/admin/listings',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Listing updated.' : 'Listing created successfully.')
      router.push('/admin/listings')
      router.refresh()
    } catch {
      toast.error(isEdit ? 'Failed to update listing.' : 'Failed to create listing. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = 'w-full h-11 px-4 text-sm focus:outline-none transition-colors'
  const labelClass = 'block text-[10px] tracking-[0.15em] uppercase mb-2'
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'),
    onBlur: (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.borderColor = '#1e2e1f'),
  }

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
              placeholder="e.g. Aqua — Lekki Sailing Apartment"
              required
              className={fieldClass}
              style={inputStyle}
              {...focusHandlers}
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
              Price (NGN)
            </label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              placeholder="e.g. 450000000"
              className={fieldClass}
              style={inputStyle}
              {...focusHandlers}
            />
            <p className="mt-1.5 text-[10px]" style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}>
              Leave blank for &ldquo;Price On Application&rdquo; listings. Powers the NGN/USD toggle and sorting.
            </p>
          </div>

          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Price Display <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <input
              type="text"
              value={form.priceDisplay}
              onChange={(e) => set('priceDisplay', e.target.value)}
              placeholder="e.g. Price On Application (shown when Price NGN is blank)"
              required
              className={fieldClass}
              style={inputStyle}
              {...focusHandlers}
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
              placeholder="e.g. Banana Island, Ikoyi"
              required
              className={fieldClass}
              style={inputStyle}
              {...focusHandlers}
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
              placeholder="e.g. Nigeria"
              required
              className={fieldClass}
              style={inputStyle}
              {...focusHandlers}
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
              {...focusHandlers}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Photos
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:tracking-wider file:uppercase disabled:opacity-60"
              style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
            />
            {uploading && (
              <p className="flex items-center gap-2 mt-2 text-xs" style={{ color: '#9a8f7a' }}>
                <Loader2 size={12} className="animate-spin" /> Uploading…
              </p>
            )}
            {form.images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 md:grid-cols-4 gap-3">
                {form.images.map((url) => (
                  <div key={url} className="relative aspect-square group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(8,12,8,0.8)', color: '#f5f0e8' }}
                      aria-label="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              {...focusHandlers}
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

      {form.category === 'supercar' && (
        <div className="p-8" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-6" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Chauffeur Hire (Lux Drive)
          </p>
          <div className="flex items-center gap-3 mb-5">
            <input
              type="checkbox"
              id="hireAvailable"
              checked={form.hireAvailable}
              onChange={(e) => set('hireAvailable', e.target.checked)}
              className="w-4 h-4 cursor-pointer"
              style={{ accentColor: '#C9A84C' }}
            />
            <label htmlFor="hireAvailable" className="text-sm cursor-pointer" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              Also available for chauffeur-driven hire, independent of sale status
            </label>
          </div>
          {form.hireAvailable && (
            <div>
              <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                Hire Rate Display
              </label>
              <input
                type="text"
                value={form.hireRateDisplay}
                onChange={(e) => set('hireRateDisplay', e.target.value)}
                placeholder="e.g. From ₦350,000 / day"
                className={fieldClass}
                style={inputStyle}
                {...focusHandlers}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading || uploading}
          className="px-10 py-4 text-xs tracking-[0.2em] uppercase transition-all disabled:opacity-60"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {loading ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Listing')}
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
