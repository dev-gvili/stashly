import { z } from 'zod'
import { buildFiltersFactory, createFilter } from '@/utils/filters'
import { PermissionRole, Prisma } from '@/prisma/client'
import { toZodArraySchema } from '../../utils/converters'
import { date } from './schema.zod'

// Define the Zod schema for base query parameters.
export const userFilterSchema = z
	.object({
		id: z.string().nonempty(),
		name: z.string(),
		displayName: z.string(),
		email: z.string().email().nonempty(),
		emailVerified: z.boolean(),
		date,
		bucket: z.string().nonempty(),
		drive: z.string().nonempty(),
		subscription: z.string().nonempty(),
		storagePlan: z.string().nonempty(),
		stripeCustomerId: z.string().nonempty(),
		permission: toZodArraySchema(z.string().nonempty()),
		roles: toZodArraySchema(z.nativeEnum(PermissionRole)),
		query: z.string().min(1),
		accounts: toZodArraySchema(z.string().nonempty()),
		sessions: toZodArraySchema(z.string().nonempty()),
		workspaces: toZodArraySchema(z.string().nonempty()),
		subscriptions: toZodArraySchema(z.string().nonempty()),
		invitations: toZodArraySchema(z.string().nonempty()),
	})
	.partial()

/**
 * Factory for creating item-specific filters.
 * Uses `createFilterFactory` from the generic filters utility.
 * @see {@link createFilter} for details.
 */
const createUserFilter = createFilter<
	Prisma.UserWhereInput,
	z.infer<typeof userFilterSchema>
>()

/**
 * All available item filters.
 * Each filter is defined using `createItemFilter`, which ensures type safety.
 * The key is the filter name, the value is a function that takes the filter value
 * and returns a Prisma `ItemWhereInput` condition.
 */
