import { config } from '@dotenvx/dotenvx'
import Stripe from 'stripe'

config({ logLevel: undefined, quiet: true })
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: '2025-08-27.basil',
})
