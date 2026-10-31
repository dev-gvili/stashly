import { fa, faker } from '@faker-js/faker'
import {
  Prisma,
  type Drive,
  type Item,
  type StoragePlan,
} from '../../app/prisma/client'
import type { User as AuthUser } from '@/services/auth.types'
import { customAlphabet } from 'nanoid'
import {
  ItemCategory,
  DriveType,
  StoragePlanType,
  type ThumbnailSize,
  ViewType,
} from '../../app/prisma/enums'
import {
  getPrefixForModel,
  toCategory,
  toObjectId,
} from '../../app/utils/converters'

const DEFAULTS = {
  DRIVE_NAME_PREFIX: 'stashly',
  DRIVE_TYPE: DriveType.personal,
  STORAGE_PLAN: {
    type: StoragePlanType.free,
    name: 'Free Plan',
    storageLimit: BigInt(10 * 1024 * 1024 * 1024), // 10 GB for free plan
  } as StoragePlan,
  QUOTA_SIZE: 10 * 1024 * 1024 * 1024, // 10GB
} as const

type User = Omit<
  AuthUser,
  'subscriptionId' | 'storagePlanId' | 'driveId' | 'rootId'
> & {
  subscriptionId: string | null
  storagePlanId: string | null
  rootId: string | null
  driveId: string | null
}

export function generateThumbnailUrl(size: ThumbnailSize, view: ViewType) {
  switch (size) {
    case 'small':
      if (view === 'grid') {
        return faker.image.urlPicsumPhotos({ height: 256, width: 256 })
      } else if (view === 'waterfall') {
        return faker.image.urlPicsumPhotos({ width: 256 })
      } else if (view === 'river') {
        return faker.image.urlPicsumPhotos({ height: 256 })
      }
      break
    case 'medium':
      if (view === 'grid') {
        return faker.image.urlPicsumPhotos({ height: 512, width: 512 })
      } else if (view === 'waterfall') {
        return faker.image.urlPicsumPhotos({ width: 512 })
      } else if (view === 'river') {
        return faker.image.urlPicsumPhotos({ height: 512 })
      }
    case 'large':
      if (view === 'grid') {
        return faker.image.urlPicsumPhotos({ height: 1024, width: 1024 })
      } else if (view === 'waterfall') {
        return faker.image.urlPicsumPhotos({ width: 1024 })
      } else if (view === 'river') {
        return faker.image.urlPicsumPhotos({ height: 1024 })
      }
    case 'custom':
      if (view === 'grid') {
        return faker.image.urlPicsumPhotos({
          height: faker.number.int({ min: 2048, max: 3290 }),
          width: faker.number.int({ min: 2048, max: 3290 }),
        })
      } else if (view === 'waterfall') {
        return faker.image.urlPicsumPhotos({
          width: faker.number.int({ min: 2048, max: 3290 }),
        })
      } else if (view === 'river') {
        return faker.image.urlPicsumPhotos({
          height: faker.number.int({ min: 2048, max: 3290 }),
        })
      }
    default:
      // If no specific view is matched, return a default square image
      // Default to a large square image if view type is not specified or is custom
      return faker.image.urlPicsumPhotos({ height: 2048, width: 2048 })
  }
}

export function generateFileInfo() {
  let mimetype = faker.system.mimeType()
  let extension = faker.system.fileExt(mimetype)
  let filename = faker.system.commonFileName(extension)
  let name = filename.split('.')[0]
  return { filename, mimetype, extension, name }
}

export const generateItemPath = (
  driveName: string,
  parentPath?: string,
  itemName?: string
): string => {
  return parentPath ? `${parentPath}/${itemName}` : `${driveName}/${itemName}`
}

/**
 * Generate a unique file key for S3 workspace id can be optional.
 * Format: {workspaceId}/{fileId}
 */
function generateFileKey(workspaceId: string | undefined, file: File): string {
  if (file.webkitRelativePath && workspaceId) {
    // If the file has a webkitRelativePath, use it as the key
    return `${workspaceId}/${file.webkitRelativePath}`
  }
  if (file.webkitRelativePath && !workspaceId) {
    // If the file has a webkitRelativePath but no workspaceId, use it directly
    return file.webkitRelativePath
  }

  return workspaceId ? `${workspaceId}/${file.name}` : file.name
}

export const generateUniqueDriveName = (prefix: string, user: User): string => {
  const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8)
  const cleanUsername = user.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16)
  const userPart = `${cleanUsername}`
  const randomPart = nanoid(8)
  const bucketName = `${prefix}-${userPart}-${randomPart}`
  return bucketName
}

