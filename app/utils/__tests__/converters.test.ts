import { describe, it, expect } from 'vitest'
import {
  toUserInitial,
  toChunkArray,
  toItemPath,
  toEnumKeys,
  toObjectId,
  getPrefixForModel,
  StashlyPrefixMap,
  toZodArraySchema,
  toZodOrderBySchema,
  toTypedObjects,
} from '../converters'
import { z } from 'zod'

// ─── toUserInitial ────────────────────────────────────────────────────────────

describe('toUserInitial', () => {
  it('returns first two letters of a single word, uppercased', () => {
    expect(toUserInitial('alice')).toBe('AL')
  })

  it('returns first letters of two words when separated by a space', () => {
    expect(toUserInitial('alice bob')).toBe('AB')
  })

  it('handles dash as a delimiter', () => {
    expect(toUserInitial('alice-bob')).toBe('AB')
  })

  it('handles underscore as a delimiter', () => {
    expect(toUserInitial('alice_bob')).toBe('AB')
  })

  it('handles dot as a delimiter', () => {
    expect(toUserInitial('alice.bob')).toBe('AB')
  })

  it('uses the local part of an email address', () => {
    expect(toUserInitial('john.doe@example.com')).toBe('JD')
  })

  it('uses first two chars of a single-word email local part', () => {
    expect(toUserInitial('alice@example.com')).toBe('AL')
  })

  it('returns NN for an empty string', () => {
    expect(toUserInitial('')).toBe('NN')
  })

  it('uppercases letters from a lowercase single word', () => {
    expect(toUserInitial('xyz')).toBe('XY')
  })

  it('handles input with multiple delimiters in a row', () => {
    // multiple delimiters between parts should filter out empty strings
    expect(toUserInitial('alice--bob')).toBe('AB')
  })
})

// ─── toChunkArray ─────────────────────────────────────────────────────────────

