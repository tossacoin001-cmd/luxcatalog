import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'

export type Crumb = { label: string; href?: string }

// In-page way back on every catalog level. Phones get one large "Back to
// <parent>" target (a full trail would truncate); tablet and desktop get the
// full trail. The parent link is a real URL rather than history.back(), so it
// also works for visitors who arrived from a shared link or search result.
export default function Breadcrumbs({ trail, overlay = false }: { trail: Crumb[]; overlay?: boolean }) {
  const parent = [...trail].reverse().find((c, i) => i > 0 && c.href)
  const color = overlay ? '#e8dfcf' : '#9a8f7a'
  const shadow = overlay ? '0 1px 12px rgba(0,0,0,0.7)' : undefined

  return (
    <nav aria-label="Breadcrumb" style={{ fontFamily: 'var(--font-inter)' }}>
      {parent && (
        <Link
          href={parent.href!}
          className="sm:hidden inline-flex items-center gap-2 min-h-11 pr-3 text-xs tracking-[0.16em] uppercase transition-colors hover:text-lux-gold"
          style={{ color, textShadow: shadow }}
        >
          <ArrowLeft size={15} />
          Back to {parent.label}
        </Link>
      )}
      <ol className="hidden sm:flex flex-wrap items-center gap-x-1 text-xs tracking-[0.14em] uppercase">
        {parent && (
          <li className="mr-3">
            <Link
              href={parent.href!}
              aria-label={`Back to ${parent.label}`}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-lux-gold hover:text-lux-bg"
              style={{ border: `1px solid ${overlay ? 'rgba(232,223,207,0.45)' : 'rgba(201,168,76,0.35)'}`, color: overlay ? '#f5f0e8' : '#C9A84C', background: overlay ? 'rgba(8,12,8,0.35)' : undefined, backdropFilter: overlay ? 'blur(8px)' : undefined }}
            >
              <ArrowLeft size={15} />
            </Link>
          </li>
        )}
        {trail.map((c, i) => {
          const last = i === trail.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1 min-w-0">
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="inline-flex items-center min-h-10 px-1 transition-colors hover:text-lux-gold"
                  style={{ color, textShadow: shadow }}
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="px-1 truncate max-w-[22ch]" style={{ color: overlay ? '#e4c878' : '#C9A84C', textShadow: shadow }}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight size={12} aria-hidden style={{ color: overlay ? '#cfc4b2' : '#908673' }} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
