'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowLeft, Sparkles, RotateCcw } from 'lucide-react'
import { categoryHrefs } from '@/lib/utils'

const steps = [
  {
    id: 'categories',
    question: 'Which asset categories interest you?',
    sub: 'Select all that apply.',
    type: 'multi',
    options: [
      { key: 'real_estate', label: 'Real Estate', icon: '🏛' },
      { key: 'supercar', label: 'Supercars', icon: '🏎' },
      { key: 'yacht', label: 'Yachts', icon: '⛵' },
      { key: 'decor', label: 'Interior Decor', icon: '🪑' },
      { key: 'commercial', label: 'Commercial', icon: '🏢' },
      { key: 'lifestyle', label: 'Lifestyle', icon: '✈' },
    ],
  },
  {
    id: 'budget',
    question: 'What is your budget range?',
    sub: 'Approximate figures are fine.',
    type: 'single',
    options: [
      { key: 'under_1m', label: 'Under $1M' },
      { key: '1m_5m', label: '$1M – $5M' },
      { key: '5m_20m', label: '$5M – $20M' },
      { key: '20m_plus', label: '$20M+' },
      { key: 'poa', label: 'Price On Application' },
    ],
  },
  {
    id: 'location',
    question: 'Which regions are you focused on?',
    sub: 'Select all that interest you.',
    type: 'multi',
    options: [
      { key: 'europe', label: 'Europe' },
      { key: 'middle_east', label: 'Middle East' },
      { key: 'americas', label: 'Americas' },
      { key: 'asia_pacific', label: 'Asia Pacific' },
      { key: 'global', label: 'Global — anywhere' },
    ],
  },
  {
    id: 'lifestyle',
    question: 'Which lifestyle descriptors resonate with you?',
    sub: 'Help us understand your taste.',
    type: 'multi',
    options: [
      { key: 'understated', label: 'Understated & Private' },
      { key: 'bold', label: 'Bold & Iconic' },
      { key: 'investment', label: 'Investment-Focused' },
      { key: 'adventure', label: 'Adventure & Travel' },
      { key: 'art', label: 'Art & Culture' },
      { key: 'family', label: 'Family & Legacy' },
    ],
  },
]

interface Results {
  matches: Array<{
    title: string
    slug: string
    category: string
    reason: string
    matchScore: number
    priceDisplay: string
  }>
  summary: string
}

