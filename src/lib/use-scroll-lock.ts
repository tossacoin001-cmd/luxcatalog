'use client'

import { useEffect } from 'react'

// Holds the page still while a menu or dialog is open, so a thumb or a wheel
// moving over it never scrolls the page behind. Several overlays can be open
// at once; the page is released only when the last one closes. The scroll
// position is never touched, and the width of the vanished scrollbar is
// replaced on desktop so nothing shifts sideways.
let locks = 0
let saved: { html: string; body: string; pad: string; overscroll: string } | null = null

function lock() {
  if (locks++ > 0) return
  const html = document.documentElement
  const body = document.body
  saved = { html: html.style.overflow, body: body.style.overflow, pad: body.style.paddingRight, overscroll: body.style.overscrollBehavior }
  const bar = window.innerWidth - html.clientWidth
  html.style.overflow = 'hidden'
  body.style.overflow = 'hidden'
  body.style.overscrollBehavior = 'none'
  if (bar > 0) body.style.paddingRight = `${bar}px`
}

function unlock() {
  if (locks === 0 || --locks > 0) return
  const html = document.documentElement
  const body = document.body
  html.style.overflow = saved?.html ?? ''
  body.style.overflow = saved?.body ?? ''
  body.style.paddingRight = saved?.pad ?? ''
  body.style.overscrollBehavior = saved?.overscroll ?? ''
  saved = null
}

// `maxWidth`: only lock at or below this viewport width (the phone menu is
// not a dialog on desktop, so it must never freeze a desktop page).
export function useScrollLock(active: boolean, maxWidth?: number) {
  useEffect(() => {
    if (!active) return
    let held = false
    const apply = () => {
      const want = maxWidth === undefined || window.innerWidth <= maxWidth
      if (want && !held) {
        lock()
        held = true
      } else if (!want && held) {
        unlock()
        held = false
      }
    }
    apply()
    window.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('resize', apply)
      if (held) unlock()
    }
  }, [active, maxWidth])
}