describe('toChunkArray', () => {
  it('splits an array into equal chunks', () => {
    expect(toChunkArray([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 2], [3, 4], [5, 6]])
  })

  it('handles a remainder chunk at the end', () => {
    expect(toChunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('chunk size larger than array length returns single chunk', () => {
    expect(toChunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]])
  })

  it('chunk size of 1 returns one element per chunk', () => {
    expect(toChunkArray(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']])
  })

  it('empty array returns empty result', () => {
    expect(toChunkArray([], 5)).toEqual([])
  })

  it('returns empty array when chunkSize is 0', () => {
    expect(toChunkArray([1, 2, 3], 0)).toEqual([])
  })

  it('returns empty array when chunkSize is negative', () => {
    expect(toChunkArray([1, 2, 3], -1)).toEqual([])
  })

  it('returns empty array when first argument is not an array', () => {
    expect(toChunkArray(null as any, 2)).toEqual([])
  })

  it('works with objects', () => {
    const input = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(toChunkArray(input, 2)).toEqual([[{ id: 1 }, { id: 2 }], [{ id: 3 }]])
  })
})

// ─── toItemPath ────────────────────────────────────────────────────────────────

describe('toItemPath', () => {
  it('builds a path with drive name and item name when no parent', () => {
    expect(toItemPath('MyDrive', undefined, 'MyFile.txt')).toBe('MyDrive/MyFile.txt')
  })

  it('builds a path with parent path and item name when parent is provided', () => {
    expect(toItemPath('MyDrive', 'Documents', 'MyFile.txt')).toBe('Documents/MyFile.txt')
  })

  it('handles nested parent paths', () => {
    expect(toItemPath('MyDrive', 'Documents/Projects', 'report.pdf')).toBe('Documents/Projects/report.pdf')
  })

  it('handles undefined itemName', () => {
    expect(toItemPath('MyDrive', undefined, undefined)).toBe('MyDrive/undefined')
  })
})

// ─── toEnumKeys ───────────────────────────────────────────────────────────────

describe('toEnumKeys', () => {
  it('returns an array of keys from a plain object', () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(toEnumKeys(obj)).toEqual(['a', 'b', 'c'])
  })

  it('returns empty array for an empty object', () => {
    expect(toEnumKeys({})).toEqual([])
  })

  it('works on the StashlyPrefixMap', () => {
    const keys = toEnumKeys(StashlyPrefixMap)
    expect(keys).toContain('Item')
    expect(keys).toContain('User')
    expect(keys).toContain('Workspace')
  })
})

// ─── getPrefixForModel ────────────────────────────────────────────────────────

describe('getPrefixForModel', () => {
  it('returns the correct prefix for Item', () => {
    expect(getPrefixForModel('Item')).toBe('item')
  })

  it('returns the correct prefix for User', () => {
    expect(getPrefixForModel('User')).toBe('usr')
  })

  it('returns the correct prefix for Workspace', () => {
    expect(getPrefixForModel('Workspace')).toBe('ws')
  })

  it('returns the correct prefix for Collection', () => {
    expect(getPrefixForModel('Collection')).toBe('coll')
  })
})

// ─── toObjectId ───────────────────────────────────────────────────────────────

describe('toObjectId', () => {
  it('generates an ID starting with the given prefix', () => {
    const id = toObjectId('item')
    expect(id.startsWith('item_')).toBe(true)
  })

  it('generates a unique ID on every call', () => {
    const id1 = toObjectId('usr')
    const id2 = toObjectId('usr')
    expect(id1).not.toBe(id2)
  })

  it('generated ID contains no + or / (URL-safe)', () => {
    const id = toObjectId('ws')
    const suffix = id.split('_')[1]
    expect(suffix).not.toMatch(/[+/=]/)
  })

  it('throws for an empty prefix', () => {
    expect(() => toObjectId('' as any)).toThrow()
  })

  it('throws when prefix contains an underscore', () => {
    expect(() => toObjectId('bad_prefix' as any)).toThrow()
  })
})

// ─── toZodArraySchema ─────────────────────────────────────────────────────────

describe('toZodArraySchema', () => {
  it('splits a comma-separated string into an array of strings', () => {
    const schema = toZodArraySchema(z.string())
    expect(schema.parse('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('trims whitespace around elements', () => {
    const schema = toZodArraySchema(z.string().trim())
    expect(schema.parse('  a ,  b , c  ')).toEqual(['a', 'b', 'c'])
  })

  it('coerces numbers when element schema is z.coerce.number()', () => {
    const schema = toZodArraySchema(z.coerce.number())
    expect(schema.parse('1,2,3')).toEqual([1, 2, 3])
  })

  it('throws a ZodError for invalid enum values', () => {
    const schema = toZodArraySchema(z.enum(['audio', 'video']))
    expect(() => schema.parse('audio,unknown')).toThrow()
  })

  it('parses a single element', () => {
    const schema = toZodArraySchema(z.string())
    expect(schema.parse('single')).toEqual(['single'])
  })

  it('accepts empty string resulting in array with one empty string', () => {
    const schema = toZodArraySchema(z.string())
    expect(schema.parse('')).toEqual([''])
  })
})

// ─── toZodOrderBySchema ───────────────────────────────────────────────────────

describe('toZodOrderBySchema', () => {
  it('parses a single field:direction pair', () => {
    const schema = toZodOrderBySchema()
    expect(schema.parse('createdAt:asc')).toEqual({ createdAt: 'asc' })
  })

  it('parses multiple field:direction pairs', () => {
    const schema = toZodOrderBySchema()
    expect(schema.parse('createdAt:desc,name:asc')).toEqual({
      createdAt: 'desc',
      name: 'asc',
    })
  })

  it('parses nested field paths with dot notation', () => {
    const schema = toZodOrderBySchema()
    expect(schema.parse('owner.name:asc')).toEqual({
      owner: { name: 'asc' },
    })
  })

  it('throws for an invalid direction', () => {
    const schema = toZodOrderBySchema()
    expect(() => schema.parse('createdAt:up')).toThrow()
  })

  it('throws for a malformed pair (no colon)', () => {
    const schema = toZodOrderBySchema()
    expect(() => schema.parse('createdAt')).toThrow()
  })
})

// ─── toTypedObjects ───────────────────────────────────────────────────────────

describe('toTypedObjects', () => {
  it('returns error when no formData entries exist for fieldName', () => {
    const fd = new FormData()
    const result = toTypedObjects<{ id: string }>(fd, { fieldName: 'id' })
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toEqual([])
  })

  it('converts formData entries into typed objects', () => {
    const fd = new FormData()
    fd.append('id', 'item_001')
    fd.append('id', 'item_002')
    fd.append('name', 'File A')
    fd.append('name', 'File B')

    const result = toTypedObjects<{ id: string; name: string }>(fd, {
      fieldName: 'id',
    })

    expect(result.errors).toEqual([])
    expect(result.data).toHaveLength(2)
    expect(result.data[0].id).toBe('item_001')
    expect(result.data[1].id).toBe('item_002')
  })

  it('returns error when fieldName option is missing', () => {
    const fd = new FormData()
    const result = toTypedObjects<{ id: string }>(fd, { fieldName: '' })
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('applies transform when provided', () => {
    const fd = new FormData()
    fd.append('id', 'item_001')
    fd.append('name', 'file a')

    const result = toTypedObjects<{ id: string; name: string }>(fd, {
      fieldName: 'id',
      transform: (obj) => ({ ...obj, name: obj.name?.toUpperCase() }),
    })

    expect(result.data[0].name).toBe('FILE A')
  })
})
