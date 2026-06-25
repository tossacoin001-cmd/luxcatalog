'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'

interface InquiryModalProps {
  listingId: string
  listingTitle: string
}

export default function InquiryModal({ listingId, listingTitle }: InquiryModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill in all required fields.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, listingId }),
      })
      if (!res.ok) throw new Error()
      toast.success('Enquiry submitted. Our team will be in touch within 24 hours.')
      setOpen(false)
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90 active:scale-95"
        style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
      >
        Enquire About This Asset
      </button>

      <button
        onClick={() => setOpen(true)}
        className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300"
        style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
      >
        Schedule a Viewing
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(8,12,8,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg"
            style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-7 py-5"
              style={{ borderBottom: '1px solid #1e2e1f' }}
            >
              <div>
                <p className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                  Private Enquiry
                </p>
                <h3 className="text-base" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                  {listingTitle}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:opacity-60 transition-opacity"
                style={{ color: '#5a5248' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                    Full Name <span style={{ color: '#C9A84C' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                    className="w-full h-10 px-4 text-sm focus:outline-none transition-colors"
                    style={{ background: '#162318', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 555 000 0000"
                    className="w-full h-10 px-4 text-sm focus:outline-none transition-colors"
                    style={{ background: '#162318', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
                  />
                </div>
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
                  className="w-full h-10 px-4 text-sm focus:outline-none transition-colors"
                  style={{ background: '#162318', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
                />
              </div>

              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                  Message <span style={{ color: '#C9A84C' }}>*</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder={`I'm interested in ${listingTitle}. Please contact me to discuss further.`}
                  rows={4}
                  className="w-full px-4 py-3 text-sm focus:outline-none transition-colors resize-none"
                  style={{ background: '#162318', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#1e2e1f')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300 disabled:opacity-60"
                style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
              >
                {loading ? 'Sending…' : 'Submit Enquiry'}
              </button>

              <p className="text-[10px] text-center" style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}>
                All enquiries are treated with absolute discretion.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
