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

/**
 * Derive a `QuotaStatus` from the current used/total values.
 *
 * Thresholds: >100% → `exceeded`, >99% → `critical`, >90% → `warning`, else `normal`.
 *
 * @param quota - Object with `used` and `total` in bytes.
 * @returns The corresponding `QuotaStatus`.
 *
 * @example
 * toQuotaStatus({ used: 95n, total: 100n }) // 'warning'
 * toQuotaStatus({ used: 101n, total: 100n }) // 'exceeded'
 */
export function toQuotaStatus({ used, total }: Pick<QuotaOutput, 'used' | 'total'>): QuotaStatus {
  if (total === 0n) return used > 0n ? 'exceeded' : 'normal'
  const ratio = Number((used * 1000n) / total) / 1000
  if (ratio > 1) return 'exceeded'
  if (ratio > 0.99) return 'critical'
  if (ratio > 0.9) return 'warning'
  return 'normal'
}

/**
 * Apply a delta to quota fields and return the recalculated values.
 * `used` and `deleted` are clamped to 0 to prevent negative values.
 *
 * @param current - The current quota snapshot (used, deleted, total).
 * @param data - Partial delta to apply. Omitted fields default to `0n`.
 * @returns Updated quota fields including `remaining` and `status`.
 *
 * @example
 * const next = calculateQuota(
 *   { used: 50n, deleted: 0n, total: 100n },
 *   { used: 10n }
 * )
 * // { used: 60n, deleted: 0n, total: 100n, remaining: 40n, status: 'normal' }
 */
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

/**
 * Convert a raw Prisma `Quota` record to a `QuotaOutput` by adding `remaining` and `status`.
 *
 * @param quota - Raw quota record (without `createdAt`/`updatedAt`).
 * @returns `QuotaOutput` with `remaining` and `status` populated.
 *
 * @example
 * const raw = await prisma.quota.findFirst({ where: { driveId } })
 * const quota = toQuota(raw)
 * console.log(quota.remaining, quota.status)
 */
