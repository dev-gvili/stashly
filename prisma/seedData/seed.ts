import { faker } from '@faker-js/faker'
import { PrismaClient } from '../../app/.server/prisma/client'
import { inspect } from 'node:util'
import { getPrefixForModel, toObjectId } from '../../app/utils/misc'
import {
	generateMockUsers,
	generateMockDrive,
	generateMockStoragePlans,
	generateMockTopLevelFolders,
	generateMockSubFolders,
	generateMockLockedItems,
	generateMockFavoriteItems,
	generateMockItemsWithFile,
} from './data'

const prisma = new PrismaClient()

async function main(): Promise<void> {
	try {
		await prisma.$transaction([
			prisma.trashItem.deleteMany(),
			prisma.subscription.deleteMany(),
			prisma.storagePlan.deleteMany(),
			prisma.lockedItem.deleteMany(),
			prisma.favorite.deleteMany(),
			prisma.folder.deleteMany(),
			prisma.file.deleteMany(),
			prisma.thumbnail.deleteMany(),
			prisma.item.deleteMany(),
			prisma.drive.deleteMany(),
			prisma.storagePlan.deleteMany(),
			prisma.user.deleteMany(),
		])

		// Create storage plans
		const createdStoragePlans =
			await prisma.storagePlan.createManyAndReturn({
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
		const top_folders = generateMockTopLevelFolders({ user, drive })

		const createdTopFolders = await prisma.$transaction([
			...top_folders.map((folder) =>
				prisma.item.create({
					data: folder,
				})
			),
		])

		const folders = generateMockSubFolders({
			user,
			drive,
			folders: createdTopFolders,
		})

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

		const favoritedItems = generateMockFavoriteItems({ user, createdFiles })
		await prisma.$transaction([
			...favoritedItems.map((item) =>
				prisma.favorite.create({
					data: item,
				})
			),
		])

		const lockedItems = generateMockLockedItems({ user, createdFiles })
		await prisma.$transaction([
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
