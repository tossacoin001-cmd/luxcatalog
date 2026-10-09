'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, CheckCircle2, Clock, FileText, Loader2, Upload, X, AlertCircle } from 'lucide-react'
import {
  ALLOWED_DOC_TYPES,
  MAX_DOC_BYTES,
  PARTNER_TYPES,
  isDocRequired,
  missingForSubmit,
  partnerTypeSpec,
  type PartnerTypeKey,
} from '@/lib/partner-requirements'
import { SUBCATEGORIES } from '@/lib/taxonomy'

type Doc = { id: string; kind: string; fileName: string; contentType: string; size: number; expiresAt: string | null; status: string; note: string | null }
type App = {
  id: string
  partnerType: PartnerTypeKey
  status: 'draft' | 'submitted' | 'info_requested' | 'approved' | 'rejected'
  legalForm: string
  businessName: string
  contactName: string
  phone: string
  city: string
  country: string
  website: string | null
  socialHandle: string | null
  cacNumber: string | null
  collections: string[]
  about: string
  yearsOperating: number | null
  declarations: Record<string, string> | null
  reviewNote: string | null
  documents: Doc[]
}

const EDITABLE = ['draft', 'info_requested', 'rejected']
const STEPS = ['Partner type', 'Business', 'Documents', 'Standards', 'Review']

const inputStyle = { background: '#0f1a10', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }
const labelCls = 'block text-[11px] tracking-[0.15em] uppercase mb-2'
const labelStyle = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }
const fieldCls = 'w-full h-12 px-4 text-base md:text-sm focus:outline-none focus:border-lux-gold-muted'
const text = { color: '#9a8f7a', fontFamily: 'var(--font-inter)' }

// Every collection label, for the "where will you list" checkboxes.
const COLLECTION_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(SUBCATEGORIES).flat().map((s) => [s.key, s.label])
)

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={labelCls} style={labelStyle}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="block mt-1.5 text-xs" style={text}>
          {hint}
        </span>
      )}
    </label>
  )
}

