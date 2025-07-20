import { z } from 'zod'

const envSchema = z.object({
	GITHUB_CLIENT_ID: z.string(),
	GITHUB_CLIENT_SECRET: z.string(),
	GOOGLE_CLIENT_ID: z.string(),
	GOOGLE_CLIENT_SECRET: z.string(),
	MICROSOFT_CLIENT_ID: z.string(),
	MICROSOFT_CLIENT_SECRET: z.string(),
	AWS_BUCKET_NAME: z.string().optional(),
	AWS_ACCESS_KEY: z.string(),
	AWS_SECRET_KEY: z.string(),
	AWS_ENDPOINT_URL: z.string(),
	AWS_REGION: z.string(),
	DATABASE_URL: z.string(),
	SESSION_SECRET: z.string(),
	BETTER_AUTH_SECRET: z.string(),
	BASE_URL: z.string().url(),
	EMAIL_SERVICE_URL: z.string().url(),
	EMAIL_SERVICE_TOKEN: z.string(),
	STRIPE_SECRET_KEY: z.string(),
	// STRIPE_WEBHOOK_SECRET: z.string(),
})

type EnvVars = z.infer<typeof envSchema>
type EnvVarsKeys = keyof EnvVars

/**
 * Verifies and returns the specified environment variables
 * @param options Object containing array of environment variables to verify
 * @returns Object containing the verified environment variables
 */
export function toRequiredEnv<T extends EnvVarsKeys>({ env }: { env: T[] }) {
	// Create a dynamic pick object based on the keys
	const pickObject = env.reduce<Record<EnvVarsKeys, true>>((acc, key) => {
		acc[key] = true
		return acc
	}, {} as Record<EnvVarsKeys, true>)

	let envValues: {
		[k: string]: string | undefined
	} = {}
	// Create a subset schema based on the provided keys
	const envSubset = envSchema.pick(pickObject)

    if(typeof process === 'undefined' || !process.env) {
        envValues = import.meta.env  
    }
	// Extract only the requested variables from process.env
	envValues = process.env

	// Parse with the subset schema
	const parsedEnv = envSubset.safeParse(envValues)

	if (!parsedEnv.success) {
		console.error(
			'Environment variables validation failed:',
			parsedEnv.error.format()
		)
		throw new Error('Invalid environment variables')
	}

	return parsedEnv.data as Record<T, string>
}
