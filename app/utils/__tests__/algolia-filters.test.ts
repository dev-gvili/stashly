import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  createAlgoliaFilter,
  AlgoliaFilterBuilder,
  buildAlgoliaFiltersFactory,
} from '../algolia-filters'

// ─── createAlgoliaFilter ──────────────────────────────────────────────────────

describe('createAlgoliaFilter', () => {
  it('creates a filter definition with schema and apply function', () => {
    const makeFilter = createAlgoliaFilter<{ userId: string }>()
    const filter = makeFilter(z.string(), (value) => `ownerId:${value}`)

    expect(filter.schema).toBeDefined()
    const result = filter.apply('usr_123', { userId: 'usr_123' })
    expect(result).toBe('ownerId:usr_123')
  })

  it('applies schema validation and throws for invalid input', () => {
    const makeFilter = createAlgoliaFilter()
    const filter = makeFilter(z.number(), (value) => `count:${value}`)

    expect(() => filter.apply('not-a-number', {})).toThrow()
  })

  it('can return an array of filter strings', () => {
    const makeFilter = createAlgoliaFilter()
    const filter = makeFilter(
      z.array(z.string()),
      (values) => values.map((v) => `tag:${v}`)
    )

    const result = filter.apply(['a', 'b'], {})
    expect(result).toEqual(['tag:a', 'tag:b'])
  })
})

// ─── AlgoliaFilterBuilder ─────────────────────────────────────────────────────

describe('AlgoliaFilterBuilder', () => {
  const makeFilter = createAlgoliaFilter<{ userId: string }>()
  const filters = {
    ownerId: makeFilter(z.string(), (value) => `ownerId:${value}`),
    status: makeFilter(z.string(), (value) => `status:${value}`),
  }

  it('builds an empty filter string when no filters are added', () => {
    const builder = new AlgoliaFilterBuilder(filters, { userId: 'usr_1' })
    expect(builder.build()).toBe('')
  })

  it('builds a filter string for a single added filter', () => {
    const builder = new AlgoliaFilterBuilder(filters, { userId: 'usr_1' })
    builder.addFilter('ownerId', 'usr_123')
    expect(builder.build()).toBe('ownerId:usr_123')
  })

  it('joins multiple filters with AND', () => {
    const builder = new AlgoliaFilterBuilder(filters, { userId: 'usr_1' })
    builder.addFilter('ownerId', 'usr_123')
    builder.addFilter('status', 'active')
    expect(builder.build()).toBe('ownerId:usr_123 AND status:active')
  })

  it('skips undefined values', () => {
    const builder = new AlgoliaFilterBuilder(filters, { userId: 'usr_1' })
    builder.addFilter('ownerId', undefined)
    expect(builder.build()).toBe('')
  })

  it('skips null values', () => {
    const builder = new AlgoliaFilterBuilder(filters, { userId: 'usr_1' })
    builder.addFilter('ownerId', null)
    expect(builder.build()).toBe('')
  })

  it('skips empty arrays', () => {
    const makeArrayFilter = createAlgoliaFilter()
    const arrayFilters = {
      tags: makeArrayFilter(z.array(z.string()), (values) =>
        values.map((v) => `tag:${v}`)
      ),
    }
    const builder = new AlgoliaFilterBuilder(arrayFilters, {})
    builder.addFilter('tags', [])
    expect(builder.build()).toBe('')
  })

  it('expands array filter results into separate conditions', () => {
    const makeArrayFilter = createAlgoliaFilter()
    const arrayFilters = {
      tags: makeArrayFilter(z.array(z.string()), (values) =>
        values.map((v) => `tag:${v}`)
      ),
    }
    const builder = new AlgoliaFilterBuilder(arrayFilters, {})
    builder.addFilter('tags', ['alpha', 'beta'])
    expect(builder.build()).toBe('tag:alpha AND tag:beta')
  })

  it('returns this from addFilter for chaining', () => {
    const builder = new AlgoliaFilterBuilder(filters, { userId: 'usr_1' })
    const result = builder.addFilter('ownerId', 'usr_123')
    expect(result).toBe(builder)
  })
})

// ─── buildAlgoliaFiltersFactory ───────────────────────────────────────────────

describe('buildAlgoliaFiltersFactory', () => {
  const schema = z.object({
    ownerId: z.string().optional(),
    status: z.string().optional(),
  })

  const makeFilter = createAlgoliaFilter<z.infer<typeof schema>>()
  const filters = {
    ownerId: makeFilter(z.string(), (value) => `ownerId:${value}`),
    status: makeFilter(z.string(), (value) => `status:${value}`),
  }

  const buildFilters = buildAlgoliaFiltersFactory({ schema, filters })

  it('returns the correct filter string from params', () => {
    const result = buildFilters({ ownerId: 'usr_456', status: 'active' })
    expect(result).toBe('ownerId:usr_456 AND status:active')
  })

  it('ignores params that have no corresponding filter', () => {
    const result = buildFilters({ ownerId: 'usr_789' })
    expect(result).toBe('ownerId:usr_789')
  })

  it('returns an empty string when no params match filters', () => {
    const result = buildFilters({})
    expect(result).toBe('')
  })
})
