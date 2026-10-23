'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Phone } from 'lucide-react'
import Turnstile from '@/components/auth/Turnstile'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { whatsappLink, PHONE_LINK, PHONE_DISPLAY } from '@/lib/contact'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' })
  const [loading, setLoading] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetCaptcha, setResetCaptcha] = useState(0)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, captcha }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResetCaptcha((n) => n + 1)
        throw new Error(data.error || 'Something went wrong. Please try again.')
      }
      toast.success('Thank you. A specialist will be in touch shortly.')
      setForm({ name: '', email: '', phone: '', message: '', website: '' })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-12 px-6 md:px-12 text-center" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
        <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
          Private Consultation
        </p>
        <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
          Speak with a Specialist
        </h1>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">

          <a
            href={PHONE_LINK}
            className="inline-flex items-center gap-2 px-6 py-3 text-xs tracking-[0.18em] uppercase transition-all duration-300"
            style={{ border: '1px solid rgba(20,19,15,0.15)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
          >
            <Phone size={14} />
            {PHONE_DISPLAY}
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 md:px-12 py-16">
        <div className="p-8 md:p-10" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Bots fill this in; people never see it. */}
            <input name="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Your name', required: true },
                { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+234 800 000 0000', required: false },
              ].map((f) => (
                <div key={f.key}>
                  <label htmlFor={`contact-${f.key}`} className="block text-[11px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                    {f.label} {f.required && <span style={{ color: '#7a5c24' }}>*</span>}
                  </label>
                  <input
                    id={`contact-${f.key}`}
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    required={f.required}
                    className="w-full h-11 px-4 text-sm focus:outline-none transition-colors"
                    style={{ background: '#ece6d9', border: '1px solid #d6cfbf', color: '#14130f', fontFamily: 'var(--font-inter)' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#14130f')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#d6cfbf')}
                  />
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-[11px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                Email <span style={{ color: '#7a5c24' }}>*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                required
                className="w-full h-11 px-4 text-sm focus:outline-none transition-colors"
                style={{ background: '#ece6d9', border: '1px solid #d6cfbf', color: '#14130f', fontFamily: 'var(--font-inter)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#14130f')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#d6cfbf')}
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-[11px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                How Can We Help? <span style={{ color: '#7a5c24' }}>*</span>
              </label>
              <textarea
                id="contact-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us what you're looking for: asset type, budget, timeline, location…"
                rows={5}
                required
                className="w-full px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
                style={{ background: '#ece6d9', border: '1px solid #d6cfbf', color: '#14130f', fontFamily: 'var(--font-inter)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#14130f')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#d6cfbf')}
              />
            </div>

            <Turnstile onToken={onToken} resetKey={resetCaptcha} />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all disabled:opacity-60"
              style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
            >
              {loading ? 'Sending…' : 'Send Enquiry'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
          All communications are handled with complete discretion. Prefer WhatsApp?{' '}
          <a data-wa-fallback href={whatsappLink("Hello, I'd like to speak with a Lux Catalog specialist.")} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#5e584c' }}>
            Message us there
          </a>
          .
        </p>
      </div>

      <Footer />
    </div>
  )
}
