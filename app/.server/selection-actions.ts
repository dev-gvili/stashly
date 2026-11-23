import type { z } from 'zod'
import type { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { TRASH_ROOTS } from '@/services/item-actions'
import { assertItemAccess } from '@/services/permission-actions'
import type { Selection, SelectionScope } from '@/types/stash.types'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'
import { toSearchSchema } from '@/utils/converters'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { parseSearchParams } from '@/utils/parsers'

/**
 * The most roots one "select all" may resolve to. Destructive actions stay one
 * transaction (chunking would make trash or delete half-done on a failure),
 * so a larger set is refused instead of split.
 */
export const SCOPE_MAX = 10_000

const listingSearchSchema = toSearchSchema<
  typeof itemFilterSchema,
  Prisma.ItemOrderByWithRelationInput,
  Prisma.ItemInclude
>({ schema: itemFilterSchema })

export type ListingParams = z.infer<typeof listingSearchSchema>

/** Keys a selection scope never carries: pagination, sort and page state. */
const NON_FILTER_KEYS = [
  'cursor',
  'take',
  'orderBy',
  'include',
  'selectedItems',
  'selectAll',
  'excluded',
  'layout',
]

/**
 * Parses a folder, All files or Trash listing's search params, after setting
 * the keys the server owns (they overwrite whatever the URL says): the caller
 * as `currentUserId`, the folder as `parentId`, `status=trashed` in Trash.
 * Throws `INVALID_INPUT` on a schema mismatch, like `parseSearchParams`.
 *
 * @example
 * const params = parseListingParams(userId, scope, new URL(request.url).searchParams)
 * const where = listingWhere(userId, scope, params)
 */
export function parseListingParams(
  userId: string,
  scope: SelectionScope,
  searchParams: URLSearchParams
): ListingParams {
  const params = new URLSearchParams(searchParams)
  params.set('currentUserId', userId)
  if (scope.kind === 'folder') {
    params.set('parentId', scope.folderId)
  } else {
    params.set('status', 'trashed')
  }
  return parseSearchParams({
    schema: listingSearchSchema,
    searchParams: params,
  })
}

/**
 * The one `where` for the folder, All files and Trash listings. The loaders
 * and the "select all" resolution both build it here, so the rows a page
 * lists and the rows a bulk action acts on can't drift apart.
 *
 * It decides no authority: a folder listing is authorized by
 * `getFolderContent` (loaders) or `assertScopeAccess` (selections), and a
 * Trash listing is the caller's own rows by construction (`ownerId`).
 *
 * @example
 * // Folder: its children matching the filters
 * listingWhere(userId, { kind: 'folder', folderId, filters: '' }, params)
 * // Trash: the caller's Trash entries, or a trashed folder's contents
 * listingWhere(userId, { kind: 'trash', filters: '' }, params)
 */
export function listingWhere(
  userId: string,
  scope: SelectionScope,
  params: ListingParams
): Prisma.ItemWhereInput {
  const filters = buildItemFilters(params)
  if (scope.kind === 'folder') {
    return {
      ...filters,
      parentId: scope.folderId,
      ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
    }
  }
  // `currentUserId` is not a scoping filter (see item.filters.ts): without
  // `ownerId` Trash listed every user's trashed items. At the top, only what
  // was trashed directly; inside a trashed folder, its trashed contents.
  return {
    AND: [
      filters,
      { ownerId: userId },
      scope.folderId
        ? { parentId: scope.folderId, status: 'trashed' }
        : TRASH_ROOTS,
    ],
  }
}

/** A scope's filter string as listing params, pagination and sort dropped. */
function scopeParams(userId: string, scope: SelectionScope): ListingParams {
  const searchParams = new URLSearchParams(scope.filters)
  for (const key of NON_FILTER_KEYS) searchParams.delete(key)
  return parseListingParams(userId, scope, searchParams)
}

/**
 * Throws unless the caller may list the scope: read access to a folder (and
 * membership of its workspace, when given). A Trash scope needs no check, as
 * its `where` holds only the caller's own rows.
 */
async function assertScopeAccess(userId: string, scope: SelectionScope) {
  if (scope.kind === 'folder') {
    await assertItemAccess(userId, scope.folderId, {
      workspaceId: scope.workspaceId,
    })
  }
}

/**
 * How many rows a "select all" over `scope` stands for: what the listing
 * would show across all its pages.
 *
 * @example
 * const count = await countSelection(userId, { kind: 'trash', filters: '' })
 */
export async function countSelection(
  userId: string,
  scope: SelectionScope
): Promise<number> {
  const params = scopeParams(userId, scope)
  await assertScopeAccess(userId, scope)
  return prisma.item.count({ where: listingWhere(userId, scope, params) })
}

/**
 * The ids a bulk action acts on. Ticked ids come back as sent, deduplicated;
 * the action they go to checks access to each. A scope is resolved in one
 * query, minus the unticked rows, and refused when it resolves to more than
 * `SCOPE_MAX` roots (400 `SELECTION_TOO_LARGE`) or to another count than the
 * one the user confirmed (409 `SELECTION_CHANGED`: an upload or another tab
 * changed the listing in between).
 *
 * @example
 * const ids = await resolveSelection(user.id, parsed.selection)
 * await trashItems(ids, user.id)
 */
export async function resolveSelection(
  userId: string,
  selection: Selection
): Promise<string[]> {
  if (selection.by === 'ids') return [...new Set(selection.selectedItems)]

  const { scope, excluded, expectedCount } = selection
  const params = scopeParams(userId, scope)
  await assertScopeAccess(userId, scope)

  const where = listingWhere(userId, scope, params)
  const rows = await prisma.item.findMany({
    where: excluded.length
      ? { AND: [where, { id: { notIn: excluded } }] }
      : where,
    select: { id: true },
    take: SCOPE_MAX + 1,
  })

  if (rows.length > SCOPE_MAX) {
    throw new StashlyError(
      StashlyErrorCode.SELECTION_TOO_LARGE,
      `Select at most ${SCOPE_MAX.toLocaleString('en-US')} items at a time.`
    )
  }
  if (rows.length !== expectedCount) {
    throw new StashlyError(
      StashlyErrorCode.SELECTION_CHANGED,
      `The selection now holds ${rows.length} items, not ${expectedCount}.`
    )
  }
  return rows.map((row) => row.id)
}
