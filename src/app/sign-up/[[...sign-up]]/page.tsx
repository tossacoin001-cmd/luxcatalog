import { SignUp } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Create Account' }

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#080c08' }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 40%, rgba(201,168,76,0.04) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <p
            className="text-xs tracking-[0.3em] uppercase mb-3"
            style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            Lux Catalog
          </p>
          <h1
            className="text-3xl"
            style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}
          >
            Join the Catalog
          </h1>
        </div>

        <SignUp
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-lux-surface border border-lux-border shadow-none rounded-none w-full',
              headerTitle: 'font-playfair text-lux-text',
              headerSubtitle: 'text-lux-text-muted font-inter',
              formButtonPrimary: 'bg-lux-gold text-lux-bg hover:bg-lux-gold-light rounded-none font-inter tracking-widest uppercase text-xs',
              formFieldInput: 'bg-lux-surface2 border border-lux-border text-lux-text rounded-none font-inter focus:border-lux-gold-muted',
              formFieldLabel: 'text-lux-text-muted font-inter text-xs tracking-widest uppercase',
              footerActionLink: 'text-lux-gold hover:text-lux-gold-light font-inter',
            },
            variables: {
              colorPrimary: '#C9A84C',
              colorBackground: '#0f1a10',
              colorInput: '#162318',
              colorInputForeground: '#f5f0e8',
              colorForeground: '#f5f0e8',
              colorMutedForeground: '#9a8f7a',
              borderRadius: '0px',
              fontFamily: 'var(--font-inter)',
            },
          }}
        />
      </div>
    </div>
  )
}
