import { prisma } from '@/services/db'

export interface Breadcrumb {
  id: string
  name: string
  parentId: string | null
  type: 'file' | 'folder' | 'collection'
}

/**
 * Fetches the breadcrumb trail for an item using a Recursive CTE.
 * This is extremely efficient (O(log n)) and requires NO path column maintenance.
 *
 * @param itemId - The ID of the item to get breadcrumbs for.
 * @returns Array of items starting from Root -> Target Item
 * @example
 * ```ts
 * const trail = await breadcrumbs("folder_123");
 * // Result:
 * // [
 * //   { id: "root_id", name: "Home", ... },
 * //   { id: "abc_id", name: "Photos", ... },
 * //   { id: "folder_123", name: "Summer 2024", ... }
 * // ]
 * ```
 */
export async function breadcrumbs(itemId: string): Promise<Breadcrumb[]> {
  // NOTES:
  // 1. "bfs_path" is our temporary recursive table.
  // 2. The first SELECT finds the starting item (Anchor).
  // 3. The UNION ALL SELECT finds the parent of the previous result (Recursion).
  // 4. We order by depth DESC because the recursion walks UP the tree (Item -> Root),
  //    but we want to display it DOWN (Root -> Item).
  const result = await prisma.$queryRaw<Breadcrumb[]>`
    WITH RECURSIVE bfs_path AS (
      -- ANCHOR: Select the target item first
      SELECT id, name, "parentId", type, 0 as depth
      FROM "Item"
      WHERE id = ${itemId}
      UNION ALL
      -- RECURSION: Join with the parent
      SELECT p.id, p.name, p."parentId", p.type, c.depth + 1
      FROM "Item" p
      INNER JOIN bfs_path c ON c."parentId" = p.id
    )
    SELECT id, name, "parentId", type
    FROM bfs_path
    ORDER BY depth DESC;
  `

  return result
}
