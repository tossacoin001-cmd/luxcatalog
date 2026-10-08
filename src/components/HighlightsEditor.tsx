'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { splitHighlights } from '@/lib/utils'

const inputStyle = {
  background: '#0f1a10',
  border: '1px solid #1e2e1f',
  color: '#f5f0e8',
  fontFamily: 'var(--font-inter)',
}

// One highlight per row, so customers see a clean outline instead of a
// paragraph. Pasting a block of text (lines, bullets, commas) splits it into
// separate highlights automatically.
export default function HighlightsEditor({
  value,
  onChange,
  max = 15,
  examples = '4 en-suite bedrooms, Private pool, 24/7 power and security',
}: {
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  examples?: string
}) {
  const [draft, setDraft] = useState('')

  const add = (items: string[]) => {
    const merged = [...value]
    for (const item of items) {
      const clean = item.trim()
      if (clean && !merged.some((m) => m.toLowerCase() === clean.toLowerCase()) && merged.length < max) merged.push(clean)
    }
    onChange(merged)
  }

  const commitDraft = () => {
    if (!draft.trim()) return
    add(splitHighlights(draft).length > 1 ? splitHighlights(draft) : [draft])
    setDraft('')
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ol className="space-y-2">
          {value.map((h, i) => (
            <li key={`${h}-${i}`} className="flex items-center gap-2">
              <span className="w-6 text-xs text-right shrink-0" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
                {i + 1}.
              </span>
              <input
                value={h}
                onChange={(e) => onChange(value.map((v, idx) => (idx === i ? e.target.value : v)))}
                className="flex-1 h-11 px-3 text-sm focus:outline-none"
                style={inputStyle}
                aria-label={`Highlight ${i + 1}`}
              />
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="flex items-center justify-center w-9 h-11 disabled:opacity-30" style={{ color: '#908673' }}>
                <ArrowUp size={14} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move down" className="flex items-center justify-center w-9 h-11 disabled:opacity-30" style={{ color: '#908673' }}>
                <ArrowDown size={14} />
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} aria-label="Remove highlight" className="flex items-center justify-center w-9 h-11 hover:text-lux-sold" style={{ color: '#908673' }}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ol>
      )}

      {value.length < max && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitDraft()
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              const parts = splitHighlights(text)
              if (parts.length > 1) {
                e.preventDefault()
                add(parts)
              }
            }}
            placeholder={value.length ? 'Add another highlight' : `e.g. ${examples}`}
            className="flex-1 h-11 px-3 text-sm focus:outline-none"
            style={inputStyle}
            aria-label="New highlight"
          />
          <button
            type="button"
            onClick={commitDraft}
            className="inline-flex items-center gap-1.5 h-11 px-4 text-xs tracking-[0.14em] uppercase"
            style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
          >
            <Plus size={13} /> Add
          </button>
        </div>
      )}
      <p className="text-xs" style={{ color: '#908673', fontFamily: 'var(--font-inter)' }}>
        One point per line, short and specific. Tip: paste a whole list or paragraph and it splits into points automatically.
      </p>
    </div>
  )
}