export default function AIDiscoverClient() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Results | null>(null)
  const [error, setError] = useState('')

  const current = steps[step]

  const toggle = (key: string) => {
    const prev = answers[current.id] ?? []
    if (current.type === 'single') {
      setAnswers({ ...answers, [current.id]: [key] })
    } else {
      setAnswers({
        ...answers,
        [current.id]: prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      })
    }
  }

  const selected = answers[current.id] ?? []
  const canNext = selected.length > 0

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: answers }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setResults(data)
    } catch {
      setError('AI matching failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStep(0)
    setAnswers({})
    setResults(null)
    setError('')
  }

  // Results view
  if (results) {
    return (
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-14">
        {/* Summary */}
        <div
          className="p-7 mb-10"
          style={{ background: '#0f1a10', border: '1px solid rgba(201,168,76,0.2)' }}
        >
          <div className="flex items-start gap-3">
            <Sparkles size={16} style={{ color: '#C9A84C', flexShrink: 0, marginTop: 2 }} />
            <p className="text-sm leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
              {results.summary}
            </p>
          </div>
        </div>

        <h2 className="text-2xl mb-8" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
          Your Matched Assets
        </h2>

        <div className="space-y-5">
          {results.matches.map((match, i) => (
            <div
              key={match.slug}
              className="p-6 flex flex-col md:flex-row md:items-center gap-5"
              style={{ background: '#0f1a10', border: '1px solid #1e2e1f' }}
            >
              {/* Rank */}
              <div
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-lg"
                style={{ border: '1px solid rgba(201,168,76,0.3)', fontFamily: 'var(--font-playfair)', color: '#C9A84C' }}
              >
                {i + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: '#C9A84C', fontFamily: 'var(--font-inter)' }}>
                  {match.category.replace('_', ' ')} · {match.priceDisplay}
                </p>
                <h3 className="text-lg mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
                  {match.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
                  {match.reason}
                </p>
              </div>

              {/* Match score + CTA */}
              <div className="flex flex-col items-end gap-3 flex-shrink-0">
                <div className="text-center">
                  <div
                    className="text-xl mb-0.5"
                    style={{ fontFamily: 'var(--font-playfair)', color: '#C9A84C' }}
                  >
                    {match.matchScore}%
                  </div>
                  <div className="text-[9px] tracking-[0.15em] uppercase" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
                    Match
                  </div>
                </div>
                <Link
                  href={`${categoryHrefs[match.category] ?? '/catalog'}/${match.slug}`}
                  className="text-xs tracking-[0.15em] uppercase px-5 py-2 transition-all hover:opacity-80"
                  style={{ border: '1px solid #C9A84C', color: '#C9A84C', fontFamily: 'var(--font-inter)' }}
                >
                  View Asset
                </Link>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={reset}
          className="mt-10 flex items-center gap-2 text-xs tracking-wider"
          style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}
        >
          <RotateCcw size={12} /> Start Again
        </button>
      </div>
    )
  }

  // Questionnaire
  return (
    <div className="max-w-2xl mx-auto px-6 md:px-12 py-14">
      {/* Progress bar */}
      <div className="flex gap-1 mb-10">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className="flex-1 h-0.5 transition-all duration-500"
            style={{ background: i <= step ? '#C9A84C' : '#1e2e1f' }}
          />
        ))}
      </div>

      {/* Step counter */}
      <p className="text-[10px] tracking-[0.2em] uppercase mb-3" style={{ color: '#5a5248', fontFamily: 'var(--font-inter)' }}>
        Step {step + 1} of {steps.length}
      </p>

      <h2 className="text-2xl md:text-3xl mb-2" style={{ fontFamily: 'var(--font-playfair)', color: '#f5f0e8' }}>
        {current.question}
      </h2>
      <p className="text-sm mb-8" style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}>
        {current.sub}
      </p>

      {/* Options grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
        {current.options.map((opt) => {
          const isSelected = selected.includes(opt.key)
          return (
            <button
              key={opt.key}
              onClick={() => toggle(opt.key)}
              className="p-4 text-left transition-all duration-200 flex flex-col gap-2"
              style={{
                background: isSelected ? 'rgba(201,168,76,0.08)' : '#0f1a10',
                border: isSelected ? '1px solid rgba(201,168,76,0.5)' : '1px solid #1e2e1f',
              }}
            >
              {'icon' in opt && (
                <span className="text-2xl">{opt.icon as string}</span>
              )}
              <span
                className="text-sm"
                style={{
                  fontFamily: 'var(--font-inter)',
                  color: isSelected ? '#C9A84C' : '#9a8f7a',
                }}
              >
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-sm mb-6" style={{ color: '#e85c4c', fontFamily: 'var(--font-inter)' }}>
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
          className="flex items-center gap-2 text-xs tracking-wider disabled:opacity-30"
          style={{ color: '#9a8f7a', fontFamily: 'var(--font-inter)' }}
        >
          <ArrowLeft size={13} /> Back
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="flex items-center gap-2 px-8 py-3 text-xs tracking-[0.18em] uppercase transition-all disabled:opacity-30"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            Next <ArrowRight size={13} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canNext || loading}
            className="flex items-center gap-2 px-8 py-3 text-xs tracking-[0.18em] uppercase transition-all disabled:opacity-40"
            style={{ background: '#C9A84C', color: '#080c08', fontFamily: 'var(--font-inter)' }}
          >
            {loading ? (
              <>Analysing… <Sparkles size={13} /></>
            ) : (
              <>Find My Matches <Sparkles size={13} /></>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
