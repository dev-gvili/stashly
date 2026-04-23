import type { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

const defaultInclude = {
  time: true,
  item: true,
  action: true,
  access: true,
} satisfies Prisma.ActivityInclude

type ActivityWithRelations = Prisma.ActivityGetPayload<{ include: typeof defaultInclude }>

export async function findActivityById(id: string): Promise<ActivityWithRelations | null> {
  return prisma.activity.findUnique({ where: { id }, include: defaultInclude })
}

export async function findAllActivities(args?: Prisma.ActivityFindManyArgs): Promise<ActivityWithRelations[]> {
  return prisma.activity.findMany({ ...args, include: defaultInclude })
}

export async function findManyActivities(args: Prisma.ActivityFindManyArgs): Promise<ActivityWithRelations[]> {
  return prisma.activity.findMany({ ...args, include: defaultInclude })
}

export async function findFirstActivity(args: Prisma.ActivityFindFirstArgs): Promise<ActivityWithRelations | null> {
  return prisma.activity.findFirst({ ...args, include: defaultInclude })
}

export async function createActivity(data: Prisma.ActivityCreateInput): Promise<ActivityWithRelations> {
  return prisma.activity.create({
    data: { ...data, id: toObjectId(getPrefixForModel('Activity')) },
    include: defaultInclude,
  })
}

export async function updateActivity(args: Prisma.ActivityUpdateArgs): Promise<ActivityWithRelations> {
  return prisma.activity.update({ ...args, include: defaultInclude })
}

export async function deleteActivity(id: string): Promise<ActivityWithRelations> {
  return prisma.activity.delete({ where: { id }, include: defaultInclude })
}

export async function countActivities(args?: Prisma.ActivityCountArgs): Promise<number> {
  return prisma.activity.count(args)
}
