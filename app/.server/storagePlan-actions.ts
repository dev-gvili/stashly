import type { Prisma, StoragePlanType } from '@/prisma/client'
import { prisma } from '@/services/db'

export async function findStoragePlanById(id: string) {
  return prisma.storagePlan.findUniqueOrThrow({ where: { id } })
}

export async function findAllStoragePlans(args: Prisma.StoragePlanFindManyArgs) {
  return prisma.storagePlan.findMany(args)
}

export async function createStoragePlan(args: Prisma.StoragePlanCreateArgs) {
  return prisma.storagePlan.create(args)
}

export async function updateStoragePlan(args: Prisma.StoragePlanUpdateArgs) {
  return prisma.storagePlan.update(args)
}

export async function deleteStoragePlan(args: Prisma.StoragePlanDeleteArgs) {
  return prisma.storagePlan.delete(args)
}

export async function findStoragePlanByType(type: StoragePlanType) {
  return prisma.storagePlan.findFirst({ where: { type } })
}

export async function findStoragePlanByName(name: string) {
  return prisma.storagePlan.findFirst({ where: { name } })
}

export async function findStoragePlansByIds(ids: string[]) {
  return prisma.storagePlan.findMany({ where: { id: { in: ids } } })
}

export async function findStoragePlanByPriceId(priceId: string) {
  return prisma.storagePlan.findFirst({ where: { stripePriceId: priceId } })
}

export async function findStoragePlanByTypeAndPrice(type: StoragePlanType, priceId: string) {
  return prisma.storagePlan.findFirst({ where: { type, stripePriceId: priceId } })
}

export async function findStoragePlanByTypeAndLimit(type: StoragePlanType, limit: bigint) {
  return prisma.storagePlan.findFirst({ where: { type, storageLimit: limit } })
}

export async function findStoragePlanLimitsByType(type: StoragePlanType) {
  const plan = await findStoragePlanByType(type)
  if (!plan) throw new Error(`Storage plan ${type} not found`)
  return {
    storageLimit: plan.storageLimit,
    workspaceLimit: plan.workspaceLimit,
    memberLimit: plan.memberLimit,
  }
}

export async function findDefaultStoragePlan(client: Prisma.TransactionClient = prisma) {
  return client.storagePlan.findFirstOrThrow({ where: { type: 'free' } })
}
