/**
 * Represents the Prisma delegate methods required for pagination.
 * This includes `findMany` for fetching records and `count` for calculating total records.
 * @template TModel The Prisma model type, which must have an `id` field.
 * @template TWhere The `WhereInput` type for the model.
 * @template TOrderBy The `OrderByWithRelationInput` type for the model.
 * @template TInclude The `Include` type for the model.
 */
export type DbDelegate<
	TModel extends { id: string },
	TWhere,
	TOrderBy,
	TInclude
> = {
	findMany: (args: {
		where: TWhere
		orderBy?: TOrderBy
		include?: TInclude
		skip?: number
		take?: number
		cursor?: { id: string }
	}) => Promise<TModel[]>
	count: (args: { where: TWhere }) => Promise<number>
}

// --- Pagination Return Types ---

/**
 * Defines the structure of the data returned for offset-based pagination.
 * @template TModel The Prisma model type.
 */
export type PaginationOffsetData<TModel> = {
	/** The array of records for the current page. */
	data: TModel[]
	/** Metadata about the pagination state. */
	metadata: {
		/** The total number of records matching the query. */
		count: number
		/** The total number of pages. */
		pages: number
		/** The current page number. */
		page: number
		/** The number of records per page. */
		pageSize: number
		/** A boolean indicating if the last page has been reached. */
		isComplete: boolean
	}
}

/**
 * Defines the structure of the data returned for cursor-based pagination.
 * @template TModel The Prisma model type.
 */
export type PaginationCursorData<TModel> = {
	/** The array of records for the current set. */
	data: TModel[]
	/** Metadata about the pagination state. */
	metadata: {
		/** The number of records returned in the current set. */
		count: number
		/** The cursor pointing to the previous set of records. */
		previousCursor?: string
		/** The cursor pointing to the next set of records. */
		nextCursor?: string
		/** The number of records requested per page. */
		take?: number
		/** A boolean indicating if the last set of records has been reached. */
		isComplete: boolean
	}
}

/**
 * Defines the structure of the data returned for stream-based pagination.
 * It is an async generator that yields chunks of data.
 * @template TModel The Prisma model type.
 */
export type PaginationStreamData<TModel> = AsyncGenerator<
	{
		/** The array of records for the current chunk. */
		data: TModel[]
		/** Metadata about the pagination state for the current chunk. */
		metadata: {
			/** The number of records requested per chunk. */
			take: number
			/** The number of records in the current chunk. */
			count: number
			/** The cursor pointing to the next chunk of records. */
			nextCursor?: string
			/** The cursor that was used to fetch the current chunk. */
			previousCursor?: string
			/** A boolean indicating if the final chunk has been yielded. */
			isComplete: boolean
		}
	},
	void,
	unknown
>

// --- Pagination Options (Discriminated Union) ---

/**
 * Core pagination options common to all strategies.
 * @template TWhere The `WhereInput` type for the model.
 * @template TOrderBy The `OrderByWithRelationInput` type for the model.
 * @template TInclude The `Include` type for the model.
 */
interface PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
	/** Prisma `where` clause to filter records. */
	where: TWhere
	/** Prisma `orderBy` clause to sort records. */
	orderBy?: TOrderBy
	/** Prisma `include` clause to include related records. */
	include?: TInclude
	/** The number of records to take per page/chunk. */
	take?: number
}

/**
 * Options for offset-based pagination.
 * @property {'offset'} strategy - The pagination strategy to use.
 * @property {number} [page] - The page number to retrieve. Defaults to 1.
 */
export interface PaginationOffsetOptions<TWhere, TOrderBy, TInclude>
	extends PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
	strategy: 'offset'
	page?: number
}

/**
 * Options for cursor-based pagination.
 * @property {'cursor'} strategy - The pagination strategy to use.
 * @property {string} [cursor] - The cursor indicating the starting point of the records to fetch.
 */
export interface PaginationCursorOptions<TWhere, TOrderBy, TInclude>
	extends PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
	strategy: 'cursor'
	cursor?: string
}

/**
 * Options for stream-based pagination.
 * @property {'stream'} strategy - The pagination strategy to use.
 */
export interface PaginationStreamOptions<TWhere, TOrderBy, TInclude>
	extends PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
	strategy: 'stream'
}

/**
 * A discriminated union of all possible pagination option types.
 * The `strategy` property determines which pagination method will be used.
 */
export type PaginationOptions<TWhere, TOrderBy, TInclude> =
	| PaginationOffsetOptions<TWhere, TOrderBy, TInclude>
	| PaginationCursorOptions<TWhere, TOrderBy, TInclude>
	| PaginationStreamOptions<TWhere, TOrderBy, TInclude>

// --- Paginate Function Overloads ---

/**
 * Paginates database queries using an offset strategy.
 * @param dbDelegate The Prisma delegate for the model.
 * @param options Options for offset pagination.
 * @returns A promise that resolves to offset-based pagination data.
 */
export function paginate<
	TModel extends { id: string },
	TWhere,
	TOrderBy,
	TInclude
