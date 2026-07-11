import type { Metadata } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'sonner'
import CurrencyProvider from '@/components/CurrencyProvider'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Lux Catalog | The Definitive Luxury Asset Discovery Platform',
    template: '%s | Lux Catalog',
  },
  description: "Discover and acquire the world's finest assets: prime real estate, supercars, superyachts, bespoke interior decor, and more.",
  keywords: ['luxury real estate', 'supercars', 'superyachts', 'luxury assets', 'premium properties'],
  openGraph: {
    type: 'website',
    siteName: 'Lux Catalog',
    title: 'Lux Catalog | The Definitive Luxury Asset Discovery Platform',
    description: 'Every luxury asset. One destination.',
  },
}

const hasClerkKeys = !!(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY
)

function Providers({ children }: { children: React.ReactNode }) {
  if (hasClerkKeys) {
    return <ClerkProvider>{children}</ClerkProvider>
  }
  return <>{children}</>
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <html lang="en" className={`${playfair.variable} ${inter.variable}`} suppressHydrationWarning>
        <head>
          <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        </head>
        <body className="min-h-screen" style={{ fontFamily: 'var(--font-inter)' }}>
          <CurrencyProvider>{children}</CurrencyProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: '#0f1a10',
                border: '1px solid #1e2e1f',
                color: '#f5f0e8',
              },
            }}
          />
        </body>
      </html>
    </Providers>
  )
}
