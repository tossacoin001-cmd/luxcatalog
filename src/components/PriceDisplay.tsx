'use client'

import { useCurrency } from '@/components/CurrencyProvider'
import { formatListingPrice } from '@/lib/utils'

export default function PriceDisplay({
  price,
  priceDisplay,
}: {
  price: number | null | undefined
  priceDisplay: string | null | undefined
}) {
  const { currency, rate } = useCurrency()
  return <>{formatListingPrice(price, priceDisplay, currency, rate)}</>
}
