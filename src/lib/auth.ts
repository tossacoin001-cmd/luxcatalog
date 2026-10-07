import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { captcha, twoFactor } from 'better-auth/plugins'
import { prisma } from '@/lib/prisma'
import { actionEmail, sendEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/utils'

// Lux Catalog's own authentication. Users, password hashes (scrypt),
// sessions and 2FA secrets all live in our Postgres, the only outside
// services involved are SMTP (to deliver links) and, when configured,
// Cloudflare Turnstile (bot check on sign-in/up/reset).
export const auth = betterAuth({
  appName: 'Lux Catalog',
  baseURL: process.env.BETTER_AUTH_URL ?? getAppUrl('http://localhost:3000'),
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Customers can browse/enquire before verifying; staff access additionally
    // requires 2FA (see admin-auth.ts), which is the real gate.
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      const mail = actionEmail({
        heading: 'Reset your password',
        body: 'We received a request to reset the password on your Lux Catalog account. This link expires in one hour.',
        actionLabel: 'Choose a new password',
        actionUrl: url,
      })
      await sendEmail({ to: user.email, subject: 'Reset your Lux Catalog password', ...mail })
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const mail = actionEmail({
        heading: 'Confirm your email',
        body: 'Confirm this address so we can send booking confirmations and account notices to it.',
        actionLabel: 'Confirm email',
        actionUrl: url,
      })
      await sendEmail({ to: user.email, subject: 'Confirm your Lux Catalog email', ...mail })
    },
  },

  user: {
    additionalFields: {
      // input: false means sign-up/update requests can never set these, so a
      // visitor can't register themselves as admin by adding a field.
      role: { type: 'string', required: false, defaultValue: 'customer', input: false },
      phone: { type: 'string', required: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
      '/request-password-reset': { window: 300, max: 3 },
      '/send-verification-email': { window: 300, max: 3 },
      '/two-factor/verify-totp': { window: 60, max: 5 },
      '/two-factor/verify-backup-code': { window: 60, max: 5 },
    },
  },

  plugins: [
    twoFactor({ issuer: 'Lux Catalog' }),
    ...(process.env.TURNSTILE_SECRET_KEY
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: process.env.TURNSTILE_SECRET_KEY,
            endpoints: ['/sign-up/email', '/sign-in/email', '/request-password-reset'],
          }),
        ]
      : []),
    // Must stay last: lets server actions set auth cookies.
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
