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

    const user = await prisma.user.create({
      data: generateMockUsers(1)[0],
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        bucket: true,
        rootId: true,
        driveId: true,
        storagePlanId: true,
        subscriptionId: true,
      },
    })

    // Create a drive for each user
    const drive = await prisma.drive.create({
      data: generateMockDrive(user, createdStoragePlans[1]),
      include: {
        quota: true,
      },
    })

    // Create subscriptions for the user
    const subscription = await prisma.subscription.create({
      data: {
        id: toObjectId(getPrefixForModel('Subscription')),
        ownerId: user.id,
        storagePlanId: createdStoragePlans[1].id,
        status: 'active',
        metadata: {
          userId: user.id,
          storagePlanId: createdStoragePlans[1].id,
          quotaId: drive?.quota?.id,
          driveId: drive.id,
        },
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        bucket: drive.name,
      },
    })

    let root = await createFolder('root', null, user.id, drive.id)

    // Create multiple folders and files
    const top_folders = generateMockTopLevelFolders({
      user,
      drive,
      parent: root,
    })

    let createdTopFolders = top_folders.map((folder) => {
      return createFolder(
        folder.name,
        folder.parentId as string,
        user.id,
        drive.id
      )
    })

    const awaitedTopFolders = await Promise.all(createdTopFolders)

    const folders = generateMockSubFolders({
      user,
      drive,
      folders: awaitedTopFolders,
    })

    const createdFolders = await prisma.$transaction([
      ...folders.map((folder) =>
        prisma.item.create({
          data: folder,
        })
      ),
    ])

    const files = generateMockItemsWithFile({
      count: faker.number.int({ min: 30, max: 70 }),
      user,
      drive,
      parent: faker.helpers.arrayElement(createdFolders),
    })

    const createdFiles = await createManyItemsBatched(files, 15)

    console.log(
      `Stashed: top_level_folders: ${createdTopFolders.length} | folders: ${inspect(createdFolders.length)} | files: ${inspect(createdFiles.length)} | total: ${createdTopFolders.length + createdFolders.length + createdFiles.length}`,
      { compact: false, depth: null, colors: true }
    )
    // // const favoritedItems = generateMockFavoriteItems({ user, createdFiles })
    // let item = faker.helpers.arrayElement(createdFiles).id;
    // const favoritedItems = faker.helpers.multiple(
    //   () => {
    //     return generateMockFavoriteItem(faker.helpers.arrayElement(createdFiles).id, user.id);
    //   },
    //   {
    //     count: 10,
    //   }
    // );
    // await prisma.$transaction([
    //   ...favoritedItems.map((item) =>
    //     prisma.favorite.create({
    //       data: item,
    //     })
    //   ),
    // ]);

    // const lockedItems = generateMockLockedItems({ user, createdFiles })
    // await prisma.$transaction([
    //   ...lockedItems.map((item) =>
    //     prisma.lockedItem.create({
    //       data: item,
    //     })
    //   ),
    // ])
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
