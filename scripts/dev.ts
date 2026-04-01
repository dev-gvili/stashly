import '@dotenvx/dotenvx/config'
import { inspect,
parseArgs, type ParseArgsConfig } from 'node:util'
import { itemRepository } from '../.server/repositories/ItemRepository'
import { subscriptionRepository } from '../.server/repositories/SubscriptionRepository'
import { getPrefixForModel, toObjectId } from '../utils/converters'
import { userRepository } from '@/.server/repositories/userRepository'
import { faker } from '@faker-js/faker'
import {
  generateMockItemsWithFile,
  generateMockItemsWithFolder,
  generateMockItemWithFile,
  generateMockItemWithFolder,
  //@ts-ignore
} from '../../prisma/seedData/data'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../app/prisma/client'
import { changeItemsOwner } from './item-actions.server'
import { searchRepository } from '../.server/search/search.repository'
import {
  buildSearchTextFromItem,
  embedItemForSearch,
} from '../.server/search/embeddings'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({
  adapter,
})
import { AutoConfig, AutoModel, AutoProcessor } from '@huggingface/transformers';

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
  if (action === 'favorite') {
    let items = await prisma.item.findMany({
      distinct: ['id'],
      take: 4,
      include: {
        owner: true,
      },
    })
    faker.helpers
      .arrayElements(items.map((i) => ({ id: i.id, ownerId: i.ownerId })))
      .forEach(async (i) => {
        await itemRepository.favorite(i.id, i.ownerId)
      })
  }
  if (action === 'unfavorite') {
    item = await itemRepository.unfavorite(`${itemId!}`, `${ownerId}`)
  }

  // if (action === "search") {
  //   // const searchParams = new URLSearchParams(`${urlSearchParams}`)

  //   // let params = parseSearchParams({
  //   // 	schema: itemAlgoliaFilterSchema.extend({ take: z.coerce.number() }),
  //   // 	searchParams,
  //   // })

  //   // void 0

  //   // const indexes = await searchItems({
  //   // 	...params,
  //   // 	mode: 'algolia',
  //   // 	buildFilters: buildItemAlgoliaFilters,
  //   // })
  //   // void 0

  //   const searchParams = new URLSearchParams(`${urlSearchParams}`);

  //   let params = parseSearchParams({
  //     schema: itemFilterSchema,
  //     searchParams,
  //   });

  //   let algparams = parseSearchParams({
  //     schema: itemAlgoliaFilterSchema,
  //     searchParams,
  //   });

  //   let cursorId: string | undefined = undefined;
  //   // For Postgres Search:
  //   // Paginate through all results
  //   // void 0
  //   // while (true) {
  //   // void 0
  //   const items = await searchItems({
  //     ...params,
  //     mode: "postgres",
  //     include: { owner: true, workspace: true },
  //     buildFilters: buildItemFilters,
  //   });
  //   let c = items.data.map((i) => i.id);
  //   void 0;
  //   // return items
  //   // For Algolia Search:
  //   // void 0
  //   // const hits = await searchItems({
  //   // 	...algparams,
  //   // 	mode: 'algolia',
  //   // 	buildFilters: buildItemAlgoliaFilters,
  //   // })

  //   // void 0
  //   // void 0
  //   // if (items.metadata.nextCursor) {
  //   // 	console.log(
  //   // 		inspect(
  //   // 			items.data.map((i) => ({ name: i.name })),
  //   // 			{ colors: true, depth: null }
  //   // 		)
  //   // 	)
  //   // 	void 0
  //   // 	cursorId = items.metadata.nextCursor
  //   // }
  //   // void 0
  //   // if (items.metadata.isComplete) {
  //   // 	console.log(
  //   // 		inspect(
  //   // 			items.data.map((i) => ({ name: i.name })),
  //   // 			{ colors: true, depth: null }
  //   // 		)
  //   // 	)
  //   // 	void 0
  //   // 	break
  //   // }
  //   // }
  // }
  // if (action === 'search') {
  // 	const searchParams = new URLSearchParams(`${urlSearchParams}`)
  // 	const searchSchema = toZodSearchSchema<
  // 		typeof itemFilterSchema,
  // 		Prisma.ItemOrderByWithRelationInput
  // 	>(itemFilterSchema)

  // 	let params = parseSearchParams({
  // 		schema: searchSchema,
  // 		searchParams,
  // 	})

  // 	if (params.strategy === 'stream') {
  // 		for await (const batch of await itemRepository.search({
  // 			...params,
  // 			strategy: 'stream',
  // 		})) {
  // 			console.log(batch.data.map(i => ({name: i.name})))
  // 			if (batch.metadata.isComplete) break
  // 		}
  // 	}
  // 	if (params.strategy === 'cursor') {
  // 		while (true) {
  // 			let res = await itemRepository.search({
  // 				...params,
  // 				strategy: 'cursor',
  // 			})
  // 			if (res.metadata.nextCursor) {
  // 				params.cursor = res.metadata.nextCursor
  // 			}
  // 			if (res.metadata.isComplete) {
  // 				void 0
  // 				break
  // 			}
  // 		}
  // 	}
  // 	if (params.strategy === 'offset') {
  // 		let res = await itemRepository.search({
  // 			...params,
  // 			page: 1,
  // 			take: 10,
  // 			strategy: 'offset',
  // 		})
  // 		void 0
  // 	}
  // }
  if (action === 'stripeCustomerId') {
    item = await subscriptionRepository.findStripeCustomerId(`${ownerId}`)
  }
  if (action === 'prices') {
    item = await subscriptionRepository.listPrices()
  }
  if (action === 'add-members') {
    let member = await userRepository.create({
      id: toObjectId(getPrefixForModel('User')),
      email: faker.internet.email(),
      name: faker.person.firstName(),
      displayName: faker.person.fullName(),
      image: faker.image.avatarGitHub(),
      emailVerified: true,
      accounts: {
        create: [
          {
            id: toObjectId(getPrefixForModel('Account')),
            providerId: 'github',
            accountId: faker.string.numeric(8),
            accessToken: faker.string.alphanumeric(32),
            refreshToken: faker.string.alphanumeric(32),
          },
        ],
      },
    })
    // itemRepository.favorite(`${itemId!}`, member.id);
  }
  if (action === 'change-owner') {
    const user = await userRepository.findById(`${ownerId}`)
    const root = await prisma.item.findFirstOrThrow({
      where: {
        AND: [{ name: 'root' }],
        NOT: {
          ownerId,
        },
      },
    })
    let res = await changeItemsOwner(root.id!, ownerId, true)
  }
  if (action === 'add-items') {
    const user = await prisma.user.findFirstOrThrow({
      where: {
        name: {
          startsWith: 'alon',
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
      })
    }
    const files = folders.map((folder) =>
      generateMockItemWithFile(user, user.drive, folder)
    )

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
  if (action === 'embeddings') {
    let items = await prisma.item.findMany()

    for (const item of items) {
      const vector = await embedItemForSearch(item) // number[]
      await searchRepository.upsertSearchEmbedding(
        item.id,
        vector,
        buildSearchTextFromItem(item)
      )
    }
  }
  if( action === 'model_config') {
    if(!model) {
      throw new Error("Model name is required for model_config action")
    }
    const cfg = await AutoConfig.from_pretrained(`${model}`,);
    // const processor = await AutoProcessor.from_pretrained(`${model}`);
    const modelInstance = await AutoModel.from_pretrained(`${model}`, {
      config: cfg,
    });
    // void 0;
  } 
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
