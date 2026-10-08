// Branded email builder. Email clients ignore <style> blocks and modern CSS,
// so everything is tables + inline styles, 600px max, single column (reads
// well on phones without media queries). Every block also has a plain-text
// twin so the text/plain part is genuinely readable.

const C = {
  bg: '#080c08',
  card: '#0f1a10',
  line: '#1e2e1f',
  gold: '#C9A84C',
  goldLight: '#e4c878',
  text: '#f5f0e8',
  muted: '#b3a993',
  subtle: '#908673',
}
const SERIF = "Georgia,'Times New Roman',serif"
const SANS = 'Arial,Helvetica,sans-serif'

export type Stat = { label: string; value: string; hint?: string }
export type ListingItem = { title: string; category: string; price: string; location: string; image?: string | null; url: string; note?: string }
export type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'stats'; stats: Stat[] }
  | { type: 'listings'; items: ListingItem[] }
  | { type: 'bullets'; items: { text: string; tone?: 'ok' | 'warn' | 'alert' }[] }
  | { type: 'cta'; label: string; url: string }

export type EmailContent = {
  preheader: string
  eyebrow: string
  greeting: string
  intro: string
  blocks: Block[]
  // Footer: why they got this, plus manage / unsubscribe links.
  reason: string
  manageUrl: string
  unsubscribeUrl?: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function blockHtml(b: Block): string {
  switch (b.type) {
    case 'heading':
      return `<tr><td style="padding:28px 0 10px;font-family:${SERIF};font-size:20px;color:${C.text}">${esc(b.text)}</td></tr>`
    case 'paragraph':
      return `<tr><td style="padding:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.muted}">${esc(b.text)}</td></tr>`
    case 'stats': {
      const cells = b.stats
        .map(
          (s) => `<td width="${Math.floor(100 / b.stats.length)}%" style="padding:14px 10px;background:${C.card};border:1px solid ${C.line};text-align:center;vertical-align:top">
  <div style="font-family:${SERIF};font-size:26px;color:${C.gold};line-height:1.1">${esc(s.value)}</div>
  <div style="font-family:${SANS};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.subtle};padding-top:6px">${esc(s.label)}</div>
  ${s.hint ? `<div style="font-family:${SANS};font-size:12px;color:${C.muted};padding-top:4px">${esc(s.hint)}</div>` : ''}
</td>`
        )
        .join('<td width="8" style="font-size:0">&nbsp;</td>')
      return `<tr><td style="padding:6px 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>`
    }
    case 'listings':
      return b.items
        .map(
          (l) => `<tr><td style="padding:0 0 12px"><a href="${esc(l.url)}" style="text-decoration:none;display:block">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line}"><tr>
  ${l.image ? `<td width="120" style="vertical-align:top"><img src="${esc(l.image)}" width="120" height="96" alt="" style="display:block;width:120px;height:96px;object-fit:cover;border:0"></td>` : ''}
  <td style="padding:12px 14px;vertical-align:top">
    <div style="font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${C.gold}">${esc(l.category)}</div>
    <div style="font-family:${SERIF};font-size:16px;color:${C.text};padding:4px 0 2px;line-height:1.3">${esc(l.title)}</div>
    <div style="font-family:${SANS};font-size:12px;color:${C.subtle}">${esc(l.location)}</div>
    <div style="font-family:${SERIF};font-size:15px;color:${C.goldLight};padding-top:6px">${esc(l.price)}${l.note ? ` <span style="font-family:${SANS};font-size:12px;color:${C.muted}">&middot; ${esc(l.note)}</span>` : ''}</div>
  </td>
</tr></table></a></td></tr>`
        )
        .join('')
    case 'bullets':
      return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${b.items
        .map((i) => {
          const dot = i.tone === 'alert' ? '#e85c4c' : i.tone === 'warn' ? '#e8a84c' : C.gold
          return `<tr><td width="18" style="vertical-align:top;padding:7px 0"><div style="width:7px;height:7px;background:${dot};margin-top:6px"></div></td><td style="padding:5px 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.muted}">${esc(i.text)}</td></tr>`
        })
        .join('')}</table></td></tr>`
    case 'cta':
      return `<tr><td style="padding:18px 0 6px"><a href="${esc(b.url)}" style="display:inline-block;background:${C.gold};color:${C.bg};font-family:${SANS};font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 26px">${esc(b.label)}</a></td></tr>`
  }
}

function blockText(b: Block): string {
  switch (b.type) {
    case 'heading':
      return `\n${b.text.toUpperCase()}\n`
    case 'paragraph':
      return b.text
    case 'stats':
      return b.stats.map((s) => `- ${s.label}: ${s.value}${s.hint ? ` (${s.hint})` : ''}`).join('\n')
    case 'listings':
      return b.items.map((l) => `- ${l.title} (${l.category}), ${l.location}: ${l.price}${l.note ? `, ${l.note}` : ''}\n  ${l.url}`).join('\n')
    case 'bullets':
      return b.items.map((i) => `${i.tone === 'alert' ? '!' : '-'} ${i.text}`).join('\n')
    case 'cta':
      return `${b.label}: ${b.url}`
  }
}

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(c.eyebrow)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td style="padding:0 0 22px;border-bottom:1px solid ${C.line}">
    <span style="font-family:${SERIF};font-size:20px;letter-spacing:6px;color:${C.gold}">LUX</span>
    <span style="font-family:${SANS};font-size:10px;letter-spacing:4px;color:${C.subtle};padding-left:6px">CATALOG</span>
  </td></tr>
  <tr><td style="padding:26px 0 6px;font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.gold}">${esc(c.eyebrow)}</td></tr>
  <tr><td style="padding:0 0 10px;font-family:${SERIF};font-size:28px;line-height:1.25;color:${C.text}">${esc(c.greeting)}</td></tr>
  <tr><td style="padding:0 0 8px;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.muted}">${esc(c.intro)}</td></tr>
  ${c.blocks.map(blockHtml).join('\n')}
  <tr><td style="padding:34px 0 0;border-top:1px solid ${C.line}"></td></tr>
  <tr><td style="font-family:${SANS};font-size:12px;line-height:1.7;color:${C.subtle}">
    ${esc(c.reason)}<br>
    <a href="${esc(c.manageUrl)}" style="color:${C.gold}">Manage your emails</a>${c.unsubscribeUrl ? ` &nbsp;&middot;&nbsp; <a href="${esc(c.unsubscribeUrl)}" style="color:${C.gold}">Unsubscribe</a>` : ''}<br>
    Lux Catalog &middot; Lagos to the World &middot; WhatsApp +234 707 025 2506
  </td></tr>
</table></td></tr></table></body></html>`

  const text = [
    c.eyebrow.toUpperCase(),
    '',
    c.greeting,
    '',
    c.intro,
    '',
    ...c.blocks.map(blockText),
    '',
    '--',
    c.reason,
    `Manage your emails: ${c.manageUrl}`,
    c.unsubscribeUrl ? `Unsubscribe: ${c.unsubscribeUrl}` : '',
  ]
    .filter((l) => l !== undefined)
    .join('\n')

  return { html, text }
}
