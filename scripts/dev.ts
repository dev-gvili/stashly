import { PrismaClient } from '../app/prisma/client'
import '@dotenvx/dotenvx/config'
import { inspect, parseArgs, type ParseArgsConfig } from 'node:util'
import { faker } from '@faker-js/faker'
import {
  generateMockItemsWithFile,
  generateMockItemsWithFolder,
  generateMockItemWithFile,
  generateMockItemWithFolder,
  generateMockSubFolders,
  generateMockTopLevelFolders,
  //@ts-ignore
} from '../prisma/seedData/data'
import { createFolder, createItem, createManyItemsBatched } from '../app/.server/item-actions'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({
  adapter,
})

const options: ParseArgsConfig = {
  options: {
    json: { type: 'boolean' },
    itemId: { type: 'string' },
    ownerId: { type: 'string' },
    email: { type: 'string' },
    action: { type: 'string' },
    urlSearchParams: { type: 'string' },
    model: { type: 'string' },
  },
  allowPositionals: true,
  tokens: true,
} as const

async function main() {
  const {
    values: { itemId, ownerId, action, email, json, urlSearchParams, model },
    positionals,
    tokens,
  } = parseArgs(options)

  let item: any | null = null
  // if (action === 'favorite') {
  //   let items = await prisma.item.findMany({
  //     distinct: ['id'],
  //     take: 4,
  //     include: {
  //       owner: true,
  //     },
  //   })
  //   faker.helpers
  //     .arrayElements(items.map((i) => ({ id: i.id, ownerId: i.ownerId })))
  //     .forEach(async (i) => {
  //       await itemRepository.favorite(i.id, i.ownerId)
  //     })
  // }
  // if (action === 'unfavorite') {
  //   item = await itemRepository.unfavorite(`${itemId!}`, `${ownerId}`)
  // }

  // if (action === 'stripeCustomerId') {
  //   item = await subscriptionRepository.findStripeCustomerId(`${ownerId}`)
  // }
  // if (action === 'prices') {
  //   item = await subscriptionRepository.listPrices()
  // }
  // if (action === 'add-members') {
  //   let member = await userRepository.create({
  //     id: toObjectId(getPrefixForModel('User')),
  //     email: faker.internet.email(),
  //     name: faker.person.firstName(),
  //     displayName: faker.person.fullName(),
  //     image: faker.image.avatarGitHub(),
  //     emailVerified: true,
  //     accounts: {
  //       create: [
  //         {
  //           id: toObjectId(getPrefixForModel('Account')),
  //           providerId: 'github',
  //           accountId: faker.string.numeric(8),
  //           accessToken: faker.string.alphanumeric(32),
  //           refreshToken: faker.string.alphanumeric(32),
  //         },
  //       ],
  //     },
  //   })
  //   // itemRepository.favorite(`${itemId!}`, member.id);
  // }
  // if (action === 'change-owner') {
  //   const user = await userRepository.findById(`${ownerId}`)
  //   const root = await prisma.item.findFirstOrThrow({
  //     where: {
  //       AND: [{ name: 'root' }],
  //       NOT: {
  //         ownerId,
  //       },
  //     },
  //   })
  //   let res = await changeItemsOwner(root.id!, ownerId, true)
  // }
  if (action === 'add-items') {
    const user = await prisma.user.findFirstOrThrow({
      where: {
        email: {
          equals: 'bwvq073@outlook.com',
        },
      },
      include: {
        drive: true,
      },
    })

    let folders = await prisma.item.findMany({
      where: {
        ownerId: user.id,
        type: 'folder',
      },
      orderBy: {
        name: 'asc',
      },
    })

    if (folders.length === 0) {
      folders = generateMockItemsWithFolder({
        count: faker.number.int({ min: 15, max: 20 }),
        user,
        drive: user?.drive!,
        name: faker.system.directoryPath().split('/').pop()!,
        parent: { id: user.rootId } as any,
      }) as any
    }

    let toplevel = generateMockTopLevelFolders({ user, drive: user.drive! })

    const createdFolders = await prisma.$transaction([
      ...toplevel.map((file) =>
        prisma.item.create({
          data: file,
        })
      ),
    ])

    const files = createdFolders.map((folder) => {
      let drive = user.drive
      return {
        ...generateMockItemWithFile(user, drive!, folder),
      }
    })

    const createdFiles = await prisma.$transaction([
      ...files.map((file) =>
        prisma.item.create({
          data: file,
        })
      ),
    ])
  }

  if (action === 'add-folders') {
    const user = await prisma.user.findFirstOrThrow({
      where: {
        name: {
          startsWith: 'dev',
        },
      },
      include: {
        drive: true,
      },
    })

    let folders = await prisma.item.findMany({
      where: {
        type: 'folder',
      },
    })
    let names = faker.helpers.multiple(
      () =>
        faker.system.directoryPath().split('/').pop() +
        '_' +
        faker.git.branch(),
      {
        count: {
          min: 2,
          max: 5,
        },
      }
    )
    const folderToCreate = names.map((name) =>
      generateMockItemWithFolder({
        user,
        drive: user?.drive!,
        parent: faker.helpers.arrayElement(folders),
        name: name,
      })
    )
    const createdFolders = await prisma.$transaction([
      ...folderToCreate.map((folder) =>
        prisma.item.create({
          data: folder,
        })
      ),
    ])
    console.log(createdFolders.map((file) => file.name))
  }
  if (json) {
    await prisma.item.update({
      where: { id: 'item_btktlpCgx_I5PFKiPm8HJg' },
      data: {
        parentId: 'item_btktlpCgx_I5PFKiPm8HJg',
      },
    })
  } else {
    // void 0
  }
  if (action === 'reset-db') {
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
    } catch (error) {
      console.error('Error resetting database:', error)
    }
  }
  if (action === 'stash-items') {
    let user = await prisma.user.findFirstOrThrow({
      where: { email: `${email}` },
      include: { drive: true },
    })

    let rootFolder = await prisma.item.findUniqueOrThrow({
      where: { id: user.rootId! },
      include: { folder: true },
    })

    // Create multiple folders and files
    const top_folders = generateMockTopLevelFolders({
      user,
      drive: user.drive!,
      parent: rootFolder,
    })

    let createdTopFolders = top_folders.map((folder) => {
      return createFolder(
        folder.name,
        folder.parentId as string,
        user.id,
        user.driveId!
      )
    })

    const awaitedTopFolders = await Promise.all(createdTopFolders)

    const folders = generateMockSubFolders({
      user,
      drive: user.drive!,
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
      drive: user.drive!,
      parent: faker.helpers.arrayElement(createdFolders),
    })

    const createdFiles = await createManyItemsBatched(files, 15)

    console.log(
      `Stashed: top_level_folders: ${createdTopFolders.length} | folders: ${inspect(createdFolders.length)} | files: ${inspect(createdFiles.length)} | total: ${createdTopFolders.length + createdFolders.length + createdFiles.length}`,
      { compact: false, depth: null, colors: true }
    )
  }
  // if (action === 'embeddings') {
  //   let items = await prisma.item.findMany()

  //   for (const item of items) {
  //     const vector = await embedItemForSearch(item) // number[]
  //     await searchRepository.upsertSearchEmbedding(
  //       item.id,
  //       vector,
  //       buildSearchTextFromItem(item)
  //     )
  //   }
  // }
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