export default function ApplyClient({
  userRole,
  defaults,
  initial,
}: {
  userRole: string
  defaults: { contactName: string; phone: string }
  initial: App | null
}) {
  const [app, setApp] = useState<App | null>(initial)
  const [step, setStep] = useState(initial ? 1 : 0)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef<Partial<App>>({})
  const timer = useRef<number | null>(null)

  const spec = app ? partnerTypeSpec(app.partnerType) : undefined
  const editable = !app || EDITABLE.includes(app.status)
  const missing = useMemo(() => (app ? missingForSubmit(app) : []), [app])

  // Autosave: batch changes and send them 700ms after the last keystroke.
  const flush = useCallback(async () => {
    const patch = pending.current
    pending.current = {}
    if (!Object.keys(patch).length) return
    setSaving('saving')
    try {
      const res = await fetch('/api/partner-application', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error)
      const data = await res.json()
      setApp((prev) => (prev ? { ...prev, status: data.application.status, id: data.application.id } : prev))
      setSaving('saved')
    } catch (err) {
      setSaving('error')
      toast.error((err as Error).message || 'Could not save. Check your connection.')
    }
  }, [])

  const update = (patch: Partial<App>) => {
    setApp((prev) => (prev ? { ...prev, ...patch } : prev))
    pending.current = { ...pending.current, ...patch }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, 700)
  }

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  // On phones the step strip scrolls sideways: keep the current step in view.
  const stepStrip = useRef<HTMLOListElement>(null)
  useEffect(() => {
    stepStrip.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [step])

  async function chooseType(key: PartnerTypeKey) {
    const fresh: App = app
      ? { ...app, partnerType: key, collections: app.collections.filter((c) => partnerTypeSpec(key)?.collections.includes(c)) }
      : {
          id: '',
          partnerType: key,
          status: 'draft',
          legalForm: key === 'security_company' ? 'company' : 'individual',
          businessName: '',
          contactName: defaults.contactName,
          phone: defaults.phone,
          city: '',
          country: 'Nigeria',
          website: null,
          socialHandle: null,
          cacNumber: null,
          collections: partnerTypeSpec(key)?.collections.slice(0, 1) ?? [],
          about: '',
          yearsOperating: null,
          declarations: {},
          reviewNote: null,
          documents: [],
        }
    setApp(fresh)
    pending.current = {
      ...pending.current,
      partnerType: key,
      legalForm: fresh.legalForm,
      contactName: fresh.contactName,
      phone: fresh.phone,
      collections: fresh.collections,
    }
    await flush()
    setStep(1)
  }

  async function submit() {
    if (timer.current) window.clearTimeout(timer.current)
    await flush()
    setSubmitting(true)
    try {
      const res = await fetch('/api/partner-application/submit', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.missing?.length ? `Still needed: ${data.missing[0]}` : data.error || 'Could not submit')
        return
      }
      setApp((prev) => (prev ? { ...prev, status: 'submitted' } : prev))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.success('Application submitted. We’ll be in touch within 2 working days.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Already a partner / decided / under review
  // ---------------------------------------------------------------------------
  if (userRole === 'admin' || userRole === 'team') {
    return (
      <StatusCard
        icon={<CheckCircle2 size={22} style={{ color: '#6fbf73' }} />}
        title="You're on the Lux Catalog team"
        body="Team accounts don't apply as partners. Partner applications are reviewed in the admin panel."
        cta={{ label: 'Review applications', href: '/admin/applications' }}
      />
    )
  }
  if (userRole === 'partner' && app?.status !== 'info_requested') {
    return (
      <StatusCard
        icon={<CheckCircle2 size={22} style={{ color: '#6fbf73' }} />}
        title="You're already a partner"
        body="Your partner dashboard is where you add and manage listings."
        cta={{ label: 'Open partner dashboard', href: '/admin' }}
      />
    )
  }
  if (app?.status === 'submitted') {
    return (
      <StatusCard
        icon={<Clock size={22} style={{ color: '#C9A84C' }} />}
        title="Your application is with our team"
        body="We review every partner personally, usually within 2 working days. We'll email you, and may call to confirm a few details."
      />
    )
  }
  if (app?.status === 'approved') {
    return (
      <StatusCard
        icon={<CheckCircle2 size={22} style={{ color: '#6fbf73' }} />}
        title="Approved: welcome to Lux Catalog"
        body="Next, sign your partner agreement, then add your first listing from the partner dashboard."
        cta={{ label: 'Sign your partner agreement', href: '/partners/agreement' }}
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Editable flow
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      {app?.status === 'info_requested' && app.reviewNote && (
        <Notice tone="warn" title="Our team needs a little more">
          {app.reviewNote}
        </Notice>
      )}
      {app?.status === 'rejected' && (
        <Notice tone="alert" title="Your previous application wasn't approved">
          {app.reviewNote ?? 'You can update your details and apply again.'}
        </Notice>
      )}

      {/* Step indicator */}
      <ol ref={stepStrip} className="flex items-center gap-2 overflow-x-auto no-scrollbar" aria-label="Application steps">
        {STEPS.map((s, i) => {
          const reachable = i === 0 || !!app
          const active = i === step
          return (
            <li key={s} className="shrink-0">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(i)}
                aria-current={active ? 'step' : undefined}
                className="flex items-center gap-2 min-h-11 px-3 text-xs tracking-[0.12em] uppercase disabled:opacity-40"
                style={{
                  fontFamily: 'var(--font-inter)',
                  color: active ? '#080c08' : '#9a8f7a',
                  background: active ? '#C9A84C' : 'transparent',
                  border: `1px solid ${active ? '#C9A84C' : '#1e2e1f'}`,
                }}
              >
                <span>{i + 1}</span>
                <span>{s}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="flex justify-end -mt-4 min-h-5 text-xs" style={text} aria-live="polite">
        {saving === 'saving' && 'Saving…'}
        {saving === 'saved' && 'All changes saved'}
        {saving === 'error' && <span style={{ color: '#e8b4b4' }}>Not saved, check your connection</span>}
      </div>

      {/* Step 0: type */}
      {step === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PARTNER_TYPES.map((t) => {
            const selected = app?.partnerType === t.key
            return (
              <button
                key={t.key}
                type="button"
                disabled={!editable}
                onClick={() => chooseType(t.key)}
                className="text-left p-5 transition-colors hover:border-lux-gold-muted"
                style={{ background: '#0f1a10', border: `1px solid ${selected ? '#C9A84C' : '#1e2e1f'}` }}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                    {t.label}
                  </span>
                  {selected && <Check size={16} style={{ color: '#C9A84C' }} />}
                </span>
                <span className="block mt-1 text-sm" style={text}>
                  {t.tagline}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Step 1: business */}
      {step === 1 && app && spec && (
        <div className="space-y-5">
          <div>
            <span className={labelCls} style={labelStyle}>
              Applying as
            </span>
            <div className="flex" role="radiogroup" style={{ border: '1px solid rgba(201,168,76,0.3)', width: 'fit-content' }}>
              {(['individual', 'company'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={app.legalForm === f}
                  disabled={app.partnerType === 'security_company' && f === 'individual'}
                  onClick={() => update({ legalForm: f })}
                  className="min-h-11 px-5 text-xs tracking-[0.14em] uppercase disabled:opacity-30"
                  style={{ background: app.legalForm === f ? '#C9A84C' : 'transparent', color: app.legalForm === f ? '#080c08' : '#9a8f7a', fontFamily: 'var(--font-inter)' }}
                >
                  {f === 'individual' ? 'Individual' : 'Registered company'}
                </button>
              ))}
            </div>
            {app.partnerType === 'security_company' && (
              <span className="block mt-1.5 text-xs" style={text}>
                Security companies must be registered and licensed.
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={app.legalForm === 'company' ? 'Company name *' : 'Trading or brand name *'}>
              <input className={fieldCls} style={inputStyle} value={app.businessName} onChange={(e) => update({ businessName: e.target.value })} />
            </Field>
            {app.legalForm === 'company' && (
              <Field label="CAC number *">
                <input className={fieldCls} style={inputStyle} value={app.cacNumber ?? ''} onChange={(e) => update({ cacNumber: e.target.value })} placeholder="RC 1234567" />
              </Field>
            )}
            <Field label="Contact person *">
              <input className={fieldCls} style={inputStyle} value={app.contactName} onChange={(e) => update({ contactName: e.target.value })} autoComplete="name" />
            </Field>
            <Field label="Phone / WhatsApp *">
              <input className={fieldCls} style={inputStyle} type="tel" value={app.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="+234 800 000 0000" autoComplete="tel" />
            </Field>
            <Field label="City *">
              <input className={fieldCls} style={inputStyle} value={app.city} onChange={(e) => update({ city: e.target.value })} placeholder="Lagos" />
            </Field>
            <Field label="Country">
              <input className={fieldCls} style={inputStyle} value={app.country} onChange={(e) => update({ country: e.target.value })} />
            </Field>
            <Field label="Website (optional)">
              <input className={fieldCls} style={inputStyle} value={app.website ?? ''} onChange={(e) => update({ website: e.target.value })} placeholder="https://" />
            </Field>
            <Field label="Instagram or social (optional)">
              <input className={fieldCls} style={inputStyle} value={app.socialHandle ?? ''} onChange={(e) => update({ socialHandle: e.target.value })} placeholder="@yourbrand" />
            </Field>
            <Field label="Years in operation (optional)">
              <input className={fieldCls} style={inputStyle} type="number" min={0} inputMode="numeric" value={app.yearsOperating ?? ''} onChange={(e) => update({ yearsOperating: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
          </div>
          <div>
            <span className={labelCls} style={labelStyle}>
              Where will you list? *
            </span>
            <div className="flex flex-wrap gap-2">
              {spec.collections.map((c) => {
                const on = app.collections.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ collections: on ? app.collections.filter((x) => x !== c) : [...app.collections, c] })}
                    className="min-h-11 px-4 text-xs tracking-[0.12em] uppercase"
                    style={{ border: `1px solid ${on ? '#C9A84C' : '#1e2e1f'}`, background: on ? 'rgba(201,168,76,0.12)' : 'transparent', color: on ? '#e4c878' : '#9a8f7a', fontFamily: 'var(--font-inter)' }}
                  >
                    {COLLECTION_LABEL[c] ?? c}
                  </button>
                )
              })}
            </div>
          </div>
          <Field label="About your business *" hint="What you offer, where, and what makes it exceptional. A few sentences is perfect.">
            <textarea
              rows={5}
              className="w-full px-4 py-3 text-base md:text-sm focus:outline-none resize-y"
              style={inputStyle}
              value={app.about}
              onChange={(e) => update({ about: e.target.value })}
            />
          </Field>
          <NavButtons onBack={() => setStep(0)} onNext={() => setStep(2)} />
        </div>
      )}

      {/* Step 2: documents */}
      {step === 2 && app && spec && (
        <div className="space-y-4">
          <p className="text-sm" style={text}>
            Clear photos or PDFs, up to 10MB each. Your documents are stored privately and only seen by our verification team.
          </p>
          {spec.docs
            .filter((d) => d.required !== 'company' || app.legalForm === 'company')
            .map((d) => (
              <DocumentRow
                key={d.kind}
                requirement={d}
                required={isDocRequired(d, app.legalForm)}
                doc={app.documents.find((x) => x.kind === d.kind)}
                disabled={!editable}
                onChange={(doc) =>
                  setApp((prev) =>
                    prev ? { ...prev, documents: doc ? [...prev.documents.filter((x) => x.kind !== d.kind), doc] : prev.documents.filter((x) => x.kind !== d.kind) } : prev
                  )
                }
              />
            ))}
          <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </div>
      )}

      {/* Step 3: standards */}
      {step === 3 && app && spec && (
        <div className="space-y-4">
          <p className="text-sm" style={text}>
            Lux Catalog clients trust every partner. Please confirm each commitment.
          </p>
          {spec.declarations.map((d) => {
            const on = !!app.declarations?.[d.key]
            return (
              <label key={d.key} className="flex items-start gap-4 p-4 cursor-pointer" style={{ background: '#0f1a10', border: `1px solid ${on ? 'rgba(201,168,76,0.5)' : '#1e2e1f'}` }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => {
                    const next = { ...(app.declarations ?? {}) }
                    if (e.target.checked) next[d.key] = new Date().toISOString()
                    else delete next[d.key]
                    update({ declarations: next })
                  }}
                  className="mt-1 w-5 h-5 shrink-0 accent-[#C9A84C]"
                />
                <span className="text-sm leading-relaxed" style={{ color: '#d6cdbd', fontFamily: 'var(--font-inter)' }}>
                  {d.text}
                </span>
              </label>
            )
          })}
          <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)} />
        </div>
      )}

      {/* Step 4: review */}
      {step === 4 && app && spec && (
        <div className="space-y-6">
          <div className="p-6 space-y-2" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
            <p className="text-lg" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
              {app.businessName || 'Your business'}
            </p>
            <p className="text-sm" style={text}>
              {spec.label} · {app.city || 'City not set'} · {app.collections.map((c) => COLLECTION_LABEL[c] ?? c).join(', ') || 'No collections'}
            </p>
            <p className="text-sm" style={text}>
              {app.documents.length} document{app.documents.length === 1 ? '' : 's'} uploaded
            </p>
          </div>
          {missing.length > 0 ? (
            <Notice tone="warn" title="Still needed before you can submit">
              <ul className="mt-2 space-y-1.5">
                {missing.map((m) => (
                  <li key={m} className="flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" /> {m}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : (
            <Notice tone="ok" title="Everything is in place">
              Submit and our team will review your application, usually within 2 working days.
            </Notice>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={() => setStep(3)} className="min-h-12 px-6 text-xs tracking-[0.16em] uppercase" style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              Back
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || missing.length > 0}
              className="sheen inline-flex items-center justify-center gap-2 min-h-12 px-8 text-xs tracking-[0.18em] uppercase disabled:opacity-50"
              style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {app.status === 'info_requested' ? 'Resubmit application' : 'Submit application'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Matches SERVER_UPLOAD_MAX_BYTES in lib/partners (server-side uploads).
const SERVER_UPLOAD_LIMIT = 4 * 1024 * 1024

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function NavButtons({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex justify-between gap-3 pt-2">
      <button type="button" onClick={onBack} className="min-h-12 px-6 text-xs tracking-[0.16em] uppercase" style={{ border: '1px solid #1e2e1f', color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
        Back
      </button>
      <button type="button" onClick={onNext} className="min-h-12 px-8 text-xs tracking-[0.16em] uppercase" style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
        Continue
      </button>
    </div>
  )
}

function Notice({ tone, title, children }: { tone: 'ok' | 'warn' | 'alert'; title: string; children: React.ReactNode }) {
  const c = tone === 'ok' ? '#6fbf73' : tone === 'warn' ? '#e8a84c' : '#e85c4c'
  return (
    <div className="p-5 text-sm" role={tone === 'alert' ? 'alert' : undefined} style={{ border: `1px solid ${c}55`, background: `${c}10`, color: '#d6cdbd', fontFamily: 'var(--font-inter)' }}>
      <p className="mb-1" style={{ color: c }}>
        {title}
      </p>
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

function StatusCard({ icon, title, body, cta }: { icon: React.ReactNode; title: string; body: string; cta?: { label: string; href: string } }) {
  return (
    <div className="p-8 text-center space-y-4" style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}>
      <div className="flex justify-center">{icon}</div>
      <p className="text-2xl" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
        {title}
      </p>
      <p className="text-sm max-w-md mx-auto leading-relaxed" style={text}>
        {body}
      </p>
      {cta && (
        <Link href={cta.href} className="inline-flex items-center justify-center min-h-12 px-8 text-xs tracking-[0.18em] uppercase" style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}>
          {cta.label}
        </Link>
      )}
    </div>
  )
}

function DocumentRow({
  requirement,
  required,
  doc,
  disabled,
  onChange,
}: {
  requirement: { kind: string; label: string; help: string; expires?: boolean }
  required: boolean
  doc?: Doc
  disabled: boolean
  onChange: (doc: Doc | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [expiry, setExpiry] = useState(doc?.expiresAt?.slice(0, 10) ?? '')
  const input = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (file.size > MAX_DOC_BYTES) return toast.error('Files must be under 10MB')
    if (!ALLOWED_DOC_TYPES.includes(file.type)) return toast.error('Upload a PDF or a photo (JPG, PNG, WEBP, HEIC)')
    if (requirement.expires && !expiry) return toast.error(`Add the expiry date for ${requirement.label} first`)
    setBusy(true)
    setProgress(null)
    const endpoint = '/api/partner-application/documents'
    const post = async (body: BodyInit, json = true) => {
      const res = await fetch(endpoint, { method: 'POST', body, ...(json ? { headers: { 'content-type': 'application/json' } } : {}) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || (res.status === 413 ? 'That file is too large. Try a smaller photo or a compressed PDF.' : 'Upload failed. Please try again.'))
      return data
    }
    try {
      // Send the file straight to private storage through a presigned URL
      // for a path the server chose; otherwise (store not set up) send it
      // through the server.
      const meta = { kind: requirement.kind, fileName: file.name, contentType: file.type, size: file.size, expiresAt: expiry || undefined }
      const grant = await post(JSON.stringify({ action: 'start', ...meta }))
      let data
      if (grant.direct) {
        const { uploadPresigned } = await import('@vercel/blob/client')
        const sent = await uploadPresigned(grant.pathname, file, {
          access: 'private',
          handleUploadUrl: `${endpoint}/presign`,
          clientPayload: JSON.stringify(meta),
          contentType: file.type,
          multipart: file.size > 5 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        }).then(
          () => true,
          () => false
        )
        if (sent) data = await post(JSON.stringify({ action: 'complete', kind: requirement.kind, pathname: grant.pathname, expiresAt: expiry || undefined }))
        else if (file.size > SERVER_UPLOAD_LIMIT) throw new Error('Upload interrupted. Check your connection and try again.')
      }
      if (!data) {
        // Store not set up, or the direct upload failed: go through the server.
        setProgress(null)
        if (file.size > SERVER_UPLOAD_LIMIT) throw new Error('Files must be under 4MB here. Try a smaller photo or a compressed PDF.')
        const body = new FormData()
        body.append('file', file)
        body.append('kind', requirement.kind)
        if (expiry) body.append('expiresAt', expiry)
        data = await post(body, false)
      }
      onChange({ ...data.document, expiresAt: data.document.expiresAt })
      toast.success(`${requirement.label} uploaded`)
    } catch (err) {
      toast.error((err as Error).message || 'Upload failed. Please try again.')
    } finally {
      setBusy(false)
      setProgress(null)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    if (!doc) return
    setBusy(true)
    const res = await fetch(`/api/partner-application/documents/${doc.id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) onChange(null)
    else toast.error('Could not remove the file')
  }

  return (
    <div className="p-5 space-y-3" style={{ background: '#0f1a10', border: `1px solid ${doc ? 'rgba(111,191,115,0.35)' : '#1e2e1f'}` }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
            {requirement.label}{' '}
            <span className="text-[11px] tracking-[0.14em] uppercase ml-1" style={{ color: required ? '#C9A84C' : '#908673', fontFamily: 'var(--font-inter)' }}>
              {required ? 'Required' : 'Optional'}
            </span>
          </p>
          <p className="text-xs mt-1 leading-relaxed" style={text}>
            {requirement.help}
          </p>
        </div>
        {doc && <CheckCircle2 size={18} className="shrink-0" style={{ color: '#6fbf73' }} aria-label="Uploaded" />}
      </div>

      {requirement.expires && (
        <Field label="Expiry date">
          <input type="date" className={fieldCls} style={inputStyle} value={expiry} disabled={disabled} onChange={(e) => setExpiry(e.target.value)} />
        </Field>
      )}

      {doc ? (
        <div className="flex flex-wrap items-center gap-3 text-sm" style={text}>
          <a href={`/api/partner-documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 min-h-11 hover:text-lux-gold" style={{ color: '#d6cdbd' }}>
            <FileText size={15} /> {doc.fileName} · {fileSize(doc.size)}
          </a>
          {!disabled && (
            <>
              <button type="button" onClick={() => input.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 min-h-11 px-3 text-xs tracking-[0.12em] uppercase" style={{ border: '1px solid #1e2e1f', color: '#C9A84C' }}>
                {busy ? (progress !== null ? `${progress}%` : <Loader2 size={14} className="animate-spin" />) : 'Replace'}
              </button>
              <button type="button" onClick={remove} disabled={busy} aria-label={`Remove ${requirement.label}`} className="inline-flex items-center justify-center w-11 h-11" style={{ color: '#908673' }}>
                <X size={15} />
              </button>
            </>
          )}
        </div>
      ) : (
        !disabled && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 min-h-12 px-5 text-xs tracking-[0.14em] uppercase disabled:opacity-60"
            style={{ border: '1px dashed rgba(201,168,76,0.5)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {busy ? (progress !== null ? `Uploading ${progress}%` : 'Uploading…') : 'Upload file'}
          </button>
        )
      )}
      <input ref={input} type="file" hidden accept={ALLOWED_DOC_TYPES.join(',')} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  )
}
