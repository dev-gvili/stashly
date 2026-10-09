import { Prisma } from '@/prisma/client'
import { StashlyErrorCode, toRouteError } from '@/utils/api.errors'

/**
 * Turns a collection page's `orderBy` (the Prisma-shaped object the sort pill
 * writes into the URL) into raw SQL for {@link getCollectionItems}, which reads
 * from `"CollectionMember" cm JOIN "Item" i`.
 *
 * Only the sort pill's columns are accepted, and each maps to a fixed SQL
 * fragment below, so nothing from the URL is ever spliced into the query.
 */

/** A sort direction the sort pill can write. */
type SortDir = 'asc' | 'desc'

/** One sort key: the SQL expression to sort by, and its direction. */
export interface CollectionSortKey {
  sql: Prisma.Sql
  dir: SortDir
}

/**
 * The sort pill's columns (`SORT_FIELDS` in `sort-pill.tsx`), keyed by their
 * `orderBy` field, mapped to the SQL each one sorts by. The pill's Count sort
 * is deliberately absent: it has no meaning inside a collection.
 *
 * All five are NOT NULL columns, so the cursor comparison never meets a NULL
 * (which compares as unknown and would silently drop rows from the next page).
 */
const SORT_COLUMNS: Record<string, Prisma.Sql> = {
  name: Prisma.sql`i."name"`,
  updatedAt: Prisma.sql`i."updatedAt"`,
  createdAt: Prisma.sql`i."createdAt"`,
  size: Prisma.sql`i."size"`,
  type: Prisma.sql`i."type"`,
}

/** With no `orderBy`, sort as the sort pill shows by default: Name, A → Z. */
const DEFAULT_KEYS: CollectionSortKey[] = [
  { sql: SORT_COLUMNS.name, dir: 'asc' },
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const invalidSort = (detail: string) =>
  toRouteError(StashlyErrorCode.INVALID_INPUT, `Invalid sort: ${detail}`)

/**
 * Parses a collection `orderBy` into sort keys.
 *
 * Accepts one object or an array of them, as qs parses the sort pill's URL
 * (`?orderBy[name]=asc`, `?orderBy[0][folder][childCount]=desc&…`). An object
 * holding several keys is split into one key per entry, as `getFolderContent`
 * does. Returns the default (name, ascending) when there is nothing to sort by.
 *
 * @param orderBy - The parsed `orderBy` search param; unvalidated input.
 * @returns The sort keys, in priority order.
 * @throws A 400 `INVALID_INPUT` route error for a column the sort pill doesn't
 *   offer or a direction other than `asc`/`desc`.
 *
 * @example
 * collectionSortKeys({ name: 'asc' })
 * collectionSortKeys([{ folder: { childCount: 'desc' } }, { members: { _count: 'desc' } }])
 */
export function collectionSortKeys(orderBy: unknown): CollectionSortKey[] {
  if (orderBy === undefined || orderBy === null) return DEFAULT_KEYS
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy]
  const keys: CollectionSortKey[] = []

  for (const entry of entries) {
    if (!isRecord(entry)) throw invalidSort('expected an object')
    for (const [field, value] of Object.entries(entry)) {
      let path = field
      let dir = value
      // One nested level: `{ folder: { childCount: 'asc' } }`.
      if (isRecord(value)) {
        const nested = Object.entries(value)
        if (nested.length !== 1) throw invalidSort(`"${field}"`)
        path = `${field}.${nested[0][0]}`
        dir = nested[0][1]
      }
      if (!Object.hasOwn(SORT_COLUMNS, path)) throw invalidSort(`"${path}"`)
      if (dir !== 'asc' && dir !== 'desc') {
        throw invalidSort(`direction for "${path}"`)
      }
      keys.push({ sql: SORT_COLUMNS[path], dir })
    }
  }
  return keys.length ? keys : DEFAULT_KEYS
}

const DIRECTION_SQL = { asc: Prisma.raw('ASC'), desc: Prisma.raw('DESC') }

/**
 * The `ORDER BY` clause for the sort keys, with the membership id last
 * (descending) as the tiebreaker the cursor relies on.
 *
 * @param keys - From {@link collectionSortKeys}.
 *
 * @example
 * Prisma.sql`SELECT … ${collectionOrderBy(keys)} LIMIT ${limit + 1}`
 */
export function collectionOrderBy(keys: CollectionSortKey[]): Prisma.Sql {
  return Prisma.sql`ORDER BY ${Prisma.join([
    ...keys.map(({ sql, dir }) => Prisma.sql`${sql} ${DIRECTION_SQL[dir]}`),
    Prisma.sql`cm.id DESC`,
  ], ', ')}`
}

/** The three fragments a page after a cursor needs, all empty for page one. */
export interface CollectionCursorSql {
  /** `WITH cur AS (…)`: the cursor row's own sort values. Goes before `SELECT`. */
  with: Prisma.Sql
  /** `CROSS JOIN cur`. Goes after the `FROM`/`JOIN`s that bind `cm` and `i`. */
  join: Prisma.Sql
  /** `AND (…)`: the rows that sort after the cursor row. Goes in the `WHERE`. */
  where: Prisma.Sql
}

/**
 * Keyset pagination for any sort, including mixed directions: the rows that
 * come after the cursor row in {@link collectionOrderBy}'s order.
 *
 * The cursor row's sort values are read through the same SQL as the sort, so a
 * computed key (a count) compares like for like. For keys `k1, k2` the
 * condition is `k1 ≻ c1 OR (k1 = c1 AND (k2 ≻ c2 OR (k2 = c2 AND cm.id < c.id)))`,
 * where `≻` is `>` for an ascending key and `<` for a descending one.
 *
 * @param keys - From {@link collectionSortKeys}.
 * @param cursor - The previous page's last `CollectionMember.id`, if any.
 *
 * @example
 * const after = collectionAfterCursor(keys, cursor)
 * Prisma.sql`${after.with} SELECT … FROM "CollectionMember" cm JOIN "Item" i ON … ${after.join} WHERE … ${after.where}`
 */
export function collectionAfterCursor(
  keys: CollectionSortKey[],
  cursor: string | undefined
): CollectionCursorSql {
  if (!cursor) {
    return { with: Prisma.empty, join: Prisma.empty, where: Prisma.empty }
  }

  const cursorValues = Prisma.join([
    ...keys.map(({ sql }, i) => Prisma.sql`${sql} AS ${Prisma.raw(`"k${i}"`)}`),
    Prisma.sql`cm.id AS "id"`,
  ], ', ')

  let after = Prisma.sql`cm.id < cur."id"`
  for (let i = keys.length - 1; i >= 0; i--) {
    const { sql, dir } = keys[i]
    const value = Prisma.raw(`cur."k${i}"`)
    const beyond = Prisma.raw(dir === 'asc' ? '>' : '<')
    after = Prisma.sql`(${sql} ${beyond} ${value} OR (${sql} = ${value} AND ${after}))`
  }

  return {
    with: Prisma.sql`WITH cur AS (
      SELECT ${cursorValues}
      FROM "CollectionMember" cm
      JOIN "Item" i ON i.id = cm."itemId"
      WHERE cm.id = ${cursor}
    )`,
    join: Prisma.sql`CROSS JOIN cur`,
    where: Prisma.sql`AND ${after}`,
  }
}
