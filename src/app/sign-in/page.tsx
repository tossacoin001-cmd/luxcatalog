import type { Metadata } from 'next'
import SignInForm from './SignInForm'

export const metadata: Metadata = { title: 'Sign In' }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  const { redirect_url } = await searchParams
  return <SignInForm redirectUrl={redirect_url ?? null} />
}
