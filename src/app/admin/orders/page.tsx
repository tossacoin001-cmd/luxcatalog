import AdminNavbar from '@/components/AdminNavbar'
import AdminOrdersTable from '@/components/AdminOrdersTable'
import { prisma } from '@/lib/prisma'
import { requireArea } from '@/lib/admin-auth'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Orders | Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
  await requireArea('orders')

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })

  const plainOrders = orders.map((o) => ({
    ...o,
    total: Number(o.total),
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({ ...i, priceSnapshot: Number(i.priceSnapshot) })),
  }))

  return (
    <div style={{ background: '#f4f0e8', minHeight: '100vh' }}>
      <AdminNavbar role="admin" />

      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(20,19,15,0.14)' }}>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            Orders
          </h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-8">
        <AdminOrdersTable orders={plainOrders} />
      </div>
    </div>
  )
}
