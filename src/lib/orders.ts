// Décor cart rules shared by the cart page and the orders API. Pure.

export const MAX_QTY = 10
export const MAX_LINES = 20

export type CartLine = { listingId: string; quantity: number }

// Whole quantities from 1 to MAX_QTY; the same item twice is merged.
export function validateCart(input: unknown): { ok: true; items: CartLine[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: 'Your cart is empty' }
  const merged = new Map<string, number>()
  for (const raw of input as { listingId?: unknown; quantity?: unknown }[]) {
    const id = typeof raw?.listingId === 'string' ? raw.listingId.trim() : ''
    const qty = raw?.quantity
    if (!id) return { ok: false, error: 'An item in your cart is missing' }
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) return { ok: false, error: 'Quantities must be whole numbers of 1 or more' }
    merged.set(id, (merged.get(id) ?? 0) + qty)
  }
  if (merged.size > MAX_LINES) return { ok: false, error: `A cart can hold up to ${MAX_LINES} different pieces` }
  for (const qty of merged.values()) if (qty > MAX_QTY) return { ok: false, error: `Up to ${MAX_QTY} of each piece per order. For more, our concierge will arrange a trade order.` }
  return { ok: true, items: [...merged].map(([listingId, quantity]) => ({ listingId, quantity })) }
}
