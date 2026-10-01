import { describe, it, expect } from 'vitest'
import { NotificationType } from '@/prisma/enums'
import {
  driveFilters,
  driveFilterSchema,
  buildDriveFilters,
} from '../filters/drive.filters'
import {
  notificationFilters,
  notificationFilterSchema,
  buildNotificationFilters,
} from '../filters/notification.filters'

/**
 * Same guard as `item-filters-coverage.test.ts`, for the drive and
 * notification filters. `buildFiltersFactory` applies a param only when
 * `key in filters` (app/utils/filters.ts:129), so a schema key with no filter
 * drops its constraint silently — the query returns more rows than intended —
 * and a filter whose key isn't in the schema can never fire.
 *
 * Keys listed as context-only are in the schema but deliberately build no
 * clause of their own; adding one is a decision to justify in the filter file.
 */
const suites = [
  {
    name: 'drive',
    schemaKeys: Object.keys(driveFilterSchema.shape),
    filterKeys: Object.keys(driveFilters),
    contextOnly: [] as string[],
  },
  {
    name: 'notification',
    schemaKeys: Object.keys(notificationFilterSchema.shape),
    filterKeys: Object.keys(notificationFilters),
    contextOnly: [] as string[],
  },
]

describe.each(suites)('$name filter key coverage', ({ schemaKeys, filterKeys, contextOnly }) => {
  it('every schema key either has a filter or is declared context-only', () => {
    const unresolved = schemaKeys.filter(
      (key) => !filterKeys.includes(key) && !contextOnly.includes(key)
    )
    expect(unresolved).toEqual([])
  })

  it('every filter key exists in the schema', () => {
    const unreachable = filterKeys.filter((key) => !schemaKeys.includes(key))
    expect(unreachable).toEqual([])
  })

  it('keeps the context-only allowlist honest', () => {
    const stale = contextOnly.filter((key) => !schemaKeys.includes(key))
    expect(stale).toEqual([])
  })
})

describe('drive filters', () => {
  it('scopes by ownerId', () => {
    expect(buildDriveFilters({ ownerId: 'usr_1' })).toEqual({
      AND: [{ ownerId: 'usr_1' }],
    })
  })

  it('drops a workspaceId param: a drive belongs to a user, not a workspace', () => {
    // `Drive` has no workspace column or relation, so the old `workspaceId`
    // schema key could never constrain anything. The schema now strips it.
    expect('workspaceId' in driveFilterSchema.parse({ workspaceId: 'ws_1' })).toBe(false)
  })
})

describe('notification filters', () => {
  it('scopes by userId', () => {
    expect(buildNotificationFilters({ userId: 'usr_1' })).toEqual({
      AND: [{ userId: 'usr_1' }],
    })
  })

  it('matches a single id', () => {
    expect(buildNotificationFilters({ id: 'ntf_1' })).toEqual({
      AND: [{ id: 'ntf_1' }],
    })
  })

  it('matches any of the given types', () => {
    const types = Object.values(NotificationType).slice(0, 2)
    expect(buildNotificationFilters({ type: types })).toEqual({
      AND: [{ type: { in: types } }],
    })
  })

  it('parses the comma-separated type param the schema accepts', () => {
    const types = Object.values(NotificationType).slice(0, 2)
    const params = notificationFilterSchema.parse({ type: types.join(',') })
    expect(buildNotificationFilters(params)).toEqual({
      AND: [{ type: { in: types } }],
    })
  })
})
