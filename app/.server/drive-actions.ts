import type { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { buildDriveFilters } from '@/utils/filters/drive.filters'
import { searchFactory } from '@/utils/search'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over Drive records.
 *
 * @example
 * const page = await searchDrives({ ownerId: 'user_123', take: 20, strategy: 'cursor' })
 */
export const searchDrives = searchFactory({
  dbDelegate: prisma.drive,
  buildFilters: buildDriveFilters,
  defaultOrderBy: (): Prisma.DriveOrderByWithRelationInput => ({ createdAt: 'desc' }),
})

const defaultInclude = {
  quota: true,
  owner: true,
  storage: true,
} satisfies Prisma.DriveInclude

type DriveWithRelations = Prisma.DriveGetPayload<{ include: typeof defaultInclude }>

/**
 * Find a drive by ID.
 *
 * @param id - The drive ID.
 * @returns The drive with quota, owner, and storage relations, or `null` if not found.
 *
 * @example
 * const drive = await findDriveById('drv_abc123')
 * if (drive) console.log(drive.quota?.used)
 */
export async function findDriveById(id: string): Promise<DriveWithRelations | null> {
  return prisma.drive.findUnique({ where: { id }, include: defaultInclude })
}

/**
 * Find a drive by ID. Throws if not found.
 *
 * @param id - The drive ID.
 * @returns The drive with quota, owner, and storage relations.
 * @throws {PrismaClientKnownRequestError} If no drive with the given ID exists.
 *
 * @example
 * const drive = await findDriveByIdOrThrow('drv_abc123')
 * console.log(drive.quota?.used)
 */
export async function findDriveByIdOrThrow(id: string): Promise<DriveWithRelations> {
  return prisma.drive.findUniqueOrThrow({ where: { id }, include: defaultInclude })
}

/**
 * Find the drive belonging to a user.
 *
 * @param ownerId - The user ID of the drive owner.
 * @returns The drive with relations, or `null` if the user has no drive.
 *
 * @example
 * const drive = await findDriveByOwner(session.user.id)
 * if (!drive) throw new Error('User not onboarded')
 */
export async function findDriveByOwner(ownerId: string): Promise<DriveWithRelations | null> {
  return prisma.drive.findFirst({ where: { ownerId }, include: defaultInclude })
}

/**
 * Find the drive belonging to a user. Throws if not found.
 *
 * @param ownerId - The user ID of the drive owner.
 * @returns The drive with relations.
 * @throws {PrismaClientKnownRequestError} If the user has no drive.
 *
 * @example
 * const drive = await findDriveByOwnerOrThrow(session.user.id)
 * console.log(drive.storage?.storageLimit)
 */
export async function findDriveByOwnerOrThrow(ownerId: string): Promise<DriveWithRelations> {
  return prisma.drive.findFirstOrThrow({ where: { ownerId }, include: defaultInclude })
}

/**
 * Find all drives, optionally scoped by Prisma filter args.
 *
 * @param args - Optional Prisma `findMany` args (where, orderBy, take, skip, etc.).
 * @returns Array of drives with relations.
 *
 * @example
 * const all = await findAllDrives()
 * const personal = await findAllDrives({ where: { type: 'personal' } })
 */
export async function findAllDrives(args?: Prisma.DriveFindManyArgs): Promise<DriveWithRelations[]> {
  return prisma.drive.findMany({ ...args, include: defaultInclude })
}

/**
 * Create a new drive. The ID is auto-generated.
 *
 * @param data - Drive create input (without `id`).
 * @returns The created drive with relations.
 *
 * @example
 * const drive = await createDrive({
 *   name: 'my-bucket',
 *   owner: { connect: { id: user.id } },
 *   storage: { connect: { id: storagePlan.id } },
 * })
 */
export async function createDrive(data: Omit<Prisma.DriveCreateInput, 'id'>): Promise<DriveWithRelations> {
  return prisma.drive.create({
    data: { ...data, id: toObjectId(getPrefixForModel('Drive')) },
    include: defaultInclude,
  })
}

/**
 * Update a drive.
 *
 * @param args - Prisma `DriveUpdateArgs` (where + data).
 * @returns The updated drive with relations.
 *
 * @example
 * const drive = await updateDrive({
 *   where: { id: 'drv_abc123' },
 *   data: { storage: { connect: { id: newPlan.id } } },
 * })
 */
export async function updateDrive(args: Prisma.DriveUpdateArgs): Promise<DriveWithRelations> {
  return prisma.drive.update({ ...args, include: defaultInclude })
}

/**
 * Update the drive belonging to a user.
 *
 * @param ownerId - The user ID of the drive owner.
 * @param data - The fields to update.
 * @returns The updated drive with relations.
 *
 * @example
 * const drive = await updateDriveByOwner(session.user.id, {
 *   storage: { connect: { id: newPlan.id } },
 * })
 */
export async function updateDriveByOwner(
  ownerId: string,
  data: Prisma.DriveUpdateInput
): Promise<DriveWithRelations> {
  return prisma.drive.update({ where: { ownerId }, data, include: defaultInclude })
}

/**
 * Create or update a drive.
 *
 * @param args - Prisma `DriveUpsertArgs` (where + create + update).
 * @returns The created or updated drive with relations.
 *
 * @example
 * const drive = await upsertDrive({
 *   where: { ownerId: user.id },
 *   create: { name: 'my-bucket', owner: { connect: { id: user.id } } },
 *   update: { name: 'my-bucket' },
 * })
 */
export async function upsertDrive(args: Prisma.DriveUpsertArgs): Promise<DriveWithRelations> {
  return prisma.drive.upsert({ ...args, include: defaultInclude })
}

/**
 * Delete a drive by ID.
 *
 * @param id - The drive ID to delete.
 * @returns The deleted drive with relations.
 *
 * @example
 * const deleted = await deleteDrive('drv_abc123')
 */
export async function deleteDrive(id: string): Promise<DriveWithRelations> {
  return prisma.drive.delete({ where: { id }, include: defaultInclude })
}

/**
 * Count drives, optionally scoped by Prisma filter args.
 *
 * @param args - Optional Prisma `count` args (where, etc.).
 * @returns The number of matching drives.
 *
 * @example
 * const total = await countDrives()
 * const personal = await countDrives({ where: { type: 'personal' } })
 */
export async function countDrives(args?: Prisma.DriveCountArgs): Promise<number> {
  return prisma.drive.count(args)
}
