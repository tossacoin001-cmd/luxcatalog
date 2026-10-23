'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const text = { color: '#5e584c', fontFamily: 'var(--font-inter)' }
const inputStyle = { background: '#f4f0e8', border: '1px solid #d6cfbf', color: '#14130f', fontFamily: 'var(--font-inter)' }
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`

// Per-booking actions in the admin/partner Bookings list.
export default function BookingActions({
  id,
  canCancel,
  canRespond = false,
  canClaim,
  canDecide,
  deposit,
  claim,
}: {
  id: string
  canCancel: boolean
  canRespond?: boolean
  canClaim: boolean
  canDecide: boolean
  deposit: number
  claim: { amount: number; note: string } | null
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'cancel' | 'claim' | 'decline' | null>(null)
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [keep, setKeep] = useState(claim ? String(claim.amount) : '')
  const [busy, setBusy] = useState(false)

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      toast.success(ok)
      setMode(null)
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const btn = 'inline-flex items-center justify-center gap-2 min-h-11 px-4 text-[11px] tracking-[0.14em] uppercase disabled:opacity-50'
  return (
    <div className="space-y-3">
      {canDecide && claim && (
        <div className="p-3 space-y-2" style={{ border: '1px solid rgba(122,92,36,0.35)', background: 'rgba(122,92,36,0.06)' }}>
          <p className="text-sm" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            Damage claim: {naira(claim.amount)} of {naira(deposit)}. &ldquo;{claim.note}&rdquo;
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs" style={text}>
              Keep (₦)
              <input value={keep} onChange={(e) => setKeep(e.target.value)} inputMode="numeric" className="block mt-1 h-11 px-3 w-36 text-sm" style={inputStyle} />
            </label>
            <button type="button" disabled={busy} onClick={() => act({ action: 'decide_claim', keep: Number(keep) || 0 }, 'Claim decided. Any refund is in the queue.')} className={btn} style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}>
              {busy && <Loader2 size={13} className="animate-spin" />} Decide claim
            </button>
          </div>
          <p className="text-xs" style={text}>
            The rest of the deposit is refunded to the guest (after approval in Refunds).
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canRespond && (
          <>
            <button type="button" disabled={busy} onClick={() => act({ action: 'accept' }, 'Accepted. The guest has been asked to pay.')} className={btn} style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}>
              {busy && <Loader2 size={13} className="animate-spin" />} Accept request
            </button>
            {mode !== 'decline' && (
              <button type="button" onClick={() => setMode('decline')} className={btn} style={{ border: '1px solid #d6cfbf', ...text }}>
                Decline
              </button>
            )}
          </>
        )}
        {canCancel && mode !== 'cancel' && (
          <button type="button" onClick={() => setMode('cancel')} className={btn} style={{ border: '1px solid rgba(138,59,46,0.4)', color: '#8a3b2e', fontFamily: 'var(--font-inter)' }}>
            Cancel booking
          </button>
        )}
        {canClaim && mode !== 'claim' && (
          <button type="button" onClick={() => setMode('claim')} className={btn} style={{ border: '1px solid rgba(20,19,15,0.20)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
            Report damage
          </button>
        )}
      </div>
      {mode === 'decline' && (
        <div className="space-y-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Short reason for the guest, e.g. Already booked privately" className="w-full h-11 px-3 text-sm" style={inputStyle} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => act({ action: 'decline', reason }, 'Declined. The guest has been told.')} className={btn} style={{ border: '1px solid rgba(138,59,46,0.4)', color: '#8a3b2e', fontFamily: 'var(--font-inter)' }}>
              {busy && <Loader2 size={13} className="animate-spin" />} Decline request
            </button>
            <button type="button" onClick={() => setMode(null)} className={btn} style={{ border: '1px solid #d6cfbf', ...text }}>
              Back
            </button>
          </div>
        </div>
      )}
      {mode === 'cancel' && (
        <div className="space-y-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (the guest sees this). They get a full refund." className="w-full p-3 text-sm" style={inputStyle} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => act({ action: 'cancel', reason }, 'Cancelled. The full refund is in the queue.')} className={btn} style={{ background: '#8a3b2e', color: '#fff', fontFamily: 'var(--font-inter)' }}>
              {busy && <Loader2 size={13} className="animate-spin" />} Cancel and refund in full
            </button>
            <button type="button" onClick={() => setMode(null)} className={btn} style={{ border: '1px solid #d6cfbf', ...text }}>
              Back
            </button>
          </div>
        </div>
      )}
      {mode === 'claim' && (
        <div className="space-y-2">
          <label className="text-xs block" style={text}>
            Amount to keep from the {naira(deposit)} deposit (₦)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className="block mt-1 h-11 px-3 w-40 text-sm" style={inputStyle} />
          </label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="What was damaged, and what it costs to put right. Keep photos and receipts ready." className="w-full p-3 text-sm" style={inputStyle} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !(Number(amount) > 0) || reason.trim().length < 10} onClick={() => act({ action: 'claim', amount: Number(amount), note: reason }, 'Claim sent. Our team will decide it.')} className={btn} style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}>
              {busy && <Loader2 size={13} className="animate-spin" />} Send claim
            </button>
            <button type="button" onClick={() => setMode(null)} className={btn} style={{ border: '1px solid #d6cfbf', ...text }}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
