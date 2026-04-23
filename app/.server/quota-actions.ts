import type { Prisma, Quota as PrismaQuota } from '@/prisma/client'
import { QuotaStatus } from '@/prisma/enums'
import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from './api.errors'
import { findDefaultStoragePlan, findStoragePlanById } from './storagePlan-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuotaOutput extends Omit<PrismaQuota, 'createdAt' | 'updatedAt'> {
  remaining: bigint
}

export interface QuotaInput {
  userId: string
  dataSize: bigint
}

export interface UpdateAfterInput {
  userId: string
  dataSize: bigint
  client?: Prisma.TransactionClient
}

// ─── Pure utilities ───────────────────────────────────────────────────────────

export function toQuotaStatus({ used, total }: Pick<QuotaOutput, 'used' | 'total'>): QuotaStatus {
  if (total === 0n) return used > 0n ? 'exceeded' : 'normal'
  const ratio = Number((used * 1000n) / total) / 1000
  if (ratio > 1) return 'exceeded'
  if (ratio > 0.99) return 'critical'
  if (ratio > 0.9) return 'warning'
  return 'normal'
}

export function calculateQuota(
  current: Pick<QuotaOutput, 'used' | 'deleted' | 'total'>,
  data: Partial<Pick<PrismaQuota, 'used' | 'deleted' | 'total'>>
): Pick<QuotaOutput, 'used' | 'deleted' | 'total' | 'status' | 'remaining'> {
  const total = data.total ?? current.total
  let used = current.used + (data.used ?? 0n)
  if (used < 0n) used = 0n
  let deleted = current.deleted + (data.deleted ?? 0n)
  if (deleted < 0n) deleted = 0n
  const remaining = total - used
  return { total, used, deleted, remaining, status: toQuotaStatus({ used, total }) }
}

export function toQuota(quota: Omit<PrismaQuota, 'createdAt' | 'updatedAt'>): QuotaOutput {
  const { total, used, deleted } = quota
  const remaining = total - used
  return { ...quota, remaining, status: toQuotaStatus({ used, total }) }
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

export async function findQuotaById(id: string, client: Prisma.TransactionClient = prisma) {
  const quota = await client.quota.findUniqueOrThrow({ where: { id } })
  return toQuota(quota)
}

export async function findQuotaByUserId(userId: string, client: Prisma.TransactionClient = prisma) {
  const quota = await client.quota.findFirst({ where: { drive: { ownerId: userId } } })
  return quota ? toQuota(quota) : null
}

export async function findQuotaByDriveId(driveId: string, client: Prisma.TransactionClient = prisma) {
  const quota = await client.quota.findFirst({ where: { driveId } })
  return quota ? toQuota(quota) : null
}

export async function findQuotaByUserAndDrive(userId: string, driveId: string) {
  const quota = await prisma.quota.findFirst({
    where: { drive: { ownerId: userId }, driveId },
    omit: { createdAt: true, updatedAt: true },
  })
  return quota ? toQuota(quota) : null
}

/** Compat alias used by routes/api/quota.ts */
export async function findQuota({ userId }: { userId: string }): Promise<QuotaOutput> {
  const quota = await findQuotaByUserId(userId)
  if (!quota) throw new Error(`Quota not found for user ${userId}`)
  return quota
}

export async function assertQuotaExists(id: string, client: Prisma.TransactionClient = prisma) {
  const quota = await client.quota.findUnique({ where: { id } })
  if (!quota) throw new StashlyError(StashlyErrorCode.QUOTA_NOT_FOUND)
  return toQuota(quota)
}

export async function ensureUserQuota(userId: string, client: Prisma.TransactionClient = prisma) {
  const quota = await findQuotaByUserId(userId, client)
  if (!quota) throw new StashlyError(StashlyErrorCode.QUOTA_NOT_DEFINED_FOR_USER)
  return quota
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function verifyFreeQuota(quota: QuotaOutput, dataSize: bigint): boolean {
  return quota.remaining >= dataSize
}

export function checkFreeQuota(itemId: string, quota: QuotaOutput, dataSize: bigint) {
  return { itemId, result: verifyFreeQuota(quota, dataSize) ? 'allowed' : 'denied' } as const
}

export function validateQuotaFreeSpace(quota: QuotaOutput, size: bigint): void {
  if (quota.total - quota.used < size) throw new StashlyError(StashlyErrorCode.INSUFFICIENT_QUOTA)
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createQuota({
  storagePlanId,
  ...args
}: Prisma.QuotaUncheckedCreateInput & { storagePlanId?: string }) {
  if (!storagePlanId) {
    const plan = await findDefaultStoragePlan()
    args.total = plan.storageLimit
  } else {
    const plan = await findStoragePlanById(storagePlanId)
    if (!plan) throw new Error(`Storage plan ${storagePlanId} not found`)
    args.total = plan.storageLimit
  }
  return toQuota(await prisma.quota.create({ data: args }))
}

export async function deleteQuota(args: Prisma.QuotaDeleteArgs) {
  return toQuota(await prisma.quota.delete(args))
}

// ─── Internal update ─────────────────────────────────────────────────────────

async function applyQuotaDelta({
  userId,
  driveId,
  id,
  client = prisma,
  ...data
}: Pick<Prisma.QuotaUncheckedUpdateInput, 'used' | 'deleted' | 'total'> & {
  userId?: string
  driveId?: string
  id?: string
  client?: Prisma.TransactionClient
}) {
  let current: QuotaOutput | null = null
  if (id) current = await findQuotaById(id, client)
  else if (driveId) current = await findQuotaByDriveId(driveId, client)
  else if (userId) current = await findQuotaByUserId(userId, client)
  if (!current) throw new StashlyError(StashlyErrorCode.QUOTA_NOT_FOUND)
  const { remaining, ...quota } = calculateQuota(current, data as PrismaQuota)
  return toQuota(await client.quota.update({ where: { id: current.id }, data: { ...data, ...quota } }))
}

// ─── After-action helpers ─────────────────────────────────────────────────────

export async function onItemsUploaded({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: dataSize, client })
}

export async function onItemsCopied({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: dataSize, client })
}

export async function onItemsTrashed({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: -dataSize, deleted: dataSize, client })
}

export async function onItemsRestored({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: dataSize, deleted: -dataSize, client })
}

export async function onItemsDeleted({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, deleted: -dataSize, client })
}

export async function updateTotalQuota({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, total: dataSize, client })
}
