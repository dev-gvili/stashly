import { Prisma } from '@/prisma/client'
import {
	ItemCategory,
	ItemType,
	ItemStatus,
	PermissionRole,
} from '@/prisma/enums'
import { z } from 'zod'
import { toZodArraySchema } from './converters'

// ---
// Generic Filter Factory & Builder
// ---

/**
 * Represents a single, reusable filter object. It contains a Zod schema
 * for validation and an apply function to generate a Prisma-compatible filter.
 *
 * @template T The input type for the filter function.
 * @template TWhereInput The Prisma model's `WhereInput` type.
 */
type Filter<T, TWhereInput> = {
	schema: z.ZodType<T>
	apply: (value: unknown) => TWhereInput
}

/**
 * Creates a factory function for generating filters tied to a specific Prisma model.
 * This function should be called once for each model (e.g., `createItemFilter`, `createPostFilter`).
 *
 * @template TWhereInput The Prisma model's `WhereInput` type.
 * @returns A specialized `createFilter` function for that model.
 */
export const createFilterFactory = <TWhereInput>() => {
	return <T>(
		schema: z.ZodType<T>,
		filterFn: (value: T) => TWhereInput
	): Filter<T, TWhereInput> => ({
		schema,
		apply: (value: unknown) => filterFn(schema.parse(value)),
	})
}

/**
 * The generic FilterBuilder class. It dynamically builds a Prisma `WhereInput`
 * array from a set of applied filters.
 *
 * @template TWhereInput The Prisma model's `WhereInput` type.
 * @template TFilters The object containing all available filters for the model.
 */
export class FilterBuilder<
	TWhereInput,
	TFilters extends Record<string, Filter<any, TWhereInput>>
> {
	private filters: Map<keyof TFilters, TWhereInput> = new Map()
	private conditions: TWhereInput[] = []

	/**
	 * Initializes the builder with a set of filters for a specific model.
	 * @param availableFilters The object containing all filters (e.g., `itemFilters`).
	 */
	constructor(private availableFilters: TFilters) {}

	addFilter<TKey extends keyof TFilters>(key: TKey, value: unknown): this {
		if (
			value !== undefined &&
			value !== null &&
			(Array.isArray(value) ? value.length > 0 : true)
		) {
			try {
				this.filters.set(key, this.availableFilters[key].apply(value))
				this.rebuildConditions()
			} catch (error) {
				console.error(
					`Invalid value for filter '${String(key)}':`,
					error
				)
			}
		}
		return this
	}

	// not in use
	removeFilter<TKey extends keyof TFilters>(key: TKey): this {
		this.filters.delete(key)
		this.rebuildConditions()
		return this
	}

	private rebuildConditions(): void {
		this.conditions = Array.from(this.filters.values())
	}

	// not in use
	clearFilters(): this {
		this.filters.clear()
		this.rebuildConditions()
		return this
	}

	/**
	 * Builds and returns the final Prisma-compatible where object.
	 * @returns A `Prisma.<Model>WhereInput` object with `AND` condition.
	 */
	build(): TWhereInput {
		if (this.conditions.length === 0) {
			return {} as TWhereInput
		}
		return { AND: this.conditions } as TWhereInput
	}
}

interface BuildFiltersFactoryInput<TWhereInput, TSchema> {
	schema: TSchema
	filters: Record<string, Filter<unknown, TWhereInput>>
}

/**
 * A factory function to create a reusable `buildFilters` function.
 * This simplifies the process of creating a filter builder for any model.
 *
 * @template TSchema The Zod schema for the query parameters.
 * @template TWhereInput The Prisma model's `WhereInput` type.
 */
export const buildFiltersFactory = <
	TWhereInput,
	TSchema extends z.ZodType<any>
>({
	filters,
	schema, // The schema for the query parameters
}: BuildFiltersFactoryInput<TWhereInput, TSchema>) => {
	return<T extends z.ZodType<any> = TSchema>(params: z.infer<T>): TWhereInput => {
		const builder = new FilterBuilder<TWhereInput, typeof filters>(filters)

		// Dynamically add filters based on the schema and provided params.
		// This makes the function truly generic and scalable.
		const keys = Object.keys(params) as Array<keyof typeof params>
		for (const key of keys) {
			builder.addFilter(key as keyof typeof filters, params[key])
		}

		return builder.build()
	}
}

