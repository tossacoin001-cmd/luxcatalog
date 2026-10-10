'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Approve (Paystack Transfer to the partner) or cancel a payout.
export default function PayoutActions({ id, amount, ready }: { id: string; amount: string; ready: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'approve' | 'cancel' | 'mark_paid' | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [manual, setManual] = useState(false)
  const [reason, setReason] = useState('')
  const [txRef, setTxRef] = useState('')

  async function act(action: 'approve' | 'cancel' | 'mark_paid') {
    if (action === 'approve' && !confirm(`Send ${amount} to the partner now?`)) return
    setBusy(action)
    try {
      const res = await fetch(`/api/admin/payouts/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, reason, reference: txRef }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Something went wrong')
      toast.success(action === 'approve' ? 'Transfer sent to Paystack.' : action === 'mark_paid' ? 'Recorded as paid.' : 'Payout cancelled.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
      router.refresh()
    }
  }
  const btn = 'inline-flex items-center justify-center gap-2 min-h-11 px-4 text-[11px] tracking-[0.14em] uppercase disabled:opacity-50'
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!ready || !!busy} onClick={() => act('approve')} className={btn} style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }} title={ready ? undefined : 'The partner needs to add bank details first'}>
          {busy === 'approve' && <Loader2 size={13} className="animate-spin" />} Approve payout
        </button>
        {!manual && (
          <button type="button" onClick={() => setManual(true)} className={btn} style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Mark as paid manually
          </button>
        )}
        {!cancelling && (
          <button type="button" onClick={() => setCancelling(true)} className={btn} style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Cancel payout
          </button>
        )}
      </div>
      {manual && (
        <div className="flex flex-wrap gap-2">
          <input value={txRef} onChange={(e) => setTxRef(e.target.value)} placeholder="Bank transfer reference" className="h-11 px-3 text-sm flex-1 min-w-48" style={{ background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }} />
          <button type="button" disabled={!!busy || txRef.trim().length < 4} onClick={() => act('mark_paid')} className={btn} style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
            {busy === 'mark_paid' && <Loader2 size={13} className="animate-spin" />} Record as paid
          </button>
        </div>
      )}
      {cancelling && (
        <div className="flex flex-wrap gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (kept on record)" className="h-11 px-3 text-sm flex-1 min-w-48" style={{ background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }} />
          <button type="button" disabled={!!busy || reason.trim().length < 5} onClick={() => act('cancel')} className={btn} style={{ border: '1px solid rgba(232,92,76,0.4)', color: '#e8b4b4', fontFamily: 'var(--font-inter)' }}>
            {busy === 'cancel' && <Loader2 size={13} className="animate-spin" />} Confirm cancel
          </button>
        </div>
      )}
    </div>
  )
}
