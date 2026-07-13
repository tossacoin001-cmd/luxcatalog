import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireAdminApi } from '@/lib/admin-auth'

// Uses OIDC (VERCEL_OIDC_TOKEN + BLOB_STORE_ID), no static BLOB_READ_WRITE_TOKEN
// needed, matches how the Blob store is connected to this project.
export async function POST(req: Request) {
  const admin = await requireAdminApi()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const blob = await put(`listings/${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
