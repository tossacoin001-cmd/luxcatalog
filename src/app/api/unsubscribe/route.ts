import { NextResponse } from 'next/server'
import { isUnsubKind, unsubscribe } from '@/lib/notify/unsubscribe'
import { getAppUrl } from '@/lib/utils'

// Handles both:
//  - RFC 8058 one-click: the mail client POSTs "List-Unsubscribe=One-Click"
//    to the URL in the List-Unsubscribe header (token + kind in the query).
//  - The confirmation form on /unsubscribe (token + kind in the form body),
//    which then redirects back to the page showing the result.
export async function POST(req: Request) {
  const url = new URL(req.url)
  let token = url.searchParams.get('t')
  let kind = url.searchParams.get('k')
  let fromForm = false

  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const form = await req.formData()
    if (form.get('t')) {
      token = String(form.get('t'))
      kind = String(form.get('k'))
      fromForm = true
    }
  }

  const ok = !!token && isUnsubKind(kind) && (await unsubscribe(token, kind))

  if (fromForm) {
    const back = new URL(`${getAppUrl()}/unsubscribe`)
    back.searchParams.set('t', token ?? '')
    back.searchParams.set('k', kind ?? '')
    back.searchParams.set('done', ok ? '1' : '0')
    return NextResponse.redirect(back, 303)
  }
  return new NextResponse(null, { status: ok ? 200 : 400 })
}