// 1. Create a specialized filter creator for each model.
export const createItemFilter = createFilterFactory<Prisma.ItemWhereInput>()

// 2. Define the filters using the new specialized creators.
export const itemFilters = {
	id: createItemFilter(z.string(), (id) => ({ id })),
	collection: createItemFilter(z.string(), (collectionId) => ({
		id: collectionId,
	})),
	date: createItemFilter(
		z
			.object({
				before: z
					.date({ coerce: true })
					.or(z.string().date())
					.optional(),
				after: z
					.date({ coerce: true })
					.or(z.string().date())
					.optional(),
			})
			.refine(({ before, after }) => before || after, {
				message: 'At least one of before or after must be provided.',
			}),
		({ before, after }) => ({
			createdAt: { lte: before, gte: after },
		})
	),
	type: createItemFilter(z.array(z.nativeEnum(ItemType)), (types) => ({
		type: { in: types },
	})),
	category: createItemFilter(
		z.array(z.nativeEnum(ItemCategory)),
		(categories) => ({
			category: { in: categories },
		})
	),
	status: createItemFilter(z.nativeEnum(ItemStatus), (status) => ({
		status,
	})),
	query: createItemFilter(z.string(), (query) => ({
		name: { contains: query },
	})),
	parent: createItemFilter(z.string(), (parentId) => ({
		parentId,
	})),
	workspace: createItemFilter(z.string(), (workspaceId) => ({
		workspaceId,
	})),
	tags: createItemFilter(z.array(z.string()), (tags) => ({
		tags: {
			hasSome: tags,
		},
	})),
	favorited: createItemFilter(z.boolean(), (isFavorited) => ({
		favoritedBy: isFavorited
			? { some: {} } // If true, favorited by *some* user
			: { none: {} }, // If false, favorited by *no* user
	})),
	locked: createItemFilter(z.boolean(), (isLocked) => ({
		locked: isLocked ? { isNot: null } : null,
	})),
	trashed: createItemFilter(z.boolean(), (inTrash) => ({
		trash: inTrash ? { isNot: null } : null,
	})),
	owner: createItemFilter(z.string().nonempty(), (ownerId) => ({
		ownerId,
	})),
	permission: createItemFilter(
		z.union([z.string(), z.array(z.string())]),
		(ids) => ({
			permissions: {
				some: {
					users: {
						some: {
							id: Array.isArray(ids) ? { in: ids } : ids,
						},
					},
				},
			},
		})
	),
	role: createItemFilter(z.array(z.nativeEnum(PermissionRole)), (roles) => ({
		permissions: {
			some: {
				roles: { in: roles },
			},
		},
	})),
}

// 3. Define the Zod schemas for your API query parameters.
export const itemFilterSchema = z
	.object({
		category: toZodArraySchema(z.nativeEnum(ItemCategory)),
		collection: itemFilters.collection.schema,
		date: itemFilters.date.schema,
		favorited: itemFilters.favorited.schema,
		parent: itemFilters.parent.schema,
		query: itemFilters.query.schema,
		status: itemFilters.status.schema,
		tags: toZodArraySchema(z.string().trim().min(1)),
		type: toZodArraySchema(z.nativeEnum(ItemType)),
		workspace: itemFilters.workspace.schema,
		locked: itemFilters.locked.schema,
		trashed: itemFilters.trashed.schema,
		owner: itemFilters.owner.schema,
		role: toZodArraySchema(z.nativeEnum(PermissionRole)),
		id: itemFilters.id.schema,
		permission: itemFilters.permission.schema,
	})
	.partial()

// 4. Create the final, usable `buildFilters` functions.
export const buildItemFilters = buildFiltersFactory<
	Prisma.ItemWhereInput,
	typeof itemFilterSchema
>({
	schema: itemFilterSchema,
	filters: itemFilters,
})
