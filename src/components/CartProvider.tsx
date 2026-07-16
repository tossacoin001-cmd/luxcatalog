'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export interface CartItem {
  listingId: string
  title: string
  priceNgn: number
  image: string | null
  quantity: number
}

interface CartContextValue {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void
  removeItem: (listingId: string) => void
  updateQuantity: (listingId: string, quantity: number) => void
  clear: () => void
  subtotalNgn: number
  count: number
}

const CartContext = createContext<CartContextValue>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clear: () => {},
  subtotalNgn: 0,
  count: 0,
})

export function useCart() {
  return useContext(CartContext)
}

const STORAGE_KEY = 'lux-cart'

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(JSON.parse(stored))
      }
    } catch {
      // corrupt local storage, ignore and start fresh
    }
  }, [])

  const persist = (next: CartItem[]) => {
    setItems(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const addItem: CartContextValue['addItem'] = (item, qty = 1) => {
    const existing = items.find((i) => i.listingId === item.listingId)
    if (existing) {
      persist(items.map((i) => (i.listingId === item.listingId ? { ...i, quantity: i.quantity + qty } : i)))
    } else {
      persist([...items, { ...item, quantity: qty }])
    }
  }

  const removeItem = (listingId: string) => {
    persist(items.filter((i) => i.listingId !== listingId))
  }

  const updateQuantity = (listingId: string, quantity: number) => {
    if (quantity < 1) return removeItem(listingId)
    persist(items.map((i) => (i.listingId === listingId ? { ...i, quantity } : i)))
  }

  const clear = () => persist([])

  const subtotalNgn = items.reduce((sum, i) => sum + i.priceNgn * i.quantity, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clear, subtotalNgn, count }}>
      {children}
    </CartContext.Provider>
  )
}
