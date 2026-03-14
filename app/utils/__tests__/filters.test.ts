import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { createFilter, FilterBuilder, buildFiltersFactory } from '../filters'

// ─── createFilter ─────────────────────────────────────────────────────────────

describe('createFilter', () => {
  it('creates a filter with schema and apply function', () => {
    type WhereInput = { id?: string }
    const makeFilter = createFilter<WhereInput>()
    const filter = makeFilter(z.string(), (value) => ({ id: value }))

    const result = filter.apply('item_123', {})
    expect(result).toEqual({ id: 'item_123' })
  })

  it('validates the value with the provided schema and throws for invalid input', () => {
    type WhereInput = { count?: number }
    const makeFilter = createFilter<WhereInput>()
    const filter = makeFilter(z.number(), (value) => ({ count: value }))

    expect(() => filter.apply('not-a-number', {})).toThrow()
  })

  it('passes the full params object to the filter function', () => {
    type WhereInput = { AND?: object[] }
    type Params = { userId: string }
    const makeFilter = createFilter<WhereInput, Params>()
    const filter = makeFilter(z.string(), (value, params) => ({
      AND: [{ id: value }, { ownerId: params.userId }],
    }))

    const result = filter.apply('item_999', { userId: 'usr_abc' })
    expect(result).toEqual({ AND: [{ id: 'item_999' }, { ownerId: 'usr_abc' }] })
  })
})

// ─── FilterBuilder ────────────────────────────────────────────────────────────

describe('FilterBuilder', () => {
  type WhereInput = { AND?: object[] }
  const makeFilter = createFilter<WhereInput>()

  const filters = {
    id: makeFilter(z.string(), (value) => ({ id: value } as WhereInput)),
    status: makeFilter(z.string(), (value) => ({ status: value } as WhereInput)),
  }

  it('returns empty array (no conditions) when build() is called with no filters', () => {
    const builder = new FilterBuilder(filters, {})
    expect(builder.build()).toEqual([])
  })

  it('builds AND conditions for each added filter', () => {
    const builder = new FilterBuilder(filters, {})
    builder.addFilter('id', 'item_001')
    builder.addFilter('status', 'active')
    const result = builder.build() as { AND: object[] }
    expect(result.AND).toHaveLength(2)
    expect(result.AND).toContainEqual({ id: 'item_001' })
    expect(result.AND).toContainEqual({ status: 'active' })
  })

  it('skips undefined values', () => {
    const builder = new FilterBuilder(filters, {})
    builder.addFilter('id', undefined)
    expect(builder.build()).toEqual([])
  })

  it('skips null values', () => {
    const builder = new FilterBuilder(filters, {})
    builder.addFilter('id', null)
    expect(builder.build()).toEqual([])
  })

  it('skips empty arrays', () => {
    const builder = new FilterBuilder(filters, {})
    builder.addFilter('id', [])
    expect(builder.build()).toEqual([])
  })

  it('returns this from addFilter for chaining', () => {
    const builder = new FilterBuilder(filters, {})
    const returned = builder.addFilter('id', 'item_001')
    expect(returned).toBe(builder)
  })

  it('silently ignores filter errors and does not throw', () => {
    const badFilters = {
      id: makeFilter(z.number(), (v) => ({ id: v } as WhereInput)),
    }
    const builder = new FilterBuilder(badFilters, {})
    // 'not-a-number' fails z.number() validation — builder should catch and continue
    expect(() => builder.addFilter('id', 'not-a-number')).not.toThrow()
    expect(builder.build()).toEqual([])
  })
})

// ─── buildFiltersFactory ──────────────────────────────────────────────────────

describe('buildFiltersFactory', () => {
  type WhereInput = { AND?: object[] }

  const schema = z.object({
    id: z.string().optional(),
    status: z.string().optional(),
  })

  const makeFilter = createFilter<WhereInput, z.infer<typeof schema>>()
  const filters = {
    id: makeFilter(z.string(), (value) => ({ id: value } as WhereInput)),
    status: makeFilter(z.string(), (value) => ({ status: value } as WhereInput)),
  }

  const buildFilters = buildFiltersFactory({ schema, filters })

  it('builds where input from params that match filters', () => {
    const result = buildFilters({ id: 'item_001', status: 'active' }) as { AND: object[] }
    expect(result.AND).toContainEqual({ id: 'item_001' })
    expect(result.AND).toContainEqual({ status: 'active' })
  })

  it('only applies filters present in both params and filter map', () => {
    const result = buildFilters({ id: 'item_002' }) as { AND: object[] }
    expect(result.AND).toHaveLength(1)
    expect(result.AND).toContainEqual({ id: 'item_002' })
  })

  it('returns empty array when params have no matching filter keys', () => {
    const result = buildFilters({})
    expect(result).toEqual([])
  })
})
