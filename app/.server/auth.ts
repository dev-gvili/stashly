import { betterAuth } from 'better-auth/minimal'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/services/db'
import { customSession, openAPI } from 'better-auth/plugins'
import { createAuthMiddleware } from 'better-auth/api'
import { onboardNewUser } from './onboard'
import { rememberAccount } from './remembered-account'
import { withOnboardingFields } from './session-user'
import { track } from '@/services/vinktar'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { Session, User } from '@/types/machine.types'

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
  advanced:{
    database:{
      joins: true,
      validateSchema: false
    }
  },
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  trustedOrigins: [
    'http://localhost',  
    'http://localhost:80',
    'https://conjoined-superelegantly-ebony.ngrok-free.dev',
  ],
  session: {
    // A cached session skips the database for 5 minutes, so a sign-out or
    // revocation elsewhere takes up to that long to apply (owner's call, 25
    // Oct). Without it every request read the session from the database,
    // 30 times for one 100 MB upload (tech-debt item 35).
    // `jwe`, not the default `compact`: the payload is the session (token, IP,
    // user agent) and the user (email, bucket, plan ids). `compact` is base64
    // with an HMAC, readable by anyone who sees the cookie; `jwe` encrypts it
    // with the auth secret.
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
      strategy: 'jwe',
    },
    additionalFields: {
      rootId: {
        type: 'string',
        required: false,
      },
      driveId: {
        type: 'string',
        required: false,
      },
    },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session, ctx) => {
          session.id = toObjectId(getPrefixForModel('Session'))
          return { data: session, ctx }
        },
      },
    },
    user: {
      create: {
        before: async (user, ctx) => {
          user.id = toObjectId(getPrefixForModel('User'))
          return {
            data: user,
            ctx,
          }
        },
        after: async (user) => {
          await onboardNewUser(user)
          track('signed_up', {}, { userId: user.id })
        },
      },
    },
  },

  hooks: {
    // Remember who signed in, for the sign-in page's "Continue as …". OAuth
    // callbacks are `/callback/:id`; `newSession` is only set when one succeeded.
    after: createAuthMiddleware(async (ctx) => {
      const user = ctx.context.newSession?.user
      if (!user || !ctx.path.startsWith('/callback/')) return
      const cookie = await rememberAccount({
        name: user.name,
        email: user.email,
        image: user.image ?? null,
        provider: ctx.params?.id,
      })
      if (cookie) ctx.setHeader('set-cookie', cookie)
    }),
  },

  user: {
    additionalFields: {
      bucket: {
        type: 'string',
        required: false,
        input: true,
        returned: true,
      },
      subscriptionId: {
        type: 'string',
        required: false,
        input: true,
        returned: true,
      },
      storagePlanId: {
        type: 'string',
        required: false,
        input: true,
        returned: true,
      },
      driveId: {
        type: 'string',
        required: false,
        input: true,
        returned: true,
      },
      rootId: {
        type: 'string',
        required: false,
        input: true,
        returned: true,
      },
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // redirectURI: 'https://conjoined-superelegantly-ebony.ngrok-free.dev/api/auth/callback/github'
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    },
  },

  plugins: [
    customSession(async ({ user, session }) => {
      // A new user's cached session predates onboarding; see session-user.ts.
      let extendedUser = (await withOnboardingFields(user as User)) as User
      let extendedSession = {
        ...session,
        rootId: extendedUser.rootId,
        driveId: extendedUser.driveId,
      } as Session

      return {
        user: extendedUser,
        session: extendedSession,
      }
    }),
    openAPI(),
  ],
})
