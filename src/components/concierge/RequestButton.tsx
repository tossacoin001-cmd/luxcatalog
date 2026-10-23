'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import BriefForm from '@/components/concierge/BriefForm'
import { useScrollLock } from '@/lib/use-scroll-lock'

// A button that opens a short "tell us what you are looking for" form for a
// given topic (a category, a service, a view). Replaces WhatsApp as the way
// to ask for something that is not listed yet.
export default function RequestButton({
  topic,
  label,
  className,
  style,
  initialMessage,
  children,
}: {
  topic: string
  label?: string
  className?: string
  style?: React.CSSProperties
  initialMessage?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  useScrollLock(open)
  return (
    <>
      <button type="button" data-brief-trigger onClick={() => setOpen(true)} className={className} style={style}>
        {children}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(20,19,15,0.5)' }} onClick={() => setOpen(false)}>
          <div data-brief-form className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={label ?? 'Tell us what you are looking for'}>
            <div className="flex items-start justify-between gap-3 px-6 py-5" style={{ borderBottom: '1px solid #d6cfbf' }}>
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase mb-1" style={{ color: '#7a5c24', fontFamily: 'var(--font-inter)' }}>
                  We’ll find it for you
                </p>
                <h3 className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
                  {label ?? topic}
                </h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="w-11 h-11 inline-flex items-center justify-center shrink-0" style={{ color: '#5e584c' }} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <BriefForm topic={topic} initialMessage={initialMessage} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
