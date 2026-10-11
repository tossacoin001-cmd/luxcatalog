import { NextResponse, after } from 'next/server'
import { getSession } from '@/lib/admin-auth'
import { ConcernError, notifyConcern, reportConcern } from '@/lib/aftercare-server'

export const maxDuration = 60

// A guest reports a problem with their booking. Goes to Lux Catalog's team
// (admins and bookings), never to the partner.
export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { reference } = await params
  const body = await req.json().catch(() => ({}))
  try {
    const id = await reportConcern(reference, session.user.id, String(body.kind ?? ''), String(body.message ?? ''))
    // Alerts and the receipt go out just after the reply.
    after(() => notifyConcern(id).catch((e) => console.error('Concern alerts failed:', e)))
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ConcernError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
