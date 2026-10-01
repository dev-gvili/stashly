import { describe, it, expect } from 'vitest'
import {
  itemFilters,
  itemFilterSchema,
  buildItemFilters,
} from '../filters/item.filters'
import { toSearchSchema } from '../converters'
import type { Prisma } from '@/prisma/browser'

/**
 * `buildFiltersFactory` applies a param only when `key in filters`
 * (app/utils/filters.ts:127-132). Anything else is dropped with no error, so a
 * schema key without a filter — or a filter whose key drifted from the schema —
 * removes a constraint *silently*, and the query returns more rows than
 * intended. Both real instances of that bug are pinned below.
 *
 * These keys are in the schema but intentionally build no clause of their own.
 * Adding to this list is a deliberate act: say why in item.filters.ts.
 *
 * Pagination and query shape (`cursor`, `take`, `orderBy`, `include`) are NOT
 * here any more — they were removed from every `*.filters.ts` file and are now
 * added by `toSearchSchema`, which the loaders wrap the filter schema in. The
 * `toSearchSchema` block below keeps that boundary honest.
 */
const CONTEXT_ONLY_KEYS = [
  // Read by the `favorited` filter as context, not a scoping filter itself.
  'currentUserId',
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

/**
 * The four keys a loader actually needs but a `where` clause never sees. They
 * live in `toSearchSchema` so no filters file has to restate them — and so they
 * can never be mistaken for a filter that silently drops out of the query.
 */
describe('toSearchSchema', () => {
  const itemSearchSchema = toSearchSchema<
    typeof itemFilterSchema,
    Prisma.ItemOrderByWithRelationInput,
    Prisma.ItemInclude
  >({ schema: itemFilterSchema })

  it('adds exactly the pagination and query-shape keys', () => {
    const added = Object.keys(itemSearchSchema.shape).filter(
      (key) => !schemaKeys.includes(key)
    )
    expect(added.sort()).toEqual(['cursor', 'include', 'orderBy', 'take'])
  })

  it('keeps every filter key from the source schema', () => {
    // An `extend` that lost the shape would typecheck and silently strip every
    // filter at parse time — the query would then return the whole table.
    const searchKeys = Object.keys(itemSearchSchema.shape)
    expect(schemaKeys.filter((key) => !searchKeys.includes(key))).toEqual([])
  })

  it('adds no key that collides with a filter', () => {
    const added = Object.keys(itemSearchSchema.shape).filter(
      (key) => !schemaKeys.includes(key)
    )
    expect(added.filter((key) => filterKeys.includes(key))).toEqual([])
  })

  it('defaults `take` instead of dropping it', () => {
    // Before this, a loader parsed with the bare filter schema: `take` was an
    // unknown key, z.object stripped it, and `limit` reached the query as
    // undefined.
    expect(itemSearchSchema.parse({}).take).toBe(50)
  })

  it('carries cursor and orderBy through the parse', () => {
    const parsed = itemSearchSchema.parse({
      cursor: 'itm_123',
      orderBy: { name: 'asc' },
    })
    expect(parsed.cursor).toBe('itm_123')
    expect(parsed.orderBy).toEqual({ name: 'asc' })
  })
})

/**
 * How the builder treats values that reach it through the real schema. A value
 * the schema accepts but the filter rejects used to be logged and dropped,
 * which left the query one constraint short and returned more rows.
 */
describe('item filter values the filter rejects', () => {
  it('rejects a role list that mixes permission and workspace roles with a 400', () => {
    // The schema accepts each role on its own (`read` is a PermissionRole,
    // `viewer` a WorkspaceMemberRole); the `roles` filter needs the list to be
    // all one kind. Measured live: /stash/all?roles=read,viewer answers 400.
    const params = itemFilterSchema.parse({ roles: 'read,viewer' })
    expect(params.roles).toEqual(['read', 'viewer'])

    let thrown: unknown
    try {
      buildItemFilters(params)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({ errorCode: 'INVALID_INPUT', status: 400 })
  })

  it('treats an empty query as unset, not invalid', () => {
    // `?query=` means no query: the same where clause as no `query` at all.
    const params = itemFilterSchema.parse({ query: '' })
    expect(params.query).toBe('')
    expect(buildItemFilters(params)).toEqual(buildItemFilters(itemFilterSchema.parse({})))
  })
})
