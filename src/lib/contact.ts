// Single source of truth for the brand's contact channel. Same number is
// used for WhatsApp and voice calls per the business decision — update here
// once a dedicated business line/email exists post-domain-purchase.
export const WHATSAPP_NUMBER = '2347070252506' // +234 707 025 2506, no leading zero, no punctuation
export const PHONE_DISPLAY = '+234 707 025 2506'

export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export const PHONE_LINK = `tel:+${WHATSAPP_NUMBER}`
