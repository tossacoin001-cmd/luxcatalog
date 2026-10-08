import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Breadcrumbs from '@/components/Breadcrumbs'
import NotificationsClient from './NotificationsClient'
import { getSession } from '@/lib/admin-auth'
import { getPrefs } from '@/lib/notify/deliver'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Email Preferences' }
export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in?redirect_url=/account/notifications')

  const [prefs, user] = await Promise.all([
    getPrefs(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, marketingConsent: true } }),
  ])
  if (!user) redirect('/sign-in')

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <div className="pt-28 md:pt-32 pb-10 px-5 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <Breadcrumbs trail={[{ label: 'Home', href: '/' }, { label: 'Account', href: '/account' }, { label: 'Emails' }]} />
          </div>
          <p className="text-xs tracking-[0.25em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Account
          </p>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            What you receive
          </h1>
          <p className="mt-3 text-sm max-w-xl" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            Choose how often we write. We only send an update when there is something genuinely new for you. Booking
            confirmations and security emails always arrive.
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-5 md:px-12 py-10">
        <NotificationsClient
          role={user.role}
          initial={{
            luxEdit: prefs.luxEdit,
            partnerDigest: prefs.partnerDigest,
            adminBriefing: prefs.adminBriefing,
            instantAlerts: prefs.instantAlerts,
            marketingConsent: user.marketingConsent,
          }}
        />
        <p className="mt-10 text-xs" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
          We never sell or share your details. Read our{' '}
          <Link href="/privacy" className="inline-flex items-center min-h-11 underline text-lux-gold">
            privacy policy
          </Link>
          .
        </p>
      </div>
      <Footer />
    </div>
  )
}
