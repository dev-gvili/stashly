import { faker } from '@faker-js/faker'
import {
	Prisma,
	type Drive,
	type Item,
	type StoragePlan,
} from '../../app/.server/prisma/client'
import type { User } from 'better-auth'
import { customAlphabet } from 'nanoid'
import {
	ItemCategory,
	DriveType,
	StoragePlanType,
	type ThumbnailSize,
} from '../../app/.server/prisma/enums'
import { getPrefixForModel, toObjectId } from '../../app/utils/misc'

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

export function generateThumbnailUrl(size: ThumbnailSize) {
	switch (size) {
		case 'small':
			return faker.image.urlPicsumPhotos({ height: 100, width: 100 })
		case 'medium':
			return faker.image.urlPicsumPhotos({ height: 400, width: 400 })
		case 'large':
			return faker.image.urlPicsumPhotos({ height: 800, width: 800 })
		case 'custom':
		default:
			return faker.image.urlPicsumPhotos({ height: 400, width: 400 })
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
	storageLimit,
	workspaceLimit,
	memberLimit,
}: {
	type: StoragePlanType
	name: string
	storageLimit: bigint
	workspaceLimit: number
	memberLimit: number
}): Prisma.StoragePlanCreateInput => {
	const prefix = getPrefixForModel('StoragePlan')
	const id = toObjectId(prefix)
	return {
		id,
		type,
		name,
		storageLimit,
		workspaceLimit,
		memberLimit,
	}
}

export const generateMockStoragePlans = () => {
	return [
		generateStoragePlan({
			type: StoragePlanType.free,
			name: 'Free',
			storageLimit: BigInt(15 * 1024 * 1024 * 1024), // 15 GB
			workspaceLimit: 5,
			memberLimit: 5,
		}),
		generateStoragePlan({
			type: StoragePlanType.basic,
			name: 'Basic',
			storageLimit: BigInt(100 * 1024 * 1024 * 1024), // 100 GB
			workspaceLimit: 10,
			memberLimit: 10,
		}),
		generateStoragePlan({
			type: StoragePlanType.standard,
			name: 'Standard',
			storageLimit: BigInt(200 * 1024 * 1024 * 1024), // 200 GB
			workspaceLimit: 50,
			memberLimit: 50,
		}),
		generateStoragePlan({
			type: StoragePlanType.premium,
			name: 'Premium',
			storageLimit: BigInt(2 * 1024 * 1024 * 1024), // 2 TB
			workspaceLimit: 1000,
			memberLimit: 1000,
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
}): Prisma.ItemUncheckedCreateInput => {
	const prefix = getPrefixForModel('Item')
	const id = toObjectId(prefix)
	return {
		id,
		name,
		size: 0,
		path: generateItemPath(drive.name, parent?.path, name),
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

export const generateThumbnail = (size: ThumbnailSize) => {
	return {
		size: size,
		id: toObjectId(getPrefixForModel('Thumbnail')),
		url: generateThumbnailUrl(size),
	}
}

export const generateMockItemWithFile = (
	user: User,
	drive: Pick<Drive, 'name' | 'id'>,
	parent?: Item
): Prisma.ItemUncheckedCreateInput => {
	const { filename, name, ...file } = generateMockFile({ drive })
	return {
		id: toObjectId(getPrefixForModel('Item')),
		name,
		size: generateSize(),
		path: generateItemPath(drive.name, parent?.path, `${filename}`),
		type: 'file',
		ownerId: user.id,
		driveId: drive.id,
		tags: faker.helpers.arrayElements(
			['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
			{ min: 0, max: 2 }
		),
		category: getItemCategory(),
		thumbnails: {
			create: [
				generateThumbnail('small'),
				generateThumbnail('medium'),
				generateThumbnail('large'),
				generateThumbnail('custom'),
			],
		},
		file: {
			create: file,
		},
		parentId: parent ? parent.id : null,
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
}: {
	user: User
	drive: Drive
}) {
	return faker.helpers.multiple(
		() =>
			generateMockItemWithFolder({
				user,
				drive,
				name: faker.system.directoryPath().split('/').pop()!,
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
	return faker.helpers.multiple(
		() => {
			let item = faker.helpers.arrayElement(
				createdFiles.map((file) => file.id)
			)
			return generateMockFavoriteItem(item, user.id)
		},
		{
			count: 2,
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
