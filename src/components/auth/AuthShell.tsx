import Link from 'next/link'
import PasswordInput from '@/components/auth/PasswordInput'

// Shared frame for every auth screen (sign in/up, reset, 2FA) so they read
// as one flow and match the storefront's palette.
export default function AuthShell({
  eyebrow = 'Lux Catalog',
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: '#f4f0e8' }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 40%, rgba(122,92,36,0.02) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center min-h-11 mb-1"
            data-wordmark
            style={{ color: '#14130f', fontSize: '1.6rem' }}
          >
            {eyebrow}
          </Link>
          <h1 className="text-3xl" style={{ fontFamily: 'var(--font-playfair)', color: '#14130f' }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-sm" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="p-8" style={{ background: '#fbf9f4', border: '1px solid #d6cfbf' }}>
          {children}
        </div>

        {footer && (
          <div className="mt-6 text-center text-sm" style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

const inputClass = 'w-full h-11 px-4 text-sm focus:outline-none focus:border-lux-gold-muted'
const inputStyle = { background: '#ece6d9', border: '1px solid #d6cfbf', color: '#14130f', fontFamily: 'var(--font-inter)' }

// Password fields get a show/hide toggle automatically.
export function AuthField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span
        className="block text-[11px] tracking-[0.15em] uppercase mb-2"
        style={{ color: '#5e584c', fontFamily: 'var(--font-inter)' }}
      >
        {label}
      </span>
      {props.type === 'password' ? (
        <PasswordInput {...props} className={inputClass} style={inputStyle} />
      ) : (
        <input {...props} className={inputClass} style={inputStyle} />
      )}
    </label>
  )
}

export function AuthSubmit({ loading, children }: { loading?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-11 text-xs tracking-[0.18em] uppercase transition-opacity disabled:opacity-60"
      style={{ background: '#14130f', color: '#f4f0e8', fontFamily: 'var(--font-inter)' }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="text-sm px-4 py-3"
      style={{ background: 'rgba(180,60,60,0.08)', border: '1px solid rgba(180,60,60,0.35)', color: '#8a3b2e', fontFamily: 'var(--font-inter)' }}
    >
      {message}
    </p>
  )
}

export function AuthNotice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      className="text-sm px-4 py-3"
      style={{ background: 'rgba(122,92,36,0.04)', border: '1px solid rgba(20,19,15,0.15)', color: '#7a5c24', fontFamily: 'var(--font-inter)' }}
    >
      {message}
    </p>
  )
}
