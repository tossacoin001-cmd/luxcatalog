'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, MessageSquareWarning } from 'lucide-react'
import { CONCERN_KINDS } from '@/lib/aftercare'

const text = { color: '#5e584c', fontFamily: 'var(--font-inter)' }
const field = { background: '#f4f0e8', border: '1px solid #d6cfbf', color: '#14130f', fontFamily: 'var(--font-inter)' }

// Guest: tell Lux Catalog something went wrong. Reaches our team only.
export default function ReportConcern({ reference }: { reference: string }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const res = await fetch(`/api/bookings/${reference}/concern`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, message }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not send your report. Please try again or message us.')
      setDone(true)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p className="self-stretch flex items-start gap-2 p-4 text-sm" role="status" style={{ background: 'rgba(47,107,69,0.08)', color: '#2f6b45', fontFamily: 'var(--font-inter)' }}>
        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
        <span>Thank you. We’ve received your report and our team will contact you shortly.</span>
      </p>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 min-h-11 text-xs underline underline-offset-2" style={text}>
        <MessageSquareWarning size={14} /> Report a concern
      </button>
    )
  }
  return (
    <section className="self-stretch p-5 space-y-3" style={{ background: '#fbf9f4', border: '1px solid rgba(122,92,36,0.35)' }}>
      <p className="text-base" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
        Report a concern
      </p>
      <p className="text-xs leading-relaxed" style={text}>
        Your report goes straight to the Lux Catalog team, not to the professional or host. If you are in danger, call 112 first.
      </p>
      <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="w-full h-11 px-3 text-sm" style={field}>
        <option value="">What is it about?</option>
        {CONCERN_KINDS.map((k) => (
          <option key={k.key} value={k.key}>
            {k.label}
          </option>
        ))}
      </select>
      <textarea name="message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What happened?" className="w-full px-3 py-2 text-base md:text-sm resize-y" style={field} />
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !kind || message.trim().length < 10}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-5 text-xs tracking-[0.14em] uppercase disabled:opacity-50"
          style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
        >
          {busy && <Loader2 size={14} className="animate-spin" />} Send report
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-5 text-xs tracking-[0.14em] uppercase" style={{ border: '1px solid #d6cfbf', ...text }}>
          Cancel
        </button>
      </div>
    </section>
  )
}
