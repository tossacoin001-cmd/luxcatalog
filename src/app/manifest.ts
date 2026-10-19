import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lux Catalog',
    short_name: 'Lux Catalog',
    description: 'Luxury homes, shortlets, supercars, yachts and vetted services in Lagos.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080c08',
    theme_color: '#080c08',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
