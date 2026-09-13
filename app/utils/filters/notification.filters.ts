import { z } from 'zod'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { Prisma } from '@/prisma/client'
import { NotificationStatus, NotificationType } from '@/prisma/enums'
import { date } from '@/schemas/filters.schemas'
import { toZodArraySchema } from '../converters'

// Define the Zod schema for base query parameters.
export const notificationFilterSchema = z
  .object({
    id: z.string().nonempty(),
    date,
    message: z.string(),
    userId: z.string(),
    status: z.nativeEnum(NotificationStatus),
    type: toZodArraySchema(z.nativeEnum(NotificationType)),
  })
  .partial()

const createNotificationFilter = createFilter<
  Prisma.NotificationWhereInput,
  z.infer<typeof notificationFilterSchema>
>()

export const notificationFilters = {
  message: createNotificationFilter(z.string(), (message) => ({
    message,
  })),
  user: createNotificationFilter(z.string().nonempty(), (userId) => ({
    userId,
  })),
  status: createNotificationFilter(z.enum(NotificationStatus), (status) => ({
    status,
  })),
  /**
   * Filter items by creation date.
   * Accepts an object with optional `before` and `after` Date properties.
   * At least one of the properties must be provided.
   * Example: { before: new Date('2023-01-01'), after: new Date('2022-01-01') }
   * This will filter items created between Jan 1, 2022 and Jan 1, 2023.
   * If only `before` is provided, it filters items created before that date.
   * If only `after` is provided, it filters items created after that date.
   * If neither is provided, the filter is ignored.
   * If both are provided, it filters items created within the range.
   * If the input is invalid, an error is logged and the filter is ignored.
   * @see {@link notificationFilterSchema} for input validation.
   * @example
   * // Filter items created before Jan 1, 2023
   * { date: { before: new Date('2023-01-01') } }
   * // Filter items created after Jan 1, 2022
   * { date: { after: new Date('2022-01-01') } }
   * // Filter items created between Jan 1, 2022 and Jan 1, 2023
   * { date: { before: new Date('2023-01-01'), after: new Date('2022-01-01') } }
   * @throws Will log an error if the input is invalid.
   */
  date: createNotificationFilter(
    date.refine(({ before, after }) => before || after, {
      message: 'At least one of before or after must be provided.',
    }),
    ({ before, after }) => ({
      createdAt: { lte: before, gte: after },
    })
  ),
}

export const buildNotificationFilters = buildFiltersFactory({
  filters: notificationFilters,
  schema: notificationFilterSchema,
})
