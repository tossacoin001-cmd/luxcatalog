// The Turnstile site key is public by design (it ships to every browser), so it
// may be saved with or without the NEXT_PUBLIC_ prefix. Stray spaces or line
// breaks from a paste are removed. The widget only shows when the secret that
// checks it is also set, so the two always switch on together.
export function turnstileSiteKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = (env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || env.TURNSTILE_SITE_KEY || '').trim()
  const secret = (env.TURNSTILE_SECRET_KEY || '').trim()
  return key && secret ? key : null
}