export const generateStoragePlan = ({
  type,
  name,
  tag,
  storageLimit,
  workspaceLimit,
  memberLimit,
  features,
  priceCents,
  description,
  currency = 'USD',
}: {
  type: StoragePlanType
  name: string
  tag: string
  storageLimit: bigint
  workspaceLimit: number
  memberLimit: number
  features?: string[]
  priceCents?: number | null
  description?: string | null
  currency?: string | null
}): Prisma.StoragePlanCreateInput => {
  return {
    id: toObjectId(getPrefixForModel('StoragePlan')),
    type,
    name,
    description,
    storageLimit,
    workspaceLimit,
    memberLimit,
    tag: type,
    features,
    priceCents,
    currency: currency ?? 'USD',
  }
}

export const generateMockStoragePlans = () => {
  return [
    generateStoragePlan({
      type: StoragePlanType.free,
      name: 'Free - 15 GB',
      tag: 'free',
      description: 'A lightweight plan for individual use',
      storageLimit: BigInt(15 * 1024 * 1024 * 1024), // 15 GB
      workspaceLimit: 1,
      memberLimit: 1,
      priceCents: 0,
      features: ['15 GB storage', '1 workspace', '1 members'],
    }),
    generateStoragePlan({
      type: StoragePlanType.basic,
      name: 'Basic - 100 GB',
      tag: 'basic',
      description: 'Affordable plan for regular users',
      storageLimit: BigInt(100 * 1024 * 1024 * 1024), // 100 GB
      workspaceLimit: 5,
      memberLimit: 5,
      priceCents: 499,
      features: ['100 GB storage', '5 workspaces', '5 members'],
    }),
    generateStoragePlan({
      type: StoragePlanType.standard,
      name: 'Standard - 200 GB',
      tag: 'standard',
      description: 'For small teams and power users',
      storageLimit: BigInt(200 * 1024 * 1024 * 1024), // 200 GB
      workspaceLimit: 10,
      memberLimit: 10,
      priceCents: 999,
      features: ['200 GB storage', '10 workspaces', '10 members'],
    }),
    generateStoragePlan({
      type: StoragePlanType.premium,
      name: 'Premium - 2 TB',
      tag: 'premium',
      description: 'Full-featured enterprise-ready plan',
      storageLimit: BigInt(2 * 1024 * 1024 * 1024), // 2 TB
      workspaceLimit: 1000,
      memberLimit: 1000,
      priceCents: 2999,
      features: ['2 TB storage', 'unlimited workspaces', 'unlimited members'],
    }),
  ]
}

export function generateMockUser() {
  const prefix = getPrefixForModel('User')
  const id = toObjectId(prefix)
  const accprefix = getPrefixForModel('Account')
  const accid = toObjectId(accprefix)
  return {
    id,
    email: faker.internet.email(),
    name: faker.person.firstName(),
    displayName: faker.person.fullName(),
    image: faker.image.avatar(),
    emailVerified: true,
    accounts: {
      create: [
        {
          id: accid,
          providerId: 'github',
          accountId: faker.string.numeric(8),
          accessToken: 'github_access_token',
          refreshToken: 'github_refresh_token',
        },
      ],
    },
  } as Prisma.UserCreateInput
}

export const generateMockQuota = (
  storagePlan: StoragePlan
): Prisma.QuotaUncheckedCreateWithoutDriveInput => {
  return {
    id: toObjectId(getPrefixForModel('Quota')),
    status: 'normal',
    total: storagePlan.storageLimit,
    deleted: 0,
    used: 0,
  }
}

export const generateMockDrive = (
  user: User,
  storagePlan: StoragePlan
): Prisma.DriveUncheckedCreateInput => {
  return {
    id: toObjectId(getPrefixForModel('Drive')),
    name: generateUniqueDriveName('stashly', user),
    type: 'personal' as DriveType,
    ownerId: user.id,
    workspaceLimit: storagePlan.workspaceLimit,
    memberLimit: storagePlan.memberLimit,
    storageLimit: storagePlan.storageLimit,
    quota: {
      create: {
        ...generateMockQuota(storagePlan),
      },
    },
  }
}

export const generateMockItemWithFolder = ({
  user,
  drive,
  name,
  parent,
}: {
  user: User
  drive: Pick<Drive, 'name' | 'id'>
  name: string
  parent?: Item
}): Omit<Prisma.ItemUncheckedCreateInput, 'createdAt'> => {
  const id = toObjectId(getPrefixForModel('Item'))
  return {
    id,
    name,
    size: 0,
    type: 'folder',
    ownerId: user.id,
    driveId: drive.id,
    category: undefined,
    parentId: parent ? parent.id : null,
    folder: {
      create: generateFolder(),
    },
  }
}

