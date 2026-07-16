'use client'

import { useEffect } from 'react'
import { useCart } from '@/components/CartProvider'

export default function ClearCartOnMount() {
  const { clear } = useCart()

  useEffect(() => {
    clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
