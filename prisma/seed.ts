import { faker } from '@faker-js/faker'
import { addMinutes } from 'date-fns'
import {
	Prisma,
	PrismaClient,
	type Drive,
	type Item,
	type StoragePlan,
} from '../app/.server/prisma/client'
import type { User } from 'better-auth'
import { customAlphabet } from 'nanoid'
import {
	ItemCategory,
	DriveType,
	StoragePlanType,
	type ThumbnailSize,
} from '../app/.server/prisma/enums'
import { inspect } from 'node:util'
import {
	getPrefixForModel,
	toObjectId,
	type StashlyObjectType,
} from '../app/utils/misc'

const prisma = new PrismaClient()

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

function generateThumbnail(size: ThumbnailSize) {
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

function generateFileInfo() {
	let mimetype = faker.system.mimeType()
	let ext = faker.system.fileExt(mimetype)
	let filename = faker.system.commonFileName(ext).split('.')[0] // Remove extension from filename
	return { filename, mimetype, ext }
}

const generateItemPath = (driveName: string, parentPath?: string): string => {
	return parentPath ? `${parentPath}` : `${driveName}`
}

const generateFolderName = () => {
	return faker.system.directoryPath().split('/').pop()
}

const generateUniqueDriveName = (prefix: string, user: User): string => {
	// Create nanoid with safe characters for S3 bucket names
	const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8)

	// Clean username - remove special chars, convert to lowercase
	const cleanUsername = user.name
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.slice(0, 16) // max 16 chars for username part

	// Generate bucket name components
	const userPart = `${cleanUsername}`
	const randomPart = nanoid(8)

	// Combine parts with prefix
	const bucketName = `${prefix}-${userPart}-${randomPart}`
	return bucketName
}

const generateStoragePlan = ({
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

const generateMockStoragePlans = () => {
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
			memberLimit: 50
		}),
		generateStoragePlan({
			type: StoragePlanType.premium,
			name: 'Premium',
			storageLimit: BigInt(2 * 1024 * 1024 * 1024), // 2 TB
						workspaceLimit: 1000,
			memberLimit: 1000
		}),
	]
}

