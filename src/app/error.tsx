'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { whatsappLink } from '@/lib/contact'

// Route-level error boundary: a failed data load shows an on-brand recovery
// screen (retry / concierge) instead of a blank or default error page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center text-center px-6"
      style={{ background: '#f4f0e8' }}
    >
      <p className="text-xs tracking-[0.35em] uppercase mb-6" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
        A brief interruption
      </p>
      <h1 className="text-3xl md:text-5xl leading-tight mb-6" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
        Something didn&apos;t load as it should
      </h1>
      <p className="max-w-md text-base leading-relaxed mb-10" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
        Please try again. If it keeps happening, our concierge is a message away.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase transition-opacity hover:opacity-90"
          style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
        >
          Try Again
        </button>
        <a
          data-wa-fallback
          href={whatsappLink(`Hello, a page on Lux Catalog didn't load${error.digest ? ` (ref ${error.digest})` : ''}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase"
          style={{ border: '1px solid rgba(20,19,15,0.25)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
        >
          Message the Concierge
        </a>
        <Link
          href="/"
          className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.2em] uppercase"
          style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}
        >
          Home
        </Link>
      </div>
    </main>
  )
}
