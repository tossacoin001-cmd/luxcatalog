import Link from 'next/link'
import type { Metadata } from 'next'
import AdminNavbar from '@/components/AdminNavbar'
import { requireArea } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { partnerTypeSpec } from '@/lib/partner-requirements'

export const metadata: Metadata = { title: 'Partner Applications | Admin' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Awaiting review', color: '#C9A84C' },
  info_requested: { label: 'Info requested', color: '#e8a84c' },
  approved: { label: 'Approved', color: '#6fbf73' },
  rejected: { label: 'Rejected', color: '#e85c4c' },
  draft: { label: 'Draft', color: '#908673' },
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireArea('applications')
  const { status } = await searchParams
  const filter = status && STATUS_LABEL[status] ? status : 'submitted'

  const [apps, counts] = await Promise.all([
    prisma.partnerApplication.findMany({
      where: { status: filter as never },
      orderBy: [{ submittedAt: 'asc' }, { updatedAt: 'desc' }],
      include: { _count: { select: { documents: true } } },
    }),
    prisma.partnerApplication.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role="admin" />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Partner programme
          </p>
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Applications
          </h1>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-5 md:px-12 py-8 space-y-6">
        <nav className="flex flex-wrap gap-2" aria-label="Filter by status">
          {['submitted', 'info_requested', 'approved', 'rejected', 'draft'].map((s) => (
            <Link
              key={s}
              href={`/admin/applications?status=${s}`}
              className="inline-flex items-center gap-2 min-h-11 px-4 text-xs tracking-[0.12em] uppercase"
              style={{
                border: `1px solid ${filter === s ? '#C9A84C' : '#1e2e1f'}`,
                color: filter === s ? '#e4c878' : '#9a8f7a',
                fontFamily: 'var(--font-inter)',
              }}
            >
              {STATUS_LABEL[s].label} <span style={{ color: '#908673' }}>{countOf(s)}</span>
            </Link>
          ))}
        </nav>

        {apps.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
            Nothing here.
          </p>
        ) : (
          <ul className="space-y-3">
            {apps.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/applications/${a.id}`}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-5 lux-card"
                >
                  <span>
                    <span className="block text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                      {a.businessName || '(no name yet)'}
                    </span>
                    <span className="block text-sm" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                      {partnerTypeSpec(a.partnerType)?.label} · {a.city || 'city not set'} · {a._count.documents} document
                      {a._count.documents === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="text-xs tracking-[0.12em] uppercase" style={{ color: STATUS_LABEL[a.status].color, fontFamily: 'var(--font-inter)' }}>
                    {STATUS_LABEL[a.status].label}
                    {a.submittedAt && ` · ${a.submittedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