function generateMockUser() {
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

const generateMockQuota = (
	storagePlan: StoragePlan
): Prisma.QuotaUncheckedCreateWithoutDriveInput => {
	const prefix = getPrefixForModel('Quota')
	const id = toObjectId(prefix)
	return {
		id,
		status: 'normal',
		total: storagePlan.storageLimit,
		deleted: 0,
		used: 0,
	}
}

const generateMockDrive = (
	user: User,
	storagePlan: StoragePlan
): Prisma.DriveUncheckedCreateInput => {
	const prefix = getPrefixForModel('Drive')
	const id = toObjectId(prefix)

	return {
		id,
		name: generateUniqueDriveName('stashly', user),
		type: 'personal' as DriveType,
		ownerId: user.id,
		quota: {
			create: {
				...generateMockQuota(storagePlan),
			},
		},
	}
}

const generateMockItemWithFolder = (
	user: User,
	drive: Pick<Drive, 'name' | 'id'>,
	parent?: Item,
	name?: string
) => {
	// const name = faker.git.branch()
	const prefix = getPrefixForModel('Item')
	const id = toObjectId(prefix)
	const fdprefix = getPrefixForModel('Folder')
	const fdid = toObjectId(fdprefix)

	return {
		id,
		name: name,
		size: 0,
		path: `${generateItemPath(drive.name, parent?.path)}/${name}`,
		type: 'folder',
		ownerId: user.id,
		driveId: drive.id,
		category: undefined, // Folders don't have a category
		parentId: parent ? parent.id : null,
		folder: {
			create: {
				id: fdid,
				childCount: 0,
				view: {
					create: {
						viewType: 'grid',
						sortBy: 'type',
						sortOrder: 'ascending',
					},
				},
			},
		},
	} as Prisma.ItemUncheckedCreateInput
}

const generateMockItemWithFile = (
	user: User,
	drive: Pick<Drive, 'name' | 'id'>,
	parent?: Item
): Prisma.ItemUncheckedCreateInput => {
	const { filename, mimetype, ext } = generateFileInfo()
	const prefix = getPrefixForModel('Item')
	const id = toObjectId(prefix)
	const flprefix = getPrefixForModel('File')
	const flid = toObjectId(flprefix)

	return {
		id,
		name: filename,
		size: faker.number.int({ min: 100, max: 1000000, multipleOf: 1024 }), // Random size between 100 bytes and 1 MB
		// Use the drive name and filename for the path
		path: `${generateItemPath(
			drive.name,
			parent?.path
		)}/${filename}.${ext}`,
		type: 'file',
		ownerId: user.id,
		driveId: drive.id,
		tags: faker.helpers.arrayElements(
			['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
			{ min: 0, max: 2 }
		),
		category: faker.helpers.arrayElement([
			faker.helpers.enumValue(ItemCategory),
		]) as ItemCategory,
		thumbnails: {
			create: [
				{
					id: toObjectId(getPrefixForModel('Thumbnail')),
					size: 'custom',
					url: generateThumbnail('custom'),
				},
				{
					id: toObjectId(getPrefixForModel('Thumbnail')),
					size: 'small',
					url: generateThumbnail('small'),
				},
				{
					id: toObjectId(getPrefixForModel('Thumbnail')),
					size: 'medium',
					url: generateThumbnail('medium'),
				},
				{
					id: toObjectId(getPrefixForModel('Thumbnail')),
					size: 'large',
					url: generateThumbnail('large'),
				},
			],
		},
		file: {
			create: {
				id: flid,
				mimeType: mimetype,
				extension: ext,
				bucket: drive.name,
				key: `${drive.name}/${filename}.${ext}`,
				etag: faker.string.alphanumeric(12),
			},
		},
		parentId: parent ? parent.id : null,
	}
}
function generateMockUsers(count: number) {
	return faker.helpers.multiple(() => generateMockUser(), { count })
}

function generateMockItemsWithFolder({
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
	name?: string
}) {
	return faker.helpers.multiple(
		() => generateMockItemWithFolder(user, drive, parent, name),
		{
			count,
		}
	)
}
function generateMockItemsWithFile({
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

function generateMockLockedItem(
	itemId: string,
	lockedById: string,
	id: string
) {
	return {
		id,
		itemId,
		lockedById,
		expiresAt: addMinutes(Date.now(), 45),
	} as Prisma.LockedItemUncheckedCreateInput
}

function generateMockFavoriteItem(itemId: string, favoritedById: string) {
	const prefix = getPrefixForModel('Favorite')
	const id = toObjectId(prefix)
	return {
		id,
		itemId,
		favoritedById,
	} as Prisma.FavoriteUncheckedCreateInput
}

function generateMockLockedItems({
	count,
	lockedById,
	itemId,
	id,
}: {
	id: string
	count: number
	lockedById: string
	itemId: string
}) {
	return faker.helpers.multiple(
		() => generateMockLockedItem(itemId, lockedById, id),
		{
			count,
		}
	)
}

async function main(): Promise<void> {
	try {
  await prisma.$transaction([
			// Start with models that have foreign keys to Item or User
 			prisma.trashItem.deleteMany(),
 			prisma.subscription.deleteMany(),
			prisma.storagePlan.deleteMany(),
 			prisma.lockedItem.deleteMany(),
 			prisma.favorite.deleteMany(),
			prisma.folder.deleteMany(), // This was the cause of the error
			prisma.file.deleteMany(),
			prisma.thumbnail.deleteMany(),
			
			// Now it's safe to delete Items
 			prisma.item.deleteMany(),

			// These are mostly independent or are safe to delete now
			prisma.drive.deleteMany(),
			prisma.storagePlan.deleteMany(),
 			prisma.user.deleteMany(),
 		])
		// Create storage plans
		const storagePlans = generateMockStoragePlans()
		const createdStoragePlans =
			await prisma.storagePlan.createManyAndReturn({
				data: storagePlans,
			})

		const mockUser = generateMockUsers(1)[0]
		const user = await prisma.user.create({
			data: mockUser,
			select: {
				id: true,
				email: true,
				name: true,
				displayName: true,
				image: true,
				emailVerified: true,
				createdAt: true,
				updatedAt: true,
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

		// Create multiple folders and files
		const top_folders = faker.helpers.multiple(
			() =>
				generateMockItemWithFolder(
					user,
					drive,
					undefined,
					faker.system.directoryPath().split('/').pop()
				),
			{
				count: faker.number.int({ min: 2, max: 4 }),
			}
		)

		console.log(inspect(top_folders, { colors: true, depth: null }))

		const createdTopFolders = await prisma.$transaction([
			...top_folders.map((folder) =>
				prisma.item.create({
					data: folder,
				})
			),
		])

		const folders = faker.helpers.multiple(
			() =>
				generateMockItemWithFolder(
					user,
					drive,
					faker.helpers.arrayElement(createdTopFolders),
					faker.git.branch()
				),
			{
				count: faker.number.int({ min: 6, max: 12 }),
			}
		)
		const createdFolders = await prisma.$transaction([
			...folders.map((folder) =>
				prisma.item.create({
					data: folder,
				})
			),
		])

		const files = generateMockItemsWithFile({
			count: faker.number.int({ min: 15, max: 25 }),
			user,
			drive,
			parent: faker.helpers.arrayElement(createdFolders),
		})

		const createdFiles = await prisma.$transaction([
			...files.map((file) =>
				prisma.item.create({
					data: file,
				})
			),
		])

		const lockedItems = faker.helpers.multiple(
			() => {
				let item = faker.helpers.arrayElement(createdFiles)
				const liPrefix = getPrefixForModel('LockedItem')
				const liId = toObjectId(liPrefix)

				return generateMockLockedItem(item.id, item.ownerId, liId)
			},
			{
				count: 5,
			}
		)

		const favoritedItems = faker.helpers.multiple(
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

		const createdFavoritedItems = await prisma.$transaction([
			...favoritedItems.map((item) =>
				prisma.favorite.create({
					data: item,
				})
			),
		])

		console.log(inspect(favoritedItems, { colors: true, depth: null }))
		// console.log(inspect(createdFavoritedItems, { colors: true, depth: null }))

		const createdLockedItems = await prisma.$transaction([
			...lockedItems.map((item) =>
				prisma.lockedItem.create({
					data: item,
				})
			),
		])

		console.log(
			inspect(
				`Seeded database with ${createdStoragePlans.length} storage plans, 1 user, 1 drive, ${createdTopFolders.length} top-level folders, ${createdFolders.length} subfolders, and ${createdFiles.length} files.`,
				{ depth: null, colors: true }
			)
		)

		console.log(inspect(`userId: ${user.id}`))
		// // console.log(
		// 	inspect(
		// 		createdFiles.map((file) => ({
		// 			name: file.name,
		// 			category: file.category,
		// 			type: file.type,
		// 			status: file.status,
		// 		})),
		// 		{
		// 			colors: true,
		// 			depth: null,
		// 		}
		// 	)
		// )
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

/**
 * driveId: 9beb3cf8-816e-438e-b227-da3111422aa3
 * ownerId: 2e1a94bc-0012-4bb8-a7f5-f47f7497b7e3
 * parentId: 30ac4c3a-9407-424e-8114-eca6e5aa308d
 */
