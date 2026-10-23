'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// An in-page "are you sure?". Browsers and phone apps can block their own
// pop-up boxes (window.confirm answers "no" without asking), which made
// buttons such as "cancel invitation" look dead. This is always shown, works
// with a keyboard (Escape cancels) and names exactly what will happen.
export type ConfirmOptions = {
  title: string
  body?: string
  yes?: string
  no?: string
  danger?: boolean
}

type Ask = (o: ConfirmOptions) => Promise<boolean>
const Ctx = createContext<Ask | null>(null)

export function useConfirm(): Ask {
  const ask = useContext(Ctx)
  // Outside the provider (never in the app) fall back to the browser box.
  return ask ?? (async (o) => window.confirm(`${o.title}${o.body ? `\n\n${o.body}` : ''}`))
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const yesRef = useRef<HTMLButtonElement>(null)

  const ask = useCallback<Ask>((o) => {
    // A second question while one is open cancels the first.
    resolver.current?.(false)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setOpen(o)
    })
  }, [])

  const close = useCallback((answer: boolean) => {
    resolver.current?.(answer)
    resolver.current = null
    setOpen(null)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => yesRef.current?.focus(), 30)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open, close])

  return (
    <Ctx.Provider value={ask}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(20,19,15,0.5)' }}
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            data-confirm
            className="w-full sm:max-w-md p-6 sm:p-7"
            style={{ background: '#fbf9f4', border: '1px solid #d6cfbf', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-xl mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
              {open.title}
            </h2>
            {open.body && (
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
                {open.body}
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-4">
              <button
                type="button"
                data-confirm-no
                onClick={() => close(false)}
                className="min-h-11 px-5 text-xs tracking-[0.16em] uppercase"
                style={{ border: '1px solid #c4bcaa', color: '#14130f', fontFamily: 'var(--font-inter)' }}
              >
                {open.no ?? 'Keep it'}
              </button>
              <button
                ref={yesRef}
                type="button"
                data-confirm-yes
                onClick={() => close(true)}
                className="min-h-11 px-5 text-xs tracking-[0.16em] uppercase"
                style={{ background: open.danger === false ? '#14130f' : '#8a3b2e', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
              >
                {open.yes ?? 'Yes, continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
