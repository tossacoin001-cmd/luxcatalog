'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { whatsappLink } from '@/lib/contact'
import { MessageCircle, Trash2 } from 'lucide-react'
import { viewingModeLabel, viewingTimeLabel } from '@/lib/enquiry'
import { useConfirm } from '@/components/ConfirmProvider'

interface InquiryRow {
  id: string
  name: string
  email: string
  phone: string | null
  message: string
  status: string
  checkIn: string | null
  checkOut: string | null
  kind: string
  preferredDate: string | null
  preferredTime: string | null
  viewingMode: string | null
  createdAt: string
  listing: { title: string; category: string } | null
}

const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
  new: { bg: 'rgba(122,92,36,0.06)', color: '#7a5c24', border: 'rgba(20,19,15,0.15)' },
  in_progress: { bg: 'rgba(200,148,80,0.1)', color: '#7a5c24', border: 'rgba(200,148,80,0.3)' },
  closed: { bg: 'rgba(116,173,130,0.1)', color: '#2f6b45', border: 'rgba(116,173,130,0.3)' },
}

export default function AdminInquiriesTable({ inquiries, canDelete = false }: { inquiries: InquiryRow[]; canDelete?: boolean }) {
  const router = useRouter()
  const confirm = useConfirm()
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

  const closedCount = inquiries.filter((i) => i.status === 'closed').length

  const remove = async (body: { ids: string[] } | { status: 'closed' }, question: { title: string; body: string; yes: string }) => {
    if (!(await confirm({ ...question, no: 'Keep them' }))) return
    try {
      const res = await fetch('/api/admin/inquiries', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error()
      const d = await res.json().catch(() => ({}))
      toast.success(d.deleted === 1 ? 'Enquiry deleted.' : `${d.deleted ?? 'The'} enquiries deleted.`)
      router.refresh()
    } catch {
      toast.error('Could not delete. Please try again.')
    }
  }

  if (inquiries.length === 0) {
    return (
      <p className="py-16 text-center text-sm" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
        No enquiries yet. They&rsquo;ll show up here as soon as someone contacts you via the site.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {canDelete && closedCount > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            data-delete-closed
            onClick={() =>
              remove({ status: 'closed' }, { title: `Delete ${closedCount} closed enquir${closedCount === 1 ? 'y' : 'ies'}?`, body: 'Closed enquiries are erased for good. New and in-progress ones are kept.', yes: 'Delete closed' })
            }
            className="inline-flex items-center gap-2 min-h-11 px-4 text-xs tracking-[0.14em] uppercase"
            style={{ border: '1px solid #c4bcaa', color: '#8a3b2e', fontFamily: 'var(--font-inter)' }}
          >
            <Trash2 size={13} /> Delete closed ({closedCount})
          </button>
        </div>
      )}
      {inquiries.map((inq) => {
        const s = statusStyles[inq.status] ?? statusStyles.new
        return (
          <div key={inq.id} data-enquiry-row={inq.id} className="p-6" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h3 className="text-base" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                    {inq.name}
                  </h3>
                  <span
                    className="text-[11px] tracking-[0.15em] uppercase px-2.5 py-1"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: 'var(--font-inter)' }}
                  >
                    {inq.status.replace('_', ' ')}
                  </span>
                  {inq.listing && (
                    <span className="text-[11px] tracking-wider uppercase" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                      re: {inq.listing.title}
                    </span>
                  )}
                </div>
                <p className="text-xs mb-1" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                  {inq.email} {inq.phone && `· ${inq.phone}`}
                </p>
                {inq.kind === 'brief' && (
                  <p className="text-xs mb-2" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                    Request (not tied to a listing)
                  </p>
                )}
                {inq.kind === 'viewing' && inq.preferredDate && (
                  <p className="text-xs mb-2" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                    Viewing request:{' '}
                    {new Date(inq.preferredDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} · {viewingTimeLabel(inq.preferredTime)} · {viewingModeLabel(inq.viewingMode)}
                  </p>
                )}
                {(inq.checkIn || inq.checkOut) && (
                  <p className="text-xs mb-2" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                    {inq.checkIn?.slice(0, 10)} &rarr; {inq.checkOut?.slice(0, 10)}
                  </p>
                )}
                <p className="text-sm leading-relaxed mt-2" style={{ color: '#14130f', fontFamily: 'var(--font-inter)' }}>
                  {inq.message}
                </p>
                <p className="text-[11px] mt-3" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
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
                    style={{ border: '1px solid rgba(20,19,15,0.15)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
                  >
                    <MessageCircle size={12} /> Reply
                  </a>
                )}
                <select
                  value={inq.status}
                  disabled={updatingId === inq.id}
                  onChange={(e) => updateStatus(inq.id, e.target.value)}
                  className="px-3 py-2 text-xs disabled:opacity-60"
                  style={{ background: '#ece6d9', border: '1px solid #d6cfbf', color: '#5e584c', fontFamily: 'var(--font-inter)' }}
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
                {canDelete && (
                  <button
                    type="button"
                    data-delete-enquiry
                    aria-label={`Delete the enquiry from ${inq.name}`}
                    onClick={() => remove({ ids: [inq.id] }, { title: `Delete the enquiry from ${inq.name}?`, body: 'It is erased for good.', yes: 'Delete' })}
                    className="inline-flex items-center justify-center gap-2 min-h-11 px-3 text-xs tracking-wider uppercase"
                    style={{ border: '1px solid #d6cfbf', color: '#8a3b2e', fontFamily: 'var(--font-inter)' }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
