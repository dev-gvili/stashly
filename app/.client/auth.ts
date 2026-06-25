import { inferAdditionalFields } from 'better-auth/client/plugins'
import { sentinelClient, dashClient } from "@better-auth/infra/client"
import type { auth } from '@/services/auth'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), dashClient()],
})