export function toQuota(quota: Omit<PrismaQuota, 'createdAt' | 'updatedAt'>): QuotaOutput {
  const { total, used, deleted } = quota
  const remaining = total - used
  return { ...quota, remaining, status: toQuotaStatus({ used, total }) }
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

/**
 * Find a quota by its ID. Throws if not found.
 *
 * @param id - The quota ID.
 * @param client - Optional Prisma transaction client.
 * @returns The `QuotaOutput` for the given ID.
 * @throws {PrismaClientKnownRequestError} If no quota with the given ID exists.
 *
 * @example
 * const quota = await findQuotaById('qta_abc123')
 * console.log(quota.remaining)
 */
export async function findQuotaById(id: string, client: Prisma.TransactionClient = prisma) {
  const quota = await client.quota.findUniqueOrThrow({ where: { id } })
  return toQuota(quota)
}

/**
 * Find the quota for a user via their associated drive.
 *
 * @param userId - The user ID.
 * @param client - Optional Prisma transaction client.
 * @returns The `QuotaOutput`, or `null` if the user has no quota.
 *
 * @example
 * const quota = await findQuotaByUserId(session.user.id)
 * if (!quota) throw new Error('No quota found')
 */
export async function findQuotaByUserId(userId: string, client: Prisma.TransactionClient = prisma) {
  const quota = await client.quota.findFirst({ where: { drive: { ownerId: userId } } })
  return quota ? toQuota(quota) : null
}

/**
 * Find the quota for a specific drive.
 *
 * @param driveId - The drive ID.
 * @param client - Optional Prisma transaction client.
 * @returns The `QuotaOutput`, or `null` if the drive has no quota.
 *
 * @example
 * const quota = await findQuotaByDriveId(session.user.driveId)
 */
export async function findQuotaByDriveId(driveId: string, client: Prisma.TransactionClient = prisma) {
  const quota = await client.quota.findFirst({ where: { driveId } })
  return quota ? toQuota(quota) : null
}

/**
 * Find a quota by both user ID and drive ID.
 * Use when you need to confirm ownership alongside drive membership.
 *
 * @param userId - The user ID.
 * @param driveId - The drive ID.
 * @returns The `QuotaOutput`, or `null` if not found.
 *
 * @example
 * const quota = await findQuotaByUserAndDrive(userId, driveId)
 */
export async function findQuotaByUserAndDrive(userId: string, driveId: string) {
  const quota = await prisma.quota.findFirst({
    where: { drive: { ownerId: userId }, driveId },
    omit: { createdAt: true, updatedAt: true },
  })
  return quota ? toQuota(quota) : null
}

/**
 * Find quota by userId. Throws if not found.
 * Compat alias used by `routes/api/quota.ts`.
 *
 * @param params - Object with `userId`.
 * @returns The `QuotaOutput`.
 * @throws {Error} If no quota exists for the user.
 *
 * @example
 * const quota = await findQuota({ userId: session.user.id })
 */
export async function findQuota({ userId }: { userId: string }): Promise<QuotaOutput> {
  const quota = await findQuotaByUserId(userId)
  if (!quota) throw new Error(`Quota not found for user ${userId}`)
  return quota
}

/**
 * Assert that a quota exists by ID. Throws a `StashlyError` if not found.
 *
 * @param id - The quota ID.
 * @param client - Optional Prisma transaction client.
 * @returns The `QuotaOutput`.
 * @throws {StashlyError} With code `QUOTA_NOT_FOUND` if the quota does not exist.
 *
 * @example
 * const quota = await assertQuotaExists('qta_abc123')
 */
export async function assertQuotaExists(id: string, client: Prisma.TransactionClient = prisma) {
  const quota = await client.quota.findUnique({ where: { id } })
  if (!quota) throw new StashlyError(StashlyErrorCode.QUOTA_NOT_FOUND)
  return toQuota(quota)
}

/**
 * Ensure the user has a quota record. Throws a `StashlyError` if missing.
 *
 * @param userId - The user ID.
 * @param client - Optional Prisma transaction client.
 * @returns The user's `QuotaOutput`.
 * @throws {StashlyError} With code `QUOTA_NOT_DEFINED_FOR_USER` if no quota exists.
 *
 * @example
 * const quota = await ensureUserQuota(session.user.id)
 * validateQuotaFreeSpace(quota, file.size)
 */
export async function ensureUserQuota(userId: string, client: Prisma.TransactionClient = prisma) {
  const quota = await findQuotaByUserId(userId, client)
  if (!quota) throw new StashlyError(StashlyErrorCode.QUOTA_NOT_DEFINED_FOR_USER)
  return quota
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Returns `true` if the quota has at least `dataSize` bytes remaining.
 *
 * @param quota - The current quota.
 * @param dataSize - The number of bytes to check.
 * @returns `true` if space is available, `false` otherwise.
 *
 * @example
 * if (!verifyFreeQuota(quota, file.size)) return 'denied'
 */
export function verifyFreeQuota(quota: QuotaOutput, dataSize: bigint): boolean {
  return quota.remaining >= dataSize
}

/**
 * Returns an `{ itemId, result }` object indicating whether an item upload is allowed.
 *
 * @param itemId - The item ID being checked.
 * @param quota - The current quota.
 * @param dataSize - The number of bytes the item requires.
 * @returns `{ itemId, result: 'allowed' | 'denied' }`.
 *
 * @example
 * const check = checkFreeQuota(item.id, quota, item.size)
 * if (check.result === 'denied') return { error: 'Quota exceeded' }
 */
export function checkFreeQuota(itemId: string, quota: QuotaOutput, dataSize: bigint) {
  return { itemId, result: verifyFreeQuota(quota, dataSize) ? 'allowed' : 'denied' } as const
}

/**
 * Throws a `StashlyError` if the quota does not have enough free space for `size` bytes.
 *
 * @param quota - The current quota.
 * @param size - The number of bytes required.
 * @throws {StashlyError} With code `INSUFFICIENT_QUOTA` if there is not enough space.
 *
 * @example
 * validateQuotaFreeSpace(quota, file.size) // throws if not enough space
 */
export function validateQuotaFreeSpace(quota: QuotaOutput, size: bigint): void {
  if (quota.total - quota.used < size) throw new StashlyError(StashlyErrorCode.INSUFFICIENT_QUOTA)
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create a new quota record. Resolves `total` from the linked storage plan.
 * If `storagePlanId` is omitted, falls back to the default (free) plan's storage limit.
 *
 * @param args - `QuotaUncheckedCreateInput` plus an optional `storagePlanId`.
 * @returns The created `QuotaOutput`.
 * @throws {Error} If the specified storage plan does not exist.
 *
 * @example
 * const quota = await createQuota({
 *   id: toObjectId(getPrefixForModel('Quota')),
 *   driveId: drive.id,
 *   storagePlanId: plan.id,
 * })
 */
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

/**
 * Delete a quota record.
 *
 * @param args - Prisma `QuotaDeleteArgs` (where).
 * @returns The deleted `QuotaOutput`.
 *
 * @example
 * const deleted = await deleteQuota({ where: { id: 'qta_abc123' } })
 */
export async function deleteQuota(args: Prisma.QuotaDeleteArgs) {
  return toQuota(await prisma.quota.delete(args))
}

// ─── Internal update ─────────────────────────────────────────────────────────

/**
 * Apply a numeric delta to `used`, `deleted`, or `total` on a quota record.
 * Looks up the quota by `id`, `driveId`, or `userId` (first match wins).
 *
 * @param params - Delta fields plus one of `id | driveId | userId` to locate the quota.
 * @returns The updated `QuotaOutput`.
 * @throws {StashlyError} With code `QUOTA_NOT_FOUND` if the quota cannot be located.
 */
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

/**
 * Increase `used` quota after items are uploaded.
 *
 * @param params - `userId`, `dataSize` (bytes added), optional transaction `client`.
 *
 * @example
 * await onItemsUploaded({ userId, dataSize: BigInt(file.size) })
 */
export async function onItemsUploaded({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: dataSize, client })
}

/**
 * Increase `used` quota after items are copied.
 *
 * @param params - `userId`, `dataSize` (bytes added), optional transaction `client`.
 *
 * @example
 * await onItemsCopied({ userId, dataSize: BigInt(item.size) })
 */
export async function onItemsCopied({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: dataSize, client })
}

/**
 * Shift bytes from `used` to `deleted` when items are moved to trash.
 *
 * @param params - `userId`, `dataSize` (bytes trashed), optional transaction `client`.
 *
 * @example
 * await onItemsTrashed({ userId, dataSize: BigInt(item.size) })
 */
export async function onItemsTrashed({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: -dataSize, deleted: dataSize, client })
}

/**
 * Shift bytes from `deleted` back to `used` when items are restored from trash.
 *
 * @param params - `userId`, `dataSize` (bytes restored), optional transaction `client`.
 *
 * @example
 * await onItemsRestored({ userId, dataSize: BigInt(item.size) })
 */
export async function onItemsRestored({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: dataSize, deleted: -dataSize, client })
}

/**
 * Decrease `deleted` quota when items are permanently deleted.
 *
 * @param params - `userId`, `dataSize` (bytes freed), optional transaction `client`.
 *
 * @example
 * await onItemsDeleted({ userId, dataSize: BigInt(item.size) })
 */
export async function onItemsDeleted({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, deleted: -dataSize, client })
}

/**
 * Update the `total` quota limit, typically called after a plan change.
 *
 * @param params - `userId`, `dataSize` (new total in bytes), optional transaction `client`.
 *
 * @example
 * await updateTotalQuota({ userId, dataSize: newPlan.storageLimit })
 */
export async function updateTotalQuota({ userId, dataSize, client }: UpdateAfterInput) {
  return applyQuotaDelta({ userId, total: dataSize, client })
}
