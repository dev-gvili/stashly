import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseFileExtension, parseEtag, parseFormData, parseSearchParams } from '../parsers'
import { toUserText } from '../converters'

describe('parseFileExtension', () => {
  it('extracts the extension from a normal filename', () => {
    expect(parseFileExtension('image.png')).toBe('png')
  })

  it('extracts the last extension for files with multiple dots', () => {
    expect(parseFileExtension('archive.tar.gz')).toBe('gz')
  })

  it('returns empty string for a filename with no extension', () => {
    expect(parseFileExtension('Makefile')).toBe('')
  })

  it('returns empty string for an empty string', () => {
    expect(parseFileExtension('')).toBe('')
  })

  it('handles filenames starting with a dot (hidden files)', () => {
    // '.gitignore' → split gives ['', 'gitignore'], pop returns 'gitignore'
    expect(parseFileExtension('.gitignore')).toBe('gitignore')
  })

  it('extracts extension correctly for paths with directory separators', () => {
    // The function splits on '.', not '/', so the last dot section is the extension
    expect(parseFileExtension('path/to/file.ts')).toBe('ts')
  })

  it('handles extensions with uppercase letters', () => {
    expect(parseFileExtension('Photo.JPG')).toBe('JPG')
  })
})

describe('parseEtag', () => {
  it('wraps a bare string in double quotes', () => {
    expect(parseEtag('abc123')).toBe('"abc123"')
  })

  it('strips surrounding double quotes then re-wraps', () => {
    expect(parseEtag('"abc123"')).toBe('"abc123"')
  })

  it('strips surrounding single quotes then re-wraps', () => {
    expect(parseEtag("'abc123'")).toBe('"abc123"')
  })

  it('handles escaped quotes inside the value', () => {
    // \\"abc\\" → after cleaning → "abc" → wrapped → ""abc""
    const result = parseEtag('\\"abc\\"')
    expect(result).toBe('"abc"')
  })

  it('handles an empty string', () => {
    expect(parseEtag('')).toBe('""')
  })

  it('handles a value with dashes and numbers (typical S3 ETag)', () => {
    expect(parseEtag('"d8e8fca2dc0f896fd7cb4cb0031ba249-2"')).toBe(
      '"d8e8fca2dc0f896fd7cb4cb0031ba249-2"'
    )
  })
})

const anything = z.record(z.string(), z.unknown())

const fromString = (qs: string) =>
  parseSearchParams({ searchParams: new URLSearchParams(qs), schema: anything })

describe('parseSearchParams — decoding values', () => {
  // `URLSearchParams.toString()` writes a space as `+`. Search sent
  // "E2E+Fav+Item+A" to the ranker, so every multi-word query matched nothing
  // literally and came back labelled "Similar name — no exact occurrence".
  it('decodes a space, whichever way the URL encoded it', () => {
    expect(fromString('query=E2E%20Fav%20Item%20A').query).toBe('E2E Fav Item A')
    expect(fromString('query=E2E+Fav+Item+A').query).toBe('E2E Fav Item A')
  })

  it('keeps an encoded plus sign as a plus', () => {
    expect(fromString('query=c%2B%2B').query).toBe('c++')
  })

  // Decoding the whole string before splitting it turned `%26` into a real `&`,
  // so "Tom & Jerry" split into `query: "Tom "` and a junk key.
  it('does not split a value on an encoded & or =', () => {
    expect(fromString('query=Tom%20%26%20Jerry')).toEqual({ query: 'Tom & Jerry' })
    expect(fromString('query=a%3Db')).toEqual({ query: 'a=b' })
  })

  it('keeps a literal percent sign', () => {
    expect(fromString('query=100%25').query).toBe('100%')
  })

  it('reads the request URL the same way as a URLSearchParams', () => {
    const request = new Request('http://localhost/x?query=E2E%20Fav&take=5')
    expect(parseSearchParams({ request, schema: anything })).toEqual({
      query: 'E2E Fav',
      take: '5',
    })
  })
})

describe('parseSearchParams — structure', () => {
  it('turns true / false into booleans', () => {
    expect(fromString('favorited=true&locked=false')).toEqual({
      favorited: true,
      locked: false,
    })
  })

  it('collects a repeated key into an array', () => {
    expect(fromString('tags=a&tags=b').tags).toEqual(['a', 'b'])
  })

  it('reads bracket keys, encoded or not', () => {
    expect(fromString('tags[]=a&tags[]=b').tags).toEqual(['a', 'b'])
    expect(fromString('tags%5B%5D=a&tags%5B%5D=b').tags).toEqual(['a', 'b'])
  })

  it('decodes values inside arrays too', () => {
    expect(fromString('tags=my%20tag&tags=rock+%26+roll').tags).toEqual([
      'my tag',
      'rock & roll',
    ])
  })

  it('still validates through the schema', () => {
    const schema = z.object({ take: z.coerce.number().int() })
    expect(() =>
      parseSearchParams({ searchParams: new URLSearchParams('take=x'), schema })
    ).toThrow(/Invalid search params/)
  })
})

