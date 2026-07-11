import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { PHONE_DISPLAY } from '@/lib/contact'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms of Service' }

const sections = [
  {
    heading: '1. Acceptance of Terms',
    body: `By accessing or using Lux Catalog ("we", "us", "our", "the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.`,
  },
  {
    heading: '2. Nature of the Service',
    body: `Lux Catalog is a curated marketplace and referral platform for luxury real estate, shortlets, vehicles, yachts, interior decor, and related lifestyle services. For most categories, we facilitate introductions and enquiries between clients and asset owners, agents, or vetted service providers, we are not automatically a party to every underlying sale, lease, or booking unless explicitly stated.`,
  },
  {
    heading: '3. Enquiries, Reservations & Deposits',
    body: `Submitting an enquiry does not guarantee availability or pricing. Where a holding deposit is collected to reserve an asset, it is refundable according to the terms communicated to you at the time of payment, and does not itself constitute a binding sale or lease agreement.`,
  },
  {
    heading: '4. Executive Transport & Security Services',
    body: `"Lux Drive," "Lux Shield," "Lux Escort," and "Lux Arrival" are Lux Catalog service brands under which we connect clients with licensed, independently vetted transport and protection providers. Lux Catalog does not itself employ armed personnel or operate as a private security firm. All such services are subject to the terms, licensing, and insurance of the fulfilling provider, which will be disclosed to you before any booking is confirmed.`,
  },
  {
    heading: '5. User Accounts',
    body: `You are responsible for maintaining the confidentiality of your account and for all activity under it. You must provide accurate information when creating an account or submitting an enquiry.`,
  },
  {
    heading: '6. Payments',
    body: `Payments made through the Platform (including holding deposits and, where applicable, product purchases) are processed by third-party payment providers. We do not store your full payment card details.`,
  },
  {
    heading: '7. Intellectual Property',
    body: `All content on the Platform, including text, images, and branding, is the property of Lux Catalog or its licensors and may not be reproduced without permission, except as necessary to use the Platform normally.`,
  },
  {
    heading: '8. Limitation of Liability',
    body: `The Platform is provided "as is." To the fullest extent permitted by law, Lux Catalog is not liable for indirect, incidental, or consequential damages arising from your use of the Platform or any transaction facilitated through it.`,
  },
  {
    heading: '9. Governing Law',
    body: `These Terms are governed by the laws of the Federal Republic of Nigeria.`,
  },
  {
    heading: '10. Changes to These Terms',
    body: `We may update these Terms from time to time. Continued use of the Platform after changes take effect constitutes acceptance of the revised Terms.`,
  },
  {
    heading: '11. Contact',
    body: `Questions about these Terms can be sent via WhatsApp/phone at ${PHONE_DISPLAY}, or through our Contact page.`,
  },
]

export default function TermsPage() {
  return (
    <div style={{ background: '#080c08', minHeight: '100vh' }}>
      <Navbar />

      <div className="pt-32 pb-12 px-6 md:px-12" style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
            Legal
          </p>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            Terms of Service
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
