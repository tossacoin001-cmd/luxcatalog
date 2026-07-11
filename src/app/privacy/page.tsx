import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { PHONE_DISPLAY } from '@/lib/contact'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy' }

const sections = [
  {
    heading: '1. Information We Collect',
    body: `When you create an account, submit an enquiry, or contact us, we collect information such as your name, email address, phone number, and the content of your message. If you sign in, our authentication provider (Clerk) also processes your account information.`,
  },
  {
    heading: '2. How We Use Your Information',
    body: `We use your information to respond to enquiries, process reservations and payments, manage your account, and communicate with you about assets or services you've shown interest in. We do not sell your personal data.`,
  },
  {
    heading: '3. Third-Party Services',
    body: `We rely on trusted third parties to operate the Platform: Clerk (authentication), Vercel (hosting), Neon (database), Stripe (payment processing), and WhatsApp (for direct client communication). Each processes data under its own privacy terms.`,
  },
  {
    heading: '4. Data Retention',
    body: `We retain enquiry and account information for as long as needed to provide our services and meet legal obligations, and delete it on request where we are not required to retain it.`,
  },
  {
    heading: '5. Your Rights',
    body: `Under the Nigeria Data Protection Act, you have the right to access, correct, or request deletion of your personal data. Contact us using the details below to exercise these rights.`,
  },
  {
    heading: '6. Cookies',
    body: `We use essential cookies to keep you signed in and remember preferences such as your selected currency. We do not use third-party advertising trackers.`,
  },
  {
    heading: '7. Contact',
    body: `For privacy questions or data requests, reach us via WhatsApp/phone at ${PHONE_DISPLAY}, or through our Contact page.`,
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-12 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Legal
          </p>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Privacy Policy
          </h1>
          <p className="mt-3 text-xs" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
            Last updated 11 July 2026
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-16 space-y-10">
        {sections.map((s) => (
          <div key={s.heading}>
            <h2 className="text-base mb-3" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              {s.heading}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>

      <Footer />
    </div>
  )
}