// `fetcher.submit(object)` posts application/x-www-form-urlencoded, so every
// mutation in the app goes through this branch.
const formPost = (body: string) =>
  parseFormData({
    request: new Request('http://localhost/api/x', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    }),
    schema: anything,
  })

const encoded = (fields: Record<string, string>) => new URLSearchParams(fields).toString()

describe('parseFormData — urlencoded values', () => {
  it('decodes spaces and keeps & = + inside a value', async () => {
    expect(await formPost(encoded({ newName: 'Tom & Jerry = c++ notes' }))).toEqual({
      newName: 'Tom & Jerry = c++ notes',
    })
  })

  it('keeps a literal percent sign', async () => {
    expect(await formPost(encoded({ newName: '100% done' }))).toEqual({ newName: '100% done' })
  })

  // Coercing "007" to 7 lost the zeros: a name only becomes a number when the
  // number writes back out as exactly the same text.
  it('leaves numeric-looking text that would change as a number as a string', async () => {
    expect(await formPost(encoded({ a: '007', b: '1e3', c: '0x10', d: ' 5', e: '1.50' }))).toEqual({
      a: '007',
      b: '1e3',
      c: '0x10',
      d: ' 5',
      e: '1.50',
    })
  })
})

describe('parseFormData — urlencoded coercion the schemas rely on', () => {
  it('turns canonical numbers into numbers', async () => {
    expect(await formPost(encoded({ size: '42', ratio: '0.5', offset: '-3' }))).toEqual({
      size: 42,
      ratio: 0.5,
      offset: -3,
    })
  })

  it('turns true / false / null into their values', async () => {
    expect(await formPost(encoded({ a: 'true', b: 'false', c: 'null' }))).toEqual({
      a: true,
      b: false,
      c: null,
    })
  })

  it('reads nested and bracket keys', async () => {
    expect(await formPost('facet%5Bwidth%5D=640&facet%5Bheight%5D=480&ids%5B%5D=a&ids%5B%5D=b')).toEqual({
      facet: { width: 640, height: 480 },
      ids: ['a', 'b'],
    })
  })

  it('throws on a schema mismatch', async () => {
    await expect(
      parseFormData({
        request: new Request('http://localhost/api/x', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'intent=nope',
        }),
        schema: z.object({ intent: z.literal('favorite') }),
      })
    ).rejects.toThrow(/Validation failed/)
  })
})

describe('toUserText — typed text that looks like a value', () => {
  const rename = z.object({
    newName: toUserText(z.string().nonempty()),
    message: toUserText(z.string().optional()),
  })
  const post = (body: string) =>
    parseFormData({
      request: new Request('http://localhost/api/items', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      }),
      schema: rename,
    })

  // The decoder makes "2024" a number and "true" a boolean; a z.string()
  // rejected both, so renaming a file to either failed.
  it.each(['2024', 'true', 'false', 'null', '0'])('renames to %j', async (name) => {
    expect((await post(encoded({ newName: name }))).newName).toBe(name)
  })

  it('leaves an absent optional field absent', async () => {
    expect((await post(encoded({ newName: 'a' }))).message).toBeUndefined()
  })

  it('still rejects a missing required field rather than inventing "undefined"', async () => {
    await expect(post(encoded({ message: 'hi' }))).rejects.toThrow(/Validation failed/)
  })

  it('reads a search for "true" as the word', () => {
    const search = z.object({ query: toUserText(z.string().min(1)) })
    expect(
      parseSearchParams({ searchParams: new URLSearchParams('query=true'), schema: search }).query
    ).toBe('true')
  })
})

describe('parser validation errors', () => {
  it('are INVALID_INPUT, so routes answer 400 rather than 500', async () => {
    const { toErrorInfo } = await import('../api.errors')
    const err = await parseFormData({
      request: new Request('http://localhost/api/x', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'intent=nope',
      }),
      schema: z.object({ intent: z.literal('favorite') }),
    }).catch((e) => e)
    expect(toErrorInfo(err).status).toBe(400)

    const searchErr = (() => {
      try {
        parseSearchParams({
          searchParams: new URLSearchParams('take=x'),
          schema: z.object({ take: z.coerce.number().int() }),
        })
      } catch (e) {
        return e
      }
    })()
    expect(toErrorInfo(searchErr).status).toBe(400)
  })
})
