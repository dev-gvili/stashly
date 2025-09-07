import { inferAdditionalFields } from 'better-auth/client/plugins'
import type { auth } from '@/services/auth'
import { createAuthClient } from 'better-auth/react' 

/**
 * The client-side authentication handler for the application.
 *
 * @remarks
 * This `authClient` is the primary interface for all authentication operations on the frontend.
 * It is initialized using `createAuthClient` from `better-auth/react`.
 *
 * The `inferAdditionalFields` plugin is used to automatically make the client-side user
 * object type-safe. It inspects the server-side `auth` configuration (from `auth.server.ts`)
 * and infers the custom user fields (`bucket`, `role`, etc.), so they are available
 * with full TypeScript support on the client without manual type definitions.
 *
 * @example
 * ```typescript
 * // In a React component
 * authClient.login('google');
 * const { user } = authClient.useUser();
 * console.log(user?.role); // Type-safe access to custom fields
 * ```
 */
export const authClient = createAuthClient({
	plugins: [inferAdditionalFields<typeof auth>()],
})
