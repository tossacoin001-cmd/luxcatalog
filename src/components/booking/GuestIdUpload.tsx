'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, IdCard, Loader2 } from 'lucide-react'

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const MAX = 4 * 1024 * 1024

// Large phone photos are scaled down in the browser before upload so they
// stay under the 4MB limit and upload quickly on mobile data.
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 3.5 * 1024 * 1024 || file.type === 'image/heic' || file.type === 'image/heif') return file
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 2400 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
}

export default function GuestIdUpload({ reference, uploaded }: { reference: string; uploaded: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function upload(original: File) {
    setBusy(true)
    try {
      const file = await shrink(original)
      if (file.size > MAX) throw new Error('That file is too large. Please use a photo under 4MB.')
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`/api/bookings/${reference}/guest-id`, { method: 'POST', body })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Upload failed. Please try again.')
      toast.success('ID received. Thank you.')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <section className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: '#0f1a10', border: `1px solid ${uploaded ? 'rgba(111,191,115,0.35)' : 'rgba(201,168,76,0.35)'}` }}>
      <div className="flex items-start gap-3">
        {uploaded ? <CheckCircle2 size={20} className="mt-0.5 shrink-0" style={{ color: '#6fbf73' }} /> : <IdCard size={20} className="mt-0.5 shrink-0" style={{ color: '#C9A84C' }} />}
        <div>
          <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
            {uploaded ? 'ID received' : 'Add your ID before arrival'}
          </p>
          <p className="text-xs leading-relaxed" style={text}>
            {uploaded
              ? 'Only your host and our bookings team can see it. You can replace it any time.'
              : 'A passport, driver’s licence or national ID. Stored privately; only your host and our bookings team can see it.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="shrink-0 inline-flex items-center justify-center gap-2 min-h-11 px-5 text-[11px] tracking-[0.14em] uppercase disabled:opacity-50"
        style={uploaded ? { border: '1px solid #1e2e1f', ...text } : { background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
      >
        {busy && <Loader2 size={13} className="animate-spin" />} {uploaded ? 'Replace' : 'Upload ID'}
      </button>
      <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </section>
  )
}
