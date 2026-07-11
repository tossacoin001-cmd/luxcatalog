'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Phone } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { whatsappLink, PHONE_LINK, PHONE_DISPLAY } from '@/lib/contact'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Thank you. A specialist will be in touch within 24 hours.')
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch {
      toast.error('Something went wrong. Please try again or reach us on WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-12 px-6 md:px-12 text-center" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          Private Consultation
        </p>
        <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          Speak with a Specialist
        </h1>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={whatsappLink("Hello, I'd like to speak with a Lux Catalog specialist.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 text-xs tracking-[0.18em] uppercase transition-all duration-300 hover:opacity-90"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            <MessageCircle size={14} />
            Chat on WhatsApp
          </a>
          <a
            href={PHONE_LINK}
            className="inline-flex items-center gap-2 px-6 py-3 text-xs tracking-[0.18em] uppercase transition-all duration-300"
            style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            <Phone size={14} />
            {PHONE_DISPLAY}
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 md:px-12 py-16">
        <div className="p-8 md:p-10" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Your name', required: true },
                { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+1 555 000 0000', required: false },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                    {f.label} {f.required && <span style={{ color: '#C9A84C' }}>*</span>}
                  </label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    required={f.required}
                    className="w-full h-11 px-4 text-sm focus:outline-none transition-colors"
                    style={{ background: '#162318', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                Email <span style={{ color: '#C9A84C' }}>*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                required
                className="w-full h-11 px-4 text-sm focus:outline-none transition-colors"
                style={{ background: '#162318', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                How Can We Help? <span style={{ color: '#C9A84C' }}>*</span>
              </label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Tell us what you're looking for: asset type, budget, timeline, location…"
                rows={5}
                required
                className="w-full px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
                style={{ background: '#162318', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all disabled:opacity-60"
              style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
            >
              {loading ? 'Sending…' : 'Send Enquiry'}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}>
          All communications are handled with complete discretion. Our specialists respond within 24 hours.
        </p>
      </div>

      <Footer />
    </div>
  )
}
