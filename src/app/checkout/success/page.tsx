import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { CheckCircle } from 'lucide-react'

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string }>
}) {
  const { listing } = await searchParams

  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 pt-40 pb-24 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-8"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}
        >
          <CheckCircle size={28} style={{ color: '#C9A84C' }} />
        </div>

        <p className="text-xs tracking-[0.25em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          Reservation Secured
        </p>
        <h1 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          Your Holding Deposit<br />Has Been Received
        </h1>

        {listing && (
          <p className="text-sm mb-4" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
            <span style={{ color: '#C9A84C' }}>{decodeURIComponent(listing)}</span> is now on hold pending your consultation.
          </p>
        )}

        <p className="text-sm leading-relaxed mb-10" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
          A senior specialist from our team will contact you within 24 hours to arrange a private viewing
          and begin the due diligence process. Your deposit is fully refundable should you decide not
          to proceed after consultation.
        </p>

        <div
          className="inline-flex items-center gap-2 px-4 py-3 mb-8 text-xs"
          style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
        >
          <CheckCircle size={12} style={{ color: '#C9A84C' }} />
          A confirmation has been sent to your registered email address
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/catalog"
            className="px-8 py-3 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-80"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Continue Browsing
          </Link>
          <Link
            href="/dashboard"
            className="px-8 py-3 text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:opacity-80"
            style={{ border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            My Dashboard
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
