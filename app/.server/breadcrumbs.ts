import { prisma } from '@/services/db'

export interface Breadcrumb {
  id: string
  name: string
  parentId: string | null
  type: 'file' | 'folder' | 'collection'
}

/** A crumb as it comes back from the CTE, before the owner column is dropped. */
type BreadcrumbRow = Breadcrumb & { ownerId: string }

/**
 * Decides how much of an ancestor chain a user may see.
 *
 * Folder names leak information — a chain like
 * `Home / Acquisitions / Project Fig / Q3 offer` tells a recipient about
 * folders they cannot open. When the viewer does not own the target item (it
 * was shared with them), everything above the item itself is withheld.
 *
 * Exported for testing: this is the whole rule, and it is worth pinning without
 * standing up a database.
 *
 * @param rows - The full chain, root first, target item last.
 * @param userId - The viewing user.
 * @returns The full chain for the owner, otherwise the target crumb alone.
 *
 * @example
 * trimBreadcrumbs(chain, chain.at(-1)!.ownerId).length === chain.length
 */
export function trimBreadcrumbs(
  rows: BreadcrumbRow[],
  userId: string
): Breadcrumb[] {
  const strip = ({ id, name, parentId, type }: BreadcrumbRow): Breadcrumb => ({
    id,
    name,
    parentId,
    type,
  })

  const target = rows.at(-1)
  if (!target) return []
  if (target.ownerId !== userId) return [strip(target)]
  return rows.map(strip)
}

/**
 * Fetches the breadcrumb trail for an item using a Recursive CTE.
 * This is extremely efficient (O(log n)) and requires NO path column maintenance.
 *
 * The trail is trimmed for non-owners before it is returned — see
 * {@link trimBreadcrumbs}. That rule used to live in the folder route, which
 * meant the two other callers (`stash/all`, `stash/file`) applied no trim at
 * all and showed non-owners the full ancestor chain. Keeping it here makes the
 * rule impossible to forget, and `ownerId` rides along in the existing CTE, so
 * it costs no extra query.
 *
 * `ownerId` is dropped before returning: callers do not need it, and it should
 * not travel to the browser in a loader payload.
 *
 * @param itemId - The ID of the item to get breadcrumbs for.
 * @param userId - The viewing user, used to decide how much of the chain to show.
 * @returns Array of items starting from Root -> Target Item, trimmed to the last
 *   crumb when the viewer does not own the target.
 * @example
 * ```ts
 * const trail = await breadcrumbs("folder_123", session.user.id);
 * // Owner sees the whole chain:
 * // [
 * //   { id: "root_id", name: "Home", ... },
 * //   { id: "abc_id", name: "Photos", ... },
 * //   { id: "folder_123", name: "Summer 2024", ... }
 * // ]
 * // A user it was shared with sees only:
 * // [ { id: "folder_123", name: "Summer 2024", ... } ]
 * ```
 */
export async function breadcrumbs(
  itemId: string,
  userId: string
): Promise<Breadcrumb[]> {
  // NOTES:
  // 1. "bfs_path" is our temporary recursive table.
  // 2. The first SELECT finds the starting item (Anchor).
  // 3. The UNION ALL SELECT finds the parent of the previous result (Recursion).
  // 4. We order by depth DESC because the recursion walks UP the tree (Item -> Root),
  //    but we want to display it DOWN (Root -> Item).
  const result = await prisma.$queryRaw<BreadcrumbRow[]>`
    WITH RECURSIVE bfs_path AS (
      -- ANCHOR: Select the target item first
      SELECT id, name, "parentId", type, "ownerId", 0 as depth
      FROM "Item"
      WHERE id = ${itemId}
      UNION ALL
      -- RECURSION: Join with the parent
      SELECT p.id, p.name, p."parentId", p.type, p."ownerId", c.depth + 1
      FROM "Item" p
      INNER JOIN bfs_path c ON c."parentId" = p.id
    )
    SELECT id, name, "parentId", type, "ownerId"
    FROM bfs_path
    ORDER BY depth DESC;
  `

  return trimBreadcrumbs(result, userId)
}
