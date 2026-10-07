'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id: string) => void
    }
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

// Cloudflare Turnstile bot check. Renders nothing when no site key is set
// (local dev), the server-side captcha plugin is likewise only enabled when
// TURNSTILE_SECRET_KEY exists, so the two always switch on together.
export default function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let cancelled = false

    // The script loads asynchronously; poll until window.turnstile exists.
    const poll = window.setInterval(mount, 250)
    function mount() {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return
      window.clearInterval(poll)
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    }
    mount()
    return () => {
      cancelled = true
      window.clearInterval(poll)
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [onToken])

  // A token is single-use, after a failed submit the widget must issue a new one.
  useEffect(() => {
    if (resetKey && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current)
      onToken(null)
    }
  }, [resetKey, onToken])

  if (!TURNSTILE_SITE_KEY) return null
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={ref} className="flex justify-center" />
    </>
  )
}

export function captchaHeaders(token: string | null): Record<string, string> | undefined {
  return token ? { 'x-captcha-response': token } : undefined
}
