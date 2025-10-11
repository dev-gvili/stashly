import { z } from 'zod'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { Prisma } from '@/prisma/client'
import { NotificationStatus, NotificationType } from '@/prisma/enums'

// Define the Zod schema for base query parameters.
export const notificationFilterSchema = z
	.object({
		id: z.string().nonempty(), // Assuming ID is a string (UUID)
		message: z.string(), // Message is a string
		date: z.object({
			before: z.date({ coerce: true }).or(z.string().date()).optional(),
			after: z.date({ coerce: true }).or(z.string().date()).optional(),
		}),
		userId: z.string(), // User ID is a string (UUID)
		status: z.nativeEnum(NotificationStatus), // Status is an enum
		type: z.nativeEnum(NotificationType), // Type is an enum
	})
	.optional()

const createNotificationFilter = createFilter<
	Prisma.NotificationWhereInput,
	z.infer<typeof notificationFilterSchema>
>()

export const notificationFilters = {
	id: createNotificationFilter(z.string().nonempty(), (id) => ({ id })),
	message: createNotificationFilter(z.string().nonempty(), (message) => ({
		message,
	})),
	userId: createNotificationFilter(z.string().nonempty(), (userId) => ({
		userId,
	})),
	status: createNotificationFilter(
		z.nativeEnum(NotificationStatus),
		(status) => ({ status })
	),
}

export const buildNotificationFilters = buildFiltersFactory({
	filters: notificationFilters,
	schema: notificationFilterSchema,
})
