import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/services/db'
import { openAPI } from 'better-auth/plugins'
import { onboardNewUser } from './onboard'

// const envs = toRequiredEnv({
// 	env: [
// 		'GITHUB_CLIENT_ID',
// 		'GITHUB_CLIENT_SECRET',
// 		'GOOGLE_CLIENT_ID',
// 		'GOOGLE_CLIENT_SECRET',
// 		'MICROSOFT_CLIENT_ID',
// 		'MICROSOFT_CLIENT_SECRET',
// 		'BETTER_AUTH_SECRET',
// 	],
// })

// describe this constant
/**
 * 
 */
/**
 * Initializes and configures the authentication service for the Stashly application.
 *
 * This service uses `betterAuth` for authentication, integrating with a PostgreSQL database via Prisma.
 * It supports onboarding logic after user creation, custom user fields, and multiple social login providers.
 * The authentication service can be extended with plugins, such as OpenAPI.
 *
 * @remarks
 * - The secret key and social provider credentials are loaded from environment variables.
 * - Custom user fields include `bucket`, `subscriptionId`, `storagePlanId`, and a required `role`.
 * - Social authentication is enabled for GitHub, Google, and Microsoft.
 * - The `onboardNewUser` function is called after a user is created.
 *
 * @example
 * ```typescript
 * import { auth } from './services/auth.server';
 * // Use `auth` to handle authentication in your application
 * ```
 */
export const auth = betterAuth({
	appName: 'Stashly',
	secret: process.env.BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, {
		provider: 'postgresql',
	}),
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					// Call your onboarding logic here
					await onboardNewUser(user)
				},
			},
		},
	},
	user: {
		additionalFields: {
			bucket: {
				type: 'string',
				required: true,
			},
			subscriptionId: {
				type: 'string',
				required: true,
			},
			storagePlanId: {
				type: 'string',
				required: true,
			},
			driveId: {
				type: 'string',
				required: true,
			},
			role: {
				type: 'string',
				required: false,
			},
		},
	},
	socialProviders: {
		github: {
			clientId: process.env.GITHUB_CLIENT_ID,
			clientSecret: process.env.GITHUB_CLIENT_SECRET,
		},
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		},
		microsoft: {
			clientId: process.env.MICROSOFT_CLIENT_ID,
			clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
		},
	},
	plugins: [openAPI()],
})
