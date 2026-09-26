import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * A stored thumbnail is a `bucket` + `stage`, not a URL — the loadable `url` in
 * a payload only exists once `signThumbnails` has produced it. A read path that
 * selects thumbnails and forgets to sign them sends rows with no `url` at all,
 * which renders as a missing image at runtime, on whichever screen happens to
 * use that query.
 *
 * So: any server file that selects a `thumbnails` relation must either sign
 * what it returns, or be listed below with the reason it doesn't have to.
 * Adding an entry is a deliberate act — name the function that signs instead.
 */
const SIGNS_ELSEWHERE: Record<string, string> = {
  'app/.server/thumbnail-actions.ts':
    'defines signThumbnails / signStoredThumbnail / signThumbnailLocation',
  'app/routes/stash/trash.tsx': 'getPaginatedItems signs the page it returns',
  'app/routes/stash/collection.tsx':
    'getCollectionItems and paginateItems both sign',
  'app/routes/api/collections.ts': 'paginateItems signs',
  'app/routes/stash/duplicates.tsx': 'getDuplicateGroups signs its copies',
}

const ROOT = join(__dirname, '..', '..', '..')
const SCAN_DIRS = [join(ROOT, 'app', '.server'), join(ROOT, 'app', 'routes')]

/** A Prisma `select`/`include` key, not a mention in prose or a URL path. */
const SELECTS_THUMBNAILS = /^\s*thumbnails\s*:/m
/**
 * `\b` matters: it keeps `presignThumbnailUpload` from counting as signing,
 * since that only presigns an upload and signs nothing that is read back.
 */
const SIGNS = /\bsignThumbnails\b|\bsignStoredThumbnail\b|\bsignThumbnailLocation\b/

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue
      out.push(...sourceFiles(full))
      continue
    }
    if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

describe('thumbnail signing coverage', () => {
  const files = SCAN_DIRS.flatMap(sourceFiles)

  it('finds server files to scan', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('every file selecting thumbnails signs them or declares who does', () => {
    const unsigned = files
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        return SELECTS_THUMBNAILS.test(source) && !SIGNS.test(source)
      })
      .map((file) => relative(ROOT, file).replace(/\\/g, '/'))
      .filter((file) => !(file in SIGNS_ELSEWHERE))

    expect(unsigned).toEqual([])
  })

  it('keeps the allowlist honest — every entry still selects thumbnails', () => {
    const stale = Object.keys(SIGNS_ELSEWHERE).filter((file) => {
      const source = readFileSync(join(ROOT, file), 'utf8')
      return !SELECTS_THUMBNAILS.test(source)
    })

    expect(stale).toEqual([])
  })
})