>(
	dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
	options: PaginationOffsetOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationOffsetData<TModel>>

/**
 * Paginates database queries using a cursor strategy.
 * @param dbDelegate The Prisma delegate for the model.
 * @param options Options for cursor pagination.
 * @returns A promise that resolves to cursor-based pagination data.
 */
export function paginate<
	TModel extends { id: string },
	TWhere,
	TOrderBy,
	TInclude
>(
	dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
	options: PaginationCursorOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationCursorData<TModel>>

/**
 * Paginates database queries using a stream strategy.
 * @param dbDelegate The Prisma delegate for the model.
 * @param options Options for stream pagination.
 * @returns A promise that resolves to an async generator for stream-based pagination.
 */
export function paginate<
	TModel extends { id: string },
	TWhere,
	TOrderBy,
	TInclude
>(
	dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
	options: PaginationStreamOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationStreamData<TModel>>

// --- Paginate Function Implementation ---

/**
 * Paginates database queries using offset, cursor, or stream strategies.
 *
 * @template TModel The Prisma model type, must have an 'id' field.
 * @template TWhere The Prisma `WhereInput` type for the model.
 * @template TOrderBy The Prisma `OrderByWithRelationInput` type for the model.
 * @template TInclude The Prisma `Include` type for the model.
 *
 * @param {DbDelegate<TModel, TWhere, TOrderBy, TInclude>} dbDelegate The Prisma delegate for the model (e.g., `prisma.item`).
 * @param {PaginationOptions<TWhere, TOrderBy, TInclude>} options Pagination options, including strategy, filters, ordering, and inclusion.
 *
 * @returns {Promise<PaginationOffsetData<TModel> | PaginationCursorData<TModel> | PaginationStreamData<TModel>>}
 * A promise resolving to pagination data based on the chosen strategy.
 *
 * @example
 * // Offset pagination
 * const offsetResult = await paginate(prisma.item, { strategy: 'offset', page: 1, take: 10, where: { ownerId: 'user123' } });
 *
 * // Cursor pagination
 * const cursorResult = await paginate(prisma.item, { strategy: 'cursor', take: 5, cursor: 'item_abc', where: { status: 'active' } });
 */
export async function paginate<
	TModel extends { id: string },
	TWhere,
	TOrderBy,
	TInclude
>(
	dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
	options: PaginationOptions<TWhere, TOrderBy, TInclude>
): Promise<
	| PaginationCursorData<TModel>
	| PaginationOffsetData<TModel>
	| PaginationStreamData<TModel>
> {
	const { where, orderBy, include } = options

	switch (options.strategy) {
		case 'offset': {
			const { page = 1, take = 10 } = options
			const skip = (page - 1) * take

			const [count, data] = await Promise.all([
				dbDelegate.count({ where }),
				dbDelegate.findMany({ where, orderBy, include, take, skip }),
			])

			const hasNextPage = skip + data.length < count
			const isComplete = !hasNextPage
			const pages = Math.ceil(count / take)

			return {
				data,
				metadata: {
					page,
					count,
					pages,
					pageSize: take,
					isComplete,
				},
			}
		}

		/**
		 * Handles cursor-based pagination.
		 * Fetches `take + 1` items to determine if there's a next page.
		 * The parameter `skip: 1` not been used.
		 * The last item's ID becomes the `nextCursor`.
		 */
		case 'cursor': {
			const { cursor, take = 10 } = options
			const items = await dbDelegate.findMany({
				where,
				orderBy,
				include,
				take: take + 1,
				// TODO: replace this default `{ id: cursor }` with user provided cursor, cursor can be any valide field on a model.
				// TODO: Support Cursor Composite
				...(cursor ? { cursor: { id: cursor } } : {}), // No skip: 1
			})

			let data: typeof items
			let nextCursor: string | undefined = undefined
			let previousCursor: string | undefined = cursor
			let hasMore = items.length > take

			if (hasMore) {
				data = items.slice(0, take)
				nextCursor = items[take]?.id
			} else {
				data = items
				nextCursor = undefined
			}

			return {
				data: data,
				metadata: {
					take,
					count: data.length,
					previousCursor,
					nextCursor,
					isComplete: !nextCursor,
				},
			}
		}

		/**
		 * Handles stream-based pagination.
		 * Based on the cursor pagination strategy and a generator function.
		 * Fetches `take + 1` items to determine if there's a next page.
		 * The last item's ID becomes the `nextCursor`.
		 * Useful for processing large datasets in a memory-efficient manner.
		 */
		case 'stream': {
			const { take = 10 } = options
			async function* generator(): PaginationStreamData<TModel> {
				let cursor: string | undefined = undefined

				while (true) {
					const items = await dbDelegate.findMany({
						where,
						orderBy,
						include,
						take: take + 1,
						...(cursor ? { cursor: { id: cursor } } : {}),
					})

					const hasNextPage = items.length > take
					const data = items.slice(0, take)

					if (data.length === 0) {
						break
					}
					// The previous cursor
					let previousCursor = cursor

					// The next cursor is the ID of the 'extra' item, if it exists.
					cursor = hasNextPage ? items[take]?.id : undefined

					yield {
						data: data,
						metadata: {
							take,
							count: data.length,
							previousCursor,
							nextCursor: cursor,
							isComplete: !cursor,
						},
					}

					if (!hasNextPage) {
						break // End of stream
					}
				}
			}
			return generator()
		}
	}
}
