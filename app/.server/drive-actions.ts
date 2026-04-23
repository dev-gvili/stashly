import type { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

const defaultInclude = {
  quota: true,
  owner: true,
  storage: true,
} satisfies Prisma.DriveInclude

type DriveWithRelations = Prisma.DriveGetPayload<{ include: typeof defaultInclude }>

export async function findDriveById(id: string): Promise<DriveWithRelations | null> {
  return prisma.drive.findUnique({ where: { id }, include: defaultInclude })
}

export async function findDriveByIdOrThrow(id: string): Promise<DriveWithRelations> {
  return prisma.drive.findUniqueOrThrow({ where: { id }, include: defaultInclude })
}

export async function findDriveByOwner(ownerId: string): Promise<DriveWithRelations | null> {
  return prisma.drive.findFirst({ where: { ownerId }, include: defaultInclude })
}

export async function findDriveByOwnerOrThrow(ownerId: string): Promise<DriveWithRelations> {
  return prisma.drive.findFirstOrThrow({ where: { ownerId }, include: defaultInclude })
}

export async function findAllDrives(args?: Prisma.DriveFindManyArgs): Promise<DriveWithRelations[]> {
  return prisma.drive.findMany({ ...args, include: defaultInclude })
}

export async function createDrive(data: Omit<Prisma.DriveCreateInput, 'id'>): Promise<DriveWithRelations> {
  return prisma.drive.create({
    data: { ...data, id: toObjectId(getPrefixForModel('Drive')) },
    include: defaultInclude,
  })
}

export async function updateDrive(args: Prisma.DriveUpdateArgs): Promise<DriveWithRelations> {
  return prisma.drive.update({ ...args, include: defaultInclude })
}

export async function updateDriveByOwner(
  ownerId: string,
  data: Prisma.DriveUpdateInput
): Promise<DriveWithRelations> {
  return prisma.drive.update({ where: { ownerId }, data, include: defaultInclude })
}

export async function upsertDrive(args: Prisma.DriveUpsertArgs): Promise<DriveWithRelations> {
  return prisma.drive.upsert({ ...args, include: defaultInclude })
}

export async function deleteDrive(id: string): Promise<DriveWithRelations> {
  return prisma.drive.delete({ where: { id }, include: defaultInclude })
}

export async function countDrives(args?: Prisma.DriveCountArgs): Promise<number> {
  return prisma.drive.count(args)
}
