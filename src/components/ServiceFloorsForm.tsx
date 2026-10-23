'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type Floor = { key: string; label: string; minPrice: number; custom: boolean }

const text = { color: '#5e584c', fontFamily: 'var(--font-inter)' }
const digits = (v: string) => v.replace(/\D/g, '')
const show = (v: string) => (v ? Number(v).toLocaleString('en-NG') : '')

// One amount per service; saves only the ones that changed.
export default function ServiceFloorsForm({ floors, defaults }: { floors: Floor[]; defaults: Record<string, number> }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(floors.map((f) => [f.key, String(f.minPrice)])))
  const [busy, setBusy] = useState(false)
  const changed = floors.filter((f) => values[f.key] !== String(f.minPrice))

  async function save() {
    if (!changed.length) return
    if (changed.some((f) => values[f.key] === '')) return toast.error('Every service needs a floor (it can be 0).')
    setBusy(true)
    try {
      const res = await fetch('/api/admin/service-floors', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ floors: Object.fromEntries(changed.map((f) => [f.key, Number(values[f.key])])) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the floors.')
      toast.success('Price floors saved.')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <ul style={{ border: '1px solid #d6cfbf' }}>
        {floors.map((f, i) => (
          <li key={f.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-6 p-4" style={{ background: '#fbf9f4', borderTop: i ? '1px solid #d6cfbf' : undefined }}>
            <label htmlFor={`floor-${f.key}`} className="min-w-0">
              <span className="block text-sm" style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}>
                {f.label}
              </span>
              <span className="block text-xs" style={text}>
                {f.key === 'private_chef' ? 'Per guest. ' : ''}Default ₦{defaults[f.key].toLocaleString('en-NG')}
              </span>
            </label>
            <div className="flex items-center shrink-0 w-full sm:w-48" style={{ border: '1px solid #d6cfbf', background: '#f4f0e8' }}>
              <span className="pl-3 text-sm" style={text}>
                ₦
              </span>
              <input
                id={`floor-${f.key}`}
                data-floor={f.key}
                inputMode="numeric"
                value={show(values[f.key])}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: digits(e.target.value) }))}
                className="w-full h-11 px-2 text-sm bg-transparent focus:outline-none"
                style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}
              />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={save}
        disabled={busy || !changed.length}
        className="inline-flex items-center justify-center gap-2 min-h-12 px-8 w-full sm:w-auto text-xs tracking-[0.18em] uppercase disabled:opacity-50"
        style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
      >
        {busy && <Loader2 size={14} className="animate-spin" />} Save floors{changed.length ? ` (${changed.length})` : ''}
      </button>
    </div>
  )
}
