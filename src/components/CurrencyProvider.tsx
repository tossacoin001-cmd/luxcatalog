'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Currency = 'NGN' | 'USD'

interface CurrencyContextValue {
  currency: Currency
  setCurrency: (c: Currency) => void
  rate: number | null // NGN -> USD
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'NGN',
  setCurrency: () => {},
  rate: null,
})

export function useCurrency() {
  return useContext(CurrencyContext)
}

export default function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>('NGN')
  const [rate, setRate] = useState<number | null>(null)

  useEffect(() => {
    // Reading localStorage here (rather than a lazy useState initializer) is
    // deliberate: it keeps server and initial client render identical
    // ('NGN'), avoiding a hydration mismatch, then syncs the real
    // preference in after mount.
    const stored = window.localStorage.getItem('lux-currency')
    if (stored === 'NGN' || stored === 'USD') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrencyState(stored)
    }

    fetch('/api/fx-rate')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.rate === 'number') setRate(data.rate)
      })
      .catch(() => {})
  }, [])

  const setCurrency = (c: Currency) => {
    setCurrencyState(c)
    window.localStorage.setItem('lux-currency', c)
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rate }}>
      {children}
    </CurrencyContext.Provider>
  )
}
