import type { Metadata } from 'next'
import { pageMeta } from '@/lib/seo-metadata'

export const metadata: Metadata = pageMeta({ title: 'Contact Our Specialists in Lagos', description: 'Tell us what you are looking for and a Lux Catalog specialist will reply personally, usually within a few hours.', path: '/contact' })

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
