import { z } from 'zod'
import { Prisma, type Drive } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { DriveType } from '@/prisma/enums'

export const driveFilterSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		type: z.nativeEnum(DriveType),
		date: z.object({
			before: z.date({ coerce: true }).or(z.string().date()).optional(),
			after: z.date({ coerce: true }).or(z.string().date()).optional(),
		}),
		workspaceLimit: z.number().int(),
		memberLimit: z.number().int(),
		storageLimit: z.bigint(),
		ownerId: z.string(),
		workspaceId: z.string(),
	})
	.partial() satisfies z.ZodType<Partial<Drive>>

const createDriveFilter = createFilter<
	Prisma.DriveWhereInput,
	z.infer<typeof driveFilterSchema>
>()

export const driveFilters = {
	id: createDriveFilter(z.string().nonempty(), (id) => ({ id })),
	name: createDriveFilter(z.string().nonempty(), (name) => ({ name })),
	type: createDriveFilter(z.nativeEnum(DriveType), (type) => ({ type })),
	createdAt: createDriveFilter(z.coerce.date(), (createdAt) => ({
		createdAt,
	})),
	updatedAt: createDriveFilter(z.coerce.date(), (updatedAt) => ({
		updatedAt,
	})),
	workspaceLimit: createDriveFilter(
		z.coerce.number().int(),
		(workspaceLimit) => ({ workspaceLimit })
	),
	memberLimit: createDriveFilter(z.coerce.number().int(), (memberLimit) => ({
		memberLimit,
	})),
	storageLimit: createDriveFilter(z.coerce.bigint(), (storageLimit) => ({
		storageLimit,
	})),
	ownerId: createDriveFilter(z.string().nonempty(), (ownerId) => ({
		ownerId,
	})),
}

export const buildDriveFilters = buildFiltersFactory({
	filters: driveFilters,
	schema: driveFilterSchema,
})
