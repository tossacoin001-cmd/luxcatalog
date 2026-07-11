'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { whatsappLink } from '@/lib/contact'
import { MessageCircle } from 'lucide-react'

interface InquiryRow {
  id: string
  name: string
  email: string
  phone: string | null
  message: string
  status: string
  checkIn: string | null
  checkOut: string | null
  createdAt: string
  listing: { title: string; category: string } | null
}

const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
  new: { bg: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: 'rgba(201,168,76,0.3)' },
  in_progress: { bg: 'rgba(200,148,80,0.1)', color: '#c99450', border: 'rgba(200,148,80,0.3)' },
  closed: { bg: 'rgba(116,173,130,0.1)', color: '#74ad82', border: 'rgba(116,173,130,0.3)' },
}

export default function AdminInquiriesTable({ inquiries }: { inquiries: InquiryRow[] }) {
  const router = useRouter()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Status updated.')
      router.refresh()
    } catch {
      toast.error('Failed to update status.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (inquiries.length === 0) {
    return (
      <p className="py-16 text-center text-sm" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
        No enquiries yet. They&rsquo;ll show up here as soon as someone contacts you via the site.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {inquiries.map((inq) => {
        const s = statusStyles[inq.status] ?? statusStyles.new
        return (
          <div key={inq.id} className="p-6" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h3 className="text-base" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                    {inq.name}
                  </h3>
                  <span
                    className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: 'var(--font-inter)' }}
                  >
                    {inq.status.replace('_', ' ')}
                  </span>
                  {inq.listing && (
                    <span className="text-[10px] tracking-wider uppercase" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                      re: {inq.listing.title}
                    </span>
                  )}
                </div>
                <p className="text-xs mb-1" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                  {inq.email} {inq.phone && `· ${inq.phone}`}
                </p>
                {(inq.checkIn || inq.checkOut) && (
                  <p className="text-xs mb-2" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                    {inq.checkIn?.slice(0, 10)} &rarr; {inq.checkOut?.slice(0, 10)}
                  </p>
                )}
                <p className="text-sm leading-relaxed mt-2" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                  {inq.message}
                </p>
                <p className="text-[10px] mt-3" style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}>
                  {new Date(inq.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>

              <div className="flex flex-row md:flex-col gap-2 flex-shrink-0">
                {inq.phone && (
                  <a
                    href={whatsappLink(`Hi ${inq.name}, following up on your enquiry with Lux Catalog.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs tracking-wider uppercase"
                    style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                  >
                    <MessageCircle size={12} /> Reply
                  </a>
                )}
                <select
                  value={inq.status}
                  disabled={updatingId === inq.id}
                  onChange={(e) => updateStatus(inq.id, e.target.value)}
                  className="px-3 py-2 text-xs disabled:opacity-60"
                  style={{ background: '#162318', border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
