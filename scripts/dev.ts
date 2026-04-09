import { PrismaClient } from '../app/prisma/client'
import '@dotenvx/dotenvx/config'
import { inspect, parseArgs, type ParseArgsConfig } from 'node:util'
import { faker } from '@faker-js/faker'
import {
  generateMockItemsWithFile,
  generateMockItemsWithFolder,
  generateMockItemWithFile,
  generateMockItemWithFolder,
  //@ts-ignore
} from '../prisma/seedData/data'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({
  adapter,
})
import { AutoConfig, AutoModel, AutoProcessor } from '@huggingface/transformers'

const options: ParseArgsConfig = {
  options: {
    json: { type: 'boolean' },
    itemId: { type: 'string' },
    ownerId: { type: 'string' },
    action: { type: 'string' },
    urlSearchParams: { type: 'string' },
    model: { type: 'string' },
  },
  allowPositionals: true,
  tokens: true,
} as const

async function main() {
  const {
    values: { itemId, ownerId, action, json, urlSearchParams, model },
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
    const files = folders.map((folder) => {
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
  if (action === 'model_config') {
    if (!model) {
      throw new Error('Model name is required for model_config action')
    }
    const cfg = await AutoConfig.from_pretrained(`${model}`)
    // const processor = await AutoProcessor.from_pretrained(`${model}`);
    const modelInstance = await AutoModel.from_pretrained(`${model}`, {
      config: cfg,
    })
    // void 0;
  }
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
