'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { X, Loader2, Plus } from 'lucide-react'
import { categoryLabels } from '@/lib/utils'

const categories = Object.entries(categoryLabels).map(([key, label]) => ({ key, label }))

const inputStyle = {
  background: '#0f1a10',
  border: '1px solid #1e2e1f',
  color: '#f5f0e8',
  fontFamily: 'var(--font-inter)',
}

interface SpecRow {
  key: string
  value: string
}

// The partner-facing "easiest way" to list a product: the essentials only,
// no status or featured fields, those stay admin-only. Whatever gets
// submitted here is polished by AI and held for admin review before it's
// visible on the public catalog, so this form can stay deliberately loose.
// "Additional Details" is a free-form key/value list rather than fixed
// per-category fields, we don't yet know the exact fields every partner type
// (security, chauffeur, shortlet, decor…) actually needs, so this stays
// flexible until real usage tells us what to hard-code.
export default function QuickListingForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: 'decor',
    description: '',
    price: '',
    location: '',
    country: 'Nigeria',
    images: [] as string[],
    marginRequested: false,
    hireAvailable: false,
    hireRateDisplay: '',
  })
  const [specRows, setSpecRows] = useState<SpecRow[]>([{ key: '', value: '' }])

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const setSpecRow = (i: number, field: keyof SpecRow, val: string) =>
    setSpecRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)))

  const addSpecRow = () => setSpecRows((rows) => [...rows, { key: '', value: '' }])
  const removeSpecRow = (i: number) => setSpecRows((rows) => rows.filter((_, idx) => idx !== i))

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
    if (form.images.length === 0) {
      toast.error('Add at least one photo before submitting.')
      return
    }
    setLoading(true)
    try {
      const specs = Object.fromEntries(
        specRows.filter((r) => r.key.trim() && r.value.trim()).map((r) => [r.key.trim(), r.value.trim()])
      )
      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, specs }),
      })
      if (!res.ok) throw new Error()
      toast.success('Listing submitted. It will go live once our team reviews it.')
      router.push('/admin/listings')
      router.refresh()
    } catch {
      toast.error('Failed to submit listing. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = 'w-full h-11 px-4 text-sm focus:outline-none transition-colors'
  const labelClass = 'block text-[10px] tracking-[0.15em] uppercase mb-2'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div
        className="p-4 text-xs leading-relaxed"
        style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
      >
        Write it however comes naturally, our team polishes the copy and reviews every submission before it appears on the storefront.
      </div>

      <div className="p-8" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              What are you listing? <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Handwoven Silk Rug, Persian Style"
              required
              className={fieldClass}
              style={inputStyle}
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
              Price (NGN)
            </label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
              placeholder="e.g. 850000"
              className={fieldClass}
              style={inputStyle}
            />
            <p className="mt-1.5 text-[10px]" style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}>
              Leave blank if it&rsquo;s price on application.
            </p>
          </div>

          <div>
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Location <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Lekki, Lagos"
              required
              className={fieldClass}
              style={inputStyle}
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
              className={fieldClass}
              style={inputStyle}
            />
          </div>

          <div className="md:col-span-2 flex items-start gap-3 p-4" style={{ background: '#162318' }}>
            <input
              type="checkbox"
              id="marginRequested"
              checked={form.marginRequested}
              onChange={(e) => set('marginRequested', e.target.checked)}
              className="w-4 h-4 cursor-pointer mt-0.5"
              style={{ accentColor: '#C9A84C' }}
            />
            <label htmlFor="marginRequested" className="text-xs leading-relaxed cursor-pointer" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              Add Lux Catalog&rsquo;s margin to this price before it goes live. Leave unchecked if the price above already reflects our agreement.
            </label>
          </div>

          {form.category === 'supercar' && (
            <div className="md:col-span-2 p-5" style={{ background: '#162318' }}>
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="hireAvailable"
                  checked={form.hireAvailable}
                  onChange={(e) => set('hireAvailable', e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                  style={{ accentColor: '#C9A84C' }}
                />
                <label htmlFor="hireAvailable" className="text-sm cursor-pointer" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                  Also available for chauffeur-driven hire
                </label>
              </div>
              {form.hireAvailable && (
                <input
                  type="text"
                  value={form.hireRateDisplay}
                  onChange={(e) => set('hireRateDisplay', e.target.value)}
                  placeholder="e.g. From ₦350,000 / day"
                  className={fieldClass}
                  style={inputStyle}
                />
              )}
            </div>
          )}

          <div className="md:col-span-2">
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Tell us about it <span style={{ color: '#C9A84C' }}>*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Write it in your own words, material, condition, what makes it special…"
              rows={5}
              required
              className="w-full px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
              style={inputStyle}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Additional Details
            </label>
            <div className="space-y-2">
              {specRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => setSpecRow(i, 'key', e.target.value)}
                    placeholder="e.g. Material, Bedrooms, Service Type"
                    className={fieldClass}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => setSpecRow(i, 'value', e.target.value)}
                    placeholder="e.g. Solid Oak, 4, Armed Escort"
                    className={fieldClass}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => removeSpecRow(i)}
                    className="px-3 flex-shrink-0"
                    style={{ color: '#5a5248' }}
                    aria-label="Remove detail"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addSpecRow}
              className="mt-2 flex items-center gap-1.5 text-xs tracking-wider"
              style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              <Plus size={12} /> Add Detail
            </button>
          </div>

          <div className="md:col-span-2">
            <label className={labelClass} style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
              Photos <span style={{ color: '#C9A84C' }}>*</span>
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
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading || uploading}
          className="px-10 py-4 text-xs tracking-[0.2em] uppercase transition-all disabled:opacity-60"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {loading ? 'Submitting…' : 'Submit for Review'}
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
