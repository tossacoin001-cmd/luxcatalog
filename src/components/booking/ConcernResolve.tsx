'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Admin / bookings team: close a guest's concern with a note.
export default function ConcernResolve({ bookingId, concernId }: { bookingId: string; concernId: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function resolve() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'resolve_concern', concernId, note }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not resolve it')
      toast.success('Concern resolved.')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 mt-2">
      <textarea
        name="note"
        rows={1}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="How was it resolved?"
        className="flex-1 px-3 py-2 text-sm resize-y"
        style={{ background: '#f4f0e8', border: '1px solid #d6cfbf', color: '#14130f', fontFamily: 'var(--font-inter)' }}
      />
      <button
        type="button"
        onClick={resolve}
        disabled={busy || note.trim().length < 5}
        className="inline-flex items-center justify-center gap-2 min-h-11 px-4 text-[11px] tracking-[0.14em] uppercase disabled:opacity-50"
        style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
      >
        {busy && <Loader2 size={13} className="animate-spin" />} Mark resolved
      </button>
    </div>
  )
}