export function generateFolder() {
  let id = toObjectId(getPrefixForModel('Folder'))
  return {
    id,
    childCount: 0,
    view: {
      create: generateView({
        viewType: 'grid',
        sortBy: 'type',
        sortOrder: 'ascending',
      }),
    },
  } satisfies Prisma.FolderCreateNestedOneWithoutItemInput['create']
}

export function generateView(params: Prisma.ViewUncheckedCreateInput) {
  return {
    id: toObjectId(getPrefixForModel('View')),
    ...params,
  }
}
const generateImageUrl = () => {
  const urlId = faker.image.url().split('/').slice(0, -2).join('/')
  return urlId
}
export const generateThumbnail = (
  size: ThumbnailSize,
  view: ViewType,
  url?: string
) => {
  let { width, height }: { width: number; height: number } = {
    width: 0,
    height: 0,
  }
  if (view === 'grid') {
    size === 'small'
      ? ((width = 256), (height = 256))
      : size === 'medium'
        ? ((width = 512), (height = 512))
        : size === 'large'
          ? ((width = 1024), (height = 1024))
          : ((width = faker.number.int({ min: 2048, max: 3290 })),
            (height = faker.number.int({ min: 2048, max: 3290 })))
  }
  if (view === 'waterfall') {
    size === 'small'
      ? ((width = 256), (height = faker.number.int({ min: 256, max: 512 })))
      : size === 'medium'
        ? ((width = 512), (height = faker.number.int({ min: 256, max: 1024 })))
        : size === 'large'
          ? ((width = 1024),
            (height = faker.number.int({ min: 512, max: 1536 })))
          : ((width = faker.number.int({ min: 512, max: 2048 })),
            (height = faker.number.int({ min: 2048, max: 3290 })))
  }
  if (view === 'river') {
    size === 'small'
      ? ((width = faker.number.int({ min: 384, max: 768 })), (height = 256))
      : size === 'medium'
        ? ((width = faker.number.int({ min: 768, max: 1536 })), (height = 512))
        : size === 'large'
          ? ((width = faker.number.int({ min: 1536, max: 3072 })),
            (height = 1024))
          : ((width = faker.number.int({ min: 3072, max: 4935 })),
            (height = faker.number.int({ min: 2048, max: 3290 })))
  }

  /**
   * {
   * id: string;
   * createdAt?: string | Date | undefined;
   * updatedAt?: string | Date | undefined;
   * width?: number | null | undefined;
   * height?: number | null | undefined;
   * url?: string | null | undefined;
   * content?: Uint8Array<ArrayBuffer> | null | undefined;
   * view?: ("list" | "grid" | "river" | "waterfall") | undefined;
   * size?: ("custom" | "small" | "medium" | "large" | "original") | undefined;
  }
*/
  return {
    size: size,
    id: toObjectId(getPrefixForModel('Thumbnail')),
    width,
    height,
    view,
    url: `${url}/${width}/${height}`,
  }
}

export const generateMockItemWithFile = (
  user: User,
  drive: Pick<Drive, 'name' | 'id'>,
  parent?: Item
): Prisma.ItemUncheckedCreateInput => {
  const { filename, name, ...file } = generateMockFile({ drive })
  let size = generateSize()
  let url = generateImageUrl()
  return {
    id: toObjectId(getPrefixForModel('Item')),
    name,
    size,
    type: 'file',
    ownerId: user.id,
    driveId: drive.id,
    tags: faker.helpers.arrayElements(
      ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
      { min: 0, max: 2 }
    ),
    category: toCategory(
      new File([], filename, {
        type: file.mimeType,
        lastModified: new Date().valueOf(),
      })
    ),
    thumbnails: {
      createMany: {
        data: [
          generateThumbnail('small', 'waterfall', url),
          generateThumbnail('medium', 'waterfall', url),
          generateThumbnail('large', 'waterfall', url),
          generateThumbnail('custom', 'waterfall', url),
          generateThumbnail('small', 'river', url),
          generateThumbnail('medium', 'river', url),
          generateThumbnail('large', 'river', url),
          generateThumbnail('custom', 'river', url),
          generateThumbnail('small', 'grid', url),
          generateThumbnail('medium', 'grid', url),
          generateThumbnail('large', 'grid', url),
          generateThumbnail('custom', 'grid', url),
        ],
        skipDuplicates: true,
      },
    },
    file: {
      create: file,
    },
    parentId: parent ? parent.id : user.rootId,
  }
}

export function getItemCategory(): ItemCategory {
  return faker.helpers.enumValue(ItemCategory)
}

export function generateSize() {
  return faker.number.int({ min: 100, max: 1000000, multipleOf: 1024 })
}

