import nodemailer from 'nodemailer'

// Plain SMTP so the sender is swappable without code changes: a Gmail app
// password works today, Resend/Zoho SMTP once the brand domain exists.
// Without SMTP config (local dev) the message is logged instead of sent, so
// auth flows that depend on a link (verify, reset, invite) stay testable.
const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null

const FROM = process.env.EMAIL_FROM ?? `Lux Catalog <${process.env.SMTP_USER ?? 'no-reply@localhost'}>`

export const emailConfigured = smtpConfigured

export async function sendEmail({
  to,
  subject,
  text,
  html,
  headers,
  attachments,
}: {
  to: string
  subject: string
  text: string
  html?: string
  headers?: Record<string, string>
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}) {
  if (!transporter) {
    console.info(`[email:not-configured] to=${to} subject="${subject}"\n${text}`)
    // Local preview: write the rendered HTML to disk so designs can be
    // checked in a browser. Never active in production (SMTP is set there).
    if (process.env.EMAIL_DEBUG_DIR && html) {
      const { writeFile, mkdir } = await import('node:fs/promises')
      await mkdir(process.env.EMAIL_DEBUG_DIR, { recursive: true })
      const safe = `${Date.now()}-${to.replace(/[^a-z0-9]/gi, '_')}.html`
      await writeFile(`${process.env.EMAIL_DEBUG_DIR}/${safe}`, html)
    }
    return
  }
  await transporter.sendMail({ from: FROM, to, subject, text, html, headers, attachments })
}

// Cheap SMTP login check for the health endpoint (no message is sent).
export async function verifyEmailTransport(): Promise<boolean> {
  if (!transporter) return false
  try {
    await transporter.verify()
    return true
  } catch {
    return false
  }
}

// Minimal on-brand wrapper for transactional auth emails. Inline styles only,
// email clients strip <style> blocks.
export function actionEmail({ heading, body, actionLabel, actionUrl }: { heading: string; body: string; actionLabel: string; actionUrl: string }) {
  const text = `${heading}\n\n${body}\n\n${actionLabel}: ${actionUrl}\n\nIf you didn't request this, you can ignore this email.`
  const html = `
<div style="background:#080c08;padding:40px 16px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto;background:#0f1a10;border:1px solid #1e2e1f;padding:32px">
    <p style="color:#C9A84C;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px">Lux Catalog</p>
    <h1 style="color:#f5f0e8;font-family:Georgia,serif;font-weight:normal;font-size:24px;margin:0 0 16px">${heading}</h1>
    <p style="color:#9a8f7a;font-size:14px;line-height:1.6;margin:0 0 24px">${body}</p>
    <a href="${actionUrl}" style="display:inline-block;background:#C9A84C;color:#080c08;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:12px 24px">${actionLabel}</a>
    <p style="color:#908673;font-size:12px;line-height:1.6;margin:24px 0 0">If you didn't request this, you can ignore this email.</p>
  </div>
</div>`
  return { text, html }
}
