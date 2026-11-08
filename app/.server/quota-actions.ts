import { Prisma, type Quota as PrismaQuota } from '@/prisma/client'
import { QuotaStatus } from '@/prisma/enums'
import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode, toRouteError } from '@/utils/api.errors'
import {
  findDefaultStoragePlan,
  findStoragePlanById,
} from './storagePlan-actions'
import { buildQuotaFilters } from '@/utils/filters/quota.filters'
import { searchFactory } from '@/utils/search'
import { formatSize } from '@/utils/formaters'
import { assertItemsAccess } from './permission-actions'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over Quota records.
 *
 * @example
 * const page = await searchQuotas({ driveId: 'drive_123', take: 20, strategy: 'cursor' })
 */
export const searchQuotas = searchFactory({
  dbDelegate: prisma.quota,
  buildFilters: buildQuotaFilters,
  defaultOrderBy: (): Prisma.QuotaOrderByWithRelationInput => ({
    createdAt: 'desc',
  }),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuotaOutput extends Omit<
  PrismaQuota,
  'createdAt' | 'updatedAt'
> {
  remaining: bigint
}

export interface QuotaInput {
  userId: string
  dataSize: bigint
}

export interface UpdateAfterInput {
  /** Whose drive; or name the drive itself. */
  userId?: string
  driveId?: string
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
export function toQuotaStatus({
  used,
  total,
}: Pick<QuotaOutput, 'used' | 'total'>): QuotaStatus {
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
 * Pure projection, for previewing a change or sizing one up. **Not a write
 * path.** Persisting its output means reading a counter, adding to it in
 * JavaScript, and storing an absolute result — two concurrent callers read the
 * same figure and the second erases the first. `applyQuotaDelta` increments in
 * the database for exactly that reason; do not route writes back through here.
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
  return {
    total,
    used,
    deleted,
    remaining,
    status: toQuotaStatus({ used, total }),
  }
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
export function toQuota(
  quota: Omit<PrismaQuota, 'createdAt' | 'updatedAt'>
): QuotaOutput {
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
export async function findQuotaById(
  id: string,
  client: Prisma.TransactionClient = prisma
) {
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
export async function findQuotaByUserId(
  userId: string,
  client: Prisma.TransactionClient = prisma
) {
  const quota = await client.quota.findFirst({
    where: { drive: { ownerId: userId } },
  })
  if (!quota) {
    throw toRouteError(StashlyErrorCode.QUOTA_NOT_DEFINED_FOR_USER)
  }
  return toQuota(quota)
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
export async function findQuotaByDriveId(
  driveId: string,
  client: Prisma.TransactionClient = prisma
) {
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
export async function findQuota({
  userId,
}: {
  userId: string
}): Promise<QuotaOutput> {
  const quota = await findQuotaByUserId(userId)
  if (!quota) throw toRouteError(StashlyErrorCode.QUOTA_NOT_DEFINED_FOR_USER)
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
export async function assertQuotaExists(
  id: string,
  client: Prisma.TransactionClient = prisma
) {
  const quota = await client.quota.findUnique({ where: { id } })
  if (!quota) throw toRouteError(StashlyErrorCode.QUOTA_NOT_FOUND)
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
export async function ensureUserQuota(
  userId: string,
  client: Prisma.TransactionClient = prisma
) {
  const quota = await findQuotaByUserId(userId, client)
  if (!quota)
    throw toRouteError(StashlyErrorCode.QUOTA_NOT_DEFINED_FOR_USER)
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
export function checkFreeQuota(
  itemId: string,
  quota: QuotaOutput,
  dataSize: bigint
) {
  return {
    itemId,
    result: verifyFreeQuota(quota, dataSize) ? 'allowed' : 'denied',
  } as const
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
  if (quota.total - quota.used < size)
    throw toRouteError(StashlyErrorCode.INSUFFICIENT_QUOTA)
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
  withinTotal = false,
  ...data
}: {
  /** Delta applied to `used`. May be negative; the result is clamped at 0. */
  used?: bigint
  /** Delta applied to `deleted`. May be negative; the result is clamped at 0. */
  deleted?: bigint
  /** Absolute replacement for `total` — a plan change, not a delta. */
  total?: bigint
  /**
   * Refuse with `INSUFFICIENT_QUOTA` instead of applying a delta that would
   * leave `used` above `total`. Checked in the UPDATE's own `WHERE`, so two
   * concurrent charges can't both pass on the same free space.
   */
  withinTotal?: boolean
  userId?: string
  driveId?: string
  id?: string
  client?: Prisma.TransactionClient
}) {
  // The UPDATE locates its own row, so there is no lookup query first. Nothing
  // is read into JavaScript and written back: the previous implementation read
  // `used`, added the delta in JavaScript, and wrote the result back as an
  // absolute figure. Two uploads that read the same starting value each wrote
  // `start + own size`, so whichever committed second silently erased the
  // other's bytes from the quota — a lost update, on every concurrent batch.
  // `Drive.ownerId` is unique, so the user form matches at most one row.
  const where = id
    ? Prisma.sql`"id" = ${id}`
    : driveId
      ? Prisma.sql`"driveId" = ${driveId}`
      : userId
        ? Prisma.sql`"driveId" = (SELECT "id" FROM "Drive" WHERE "ownerId" = ${userId})`
        : null
  if (!where) throw toRouteError(StashlyErrorCode.QUOTA_NOT_FOUND)

  // Delta, clamp, and status must land in ONE statement — which is why this is
  // raw SQL and not `quota.update`. Postgres evaluates every SET expression
  // against the row after taking its lock, so concurrent deltas accumulate.
  // The earlier `increment` + guarded `updateMany` pair split the clamp into a
  // second write; when a concurrent delta moved the row in between, the guard
  // missed and the clamp was dropped (-5 then +10 from 0 ended at 5, not 10).
  //
  // SET expressions all see the *old* row, so `status` interpolates the new
  // `used`/`total` expressions rather than naming the columns. The integer
  // thresholds mirror `toQuotaStatus`'s three-decimal truncation exactly.
  const used =
    data.used === undefined
      ? Prisma.sql`"used"`
      : Prisma.sql`GREATEST(0::bigint, "used" + ${data.used}::bigint)`

  const deleted =
    data.deleted === undefined
      ? Prisma.sql`"deleted"`
      : Prisma.sql`GREATEST(0::bigint, "deleted" + ${data.deleted}::bigint)`

  const total =
    data.total === undefined
      ? Prisma.sql`"total"`
      : Prisma.sql`${data.total}::bigint`

  const fits = withinTotal ? Prisma.sql`AND ${used} <= ${total}` : Prisma.empty

  const status = toQuotaStatusSql(used, total)

  // Raw SQL bypasses Prisma's `@updatedAt`, so set it by hand. Not `now()`: the
  // column is `timestamp without time zone` and the session runs in a local
  // zone, so `now()` stores local time while Prisma writes UTC.
  const rows = await client.$queryRaw<PrismaQuota[]>`
    UPDATE "Quota"
    SET
      "used" = ${used},
      "deleted" = ${deleted},
      "total" = ${total},
      "status" = ${status},
      "updatedAt" = ${new Date()}
    WHERE ${where} ${fits}
    RETURNING *
  `

  const row = rows[0]
  // No row updated: either there is no quota, or the delta doesn't fit.
  if (!row && withinTotal) await refuseCharge(where, data.used ?? 0n, client)
  if (!row) throw toRouteError(StashlyErrorCode.QUOTA_NOT_FOUND)

  return toQuota(row)
}

/**
 * The `status` a quota row gets for the `used`/`total` a statement leaves it
 * with. The integer thresholds mirror `toQuotaStatus`'s three-decimal
 * truncation exactly.
 */
function toQuotaStatusSql(used: Prisma.Sql, total: Prisma.Sql) {
  return Prisma.sql`
    CASE
      WHEN ${total} = 0::bigint THEN
        CASE
          WHEN ${used} > 0::bigint THEN 'exceeded'
          ELSE 'normal'
        END
      WHEN (${used} * 1000::bigint / ${total}) > 1000 THEN 'exceeded'
      WHEN (${used} * 1000::bigint / ${total}) > 990 THEN 'critical'
      WHEN (${used} * 1000::bigint / ${total}) > 900 THEN 'warning'
      ELSE 'normal'
    END::"QuotaStatus"
  `
}

/**
 * Throws the error for a charge of `size` that matched no quota row: 507
 * `INSUFFICIENT_QUOTA` saying how much is free, or `QUOTA_NOT_FOUND` when there
 * is no row at all.
 */
async function refuseCharge(
  where: Prisma.Sql,
  size: bigint,
  client: Prisma.TransactionClient = prisma
): Promise<never> {
  const existing = await client.$queryRaw<PrismaQuota[]>`
    SELECT * FROM "Quota" WHERE ${where}
  `
  if (existing[0]) {
    const { remaining } = toQuota(existing[0])
    throw toRouteError(
      StashlyErrorCode.INSUFFICIENT_QUOTA,
      `Not enough storage: this needs ${formatSize('byte', 'unit', Number(size))} and ${formatSize(
        'byte',
        'unit',
        Number(remaining > 0n ? remaining : 0n)
      )} is free.`
    )
  }
  throw toRouteError(StashlyErrorCode.QUOTA_NOT_FOUND)
}

/**
 * Throws why `stashly_charge_upload()` refused an upload: 507
 * `INSUFFICIENT_QUOTA`, or `QUOTA_NOT_FOUND`. Only called once a refusal has
 * happened. The drive's owner is told how much is free; a collaborator isn't,
 * since that is the owner's business.
 */
export async function refuseUploadCharge(
  driveId: string,
  userId: string,
  size: bigint
): Promise<never> {
  const where = Prisma.sql`"driveId" = ${driveId}`
  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    select: { ownerId: true },
  })
  if (drive?.ownerId === userId) return refuseCharge(where, size)
  const [quota] = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Quota" WHERE ${where}`
  if (!quota) throw toRouteError(StashlyErrorCode.QUOTA_NOT_FOUND)
  throw toRouteError(
    StashlyErrorCode.INSUFFICIENT_QUOTA,
    "This file doesn't fit: the folder's owner has run out of storage."
  )
}

/**
 * The quota an upload into `folderId` is charged to: its drive's. For the
 * pre-check before any bytes move, so a caller answers yes or no and never
 * hands these numbers to a collaborator.
 *
 * @throws `FORBIDDEN` (403) without write access to the folder.
 */
export async function findQuotaForFolder(userId: string, folderId: string) {
  await assertItemsAccess(userId, [folderId], 'write')
  const folder = await prisma.item.findUniqueOrThrow({
    where: { id: folderId },
    select: { driveId: true },
  })
  const quota = await findQuotaByDriveId(folder.driveId)
  if (!quota) throw toRouteError(StashlyErrorCode.QUOTA_NOT_FOUND)
  return quota
}

/**
 * Applies a drive's logged charges now, so a change that lowers `used` can't
 * clamp at 0 against a charge that hasn't arrived and leave it too high once it
 * does. Does nothing when the drive has none pending.
 */
export async function settlePendingCharges(driveId: string) {
  const [{ pending }] = await prisma.$queryRaw<{ pending: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM "QuotaDelta" WHERE "driveId" = ${driveId}) AS pending`
  if (pending) await prisma.$queryRaw`SELECT * FROM apply_item_size_deltas(NULL, true)`
}

/**
 * Charge an upload to `used`, refusing it when it doesn't fit.
 *
 * This is the upload's quota enforcement: the client's pre-check only saves a
 * wasted transfer, and a client can skip it.
 *
 * @param params - `userId`, `dataSize` (bytes added), optional transaction `client`.
 * @throws `INSUFFICIENT_QUOTA` (507) when `used + dataSize` would exceed `total`; nothing is charged.
 *
 * @example
 * await onItemsUploaded({ userId, dataSize: BigInt(file.size) })
 */
export async function onItemsUploaded({
  userId,
  dataSize,
  client,
}: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: dataSize, client, withinTotal: true })
}

/**
 * Charge a copy to `used`, refusing it when it doesn't fit.
 *
 * The check is the UPDATE's own (`withinTotal`), so two copies can't both pass
 * on the same free space.
 *
 * @param params - `userId`, `dataSize` (bytes added), optional transaction `client`.
 * @throws `INSUFFICIENT_QUOTA` (507) when `used + dataSize` would exceed `total`; nothing is charged.
 *
 * @example
 * await onItemsCopied({ userId, dataSize: bytes, client: tx })
 */
export async function onItemsCopied({
  userId,
  dataSize,
  client,
}: UpdateAfterInput) {
  return applyQuotaDelta({ userId, used: dataSize, client, withinTotal: true })
}

/**
 * Shift bytes from `used` to `deleted` when items are moved to trash.
 *
 * @param params - `userId`, `dataSize` (bytes trashed), optional transaction `client`.
 *
 * @example
 * await onItemsTrashed({ userId, dataSize: BigInt(item.size) })
 */
export async function onItemsTrashed({
  userId,
  driveId,
  dataSize,
  client,
}: UpdateAfterInput) {
  return applyQuotaDelta({ userId, driveId, used: -dataSize, deleted: dataSize, client })
}

/**
 * Shift bytes from `deleted` back to `used` when items are restored from trash.
 *
 * @param params - `userId`, `dataSize` (bytes restored), optional transaction `client`.
 *
 * @example
 * await onItemsRestored({ userId, dataSize: BigInt(item.size) })
 */
export async function onItemsRestored({
  userId,
  driveId,
  dataSize,
  client,
}: UpdateAfterInput) {
  return applyQuotaDelta({ userId, driveId, used: dataSize, deleted: -dataSize, client })
}

/**
 * Decrease `deleted` quota when items are permanently deleted.
 *
 * @param params - `userId`, `dataSize` (bytes freed), optional transaction `client`.
 *
 * @example
 * await onItemsDeleted({ userId, dataSize: BigInt(item.size) })
 */
export async function onItemsDeleted({
  userId,
  driveId,
  dataSize,
  client,
}: UpdateAfterInput) {
  return applyQuotaDelta({ userId, driveId, deleted: -dataSize, client })
}

/**
 * Update the `total` quota limit, typically called after a plan change.
 *
 * @param params - `userId`, `dataSize` (new total in bytes), optional transaction `client`.
 *
 * @example
 * await updateTotalQuota({ userId, dataSize: newPlan.storageLimit })
 */
export async function updateTotalQuota({
  userId,
  dataSize,
  client,
}: UpdateAfterInput) {
  return applyQuotaDelta({ userId, total: dataSize, client })
}
