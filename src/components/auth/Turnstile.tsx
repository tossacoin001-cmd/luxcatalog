'use client'

import { useEffect, useRef, useState } from 'react'
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

// One lookup per page load, shared by every form on it.
let keyRequest: Promise<string | null> | null = null
function loadSiteKey(): Promise<string | null> {
  keyRequest ??= fetch('/api/turnstile-config', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { siteKey?: string | null } | null) => d?.siteKey ?? null)
    .catch(() => {
      keyRequest = null
      return null
    })
  return keyRequest
}

// Cloudflare Turnstile bot check. Renders nothing when no key is set (local
// dev). The key comes from the server when the page opens, so it works however
// it was named in the host settings, and it shows only when the secret that
// checks it exists too.
export default function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [siteKey, setSiteKey] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void loadSiteKey().then((k) => live && setSiteKey(k))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false

    // The script loads asynchronously; poll until window.turnstile exists.
    const poll = window.setInterval(mount, 250)
    function mount() {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return
      window.clearInterval(poll)
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: 'auto',
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
  }, [siteKey, onToken])

  // A token is single-use, after a failed submit the widget must issue a new one.
  useEffect(() => {
    if (resetKey && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current)
      onToken(null)
    }
  }, [resetKey, onToken])

  if (!siteKey) return null
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={ref} data-turnstile className="flex justify-center" />
    </>
  )
}

export function captchaHeaders(token: string | null): Record<string, string> | undefined {
  return token ? { 'x-captcha-response': token } : undefined
}
