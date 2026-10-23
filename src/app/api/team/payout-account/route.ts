import { payoutAccountRoutes } from '@/lib/payout-account-routes'

// A team member's (or the administrator's) own payment method.
export const { GET, POST, PUT } = payoutAccountRoutes(['team', 'admin'])
