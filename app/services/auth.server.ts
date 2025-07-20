import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/services/db.server'
import { openAPI } from 'better-auth/plugins'
import { onboardNewUser } from './onboard.server'

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
			},
			subscriptionId: {
				type: 'string',
			},
			storagePlanId: {
				type: 'string',
			},
			role: {
				type: 'string',
				required: true,
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
