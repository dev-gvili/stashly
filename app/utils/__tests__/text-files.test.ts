import { describe, expect, it } from 'vitest'
import {
  MAX_INDEXED_TEXT_CHARS,
  TEXT_EXTENSIONS,
  isIndexableTextFile,
  isIndexableTextName,
} from '../text-files'

/**
 * These guard the predicate the *search index* reads, which is a different
 * question from the one `text-thumbnail.test.ts` asks. A file can be worth
 * rendering and not worth indexing (a lockfile), so the two suites are allowed
 * to disagree — deliberately, and only in that direction.
 */
describe('isIndexableTextFile', () => {
  it('indexes source files the extraction chain used to drop', () => {
    // The regression this whole change exists for: these fell past every
    // branch in `extractMediaMetadata` and so were never given a Search row.
    for (const name of [
      'converters.ts',
      'search-view.tsx',
      'tsconfig.json',
      'schema.prisma',
      'main.py',
      'globals.css',
      'deploy.ps1',
      'notes.txt',
    ]) {
      expect(isIndexableTextFile({ name, type: '' }), name).toBe(true)
    }
  })

  it('still indexes markdown — callers pick the richer path first', () => {
    expect(isIndexableTextFile({ name: 'README.md', type: '' })).toBe(true)
  })

  it('skips generated text that would flood the chunk table', () => {
    for (const name of [
      'package-lock.json',
      'pnpm-lock.yaml',
      'PACKAGE-LOCK.JSON',
      'vendor.min.js',
      'app.min.css',
      'bundle.js.map',
    ]) {
      expect(isIndexableTextFile({ name, type: '' }), name).toBe(false)
    }
  })

  it('skips binary formats regardless of how the OS typed them', () => {
    expect(isIndexableTextFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false)
    expect(isIndexableTextFile({ name: 'doc.pdf', type: 'application/pdf' })).toBe(false)
    expect(isIndexableTextFile({ name: 'song.mp3', type: 'audio/mpeg' })).toBe(false)
  })

  it('falls back to the mime type when the name carries no extension', () => {
    expect(isIndexableTextFile({ name: 'payload', type: 'application/json' })).toBe(true)
    expect(isIndexableTextFile({ name: 'notes', type: 'text/plain' })).toBe(true)
    expect(isIndexableTextFile({ name: 'blob', type: 'application/octet-stream' })).toBe(
      false,
    )
  })
})

describe('isIndexableTextName', () => {
  it('accepts a null name and a null mime without throwing', () => {
    // Both arrive straight off a Prisma row, where either can be null.
    expect(isIndexableTextName(null)).toBe(false)
    expect(isIndexableTextName(undefined, null)).toBe(false)
    expect(isIndexableTextName('converters.ts', null)).toBe(true)
  })

  it('agrees with the File form it delegates to', () => {
    expect(isIndexableTextName('package-lock.json', 'application/json')).toBe(false)
    expect(isIndexableTextName('Dockerfile', '')).toBe(true)
  })
})

describe('TEXT_EXTENSIONS', () => {
  it('carries the suffixes the re-index SQL builds its LIKE patterns from', () => {
    // The candidate query matches `%<ext>`, so bare filenames have to be in
    // this list as-is for `Dockerfile` to be reachable at all.
    expect(TEXT_EXTENSIONS).toContain('ts')
    expect(TEXT_EXTENSIONS).toContain('tsx')
    expect(TEXT_EXTENSIONS).toContain('json')
    expect(TEXT_EXTENSIONS).toContain('md')
    expect(TEXT_EXTENSIONS).toContain('dockerfile')
  })

  it('holds no dots — the pattern adds the wildcard, not the separator', () => {
    expect(TEXT_EXTENSIONS.filter((ext) => ext.includes('.'))).toEqual([])
  })
})

describe('MAX_INDEXED_TEXT_CHARS', () => {
  it('is an integer, so Postgres can compare it against the bigint size column', () => {
    // A fractional param is typed bigint by Postgres and rejected outright —
    // the cap appears inside `LEAST(i."size", …)` in the candidate query.
    expect(Number.isInteger(MAX_INDEXED_TEXT_CHARS)).toBe(true)
  })
})
