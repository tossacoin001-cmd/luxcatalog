import { payoutAccountRoutes } from '@/lib/payout-account-routes'

// A partner's own bank details for payouts.
export const { GET, POST, PUT } = payoutAccountRoutes(['partner'])
