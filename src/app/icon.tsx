import { ImageResponse } from 'next/og'

// The site icon (also the logo search engines read): a gold "L" on the house colour.
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080c08', color: '#C9A84C', fontSize: 340, border: '10px solid #C9A84C' }}>
        L
      </div>
    ),
    size,
  )
}