export const userFilters = {
	/**
	 * Filter users by their unique ID.
	 * @param {string} id - The ID of the user.
	 * @example
	 * // Filter for a user with a specific ID
	 * { id: 'user_12345' }
	 */
	id: createUserFilter(z.string().nonempty(), (id) => ({ id })),

	/**
	 * Filter users by their name.
	 * @param {string} name - The name of the user.
	 * @example
	 * // Filter for users named 'John Doe'
	 * { name: 'John Doe' }
	 */
	name: createUserFilter(z.string(), (name) => ({ name })),

	/**
	 * Filter users by their display name.
	 * @param {string} displayName - The display name of the user.
	 * @example
	 * // Filter for users with display name 'Johnny'
	 * { displayName: 'Johnny' }
	 */
	displayName: createUserFilter(z.string(), (displayName) => ({
		displayName,
	})),

	/**
	 * Filter users by their email address.
	 * @param {string} email - The email address of the user.
	 * @example
	 * // Filter for users with email 'john.doe@example.com'
	 * { email: 'john.doe@example.com' }
	 */
	email: createUserFilter(z.string().email(), (email) => ({ email })),

	/**
	 * Filter users by their email verification status.
	 * @param {boolean} emailVerified - True for verified emails, false for unverified.
	 * @example
	 * // Filter for users with verified emails
	 * { emailVerified: true }
	 * @example
	 * // Filter for users with unverified emails
	 * { emailVerified: false }
	 */
	emailVerified: createUserFilter(z.boolean(), (emailVerified) => ({
		emailVerified,
	})),

	/**
	 * Filter users by creation date.
	 * Accepts an object with optional `before` and `after` Date properties.
	 * At least one of the properties must be provided.
	 * Example: { before: new Date('2023-01-01'), after: new Date('2022-01-01') }
	 * This will filter users created between Jan 1, 2022 and Jan 1, 2023.
	 * If only `before` is provided, it filters users created before that date.
	 * If only `after` is provided, it filters users created after that date.
	 * If neither is provided, the filter is ignored.
	 * If both are provided, it filters users created within the range.
	 * If the input is invalid, an error is logged and the filter is ignored.
	 * @param {object} date - Object containing `before` and/or `after` dates.
	 * @param {Date | string} [date.before] - Filter users created before this date.
	 * @param {Date | string} [date.after] - Filter users created after this date.
	 * @example
	 * // Filter users created before Jan 1, 2023
	 * { date: { before: new Date('2023-01-01') } }
	 * @example
	 * // Filter users created after Jan 1, 2022
	 * { date: { after: '2022-01-01' } }
	 * @example
	 * // Filter users created between Jan 1, 2022 and Jan 1, 2023
	 * { date: { before: new Date('2023-01-01'), after: new Date('2022-01-01') } }
	 * @throws Will log an error if the input is invalid.
	 */
	date: createUserFilter(
		date.refine(({ before, after }) => before || after, {
			message: 'At least one of before or after must be provided.',
		}),
		({ before, after }) => ({
			createdAt: { lte: before, gte: after },
		})
	),

	/**
	 * Filter users by their bucket ID.
	 * @param {string} bucket - The ID of the bucket.
	 * @example
	 * // Filter users with a specific bucket ID
	 * { bucket: 'bucket_12345' }
	 */
	bucket: createUserFilter(z.string().nonempty(), (bucket) => ({ bucket })),

	/**
	 * Filter users by their drive ID.
	 * @param {string} driveId - The ID of the drive.
	 * @example
	 * // Filter users with a specific drive ID
	 * { driveId: 'drive_12345' }
	 */
	drive: createUserFilter(z.string().nonempty(), (driveId) => ({
		driveId,
	})),

	/**
	 * Filter users by their subscription ID.
	 * @param {string} subscriptionId - The ID of the subscription.
	 * @example
	 * // Filter users with a specific subscription ID
	 * { subscriptionId: 'sub_12345' }
	 */
	subscription: createUserFilter(z.string().nonempty(), (subscriptionId) => ({
		subscriptionId,
	})),

	/**
	 * Filter users by their storage plan ID.
	 * @param {string} storagePlanId - The ID of the storage plan.
	 */
	storagePlan: createUserFilter(z.string().nonempty(), (storagePlanId) => ({
		storagePlanId,
	})),

	/**
	 * Filter users by specific invitation IDs.
	 * Accepts an array of invitation IDs.
	 * @param {string[]} invitations - An array of invitation IDs.
	 * @example
	 * // Filter users who have received invitations with specific IDs
	 * { invitations: ['inv_123', 'inv_456'] }
	 */
	invitations: createUserFilter(
		z.array(z.string().nonempty()),
		(invitations) => ({
			invitations: {
				some: {
					id: { in: invitations },
				},
			},
		})
	),

	/**
	 * Filter users by their Stripe customer ID.
	 * @param {string} stripeCustomerId - The Stripe customer ID.
	 * @example
	 * // Filter users associated with a specific Stripe customer ID
	 * { stripeCustomerId: 'cus_abc123' }
	 */
	stripeCustomerId: createUserFilter(
		z.string().nonempty(),
		(stripeCustomerId) => ({ stripeCustomerId })
	),

	/**
	 * Filter users by specific permission IDs.
	 * Accepts a single string ID or an array of string IDs.
	 * @param {string | string[]} ids - A single permission ID or an array of permission IDs.
	 * @example
	 * // Filter users with a specific permission ID
	 * { permission: 'perm_789' }
	 */
	permission: createUserFilter(
		z.union([z.string(), z.array(z.string())]),
		(ids) => ({
			permissions: {
				some: {
					id: Array.isArray(ids) ? { in: ids } : { equals: ids },
				},
			},
		})
	),

	/**
	 * Filter users by specific permission roles.
	 * Accepts an array of permission roles.
	 * @param {PermissionRole[]} roles - An array of permission roles ( owner / write / read ).
	 * @example
	 * // Filter users who have 'owner' or 'write' roles
	 * { roles: ['owner', 'write'] }
	 */
	roles: createUserFilter(z.array(z.nativeEnum(PermissionRole)), (roles) => ({
		permissions: {
			some: {
				roles: { in: roles },
			},
		},
	})),

	/**
	 * Filter users by a search query.
	 * Searches across user's name and display name.
	 * @param {string} query - The search string.
	 * @example
	 * // Filter users whose name or display name contains 'John'
	 * { query: 'John' }
	 */
	query: createUserFilter(z.string().min(1), (query) => ({
		OR: [
			{ name: { contains: query, mode: 'insensitive' } },
			{ displayName: { contains: query, mode: 'insensitive' } },
		],
	})),

	/**
	 * Filter users by specific account IDs.
	 * Accepts an array of account IDs.
	 * @param {string[]} accounts - An array of account IDs.
	 * @example
	 * // Filter users who have accounts with specific IDs
	 * { accounts: ['acc_123', 'acc_456'] }
	 */
	accounts: createUserFilter(z.array(z.string().nonempty()), (accounts) => ({
		accounts: {
			some: {
				id: { in: accounts },
			},
		},
	})),

	/**
	 * Filter users by specific session IDs.
	 * Accepts an array of session IDs.
	 * @param {string[]} sessions - An array of session IDs.
	 * @example
	 * // Filter users who have active sessions with specific IDs
	 * { sessions: ['sess_abc', 'sess_def'] }
	 */
	sessions: createUserFilter(z.array(z.string().nonempty()), (sessions) => ({
		sessions: {
			some: {
				id: { in: sessions },
			},
		},
	})),

	/**
	 * Filter users by specific workspace IDs they are members of.
	 * Accepts an array of workspace IDs.
	 * @param {string[]} workspaces - An array of workspace IDs.
	 * @example
	 * // Filter users who are members of workspaces with specific IDs
	 * { workspaces: ['ws_789', 'ws_012'] }
	 */
	workspaces: createUserFilter(
		z.array(z.string().nonempty()),
		(workspaces) => ({
			workspaces: {
				some: {
					id: { in: workspaces },
				},
			},
		})
	),

	/**
	 * Filter users by specific subscription IDs.
	 * Accepts an array of subscription IDs.
	 * @param {string[]} subscriptions - An array of subscription IDs.
	 * @example
	 * // Filter users who have subscriptions with specific IDs
	 * { subscriptions: ['sub_xyz', 'sub_uvw'] }
	 */
	subscriptions: createUserFilter(
		z.array(z.string().nonempty()),
		(subscriptions) => ({
			subscriptions: {
				some: {
					id: { in: subscriptions },
				},
			},
		})
	),
}

export const buildUserFilters = buildFiltersFactory({
	filters: userFilters,
	schema: userFilterSchema,
})
