import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireListingsApi } from '@/lib/admin-auth'

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
const MAX_PHOTO_BYTES = 10 * 1024 * 1024

// Uses OIDC (VERCEL_OIDC_TOKEN + BLOB_STORE_ID), no static BLOB_READ_WRITE_TOKEN
// needed, matches how the Blob store is connected to this project.
export async function POST(req: Request) {
  const staff = await requireListingsApi()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    // Listing photos only: no web pages, scripts or SVGs on the public store.
    if (!PHOTO_TYPES.includes(file.type)) return NextResponse.json({ error: 'Please upload a JPG, PNG, WebP or AVIF photo' }, { status: 400 })
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'Photos must be under 10MB' }, { status: 400 })
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'photo'

    const blob = await put(`listings/${safeName}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
