import { faker } from '@faker-js/faker'
import { inspect } from 'node:util'
import { getPrefixForModel, toObjectId } from '../../app/utils/converters'
import {
  generateMockUsers,
  generateMockDrive,
  generateMockStoragePlans,
  generateMockTopLevelFolders,
  generateMockSubFolders,
  generateMockLockedItems,
  generateMockFavoriteItems,
  generateMockItemsWithFile,
  generateMockFavoriteItem,
} from './data'
import {
  createFolder,
  createItem,
  createManyItemsBatched,
} from '../../app/.server/item-actions'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../app/prisma/client'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    timeout: 15000,
  },
})

async function main(): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.folder.deleteMany(),
      prisma.invitation.deleteMany(),
      prisma.collectionMember.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.permission.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.activity.deleteMany(),
      prisma.itemVersion.deleteMany(),
      prisma.lockedItem.deleteMany(),
      prisma.drive.deleteMany(),
      prisma.subscription.deleteMany(),
      prisma.storagePlan.deleteMany(),
      prisma.favorite.deleteMany(),
      prisma.file.deleteMany(),
      prisma.thumbnail.deleteMany(),
      prisma.item.deleteMany(),
      prisma.account.deleteMany(),
      prisma.user.deleteMany(),
    ])

    // Create storage plans
    const createdStoragePlans = await prisma.storagePlan.createManyAndReturn({
      data: generateMockStoragePlans(),
    })
    console.log('Created storage plans:', createdStoragePlans)
  } catch (error) {
    console.error('Error seeding database:', error)
  }
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
