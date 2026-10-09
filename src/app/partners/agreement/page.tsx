import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Breadcrumbs from '@/components/Breadcrumbs'
import AgreementClient from './AgreementClient'
import { getRole, getSession } from '@/lib/admin-auth'
import { agreementStatus } from '@/lib/agreements-server'

export const metadata: Metadata = { title: 'Partner Agreement', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function AgreementPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in?redirect_url=/partners/agreement')
  const role = await getRole(session.user.id)
  if (role === 'admin') redirect('/admin/agreements')
  if (role !== 'partner') redirect('/partners/apply')

  const status = await agreementStatus(session.user.id)
  if (!status) redirect('/sign-in')

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <Breadcrumbs trail={[{ label: 'Home', href: '/' }, { label: 'Become a Partner', href: '/partners' }, { label: 'Agreement' }]} />
          </div>
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            {status.ctx.businessName}
          </p>
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {status.allSigned ? 'Your partner agreement' : 'Sign your partner agreement'}
          </h1>
          <p className="mt-3 text-sm leading-relaxed max-w-2xl" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            {status.allSigned
              ? 'Everything is signed. Your signed copies are below and were emailed to you.'
              : 'Please read each document, then sign by typing your full legal name. You will receive a signed PDF copy by email. Once signed, you can add your first listing.'}
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-5 md:px-12 py-10">
        <AgreementClient
          defaultName={status.ctx.partnerName}
          items={status.items.map((i) => ({
            key: i.key,
            title: i.title,
            version: i.version,
            summary: i.summary,
            hash: i.hash,
            clauses: i.rendered.clauses,
            signed: i.signed ? { id: i.signed.id, signedName: i.signed.signedName, signedAt: i.signed.signedAt.toISOString() } : null,
            previousVersion: i.previous?.version ?? null,
          }))}
        />
      </div>
      <Footer />
    </div>
  )
}
