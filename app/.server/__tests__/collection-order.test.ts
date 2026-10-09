import { describe, expect, it } from 'vitest'
import { StashlyErrorCode } from '@/utils/api.errors'
import {
  collectionAfterCursor,
  collectionOrderBy,
  collectionSortKeys,
} from '@/services/collection-order'

/** The ORDER BY text for an orderBy, whitespace collapsed. */
const orderSql = (orderBy: unknown) =>
  collectionOrderBy(collectionSortKeys(orderBy)).sql.replace(/\s+/g, ' ')

describe('collectionSortKeys', () => {
  it.each([
    ['name', 'i."name"'],
    ['updatedAt', 'i."updatedAt"'],
    ['createdAt', 'i."createdAt"'],
    ['size', 'i."size"'],
    ['type', 'i."type"'],
  ])('maps the sort pill column %s to %s', (column, sql) => {
    expect(orderSql({ [column]: 'desc' })).toBe(`ORDER BY ${sql} DESC, cm.id DESC`)
  })

  it('defaults to the sort pill default, name ascending', () => {
    expect(orderSql(undefined)).toBe('ORDER BY i."name" ASC, cm.id DESC')
    expect(orderSql([])).toBe('ORDER BY i."name" ASC, cm.id DESC')
  })

  it('keeps array order and splits an object holding several keys', () => {
    expect(orderSql([{ type: 'asc', size: 'desc' }, { name: 'asc' }])).toBe(
      'ORDER BY i."type" ASC, i."size" DESC, i."name" ASC, cm.id DESC'
    )
  })

  it.each([
    ['an unknown column', { owner: 'asc' }],
    ['the Count sort, which has no meaning inside a collection', { members: { _count: 'desc' } }],
    ['a folder child count', [{ folder: { childCount: 'asc' } }]],
    ['an injection attempt', { 'name"; DROP TABLE "Item"; --': 'asc' }],
    ['a prototype key', JSON.parse('{"__proto__": "asc"}')],
    ['a bad direction', { name: 'sideways' }],
    ['a direction object', { name: { sort: 'asc', nulls: 'last' } }],
    ['a non-object', 'name'],
  ])('rejects %s with a 400 INVALID_INPUT', (_label, orderBy) => {
    expect(() => collectionSortKeys(orderBy)).toThrow(
      expect.objectContaining({ errorCode: StashlyErrorCode.INVALID_INPUT, status: 400 })
    )
  })
})

describe('collectionAfterCursor', () => {
  it('adds nothing on the first page', () => {
    const after = collectionAfterCursor(collectionSortKeys({ name: 'asc' }), undefined)
    expect([after.with.sql, after.join.sql, after.where.sql]).toEqual(['', '', ''])
  })

  it('compares each key against the cursor row, in its own direction', () => {
    const keys = collectionSortKeys([{ type: 'asc' }, { size: 'desc' }])
    const after = collectionAfterCursor(keys, 'cm_1')
    expect(after.where.sql.replace(/\s+/g, ' ')).toBe(
      'AND (i."type" > cur."k0" OR (i."type" = cur."k0" AND ' +
        '(i."size" < cur."k1" OR (i."size" = cur."k1" AND cm.id < cur."id"))))'
    )
    expect(after.join.sql).toBe('CROSS JOIN cur')
    // The cursor id is a bound parameter, never spliced into the text.
    expect(after.with.sql).not.toContain('cm_1')
    expect(after.with.values).toEqual(['cm_1'])
  })
})
