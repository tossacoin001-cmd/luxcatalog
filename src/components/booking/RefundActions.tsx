'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Approve (sends the money back through Paystack) or reject a refund.
export default function RefundActions({ id, amount }: { id: string; amount: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  async function act(action: 'approve' | 'reject') {
    if (action === 'approve' && !confirm(`Send ${amount} back to the guest through Paystack?`)) return
    setBusy(action)
    try {
      const res = await fetch(`/api/admin/refunds/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, reason }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      toast.success(action === 'approve' ? 'Refund sent to Paystack.' : 'Refund rejected.')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const btn = 'inline-flex items-center justify-center gap-2 min-h-11 px-4 text-[11px] tracking-[0.14em] uppercase disabled:opacity-50'
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!busy} onClick={() => act('approve')} className={btn} style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
          {busy === 'approve' && <Loader2 size={13} className="animate-spin" />} Approve refund
        </button>
        {!rejecting && (
          <button type="button" onClick={() => setRejecting(true)} className={btn} style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Reject
          </button>
        )}
      </div>
      {rejecting && (
        <div className="flex flex-wrap gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (kept on record)" className="h-11 px-3 text-sm flex-1 min-w-48" style={{ background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }} />
          <button type="button" disabled={!!busy || reason.trim().length < 5} onClick={() => act('reject')} className={btn} style={{ border: '1px solid rgba(232,92,76,0.4)', color: '#e8b4b4', fontFamily: 'var(--font-inter)' }}>
            {busy === 'reject' && <Loader2 size={13} className="animate-spin" />} Confirm reject
          </button>
        </div>
      )}
    </div>
  )
}
