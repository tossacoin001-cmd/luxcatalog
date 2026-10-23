'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUp, RotateCcw, X } from 'lucide-react'
import { greeting, starters, type Starter } from '@/lib/lux-chat'
import { whatsappLink } from '@/lib/contact'
import { useSession } from '@/lib/auth-client'
import Turnstile, { captchaHeaders } from '@/components/auth/Turnstile'

type Card = {
  slug: string; title: string; href: string; image: string | null; priceDisplay: string; priceNote: string
  availability: 'available' | 'unavailable' | 'unchecked'; reason: string; bookHref?: string
}
type Msg = { role: 'user' | 'assistant'; content: string; cards?: Card[]; chips?: Starter[]; handoff?: boolean }

const KEY = 'lux-chat-v1'
const ink = '#14130f'
const stone = '#5e584c'
const rule = '#d6cfbf'
const sans = { fontFamily: 'var(--font-inter)' }

function load(): Msg[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : null
    return Array.isArray(v) ? v.slice(-40) : []
  } catch {
    return []
  }
}
function save(m: Msg[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m.slice(-40)))
  } catch {
    // Private windows and blocked storage: the chat simply is not remembered.
  }
}

// Lux: a chat, not a form. A greeting from the visitor's own clock, questions
// to tap, answers with real listings and live availability, and a person on
// request. The conversation stays in this browser.
export default function LuxChat({ onClose }: { onClose: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const listingSlug = (/^\/catalog\/[^/]+\/([^/?#]+)/.exec(pathname) ?? [])[1]
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [ready, setReady] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [hello, setHello] = useState('')
  const [chips, setChips] = useState<Starter[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Greeting and tappable questions, from this person's own hour and page.
  useEffect(() => {
    const title = listingSlug ? document.querySelector('h1')?.textContent?.trim() ?? undefined : undefined
    setHello(greeting(new Date().getHours(), session?.user?.name))
    setChips(starters({ listingTitle: title }))
    setMsgs(load())
    setReady(true)
  }, [listingSlug, session?.user?.name])

  useEffect(() => {
    if (ready) save(msgs)
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs, ready, busy])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const send = useCallback(
    async (content: string) => {
      const clean = content.trim()
      if (!clean || busy) return
      const next: Msg[] = [...msgs, { role: 'user', content: clean }]
      setTouched(true)
      setMsgs(next)
      setText('')
      setBusy(true)
      try {
        const res = await fetch('/api/lux', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: next.slice(-20).map((m) => ({ role: m.role, content: m.content })), context: listingSlug ? { listingSlug } : undefined }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
        setMsgs((m) => [...m, { role: 'assistant', content: d.reply, cards: d.cards, chips: d.chips, handoff: d.handoff }])
      } catch (err) {
        setMsgs((m) => [...m, { role: 'assistant', content: (err as Error).message || 'Something went wrong. Please try again.', chips: starters() }])
      } finally {
        setBusy(false)
        inputRef.current?.focus()
      }
    },
    [msgs, busy, listingSlug],
  )

  const last = msgs[msgs.length - 1]
  // On a listing page, questions about that listing come first until the visitor says something.
  const activeChips = !touched && listingSlug ? chips : last?.role === 'assistant' ? last.chips ?? [] : msgs.length === 0 ? chips : []

  const reset = () => {
    setMsgs([])
    save([])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-end sm:justify-end sm:p-6 pointer-events-none">
      <div className="absolute inset-0 sm:hidden pointer-events-auto" style={{ background: 'rgba(20,19,15,0.35)' }} onClick={onClose} />
      <section
        role="dialog"
        aria-label="Chat with Lux"
        aria-modal="true"
        data-lux-chat
        className="relative pointer-events-auto flex flex-col w-full sm:w-[420px] h-[88dvh] sm:h-[640px] sm:max-h-[calc(100dvh-3rem)]"
        style={{ background: '#fbf9f4', border: `1px solid ${rule}`, ...sans }}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${rule}` }}>
          <div>
            <p data-wordmark className="text-xl leading-none" style={{ color: ink }}>
              Lux
            </p>
            <p className="text-[11px] tracking-[0.16em] uppercase mt-1" style={{ color: stone }}>
              Homes, stays, cars, yachts, services
            </p>
          </div>
          <div className="flex items-center">
            {msgs.length > 0 && (
              <button type="button" onClick={reset} aria-label="Start a new chat" className="w-11 h-11 inline-flex items-center justify-center" style={{ color: stone }}>
                <RotateCcw size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 inline-flex items-center justify-center" style={{ color: ink }}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" aria-live="polite" data-lux-log>
          {ready && (
            <Bubble who="assistant" data-lux-greeting>
              {hello}
            </Bubble>
          )}
          {msgs.map((m, i) => (
            <div key={i} className="space-y-3">
              <Bubble who={m.role}>{m.content}</Bubble>
              {m.cards && m.cards.length > 0 && (
                <ul className="space-y-3">
                  {m.cards.map((c) => (
                    <li key={c.slug}>
                      <CardView c={c} onNavigate={onClose} />
                    </li>
                  ))}
                </ul>
              )}
              {m.handoff && i === msgs.length - 1 && <Handoff msgs={msgs} onDone={(t) => setMsgs((x) => [...x, { role: 'assistant', content: t, chips: starters() }])} />}
            </div>
          ))}
          {busy && (
            <div role="status" aria-label="Lux is typing" className="flex gap-1.5 px-1" data-lux-typing>
              {[0, 1, 2].map((d) => (
                <span key={d} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: stone, animationDelay: `${d * 160}ms` }} />
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {activeChips.length > 0 && !busy && (
          <div className="px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar" data-lux-chips>
            {activeChips.map((c) => (
              <button
                key={c.label}
                type="button"
                data-lux-chip
                onClick={() => void send(c.text)}
                className="shrink-0 min-h-11 px-4 text-xs whitespace-nowrap"
                style={{ border: `1px solid ${ink}`, color: ink, background: 'transparent' }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(text)
          }}
          className="flex items-center gap-2 px-4 pt-3"
          style={{ borderTop: `1px solid ${rule}`, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <label htmlFor="lux-input" className="sr-only">
            Message Lux
          </label>
          <input
            ref={inputRef}
            id="lux-input"
            data-lux-input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={600}
            placeholder="Ask about a home, a stay, a car…"
            autoComplete="off"
            className="flex-1 h-11 px-3 text-base"
            style={{ background: '#f4f0e8', border: `1px solid ${rule}`, color: ink }}
          />
          <button type="submit" data-lux-send aria-label="Send" disabled={busy || !text.trim()} className="w-11 h-11 inline-flex items-center justify-center disabled:opacity-50" style={{ background: ink, color: '#f4f0e8' }}>
            <ArrowUp size={18} />
          </button>
        </form>
        <p className="px-5 pb-3 pt-1 text-center text-[11px]" style={{ color: stone }}>
          Prefer WhatsApp?{' '}
          <a data-wa-fallback href={whatsappLink('Hello, I’d like help from Lux Catalog.')} target="_blank" rel="noopener noreferrer" className="underline">
            Message us there
          </a>
        </p>
      </section>
    </div>
  )
}

function Bubble({ who, children, ...rest }: { who: 'user' | 'assistant'; children: React.ReactNode } & Record<string, unknown>) {
  const mine = who === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} {...rest}>
      <p
        className="max-w-[88%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
        style={mine ? { background: ink, color: '#f4f0e8' } : { background: '#f4f0e8', color: ink, border: `1px solid ${rule}` }}
      >
        {children}
      </p>
    </div>
  )
}

function CardView({ c, onNavigate }: { c: Card; onNavigate: () => void }) {
  const tag = c.availability === 'available' ? { t: 'Free on your dates', col: '#2f6b45' } : c.availability === 'unavailable' ? { t: 'Not free on those dates', col: '#8a3b2e' } : null
  return (
    <div data-lux-card className="flex gap-3 p-3" style={{ background: '#fbf9f4', border: `1px solid ${rule}` }}>
      {c.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.image} alt="" width={88} height={88} className="w-[88px] h-[88px] object-cover shrink-0" loading="lazy" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug truncate" style={{ fontFamily: 'var(--font-playfair)', color: ink }}>
          {c.title}
        </p>
        <p className="text-sm mt-0.5" style={{ color: ink }} data-price>
          {c.priceDisplay}
          {c.priceNote ? <span className="ml-1.5 text-[11px]" style={{ color: stone }}>{c.priceNote}</span> : null}
        </p>
        {tag && (
          <p className="text-[11px] tracking-[0.12em] uppercase mt-1" style={{ color: tag.col }}>
            {tag.t}
          </p>
        )}
        <Link href={c.bookHref ?? c.href} onClick={onNavigate} className="inline-flex items-center min-h-11 text-xs tracking-[0.14em] uppercase underline underline-offset-4" style={{ color: ink }}>
          {c.bookHref ? 'Book these dates' : 'View'}
        </Link>
      </div>
    </div>
  )
}

// "Speak to a person": the whole conversation goes to the team as one request.
function Handoff({ msgs, onDone }: { msgs: Msg[]; onDone: (thanks: string) => void }) {
  const { data: session } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reset, setReset] = useState(0)
  const onToken = useCallback((t: string | null) => setCaptcha(t), [])
  const n = name || session?.user?.name || ''
  const e = email || session?.user?.email || ''

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setBusy(true)
    setError(null)
    const transcript = msgs
      .filter((m) => m.content)
      .map((m) => `${m.role === 'user' ? 'Visitor' : 'Lux'}: ${m.content}`)
      .join('\n')
      .slice(-2800)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(captchaHeaders(captcha) ?? {}) },
        body: JSON.stringify({ kind: 'brief', name: n, email: e, message: `Looking for: A conversation with Lux\n\n${transcript}`, captcha }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setReset((x) => x + 1)
        throw new Error(d.error || 'Something went wrong. Please try again.')
      }
      onDone('Thank you. A specialist has your conversation and will reply personally, usually within a few hours.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field = { background: '#f4f0e8', border: `1px solid ${rule}`, color: ink }
  return (
    <form data-lux-handoff onSubmit={submit} className="space-y-2 p-3" style={{ background: '#fbf9f4', border: `1px solid ${rule}` }}>
      <label className="block text-[11px] tracking-[0.14em] uppercase" style={{ color: stone }}>
        Your name
        <input name="name" value={n} onChange={(x) => setName(x.target.value)} autoComplete="name" className="mt-1 w-full h-11 px-3 text-sm normal-case tracking-normal" style={field} />
      </label>
      <label className="block text-[11px] tracking-[0.14em] uppercase" style={{ color: stone }}>
        Your email
        <input name="email" type="email" value={e} onChange={(x) => setEmail(x.target.value)} autoComplete="email" className="mt-1 w-full h-11 px-3 text-sm normal-case tracking-normal" style={field} />
      </label>
      <Turnstile onToken={onToken} resetKey={reset} />
      {error && (
        <p role="alert" className="text-xs" style={{ color: '#8a3b2e' }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="min-h-11 px-5 text-xs tracking-[0.16em] uppercase disabled:opacity-60" style={{ background: ink, color: '#f4f0e8' }}>
        {busy ? 'Sending…' : 'Send to the team'}
      </button>
    </form>
  )
}
