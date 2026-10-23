import type { Metadata } from 'next'
import { Newsreader, Hanken_Grotesk } from 'next/font/google'
import { Toaster } from 'sonner'
import CurrencyProvider from '@/components/CurrencyProvider'
import CartProvider from '@/components/CartProvider'
import ConfirmProvider from '@/components/ConfirmProvider'
import { MotionProvider } from '@/components/motion/Reveal'
import { getAppUrl } from '@/lib/utils'
import { SITE, homeTitle, homeDescription } from '@/lib/seo'
import './globals.css'

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

// Search engines and link previews read these. Every address is built from
// NEXT_PUBLIC_APP_URL, so a new domain is one environment change. Each page
// adds its own canonical address and preview text with pageMeta().
export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: { default: homeTitle(), template: `%s | ${SITE.name}` },
  description: homeDescription(),
  applicationName: SITE.name,
  keywords: ['luxury homes Lagos', 'luxury shortlets Lagos', 'supercar hire Lagos', 'yacht charter Lagos', 'luxury real estate Nigeria', 'Lux Catalog'],
  // Set these two in the environment once Search Console and Bing give the codes.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } } : {}),
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${hanken.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen" style={{ fontFamily: 'var(--font-inter)' }}>
        <MotionProvider>
          <CurrencyProvider>
            <CartProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </CartProvider>
          </CurrencyProvider>
        </MotionProvider>
        <Toaster
          theme="light"
          toastOptions={{
            style: {
              background: '#fbf9f4',
              border: '1px solid #d6cfbf',
              color: '#14130f',
              borderRadius: 0,
            },
          }}
        />
      </body>
    </html>
  )
}
