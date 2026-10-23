'use client'

import { useCurrency } from '@/components/CurrencyProvider'
import { formatListingPrice } from '@/lib/utils'

// A price is set as figures first: tabular lining numerals, with the currency
// sign small and light beside them (see [data-price] in globals.css). Text such
// as "Price on request" is shown as written, with no sign.
export default function PriceDisplay({
  price,
  priceDisplay,
}: {
  price: number | null | undefined
  priceDisplay: string | null | undefined
}) {
  const { currency, rate } = useCurrency()
  const text = formatListingPrice(price, priceDisplay, currency, rate)
  const m = /^(\D{1,3}?)(\d.*)$/.exec(text)
  return (
    <span data-price>
      {m ? (
        <>
          <span data-currency>{m[1]}</span>
          {m[2]}
        </>
      ) : (
        text
      )}
    </span>
  )
}
