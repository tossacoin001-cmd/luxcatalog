'use client'

import { categoryLabels } from '@/lib/utils'
import { MODE_LABELS, defaultMode, specTemplate, subcategoriesFor, type Mode } from '@/lib/taxonomy'

const inputStyle = {
  background: '#0f1a10',
  border: '1px solid #1e2e1f',
  color: '#f5f0e8',
  fontFamily: 'var(--font-inter)',
  appearance: 'none' as const,
}
const labelStyle = { color: '#908673', fontFamily: 'var(--font-inter)' }
const labelClass = 'block text-[11px] tracking-[0.15em] uppercase mb-2'
const fieldClass = 'w-full h-11 px-4 text-sm focus:outline-none'

export type CategoryValue = { category: string; subcategory: string | null; mode: Mode }

// Category → sub-collection → mode, kept consistent with src/lib/taxonomy.ts.
// Choosing a sub-collection sets its natural mode (e.g. Luxury Shortlets →
// Book Online) and offers its ready-made spec fields via onTemplate.
export default function CategoryPicker({
  value,
  onChange,
  onTemplate,
  allowModeOverride = false,
}: {
  value: CategoryValue
  onChange: (v: CategoryValue) => void
  onTemplate?: (labels: string[]) => void
  allowModeOverride?: boolean
}) {
  const subs = subcategoriesFor(value.category)

  const pickCategory = (category: string) => {
    const first = subcategoriesFor(category)[0]?.key ?? null
    onChange({ category, subcategory: first, mode: defaultMode(category, first) })
    onTemplate?.(specTemplate(first))
  }

  const pickSub = (subcategory: string) => {
    onChange({ ...value, subcategory, mode: defaultMode(value.category, subcategory) })
    onTemplate?.(specTemplate(subcategory))
  }

  return (
    <>
      <div>
        <label className={labelClass} style={labelStyle}>
          Category <span style={{ color: '#C9A84C' }}>*</span>
        </label>
        <select value={value.category} onChange={(e) => pickCategory(e.target.value)} className={fieldClass} style={inputStyle}>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {subs.length > 1 && (
        <div>
          <label className={labelClass} style={labelStyle}>
            Collection <span style={{ color: '#C9A84C' }}>*</span>
          </label>
          <select value={value.subcategory ?? ''} onChange={(e) => pickSub(e.target.value)} className={fieldClass} style={inputStyle}>
            {subs.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass} style={labelStyle}>
          How it&apos;s offered
        </label>
        {allowModeOverride ? (
          <select value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as Mode })} className={fieldClass} style={inputStyle}>
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        ) : (
          <p className="h-11 flex items-center px-4 text-sm" style={{ ...inputStyle, color: '#C9A84C' }}>
            {MODE_LABELS[value.mode]}
          </p>
        )}
      </div>
    </>
  )
}
