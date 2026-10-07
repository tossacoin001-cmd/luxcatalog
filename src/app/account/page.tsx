import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AccountClient from './AccountClient'
import { getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Account & Security' }
export const dynamic = 'force-dynamic'

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/sign-in?redirect_url=/account')
  const { setup } = await searchParams

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, emailVerified: true, phone: true, role: true, twoFactorEnabled: true },
  })
  if (!user) redirect('/sign-in')

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <div className="pt-32 pb-10 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.25em] uppercase mb-3" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Account
          </p>
          <h1 className="text-4xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Account &amp; Security
          </h1>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 md:px-12 py-10">
        <AccountClient
          user={{ ...user, twoFactorEnabled: !!user.twoFactorEnabled }}
          requireTwoFactor={setup === '2fa' && user.role !== 'customer' && !user.twoFactorEnabled}
        />
      </div>
      <Footer />
    </div>
  )
}
