import { requireAreaApi } from '@/lib/admin-auth'
import { agreementByKey } from '@/lib/agreements'
import { buildTemplatePdf, pdfFileName } from '@/lib/agreements-server'

// Review copy of an agreement template (sample details), e.g. for the lawyer.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!(await requireAreaApi('partners'))) return new Response('Unauthorized', { status: 401 })
  const { key } = await params
  const t = agreementByKey(key)
  const pdf = t ? await buildTemplatePdf(key) : null
  if (!t || !pdf) return new Response('Not found', { status: 404 })
  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdfFileName({ title: `${t.title} DRAFT`, version: t.version })}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
