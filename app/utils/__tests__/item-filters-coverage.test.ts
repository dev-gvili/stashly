import { describe, it, expect } from 'vitest'
import {
  itemFilters,
  itemFilterSchema,
  buildItemFilters,
} from '../filters/item.filters'

/**
 * `buildFiltersFactory` applies a param only when `key in filters`
 * (app/utils/filters.ts:127-132). Anything else is dropped with no error, so a
 * schema key without a filter — or a filter whose key drifted from the schema —
 * removes a constraint *silently*, and the query returns more rows than
 * intended. Both real instances of that bug are pinned below.
 *
 * These keys are in the schema but intentionally build no clause of their own.
 * Adding to this list is a deliberate act: say why in item.filters.ts.
 */
const CONTEXT_ONLY_KEYS = [
  // Read by the `favorited` filter as context, not a scoping filter itself.
  'currentUserId',
  // Pagination and query shape — consumed by callers, never part of `where`.
  'cursor',
  'take',
  'orderBy',
  'include',
] as const

const schemaKeys = Object.keys(itemFilterSchema.shape)
const filterKeys = Object.keys(itemFilters)

describe('item filter key coverage', () => {
  it('every schema key either has a filter or is declared context-only', () => {
    const unresolved = schemaKeys.filter(
      (key) =>
        !filterKeys.includes(key) &&
        !(CONTEXT_ONLY_KEYS as readonly string[]).includes(key)
    )
    expect(unresolved).toEqual([])
  })

  it('every filter key exists in the schema', () => {
    // A filter whose key is absent from the schema can never fire: the builder
    // iterates the *parsed params*, so the key never appears. This is exactly
    // how `workspace` sat dead against a `workspaceId` schema key.
    const unreachable = filterKeys.filter((key) => !schemaKeys.includes(key))
    expect(unreachable).toEqual([])
  })

  it('keeps the context-only allowlist honest', () => {
    // A stale entry here would mask a genuinely missing filter.
    const stale = (CONTEXT_ONLY_KEYS as readonly string[]).filter(
      (key) => !schemaKeys.includes(key)
    )
    expect(stale).toEqual([])
  })
})

/** The builder collects clauses under `AND`; normalise for assertions. */
function clauses(where: Record<string, unknown>): unknown[] {
  return Array.isArray(where.AND) ? where.AND : [where]
}

describe('item filters that must produce a constraint', () => {
  it('workspaceId scopes the query', () => {
    // Regression: the filter used to be keyed `workspace`, so this produced
    // nothing at all and a workspace query returned unscoped rows.
    const where = buildItemFilters({ workspaceId: 'wsp_1' } as never)
    expect(clauses(where)).toContainEqual({ workspaceId: 'wsp_1' })
  })

  it('accessibleBy admits owned items and items shared with the user', () => {
    const where = buildItemFilters({ accessibleBy: 'usr_1' } as never)
    expect(clauses(where)).toContainEqual({
      OR: [
        { ownerId: 'usr_1' },
        { permissions: { some: { users: { some: { id: 'usr_1' } } } } },
      ],
    })
  })

  it('currentUserId alone scopes nothing — use accessibleBy', () => {
    // Documents the trap rather than fixing it: `currentUserId` is context for
    // `favorited`. A loader that passes only this believes it is scoped and is
    // not. This assertion exists so that stays a deliberate, visible choice.
    const where = buildItemFilters({ currentUserId: 'usr_1' } as never)
    const asText = JSON.stringify(where)
    expect(asText).not.toContain('usr_1')
  })
})
