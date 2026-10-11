import Link from 'next/link'
import type { Metadata } from 'next'
import AdminNavbar from '@/components/AdminNavbar'
import ServiceFloorsForm from '@/components/ServiceFloorsForm'
import { requireAdmin } from '@/lib/admin-auth'
import { serviceFloors } from '@/lib/services-server'
import { SERVICE_FLOOR_DEFAULTS } from '@/lib/services'

export const metadata: Metadata = { title: 'Private Services | Admin' }
export const dynamic = 'force-dynamic'

export default async function ServiceFloorsPage() {
  await requireAdmin()
  const floors = await serviceFloors()

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role="admin" />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <Link href="/admin/listings" className="text-[11px] tracking-[0.2em] uppercase mb-4 block hover:text-lux-gold transition-colors" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
            ← Listings
          </Link>
          <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Private Services
          </p>
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Price floors
          </h1>
          <p className="mt-3 text-sm leading-relaxed max-w-xl" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            The lowest starting price a partner may list each service at, so the category stays luxury. House listings you add
            yourself are not limited. Changes apply to new listings and edits, and are recorded in the audit log.
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-5 md:px-12 py-8">
        <ServiceFloorsForm floors={floors} defaults={SERVICE_FLOOR_DEFAULTS} />
      </div>
    </div>
  )
}
