'use client'

// Opens the concierge panel (see ConciergeButton) from anywhere on the page.
export const CONCIERGE_EVENT = 'lux:concierge'

export default function OpenConcierge({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <button type="button" className={className} style={style} onClick={() => window.dispatchEvent(new CustomEvent(CONCIERGE_EVENT))}>
      {children}
    </button>
  )
}
