'use client'

import { useCallback, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { toast } from 'sonner'
import { X, CheckCircle, CalendarDays, MessageSquare, Loader2 } from 'lucide-react'
import Turnstile from '@/components/auth/Turnstile'
import { whatsappLink } from '@/lib/contact'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { VIEWING_MODES, VIEWING_TIMES, VIEWING_MAX_DAYS } from '@/lib/enquiry'

interface InquiryModalProps {
  listingId: string
  listingTitle: string
  listingPrice?: number | null
}

type Mode = 'enquiry' | 'viewing'

const field = { background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }
const label = 'block text-[11px] tracking-[0.15em] uppercase mb-1.5'
const muted = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const lagosDay = (offset: number) => new Date(Date.now() + 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10)

// Enquire about a listing or ask to view it. Open to everyone: guests pass a
// quick bot check instead of creating an account. The team replies; WhatsApp
// is offered afterwards only as an alternative.
export default function InquiryModal({ listingId, listingTitle }: InquiryModalProps) {
  const { data: session } = useSession()
  const user = session?.user
  const [mode, setMode] = useState<Mode | null>(null)
  useScrollLock(mode !== null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState<Mode | null>(null)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetCaptcha, setResetCaptcha] = useState(0)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', preferredDate: '', preferredTime: 'morning', viewingMode: 'in_person', website: '' })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  function open(m: Mode) {
    setForm((f) => ({
      ...f,
      name: f.name || user?.name || '',
      email: f.email || user?.email || '',
      phone: f.phone || (user as { phone?: string } | undefined)?.phone || '',
      message: f.message || (m === 'viewing' ? `I would like to view ${listingTitle}.` : ''),
    }))
    setSent(null)
    setMode(m)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!mode) return
    setLoading(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, kind: mode, listingId, captcha }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResetCaptcha((n) => n + 1)
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      setSent(mode)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => open('enquiry')}
        className="w-full min-h-12 py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90 flex items-center justify-center gap-2"
        style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
      >
        <MessageSquare size={14} /> Enquire About This Asset
      </button>
      <button
        type="button"
        onClick={() => open('viewing')}
        className="w-full min-h-12 py-4 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2"
        style={{ border: '1px solid rgba(201,168,76,0.45)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
      >
        <CalendarDays size={14} /> Schedule a Viewing
      </button>

      {mode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(8,12,8,0.9)', backdropFilter: 'blur(8px)' }} onClick={() => setMode(null)}>
          <div data-enquiry-form className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={mode === 'viewing' ? 'Schedule a viewing' : 'Enquire'}>
            <div className="flex items-start justify-between gap-3 px-6 py-5" style={{ borderBottom: '1px solid #1e2e1f' }}>
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                  {mode === 'viewing' ? 'Schedule a viewing' : 'Private enquiry'}
                </p>
                <h3 className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                  {listingTitle}
                </h3>
              </div>
              <button type="button" onClick={() => setMode(null)} className="w-11 h-11 inline-flex items-center justify-center shrink-0" style={{ color: '#908673' }} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {sent ? (
              <div className="px-6 py-8 space-y-5 text-center">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-full" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)' }}>
                  <CheckCircle size={20} style={{ color: '#C9A84C' }} />
                </span>
                <p className="text-base" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                  Thank you. {sent === 'viewing' ? 'Your viewing request has been received; a specialist will confirm the time with you shortly.' : 'Your enquiry has been received; a specialist will reply personally, usually within a few hours.'}
                </p>
                <p className="text-xs" style={muted}>
                  A copy is on its way to your email. Prefer to talk now?{' '}
                  <a data-wa-fallback href={whatsappLink(`Hello, I just sent ${sent === 'viewing' ? 'a viewing request' : 'an enquiry'} about "${listingTitle}" on Lux Catalog.`)} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#C9A84C' }}>
                    Message us on WhatsApp
                  </a>
                  .
                </p>
                <button type="button" onClick={() => setMode(null)} className="w-full min-h-11 text-xs tracking-[0.15em] uppercase" style={muted}>
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="px-6 py-5 space-y-4">
                {/* Bots fill this in; people never see it. */}
                <input name="website" value={form.website} onChange={(e) => set('website', e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className={label} style={muted}>Name *</span>
                    <input name="name" required value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full h-11 px-3 text-base sm:text-sm" style={field} />
                  </label>
                  <label className="block">
                    <span className={label} style={muted}>Phone</span>
                    <input name="phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className="w-full h-11 px-3 text-base sm:text-sm" style={field} />
                  </label>
                </div>
                <label className="block">
                  <span className={label} style={muted}>Email *</span>
                  <input name="email" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full h-11 px-3 text-base sm:text-sm" style={field} />
                </label>
                {mode === 'viewing' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="block">
                      <span className={label} style={muted}>Day *</span>
                      <input name="preferredDate" type="date" required min={lagosDay(1)} max={lagosDay(VIEWING_MAX_DAYS)} value={form.preferredDate} onChange={(e) => set('preferredDate', e.target.value)} className="w-full h-11 px-3 text-base sm:text-sm" style={field} />
                    </label>
                    <label className="block">
                      <span className={label} style={muted}>Time *</span>
                      <select name="preferredTime" value={form.preferredTime} onChange={(e) => set('preferredTime', e.target.value)} className="w-full h-11 px-2 text-sm" style={field}>
                        {VIEWING_TIMES.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={label} style={muted}>How *</span>
                      <select name="viewingMode" value={form.viewingMode} onChange={(e) => set('viewingMode', e.target.value)} className="w-full h-11 px-2 text-sm" style={field}>
                        {VIEWING_MODES.map((m) => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <label className="block">
                  <span className={label} style={muted}>{mode === 'viewing' ? 'Anything we should know?' : 'Your message *'}</span>
                  <textarea name="message" required rows={4} value={form.message} onChange={(e) => set('message', e.target.value)} placeholder={mode === 'viewing' ? 'e.g. I am abroad, a video walkthrough would be ideal.' : 'What would you like to know?'} className="w-full px-3 py-2 text-base sm:text-sm resize-y" style={field} />
                </label>
                {!session && <Turnstile onToken={onToken} resetKey={resetCaptcha} />}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-12 text-xs tracking-[0.2em] uppercase inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {mode === 'viewing' ? 'Request viewing' : 'Send enquiry'}
                </button>
                <p className="text-[11px] text-center leading-relaxed" style={muted}>
                  Handled with complete discretion. No account needed.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
