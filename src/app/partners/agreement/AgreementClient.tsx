'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, CheckCircle2, FileText, Loader2, PenLine } from 'lucide-react'

type Item = {
  key: string
  title: string
  version: string
  summary: string
  hash: string
  clauses: { heading: string; paragraphs: string[] }[]
  signed: { id: string; signedName: string; signedAt: string } | null
  previousVersion: string | null
}

const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function AgreementText({ item }: { item: Item }) {
  return (
    <div className="space-y-5 text-[15px] leading-relaxed" style={{ color: '#d8d0c0', fontFamily: 'var(--font-inter)' }}>
      {item.clauses.map((c, i) => (
        <section key={c.heading}>
          <h3 className="text-base mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {i + 1}. {c.heading}
          </h3>
          {c.paragraphs.map((p, j) => (
            <p key={j} className="mb-2 whitespace-pre-line">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}

function SignCard({ item, defaultName }: { item: Item; defaultName: string }) {
  const router = useRouter()
  const [agree, setAgree] = useState(false)
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)

  async function sign() {
    setBusy(true)
    try {
      const res = await fetch('/api/partner-agreements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: item.key, hash: item.hash, signedName: name, agree }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not sign. Please try again.')
      toast.success(`${item.title} signed. A copy is on its way to your email.`)
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
      if ((err as Error).message.includes('updated')) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const nameOk = name.trim().split(/\s+/).length >= 2 && name.trim().length >= 5

  return (
    <article style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
      <header className="p-5 md:p-6" style={{ borderBottom: '1px solid #1e2e1f' }}>
        <p className="text-[11px] tracking-[0.18em] uppercase mb-1" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
          To sign · Version {item.version}
        </p>
        <h2 className="text-xl md:text-2xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          {item.title}
        </h2>
        <p className="mt-1 text-sm" style={text}>
          {item.summary}
        </p>
        {item.previousVersion && (
          <p className="mt-3 text-sm p-3" style={{ background: 'rgba(201,168,76,0.08)', color: '#e6d3a1', fontFamily: 'var(--font-inter)' }}>
            We have updated this agreement since you signed version {item.previousVersion}. Please read and sign the new version to keep adding listings.
          </p>
        )}
      </header>
      <div className="p-5 md:p-6 max-h-[60vh] overflow-y-auto" tabIndex={0} aria-label={`${item.title} full text`}>
        <AgreementText item={item} />
      </div>
      <footer className="p-5 md:p-6 space-y-4" style={{ borderTop: '1px solid #1e2e1f' }}>
        <label className="flex items-start gap-3 cursor-pointer text-sm" style={{ color: '#d8d0c0', fontFamily: 'var(--font-inter)' }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 w-4 h-4 accent-[#C9A84C] shrink-0" />
          I have read the {item.title} and agree to it on behalf of my business.
        </label>
        <label className="block">
          <span className="block text-[11px] tracking-[0.15em] uppercase mb-2" style={text}>
            Type your full legal name to sign
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="w-full min-h-12 px-4 text-lg outline-none focus:ring-1 focus:ring-[#C9A84C]"
            style={{ background: '#080c08', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-playfair)', fontStyle: 'italic' }}
          />
        </label>
        <button
          type="button"
          onClick={sign}
          disabled={!agree || !nameOk || busy}
          className="sheen inline-flex items-center justify-center gap-2 min-h-12 px-8 w-full sm:w-auto text-xs tracking-[0.18em] uppercase disabled:opacity-50"
          style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
          Sign agreement
        </button>
        <p className="text-xs" style={text}>
          Your typed name is your electronic signature. We record the date, time, your IP address and device with the exact text above.
        </p>
      </footer>
    </article>
  )
}

function SignedCard({ item }: { item: Item }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="p-5 md:p-6" style={{ background: '#0f1a10', border: '1px solid rgba(111,191,115,0.35)' }}>
      <div className="flex items-start gap-3">
        <CheckCircle2 size={20} className="shrink-0 mt-1" style={{ color: '#6fbf73' }} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {item.title} <span className="text-xs" style={text}>v{item.version}</span>
          </h2>
          <p className="text-sm mt-0.5" style={text}>
            Signed by {item.signed!.signedName} on {formatDate(item.signed!.signedAt)}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <a
              href={`/api/partner-agreements/${item.signed!.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 min-h-11 px-4 text-xs tracking-[0.14em] uppercase"
              style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
            >
              <FileText size={14} /> Signed copy (PDF)
            </a>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="min-h-11 px-4 text-xs tracking-[0.14em] uppercase"
              style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
            >
              {open ? 'Hide text' : 'Read text'}
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid #1e2e1f' }}>
          <AgreementText item={item} />
        </div>
      )}
    </article>
  )
}

export default function AgreementClient({ items, defaultName }: { items: Item[]; defaultName: string }) {
  const toSign = items.filter((i) => !i.signed)
  return (
    <div className="space-y-6">
      {toSign.length > 1 && (
        <p className="text-sm" style={text}>
          {toSign.length} documents to sign.
        </p>
      )}
      {items.map((item) => (item.signed ? <SignedCard key={item.key} item={item} /> : <SignCard key={item.key} item={item} defaultName={defaultName} />))}
      {toSign.length === 0 && (
        <div className="p-6 md:p-8 text-center" style={{ border: '1px solid rgba(201,168,76,0.3)', background: 'linear-gradient(120deg, rgba(201,168,76,0.1), transparent)' }}>
          <p className="text-2xl mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            You&apos;re all set
          </p>
          <p className="text-sm mb-5" style={text}>
            Add your first listing. Our team polishes it and publishes it to the catalogue.
          </p>
          <Link
            href="/admin/listings/new"
            className="sheen group inline-flex items-center justify-center gap-3 min-h-12 px-8 text-xs tracking-[0.18em] uppercase"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Add your first listing <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      )}
    </div>
  )
}
