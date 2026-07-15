'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface OrderRow {
  id: string
  email: string
  phone: string | null
  total: number
  currency: string
  status: string
  shippingName: string
  shippingAddress: string
  shippingCity: string
  shippingState: string
  createdAt: string
  items: { titleSnapshot: string; quantity: number; priceSnapshot: number }[]
}

const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
  pending: { bg: 'rgba(200,148,80,0.1)', color: '#c99450', border: 'rgba(200,148,80,0.3)' },
  paid: { bg: 'rgba(201,168,76,0.1)', color: '#C9A84C', border: 'rgba(201,168,76,0.3)' },
  fulfilled: { bg: 'rgba(116,173,130,0.1)', color: '#74ad82', border: 'rgba(116,173,130,0.3)' },
  cancelled: { bg: 'rgba(211,105,95,0.1)', color: '#d3695f', border: 'rgba(211,105,95,0.3)' },
}

export default function AdminOrdersTable({ orders }: { orders: OrderRow[] }) {
  const router = useRouter()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Order updated.')
      router.refresh()
    } catch {
      toast.error('Failed to update order.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (orders.length === 0) {
    return (
      <p className="py-16 text-center text-sm" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
        No orders yet.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const s = statusStyles[order.status] ?? statusStyles.pending
        return (
          <div key={order.id} className="p-6" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h3 className="text-base" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                    {order.shippingName}
                  </h3>
                  <span
                    className="text-[10px] tracking-[0.15em] uppercase px-2.5 py-1"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontFamily: 'var(--font-inter)' }}
                  >
                    {order.status}
                  </span>
                </div>
                <p className="text-xs mb-1" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                  {order.email} {order.phone && `· ${order.phone}`}
                </p>
                <p className="text-xs mb-3" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                  {order.shippingAddress}, {order.shippingCity}, {order.shippingState}
                </p>
                <div className="space-y-1 mb-2">
                  {order.items.map((item, i) => (
                    <p key={i} className="text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                      {item.titleSnapshot} &times; {item.quantity}
                    </p>
                  ))}
                </div>
                <p className="text-sm" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                  {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(order.total)}
                </p>
                <p className="text-[10px] mt-3" style={{ color: '#3a3028', fontFamily: 'var(--font-inter)' }}>
                  {new Date(order.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>

              <select
                value={order.status}
                disabled={updatingId === order.id}
                onChange={(e) => updateStatus(order.id, e.target.value)}
                className="px-3 py-2 text-xs disabled:opacity-60 flex-shrink-0"
                style={{ background: '#162318', border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        )
      })}
    </div>
  )
}
