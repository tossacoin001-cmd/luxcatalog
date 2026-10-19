import { ImageResponse } from 'next/og'

// The picture shown when a Lux Catalog link is shared. Plain and quiet:
// the name, one line, the place.
export const dynamic = 'force-static'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 96px',
          background: '#080c08', color: '#f5f0e8',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, letterSpacing: 10, color: '#C9A84C' }}>LAGOS · NIGERIA</div>
        <div style={{ display: 'flex', fontSize: 120, marginTop: 28, letterSpacing: 4 }}>LUX CATALOG</div>
        <div style={{ display: 'flex', width: 140, height: 2, background: '#C9A84C', marginTop: 36 }} />
        <div style={{ display: 'flex', fontSize: 38, marginTop: 36, color: '#d8cfbc' }}>Luxury homes, stays, cars, yachts and vetted services.</div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
