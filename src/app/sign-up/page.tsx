import type { Metadata } from 'next'
import SignUpForm from './SignUpForm'

export const metadata: Metadata = { title: 'Create Account' }

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string; invite?: string; email?: string }>
}) {
  const { redirect_url, invite, email } = await searchParams
  return <SignUpForm redirectUrl={redirect_url ?? null} invite={invite ?? null} invitedEmail={email ?? null} />
}