export function generateMockFile({
  drive,
}: {
  drive: Pick<Drive, 'name' | 'id'>
}) {
  const { filename, mimetype, extension, name } = generateFileInfo()
  return {
    id: toObjectId(getPrefixForModel('File')),
    mimeType: mimetype,
    extension: extension,
    bucket: drive.name,
    key: `${drive.name}/${filename}`,
    uploadPath: `${drive.name}/${filename}`,
    etag: faker.string.alphanumeric(12),
    filename,
    name,
  }
}

export function generateMockUsers(count: number) {
  return faker.helpers.multiple(() => generateMockUser(), { count })
}

export function generateMockItemsWithFolder({
  count,
  user,
  drive,
  parent,
  name,
}: {
  count: number
  user: User
  drive: Drive
  parent?: Item
  name: string
}) {
  return faker.helpers.multiple(
    () => generateMockItemWithFolder({ user, drive, parent, name }),
    {
      count,
    }
  )
}

export function generateMockItemsWithFile({
  count,
  user,
  drive,
  parent,
}: {
  count: number
  user: User
  drive: Drive
  parent?: Item
}) {
  return faker.helpers.multiple(
    () => generateMockItemWithFile(user, drive, parent),
    {
      count,
    }
  )
}

export function generateMockTopLevelFolders({
  user,
  drive,
  parent,
}: {
  user: User
  drive: Drive
  parent?: Item
}) {
  return faker.helpers.multiple(
    () =>
      generateMockItemWithFolder({
        user,
        drive,
        name: faker.system.filePath().split('/').pop()!,
        parent,
      }),
    {
      count: faker.number.int({ min: 2, max: 6 }),
    }
  )
}

export function generateMockSubFolders({
  user,
  drive,
  folders,
}: {
  user: User
  drive: Drive
  folders: Item[]
}) {
  return faker.helpers.multiple(
    () =>
      generateMockItemWithFolder({
        user,
        drive,
        parent: faker.helpers.arrayElement(folders),
        name: faker.git.branch(),
      }),
    {
      count: faker.number.int({ min: 6, max: 12 }),
    }
  )
}

export function generateMockLockedItems({
  user,
  createdFiles,
}: {
  user: User
  createdFiles: Item[]
}) {
  return faker.helpers.multiple(
    () => {
      let item = faker.helpers.arrayElement(createdFiles)
      return generateMockLockedItem({
        itemId: item.id,
        lockedById: user.id,
      })
    },
    {
      count: 5,
    }
  )
}

export function generateMockFavoriteItems({
  user,
  createdFiles,
}: {
  user: User
  createdFiles: Item[]
}) {
  let item = faker.helpers.arrayElement(createdFiles.map((i) => i.id))
  return faker.helpers.multiple(
    () => {
      return generateMockFavoriteItem(item, user.id)
    },
    {
      count: 10,
    }
  )
}

// These are for `seed.ts` only, but are kept here to keep all the mocks together.
export function generateMockLockedItem({
  itemId,
  lockedById,
}: {
  itemId: string
  lockedById: string
}) {
  return {
    id: toObjectId(getPrefixForModel('LockedItem')),
    itemId: itemId,
    lockedById: lockedById,
    expiresAt: faker.date.future(),
    lockedAt: faker.date.past(),
  }
}

export function generateMockFavoriteItem(itemId: string, ownerId: string) {
  return {
    id: toObjectId(getPrefixForModel('Favorite')),
    itemId: itemId,
    favoritedById: ownerId,
    createdAt: faker.date.past(),
  }
}

type FileTag = string

/**
 * Generates a single mock file tag.
 * It randomly chooses from several Faker.js methods to create varied tags.
 * @returns {FileTag} A string representing a file tag.
 */
function generateSingleTag(): FileTag {
  const tagGenerators = [
    () => faker.word.verb(),
    () => faker.word.adjective(),
    () => `${faker.hacker.ingverb()}ing`,
    () => faker.lorem.word(),
    () => `Project-${faker.lorem.word()}`,
    () => `${faker.commerce.department()}`,
  ]

  const generator = faker.helpers.arrayElement(tagGenerators)
  const tag = generator()

  // Capitalize the first letter for a clean look
  return tag.charAt(0).toUpperCase() + tag.slice(1)
}

/**
 * Generates an array of mock Google Drive-style tags.
 * @param {number} count The number of tags to generate.
 * @returns {FileTag[]} An array of generated tags.
 */
export function generateTags(count: number): FileTag[] {
  const tags: Set<FileTag> = new Set()
  while (tags.size < count) {
    const newTag = generateSingleTag()
    tags.add(newTag)
  }

  return Array.from(tags)
}

export function generateMockTags(count: number) {
  return generateTags(count)
}
