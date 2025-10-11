// --- DB Delegate Type ---
// Represents the Prisma delegate methods needed for pagination.
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

export type PaginationOffsetData<TModel> = {
	data: TModel[]
	metadata: {
		items: number
		pages: number
		page: number
		pageSize: number
		isComplete: boolean
	}
}

export type PaginationCursorData<TModel> = {
	data: TModel[]
	metadata: {
		nextCursor?: string
		take?: number
		isComplete: boolean
	}
}

export type PaginationStreamData<TModel> = AsyncGenerator<
	{
		data: TModel[]
		metadata: {
			nextCursor?: string
			take?: number
			isComplete: boolean
		}
	},
	void,
	unknown
>

// --- Pagination Options (Discriminated Union) ---

interface PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
	where: TWhere
	orderBy?: TOrderBy
	include?: TInclude
	take?: number
}

export interface PaginationOffsetOptions<TWhere, TOrderBy, TInclude>
	extends PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
	strategy: 'offset'
	page?: number
}

export interface PaginationCursorOptions<TWhere, TOrderBy, TInclude>
	extends PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
	strategy: 'cursor'
	cursor?: string
}

export interface PaginationStreamOptions<TWhere, TOrderBy, TInclude>
	extends PaginationCoreOptions<TWhere, TOrderBy, TInclude> {
	strategy: 'stream'
}

// Union of all possible pagination option types
export type PaginationOptions<TWhere, TOrderBy, TInclude> =
	| PaginationOffsetOptions<TWhere, TOrderBy, TInclude>
	| PaginationCursorOptions<TWhere, TOrderBy, TInclude>
	| PaginationStreamOptions<TWhere, TOrderBy, TInclude>

// --- Paginate Function Overloads ---

export function paginate<
	TModel extends { id: string },
	TWhere,
	TOrderBy,
	TInclude
>(
	dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
	options: PaginationOffsetOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationOffsetData<TModel>>

export function paginate<
	TModel extends { id: string },
	TWhere,
	TOrderBy,
	TInclude
>(
	dbDelegate: DbDelegate<TModel, TWhere, TOrderBy, TInclude>,
	options: PaginationCursorOptions<TWhere, TOrderBy, TInclude>
): Promise<PaginationCursorData<TModel>>

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

			const [total, data] = await Promise.all([
				dbDelegate.count({ where }),
				dbDelegate.findMany({ where, orderBy, include, take, skip }),
			])

			return {
				data,
				metadata: {
					items: total,
					pages: Math.ceil(total / take),
					page,
					pageSize: take,
					isComplete: skip + data.length >= total,
				},
			}
		}

		case 'cursor': {
			const { cursor } = options
			const take = Number(options.take) || 10

			const items = await dbDelegate.findMany({
				where,
				orderBy,
				include,
				take: take + 1,
				...(cursor ? { cursor: { id: cursor } } : {}), // No skip: 1
			})

			let data: typeof items
			let nextCursor: string | undefined = undefined

			const hasNextPage = items.length > take

			if (hasNextPage) {
				data = items.slice(0, take)
				// The next cursor is the ID of the 'extra' item
				nextCursor = items[take]?.id
			} else {
				data = items
				nextCursor = undefined
			}

			return {
				data: data,
				metadata: {
					take,
					nextCursor,
					isComplete: !nextCursor,
				},
			}
		}
		case 'stream': {
			const take = Number(options.take) || 10
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

					// The next cursor is the ID of the 'extra' item, if it exists.
					cursor = hasNextPage ? items[take]?.id : undefined

					yield {
						data: data,
						metadata: {
							take,
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
