'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from 'lucide-react'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const SWIPE_THRESHOLD = 50

interface ListingGalleryProps {
  images: string[]
  title: string
  // Server-rendered title/location/status overlay, kept as children so the
  // detail page stays a Server Component and only the gallery hydrates.
  children?: React.ReactNode
}

export default function ListingGallery({ images, title, children }: ListingGalleryProps) {
  const [active, setActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const count = images.length

  const go = useCallback(
    (delta: number) => setActive((i) => (i + delta + count) % count),
    [count]
  )

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1)
  }

  return (
    <>
      <div
        className="relative pt-20 h-[55vh] md:h-[70vh] overflow-hidden"
        onTouchStart={count > 1 ? onTouchStart : undefined}
        onTouchEnd={count > 1 ? onTouchEnd : undefined}
      >
        {images.map((img, i) => (
          <Image
            key={img}
            src={img}
            alt={`${title} photo ${i + 1}`}
            fill
            sizes="100vw"
            className="object-cover transition-opacity duration-500"
            style={{ opacity: i === active ? 1 : 0 }}
            priority={i === 0}
          />
        ))}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(8,12,8,0.2) 0%, rgba(8,12,8,0.85) 100%)' }}
        />

        {count > 0 && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute top-24 right-6 md:right-12 z-10 flex items-center gap-2 px-3 py-2 text-xs tracking-[0.15em] uppercase transition-colors hover:bg-black/70"
            style={{ background: 'rgba(8,12,8,0.55)', border: '1px solid #1e2e1f', color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}
            aria-label="View photos fullscreen"
          >
            <Expand size={14} />
            {count > 1 ? `${active + 1} / ${count}` : 'View'}
          </button>
        )}

        {count > 1 && (
          <>
            <GalleryArrow side="left" onClick={() => go(-1)} />
            <GalleryArrow side="right" onClick={() => go(1)} />
          </>
        )}

        {children}
      </div>

      {count > 1 && (
        <div
          className="flex gap-3 max-w-7xl mx-auto px-6 md:px-12 py-4 overflow-x-auto"
          style={{ borderBottom: '1px solid #1e2e1f' }}
        >
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === active}
              className="relative w-24 h-16 flex-shrink-0 overflow-hidden transition-opacity hover:opacity-100"
              style={{ border: i === active ? '1px solid #C9A84C' : '1px solid #1e2e1f', opacity: i === active ? 1 : 0.65 }}
            >
              <Image src={img} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <Lightbox
          images={images}
          title={title}
          index={active}
          onIndexChange={setActive}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  )
}

function GalleryArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-11 h-11 rounded-full transition-colors hover:bg-black/70 ${side === 'left' ? 'left-6' : 'right-6'}`}
      style={{ background: 'rgba(8,12,8,0.55)', border: '1px solid #1e2e1f', color: '#f5f0e8' }}
    >
      <Icon size={20} />
    </button>
  )
}

interface LightboxProps {
  images: string[]
  title: string
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

// Fullscreen viewer: wheel / double-tap / pinch to zoom, drag to pan when
// zoomed, swipe or arrow keys to change photo when not zoomed.
function Lightbox({ images, title, index, onIndexChange, onClose }: LightboxProps) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null)
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const lastTap = useRef(0)
  const [gesturing, setGesturing] = useState(false)
  const count = images.length

  const reset = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const go = useCallback(
    (delta: number) => {
      reset()
      onIndexChange((index + delta + count) % count)
    },
    [count, index, onIndexChange, reset]
  )

  const applyZoom = useCallback((next: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    setZoom(z)
    if (z === 1) setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && count > 1) go(-1)
      else if (e.key === 'ArrowRight' && count > 1) go(1)
      else if (e.key === '+' || e.key === '=') applyZoom(zoom + 0.5)
      else if (e.key === '-') applyZoom(zoom - 0.5)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [applyZoom, count, go, onClose, zoom])

  function onWheel(e: React.WheelEvent) {
    applyZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setGesturing(true)

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
      dragStart.current = null
      return
    }

    const now = Date.now()
    if (now - lastTap.current < 300) {
      applyZoom(zoom > 1 ? 1 : 2.5)
      lastTap.current = 0
      return
    }
    lastTap.current = now
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pinchStart.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      applyZoom(pinchStart.current.zoom * (dist / pinchStart.current.dist))
      return
    }

    if (dragStart.current && zoom > 1) {
      setOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      })
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = dragStart.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) setGesturing(false)
    dragStart.current = null

    // Unzoomed horizontal drag acts as a swipe between photos.
    if (start && zoom === 1 && count > 1) {
      const dx = e.clientX - start.x
      if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photos`}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: 'rgba(4,6,4,0.97)' }}
    >
      <div className="flex items-center justify-between px-4 md:px-8 py-4" style={{ color: '#f5f0e8', fontFamily: 'var(--font-inter)' }}>
        <span className="text-xs tracking-[0.2em] uppercase" style={{ color: '#9a8f7a' }}>
          {index + 1} / {count}
        </span>
        <div className="flex items-center gap-2">
          <IconButton label="Zoom out" onClick={() => applyZoom(zoom - 0.5)} disabled={zoom <= MIN_ZOOM}>
            <ZoomOut size={18} />
          </IconButton>
          <IconButton label="Zoom in" onClick={() => applyZoom(zoom + 0.5)} disabled={zoom >= MAX_ZOOM}>
            <ZoomIn size={18} />
          </IconButton>
          <IconButton label="Close" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
      </div>

      <div
        className="relative flex-1 overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: zoom > 1 ? 'grab' : 'zoom-in' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transition: gesturing ? 'none' : 'transform 150ms ease-out',
          }}
        >
          <Image
            src={images[index]}
            alt={`${title} photo ${index + 1}`}
            fill
            sizes="100vw"
            className="object-contain pointer-events-none"
            draggable={false}
            priority
          />
        </div>

        {count > 1 && zoom === 1 && (
          <>
            <LightboxArrow side="left" onClick={() => go(-1)} />
            <LightboxArrow side="right" onClick={() => go(1)} />
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-2 px-4 py-4 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img}
              type="button"
              onClick={() => {
                reset()
                onIndexChange(i)
              }}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className="relative w-16 h-11 flex-shrink-0 overflow-hidden"
              style={{ border: i === index ? '1px solid #C9A84C' : '1px solid #1e2e1f', opacity: i === index ? 1 : 0.55 }}
            >
              <Image src={img} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center justify-center w-10 h-10 transition-colors hover:bg-white/10 disabled:opacity-30"
      style={{ border: '1px solid #1e2e1f' }}
    >
      {children}
    </button>
  )
}

function LightboxArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-12 h-12 rounded-full transition-colors hover:bg-white/10 ${side === 'left' ? 'left-3 md:left-8' : 'right-3 md:right-8'}`}
      style={{ background: 'rgba(8,12,8,0.6)', border: '1px solid #1e2e1f', color: '#f5f0e8' }}
    >
      <Icon size={24} />
    </button>
  )
}
