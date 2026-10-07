import type { Metadata } from 'next'
import TwoFactorForm from './TwoFactorForm'

export const metadata: Metadata = { title: 'Verify Sign In' }

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  const { redirect_url } = await searchParams
  return <TwoFactorForm redirectUrl={redirect_url ?? null} />
}
