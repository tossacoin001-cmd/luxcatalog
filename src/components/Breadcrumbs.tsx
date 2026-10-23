import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'

export type Crumb = { label: string; href?: string }

// In-page way back on every catalog level. Phones get one large "Back to
// <parent>" target (a full trail would truncate); tablet and desktop get the
// full trail. The parent link is a real URL rather than history.back(), so it
// also works for visitors who arrived from a shared link or search result.
export default function Breadcrumbs({ trail, overlay = false }: { trail: Crumb[]; overlay?: boolean }) {
  const parent = [...trail].reverse().find((c, i) => i > 0 && c.href)
  const color = overlay ? '#3a362d' : '#5e584c'
  const shadow = undefined
  // Over a photo: a dark glass backing keeps the way back readable on any image.
  const backing = overlay ? { background: 'rgba(244,240,232,0.94)', border: '1px solid #d6cfbf' } : {}

  return (
    <nav aria-label="Breadcrumb" style={{ fontFamily: 'var(--font-inter)' }}>
      {parent && (
        <Link
          href={parent.href!}
          className={`sm:hidden inline-flex items-center gap-2 min-h-11 text-xs tracking-[0.16em] uppercase transition-colors hover:text-lux-text ${overlay ? 'px-3' : 'pr-3'}`}
          style={{ color, textShadow: shadow, ...backing }}
        >
          <ArrowLeft size={15} />
          Back to {parent.label}
        </Link>
      )}
      <ol className={`hidden sm:flex flex-wrap items-center gap-x-1 text-xs tracking-[0.14em] uppercase ${overlay ? 'w-fit pl-1 pr-3 py-1' : ''}`} style={backing}>
        {parent && (
          <li className="mr-3">
            <Link
              href={parent.href!}
              aria-label={`Back to ${parent.label}`}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-[#14130f] hover:text-[#f4f0e8]"
              style={{ border: '1px solid #c4bcaa', color: '#14130f' }}
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
                  className="inline-flex items-center min-h-10 px-1 transition-colors hover:text-lux-text"
                  style={{ color, textShadow: shadow }}
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="px-1 truncate max-w-[22ch]" style={{ color: '#14130f', textShadow: shadow }}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight size={12} aria-hidden style={{ color: overlay ? '#cfc4b2' : '#5e584c' }} />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
