'use client'

import { useEffect } from 'react'

// Fire-and-forget view ping for partner stats. Never blocks rendering and
// fails silently; the server dedupes and ignores bots and owners.
export default function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    fetch('/api/track/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId }),
      keepalive: true,
    }).catch(() => {})
  }, [listingId])
  return null
}
