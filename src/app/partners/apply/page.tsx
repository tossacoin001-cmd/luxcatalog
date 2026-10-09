import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Breadcrumbs from '@/components/Breadcrumbs'
import ApplyClient from './ApplyClient'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { APPLICANT_APPLICATION_SELECT } from '@/lib/partner-requirements'

export const metadata: Metadata = { title: 'Partner Application', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ApplyPage() {
  const session = await getSession()
  if (!session) redirect('/sign-up?redirect_url=/partners/apply')

  const [user, application] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, phone: true, role: true } }),
    prisma.partnerApplication.findUnique({ where: { userId: session.user.id }, select: APPLICANT_APPLICATION_SELECT }),
  ])
  if (!user) redirect('/sign-in')

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <div className="pt-28 md:pt-32 pb-8 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <Breadcrumbs trail={[{ label: 'Home', href: '/' }, { label: 'Become a Partner', href: '/partners' }, { label: 'Application' }]} />
          </div>
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Partner application
          </p>
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {application?.status === 'approved' ? 'Welcome, partner' : 'Tell us about your business'}
          </h1>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-5 md:px-12 py-10">
        <ApplyClient
          userRole={user.role}
          defaults={{ contactName: user.name, phone: user.phone ?? '' }}
          initial={application ? JSON.parse(JSON.stringify(application)) : null}
        />
      </div>
      <Footer />
    </div>
  )
}
