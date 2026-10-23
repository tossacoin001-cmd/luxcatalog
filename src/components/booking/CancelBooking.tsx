'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const text = { color: '#5e584c', fontFamily: 'var(--font-inter)' }
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`

// Guest-side cancellation: shows exactly what comes back before confirming.
export default function CancelBooking({
  reference,
  quote,
  session = false,
}: {
  reference: string
  quote: { share: number; stay: number; cleaning: number; deposit: number; refund: number; kept: number }
  // Private Services: "Session" and "Travel" instead of "Stay" and "Cleaning".
  session?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function cancel() {
    setBusy(true)
    try {
      const res = await fetch(`/api/bookings/${reference}/cancel`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not cancel. Please try again.')
      toast.success(data.refund > 0 ? `Cancelled. ${naira(data.refund)} will be refunded.` : 'Cancelled.')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs underline underline-offset-2 min-h-11" style={text}>
        Cancel this booking{quote.refund > 0 ? `: ${naira(quote.refund)} back` : ''}
      </button>
    )
  }
  return (
    <section className="self-stretch p-5 space-y-3" style={{ border: '1px solid rgba(138,59,46,0.35)', background: 'rgba(138,59,46,0.05)' }}>
      <p className="text-base" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
        Cancel your booking?
      </p>
      <dl className="text-sm space-y-1" style={{ fontFamily: 'var(--font-inter)' }}>
        <Row k={`${session ? 'Session' : 'Stay'} (${Math.round(quote.share * 100)}% back under the policy)`} v={naira(quote.stay)} />
        {quote.cleaning > 0 && <Row k={session ? 'Travel' : 'Cleaning'} v={naira(quote.cleaning)} />}
        {quote.deposit > 0 && <Row k="Caution deposit" v={naira(quote.deposit)} />}
        <div className="pt-1" style={{ borderTop: '1px solid #d6cfbf' }}>
          <Row k="You get back" v={naira(quote.refund)} strong />
        </div>
        {quote.kept > 0 && <Row k="Not refundable" v={naira(quote.kept)} />}
      </dl>
      <p className="text-xs" style={text}>
        Refunds go back to the card or account you paid with, usually within 5 to 10 working days after we approve them.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-5 text-xs tracking-[0.14em] uppercase disabled:opacity-50"
          style={{ background: '#8a3b2e', color: '#fff', fontFamily: 'var(--font-inter)' }}
        >
          {busy && <Loader2 size={14} className="animate-spin" />} Yes, cancel
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-5 text-xs tracking-[0.14em] uppercase" style={{ border: '1px solid #d6cfbf', ...text }}>
          Keep my booking
        </button>
      </div>
    </section>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: '#5e584c' }}>{k}</dt>
      <dd style={{ color: strong ? '#14130f' : '#3a362d', fontWeight: strong ? 600 : 400 }}>{v}</dd>
    </div>
  )
}
