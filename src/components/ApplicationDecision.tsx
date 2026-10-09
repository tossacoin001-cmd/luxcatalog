'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const box = { background: '#0f1a10', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }

// Approve / ask for more / reject, plus private admin notes. The note for the
// applicant is required when asking for more information or rejecting, so
// nobody receives an unexplained decision.
export default function ApplicationDecision({ id, status, internalNote }: { id: string; status: string; internalNote: string }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [internal, setInternal] = useState(internalNote)
  const [busy, setBusy] = useState<string | null>(null)
  const decided = status === 'approved' || status === 'rejected'

  async function act(action: 'approve' | 'request_info' | 'reject' | 'note') {
    if ((action === 'request_info' || action === 'reject') && !note.trim()) {
      return toast.error(action === 'reject' ? 'Give the applicant a reason.' : 'Say what you need from them.')
    }
    if (action === 'approve' && !confirm('Approve this partner? They will be able to submit listings.')) return
    if (action === 'reject' && !confirm('Reject this application? The applicant will be emailed your reason.')) return
    setBusy(action)
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: action === 'note' ? internal : note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(action === 'note' ? 'Note saved.' : action === 'approve' ? 'Approved. Welcome email sent.' : 'Decision sent to the applicant.')
      setNote('')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message || 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  const btn = 'w-full inline-flex items-center justify-center gap-2 min-h-12 text-xs tracking-[0.16em] uppercase disabled:opacity-50'

  return (
    <div className="p-5 space-y-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
      <p className="text-xs tracking-[0.16em] uppercase" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
        Decision
      </p>
      {decided ? (
        <p className="text-sm" style={text}>
          This application was {status}. You can still approve it later if circumstances change.
        </p>
      ) : (
        <label className="block">
          <span className="block text-xs mb-2" style={text}>
            Message to the applicant (needed to ask for more or reject)
          </span>
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-3 py-2 text-sm focus:outline-none resize-y" style={box} />
        </label>
      )}
      <div className="space-y-2">
        {status !== 'approved' && (
          <button type="button" onClick={() => act('approve')} disabled={!!busy} className={btn} style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
            {busy === 'approve' && <Loader2 size={14} className="animate-spin" />} Approve partner
          </button>
        )}
        {!decided && (
          <>
            <button type="button" onClick={() => act('request_info')} disabled={!!busy} className={btn} style={{ border: '1px solid rgba(232,168,76,0.5)', color: '#e8a84c', fontFamily: 'var(--font-inter)' }}>
              {busy === 'request_info' && <Loader2 size={14} className="animate-spin" />} Request more info
            </button>
            <button type="button" onClick={() => act('reject')} disabled={!!busy} className={btn} style={{ border: '1px solid rgba(232,92,76,0.4)', color: '#e85c4c', fontFamily: 'var(--font-inter)' }}>
              {busy === 'reject' && <Loader2 size={14} className="animate-spin" />} Reject
            </button>
          </>
        )}
      </div>
      <label className="block pt-2" style={{ borderTop: '1px solid #1e2e1f' }}>
        <span className="block text-xs my-2" style={text}>
          Private admin notes (never shown to the applicant)
        </span>
        <textarea rows={3} value={internal} onChange={(e) => setInternal(e.target.value)} className="w-full px-3 py-2 text-sm focus:outline-none resize-y" style={box} />
      </label>
      <button type="button" onClick={() => act('note')} disabled={!!busy} className={btn} style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
        Save note
      </button>
    </div>
  )
}
