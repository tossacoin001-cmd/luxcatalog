'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Loader2 } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import Turnstile from '@/components/auth/Turnstile'
import { briefMessage } from '@/lib/enquiry'
import { whatsappLink } from '@/lib/contact'

const field = { background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }
const label = 'block text-[11px] tracking-[0.15em] uppercase mb-1.5'
const muted = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }

// "Tell us what you are looking for": a short request that goes straight to
// the Lux Catalog team (no account needed). WhatsApp is only offered as a
// plain link once the request is sent.
export default function BriefForm({ topic, initialMessage = '', onDone }: { topic: string; initialMessage?: string; onDone?: () => void }) {
  const { data: session } = useSession()
  const user = session?.user
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: initialMessage, website: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetCaptcha, setResetCaptcha] = useState(0)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const name = form.name || user?.name || ''
  const email = form.email || user?.email || ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'brief', name, email, phone: form.phone, message: briefMessage(topic, form.message), website: form.website, captcha }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResetCaptcha((n) => n + 1)
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      setSent(true)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="px-6 py-8 space-y-4 text-center" role="status">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-full" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)' }}>
          <CheckCircle size={20} style={{ color: '#C9A84C' }} />
        </span>
        <p className="text-base" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
          Thank you. A specialist will reply personally, usually within a few hours. A copy is on its way to your email.
        </p>
        <p className="text-xs" style={muted}>
          Prefer to talk now?{' '}
          <a data-wa-fallback href={whatsappLink(`Hello, I just sent a request on Lux Catalog${topic ? ` about: ${topic}` : ''}.`)} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#C9A84C' }}>
            Message us on WhatsApp
          </a>
          .
        </p>
        {onDone && (
          <button type="button" onClick={onDone} className="w-full min-h-11 text-xs tracking-[0.15em] uppercase" style={muted}>
            Close
          </button>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="px-6 py-5 space-y-4">
      {/* Bots fill this in; people never see it. */}
      <input name="website" value={form.website} onChange={(e) => set('website', e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={label} style={muted}>Name *</span>
          <input name="name" required value={name} onChange={(e) => set('name', e.target.value)} className="w-full h-11 px-3 text-base sm:text-sm" style={field} />
        </label>
        <label className="block">
          <span className={label} style={muted}>Phone</span>
          <input name="phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="w-full h-11 px-3 text-base sm:text-sm" style={field} />
        </label>
      </div>
      <label className="block">
        <span className={label} style={muted}>Email *</span>
        <input name="email" type="email" required value={email} onChange={(e) => set('email', e.target.value)} className="w-full h-11 px-3 text-base sm:text-sm" style={field} />
      </label>
      <label className="block">
        <span className={label} style={muted}>What are you looking for? *</span>
        <textarea name="message" required rows={4} value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="Tell us what you need: dates, budget, area, anything that matters." className="w-full px-3 py-2 text-base sm:text-sm resize-y" style={field} />
      </label>
      {!session && <Turnstile onToken={onToken} resetKey={resetCaptcha} />}
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-12 text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center gap-2 disabled:opacity-60"
        style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
      >
        {loading && <Loader2 size={14} className="animate-spin" />} Send request
      </button>
      <p className="text-[11px] text-center leading-relaxed" style={muted}>
        Handled with complete discretion. No account needed.
      </p>
    </form>
  )
}
