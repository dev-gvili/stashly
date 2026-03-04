import { inferAdditionalFields } from 'better-auth/client/plugins'
import type { auth } from '@/services/auth'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
})


