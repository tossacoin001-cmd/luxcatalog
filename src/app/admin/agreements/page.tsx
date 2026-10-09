import type { Metadata } from 'next'
import { CheckCircle2, Clock, FileText } from 'lucide-react'
import AdminNavbar from '@/components/AdminNavbar'
import { requireArea } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { AGREEMENTS, COMPANY } from '@/lib/agreements'
import { agreementStatus } from '@/lib/agreements-server'
import { partnerTypeSpec } from '@/lib/partner-requirements'

export const metadata: Metadata = { title: 'Partner Agreements | Admin' }
export const dynamic = 'force-dynamic'

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const card = { background: '#0f1a10', border: '1px solid #1e2e1f' }
const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default async function AgreementsAdminPage() {
  await requireArea('partners')
  const partners = await prisma.user.findMany({ where: { role: 'partner' }, select: { id: true, name: true, email: true }, orderBy: { createdAt: 'desc' } })
  const statuses = await Promise.all(partners.map(async (p) => ({ p, s: await agreementStatus(p.id) })))
  const unreviewed = AGREEMENTS.filter((a) => !a.reviewed).length

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <AdminNavbar role="admin" />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Partner programme
          </p>
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Agreements
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-12 py-8 space-y-10">
        {unreviewed > 0 && (
          <div className="p-5 text-sm leading-relaxed" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)', color: '#e6d3a1', fontFamily: 'var(--font-inter)' }}>
            <p className="mb-2" style={{ color: '#f5f0e8' }}>
              {unreviewed} of {AGREEMENTS.length} texts are awaiting your lawyer&apos;s review.
            </p>
            <p>
              Download each PDF below and send it to your lawyer. Ask them to confirm the legal entity that contracts with partners (currently shown as
              &ldquo;{COMPANY.name}, {COMPANY.address}&rdquo;; add the RC number and registered address), the laws cited, and the commission and liability
              terms. Partners can sign the current versions now; when the lawyer&apos;s changes go in, each text gets a new version and partners are asked
              to sign again before adding listings.
            </p>
          </div>
        )}

        <section>
          <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Agreement texts
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {AGREEMENTS.map((a) => (
              <li key={a.key} className="p-5 flex flex-col gap-3" style={card}>
                <div>
                  <p className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                    {a.title} <span className="text-xs" style={text}>v{a.version}</span>
                  </p>
                  <p className="text-xs mt-1" style={text}>
                    {a.appliesTo === 'all' ? 'Every partner' : a.appliesTo.map((t) => partnerTypeSpec(t)?.label ?? t).join(', ')}
                  </p>
                </div>
                <p className="inline-flex items-center gap-2 text-xs" style={{ color: a.reviewed ? '#6fbf73' : '#e0b75a', fontFamily: 'var(--font-inter)' }}>
                  {a.reviewed ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                  {a.reviewed ? 'Approved by lawyer' : 'Awaiting lawyer review'}
                </p>
                <a
                  href={`/api/admin/agreements/${a.key}/pdf`}
                  className="self-start inline-flex items-center gap-2 min-h-11 px-4 text-xs tracking-[0.14em] uppercase"
                  style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                >
                  <FileText size={14} /> Download for review
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Partners
          </h2>
          {statuses.length === 0 ? (
            <p className="text-sm" style={text}>
              No partners yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {statuses.map(({ p, s }) => (
                <li key={p.id} className="p-5" style={card}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                      {s?.ctx.businessName ?? p.name} <span className="text-xs" style={text}>{p.email}</span>
                    </p>
                    <p className="text-xs" style={{ color: s?.allSigned ? '#6fbf73' : '#e0b75a', fontFamily: 'var(--font-inter)' }}>
                      {s?.allSigned ? 'All signed' : `${s?.items.filter((i) => i.signed).length ?? 0} of ${s?.items.length ?? 0} signed`}
                    </p>
                  </div>
                  {!!s?.history.length && (
                    <ul className="mt-3 space-y-1">
                      {s.history.map((h) => (
                        <li key={h.id} className="text-xs flex flex-wrap gap-x-3" style={text}>
                          <a href={`/api/partner-agreements/${h.id}/pdf`} target="_blank" rel="noopener" className="underline underline-offset-2" style={{ color: '#C9A84C' }}>
                            {h.title} v{h.version}
                          </a>
                          <span>
                            signed by {h.signedName}, {fmt(h.signedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
