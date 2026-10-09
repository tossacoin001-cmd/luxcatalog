import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { FileText, AlertTriangle } from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'
import ApplicationDecision from '@/components/ApplicationDecision'
import { requireArea } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { isDocRequired, missingForSubmit, partnerTypeSpec } from '@/lib/partner-requirements'
import { SUBCATEGORIES } from '@/lib/taxonomy'

export const metadata: Metadata = { title: 'Review Application | Admin' }
export const dynamic = 'force-dynamic'

const COLLECTION_LABEL: Record<string, string> = Object.fromEntries(Object.values(SUBCATEGORIES).flat().map((s) => [s.key, s.label]))
const muted = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }

export default async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireArea('applications')
  const { id } = await params
  const app = await prisma.partnerApplication.findUnique({
    where: { id },
    include: { documents: { select: { id: true, kind: true, fileName: true, size: true, expiresAt: true, status: true, storage: true, createdAt: true } } },
  })
  if (!app) notFound()
  const [user, audit] = await Promise.all([
    prisma.user.findUnique({ where: { id: app.userId }, select: { email: true, emailVerified: true, createdAt: true, role: true } }),
    prisma.auditLog.findMany({ where: { target: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ])
  const spec = partnerTypeSpec(app.partnerType)
  const missing = missingForSubmit(app)
  const declarations = (app.declarations ?? {}) as Record<string, string>

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-4 py-2.5" style={{ borderBottom: '1px solid #1e2e1f' }}>
      <dt className="text-xs tracking-[0.12em] uppercase" style={muted}>
        {label}
      </dt>
      <dd className="col-span-2 text-sm break-words" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
        {value || <span style={muted}>—</span>}
      </dd>
    </div>
  )

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role="admin" />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-6xl mx-auto">
          <Link href="/admin/applications" className="inline-flex items-center min-h-11 text-xs tracking-[0.2em] uppercase hover:text-lux-gold" style={muted}>
            ← Applications
          </Link>
          <h1 className="text-3xl md:text-4xl mt-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {app.businessName || '(no name yet)'}
          </h1>
          <p className="mt-2 text-sm" style={muted}>
            {spec?.label} · status: {app.status.replace('_', ' ')}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-12 py-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <section>
            <h2 className="text-xl mb-3" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Business
            </h2>
            <dl>
              {row('Applying as', app.legalForm === 'company' ? `Company · CAC ${app.cacNumber ?? '—'}` : 'Individual')}
              {row('Contact', app.contactName)}
              {row('Email', `${user?.email ?? '—'}${user?.emailVerified ? ' (verified)' : ' (not verified)'}`)}
              {row('Phone', app.phone)}
              {row('Location', [app.city, app.country].filter(Boolean).join(', '))}
              {row('Website', app.website)}
              {row('Social', app.socialHandle)}
              {row('Years operating', app.yearsOperating?.toString())}
              {row('Collections', app.collections.map((c) => COLLECTION_LABEL[c] ?? c).join(', '))}
              {row('About', <span className="whitespace-pre-line">{app.about}</span>)}
            </dl>
          </section>

          <section>
            <h2 className="text-xl mb-3" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Documents
            </h2>
            <ul className="space-y-2">
              {spec?.docs.map((d) => {
                const doc = app.documents.find((x) => x.kind === d.kind)
                const expired = doc?.expiresAt && doc.expiresAt < new Date()
                return (
                  <li key={d.kind} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
                    <span>
                      <span className="block text-sm" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
                        {d.label}
                        {isDocRequired(d, app.legalForm) ? '' : ' (optional)'}
                      </span>
                      {doc?.expiresAt && (
                        <span className="block text-xs" style={{ color: expired ? '#e85c4c' : '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                          {expired ? 'EXPIRED ' : 'Expires '}
                          {doc.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </span>
                    {doc ? (
                      <a
                        href={`/api/partner-documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 min-h-11 px-4 text-xs tracking-[0.12em] uppercase hover:text-lux-gold"
                        style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                      >
                        <FileText size={14} /> Open {doc.storage === 'db' ? '(db)' : ''}
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: isDocRequired(d, app.legalForm) ? '#e85c4c' : '#908673', fontFamily: 'var(--font-inter)' }}>
                        Not uploaded
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <h2 className="text-xl mb-3" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              Declarations
            </h2>
            <ul className="space-y-2">
              {spec?.declarations.map((d) => (
                <li key={d.key} className="text-sm" style={{ color: declarations[d.key] ? '#d6cdbd' : '#e85c4c', fontFamily: 'var(--font-inter)' }}>
                  {declarations[d.key] ? '✓' : '✗'} {d.text}
                  {declarations[d.key] && (
                    <span className="block text-xs" style={muted}>
                      Accepted {new Date(declarations[d.key]).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          {missing.length > 0 && (
            <div className="p-5 text-sm" style={{ border: '1px solid rgba(232,168,76,0.4)', background: 'rgba(232,168,76,0.06)', color: '#d6cdbd', fontFamily: 'var(--font-inter)' }}>
              <p className="flex items-center gap-2 mb-2" style={{ color: '#e8a84c' }}>
                <AlertTriangle size={14} /> Incomplete
              </p>
              <ul className="space-y-1 text-xs">
                {missing.map((m) => (
                  <li key={m}>· {m}</li>
                ))}
              </ul>
            </div>
          )}
          <ApplicationDecision id={app.id} status={app.status} internalNote={app.internalNote ?? ''} />
          {audit.length > 0 && (
            <div>
              <p className="text-xs tracking-[0.16em] uppercase mb-2" style={muted}>
                History
              </p>
              <ul className="space-y-1.5 text-xs" style={muted}>
                {audit.map((e) => (
                  <li key={e.id}>
                    {e.createdAt.toLocaleString('en-GB', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' })} · {e.action.replace('partner_application.', '').replace('partner_document.', 'document ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
