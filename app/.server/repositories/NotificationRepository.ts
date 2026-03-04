import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import {
  buildNotificationFilters,
  type NotificationFilterParams,
} from '../../utils/filters/notification.filters'
import { searchFactory } from '@/utils/searchFactory'
import type { IRepository } from './IRepository'

const defaultInclude = {
  user: true,
}
type ModelWithRelations = Prisma.NotificationGetPayload<{
  include: typeof defaultInclude
}>

export class NotificationRepository implements IRepository<
  ModelWithRelations,
  'Notification'
> {
  name = 'Notification' as const
  private db: typeof prisma
  private searchNotifications

  constructor(dbClient: typeof prisma) {
    this.db = dbClient
    this.searchNotifications = searchFactory(
      this.db.notification,
      buildNotificationFilters,
      defaultInclude
      // Default order by can be customized here
    )
  }

  // ------------------------------------------------------------------
  // Basic CRUD
  // ------------------------------------------------------------------

  async findById(id: string): Promise<ModelWithRelations | null> {
    return this.db.notification.findUnique({
      where: { id },
      include: defaultInclude,
    })
  }

  async findAll(
    args?: Prisma.NotificationFindManyArgs
  ): Promise<ModelWithRelations[]> {
    return this.db.notification.findMany({
      ...args,
      include: defaultInclude,
    })
  }

  async create(
    data: Prisma.NotificationCreateInput
  ): Promise<ModelWithRelations> {
    return this.db.notification.create({
      data,
      include: defaultInclude,
    })
  }

  async update(
    args: Prisma.NotificationUpdateArgs
  ): Promise<ModelWithRelations> {
    return this.db.notification.update({
      ...args,
      include: defaultInclude,
    })
  }

  async delete(id: string): Promise<ModelWithRelations> {
    return this.db.notification.delete({
      where: { id },
      include: defaultInclude,
    })
  }

  // ------------------------------------------------------------------
  // Search and Advanced Queries
  // ------------------------------------------------------------------

  async search(
    options: NotificationFilterParams & {
      page?: number
      pageSize?: number
      cursor?: string
      limit?: number
      batchSize?: number
      orderBy?: Prisma.NotificationOrderByWithRelationInput
      maxNoPaginationLimit?: number
      stream?: true
    }
  ) {
    return this.searchNotifications(options)
  }

  // ------------------------------------------------------------------
  // Custom Methods
  // ------------------------------------------------------------------

  // Add custom data access methods here.
  // Example:
  // async findByEmail(email: string): Promise<ModelWithRelations | null> {
  //   return this.db.notification.findUnique({
  //     where: { email },
  //     include: defaultInclude,
  //   });
  // }
}

// Export a singleton instance of the repository.
export const notificationRepository = new NotificationRepository(prisma)
