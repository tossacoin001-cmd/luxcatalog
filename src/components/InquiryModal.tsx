'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, ShieldCheck, Lock, CheckCircle, ArrowRight, MessageCircle } from 'lucide-react'
import { whatsappLink } from '@/lib/contact'

interface InquiryModalProps {
  listingId: string
  listingTitle: string
  listingPrice?: number | null
}

export default function InquiryModal({ listingId, listingTitle, listingPrice }: InquiryModalProps) {
  const { isSignedIn, user, isLoaded } = useUser()
  const pathname = usePathname()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reserveLoading, setReserveLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })

  const prefill = () => {
    if (user) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
      const email = user.emailAddresses?.[0]?.emailAddress || ''
      setForm(prev => ({
        name: prev.name || name,
        email: prev.email || email,
        phone: prev.phone || '',
        message: prev.message,
      }))
    }
  }

  const handleOpen = () => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push(`/sign-up?redirect_url=${encodeURIComponent(pathname)}`)
      return
    }
    prefill()
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setSubmitted(false)
  }

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
      setSubmitted(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReserve = async () => {
    setReserveLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, listingTitle, listingPrice }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error()
      }
    } catch {
      toast.error('Unable to initiate payment. Please try again.')
      setReserveLoading(false)
    }
  }

  // Deposit amount display
  const depositAmount = listingPrice
    ? Math.min(Math.max(Math.round(listingPrice * 0.01), 1000), 50000)
    : null
  const depositDisplay = depositAmount
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(depositAmount)
    : null

  return (
    <>
      {/* Enquire button */}
      <button
        onClick={handleOpen}
        className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
        style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
      >
        {!isLoaded || isSignedIn ? null : <Lock size={12} />}
        Enquire About This Asset
      </button>

      {/* Schedule viewing button */}
      <button
        onClick={handleOpen}
        className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300 flex items-center justify-center gap-2"
        style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
      >
        {!isLoaded || isSignedIn ? null : <Lock size={12} />}
        Schedule a Viewing
      </button>

      {/* Auth notice for guests */}
      {isLoaded && !isSignedIn && (
        <p className="text-[10px] text-center" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
          <button
            onClick={() => router.push(`/sign-up?redirect_url=${encodeURIComponent(pathname)}`)}
            className="underline cursor-pointer hover:opacity-80"
            style={{ color: '#C9A84C' }}
          >
            Create a free account
          </button>{' '}
          to enquire or reserve this asset
        </p>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(8,12,8,0.9)', backdropFilter: 'blur(8px)' }}
          onClick={handleClose}
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
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                    {submitted ? 'Enquiry Submitted' : 'Private Enquiry'}
                  </p>
                  {isSignedIn && (
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 text-[9px] tracking-widest uppercase"
                      style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                    >
                      <ShieldCheck size={9} />
                      Verified
                    </span>
                  )}
                </div>
                <h3 className="text-base" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                  {listingTitle}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="p-1 hover:opacity-60 transition-opacity"
                style={{ color: '#5a5248' }}
              >
                <X size={18} />
              </button>
            </div>

            {submitted ? (
              /* ── Success state ── */
              <div className="px-7 py-8 space-y-6">
                <div className="text-center space-y-3">
                  <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full mx-auto"
                    style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)' }}
                  >
                    <CheckCircle size={20} style={{ color: '#C9A84C' }} />
                  </div>
                  <p className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                    Your enquiry has been received. A specialist will respond within 24 hours.
                  </p>
                </div>

                <a
                  href={whatsappLink(`Hello, I just submitted an enquiry about "${listingTitle}" on Lux Catalog.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 text-xs tracking-[0.18em] uppercase transition-all duration-300 flex items-center justify-center gap-2"
                  style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                >
                  <MessageCircle size={13} />
                  Continue on WhatsApp
                </a>

                {depositDisplay && (
                  <>
                    <div style={{ height: 1, background: '#1e2e1f' }} />

                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                          Reserve This Asset
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                          Secure this listing with a fully refundable holding deposit of{' '}
                          <span style={{ color: '#f5f0e8' }}>{depositDisplay}</span>.
                          Your asset is held for 7 days while we complete due diligence.
                        </p>
                      </div>

                      <button
                        onClick={handleReserve}
                        disabled={reserveLoading}
                        className="w-full py-4 text-xs tracking-[0.2em] uppercase transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ border: '1px solid rgba(201,168,76,0.5)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                      >
                        {reserveLoading ? 'Redirecting…' : (
                          <>
                            Pay Holding Deposit · {depositDisplay}
                            <ArrowRight size={12} />
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-center" style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}>
                        Secured via Stripe · Fully refundable · No obligation to proceed
                      </p>
                    </div>
                  </>
                )}

                <button
                  onClick={handleClose}
                  className="w-full py-3 text-xs tracking-[0.15em] uppercase hover:opacity-70 transition-opacity"
                  style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}
                >
                  Close
                </button>
              </div>
            ) : (
              /* ── Enquiry form ── */
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
            )}
          </div>
        </div>
      )}
    </>
  )
}
