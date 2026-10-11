import { NextResponse } from 'next/server'
import { audit, can, getSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { deleteStoredDocument, readDocument, storePrivateFile } from '@/lib/partners'
import { SERVER_UPLOAD_MAX_BYTES } from '@/lib/partners'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

// Guest ID for a booking. Upload: the guest, on a confirmed booking. View:
// the guest, the listing's partner, or the bookings team (views audited).
async function load(reference: string) {
  return prisma.booking.findUnique({
    where: { reference },
    select: {
      id: true,
      userId: true,
      status: true,
      guestIdStorage: true,
      guestIdPath: true,
      guestIdData: true,
      guestIdType: true,
      listing: { select: { ownerId: true } },
    },
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const { reference } = await params
  const b = await load(reference)
  if (!b || b.userId !== session.user.id) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (b.status !== 'confirmed') return NextResponse.json({ error: 'You can add your ID once the booking is confirmed' }, { status: 409 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a photo or PDF of your ID' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Upload a photo (JPG, PNG, WEBP, HEIC) or a PDF' }, { status: 400 })
  if (file.size > SERVER_UPLOAD_MAX_BYTES) return NextResponse.json({ error: 'That file is too large. Please use a photo under 4MB.' }, { status: 400 })

  const stored = await storePrivateFile(`guest-ids/${b.id}`, file)
  await prisma.booking.update({
    where: { id: b.id },
    data: { guestIdStorage: stored.storage, guestIdPath: stored.blobPathname, guestIdData: stored.data ? new Uint8Array(stored.data) : null, guestIdType: file.type, guestIdUploadedAt: new Date() },
  })
  if (b.guestIdStorage) await deleteStoredDocument({ storage: b.guestIdStorage, blobPathname: b.guestIdPath })
  await audit(session.user.id, 'booking.guest_id.upload', b.id)
  return NextResponse.json({ uploaded: true })
}

export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const session = await getSession()
  if (!session) return new Response('Sign in first', { status: 401 })
  const { reference } = await params
  const b = await load(reference)
  if (!b || !b.guestIdStorage) return new Response('Not found', { status: 404 })
  const guest = b.userId === session.user.id
  const host = b.listing.ownerId === session.user.id
  const staff = !guest && !host && (await can(session.user.id, 'bookings'))
  if (!guest && !host && !staff) return new Response('Not found', { status: 404 })
  if (!guest) await audit(session.user.id, 'booking.guest_id.view', b.id, { as: host ? 'partner' : 'team' })
  const body = await readDocument({ storage: b.guestIdStorage, blobPathname: b.guestIdPath, data: b.guestIdData })
  if (!body) return new Response('Not found', { status: 404 })
  const isImage = (b.guestIdType ?? '').startsWith('image/')
  return new Response(body as BodyInit, {
    headers: {
      'Content-Type': b.guestIdType ?? 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(isImage ? { 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox" } : {}),
    },
  })
}
