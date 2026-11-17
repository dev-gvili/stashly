import { describe, it, expect } from 'vitest'
import {
  BACKFILL_MAX_BYTES,
  canBackfillThumbnail,
  canThumbnailFromMemory,
  hasThumbnailProducer,
  isConnectionTooSlow,
  isRealThumbnailUrl,
  THUMBNAIL_HEAD_BYTES,
  thumbnailSourceRange,
} from '../thumbnail-backfill'

describe('isRealThumbnailUrl', () => {
  it('accepts a persisted S3 url', () => {
    expect(isRealThumbnailUrl('https://b.t3.tigrisfiles.io/thumbnails/x.webp?v=2')).toBe(true)
  })

  it('rejects legacy hex placeholders and empties', () => {
    expect(isRealThumbnailUrl('#a1b2c3')).toBe(false)
    expect(isRealThumbnailUrl('')).toBe(false)
    expect(isRealThumbnailUrl(null)).toBe(false)
    expect(isRealThumbnailUrl(undefined)).toBe(false)
  })
})

describe('hasThumbnailProducer', () => {
  it('matches the stage-2 branches: image, video, pdf', () => {
    expect(hasThumbnailProducer({ name: 'a.jpg', mimeType: 'image/jpeg' })).toBe(true)
    expect(hasThumbnailProducer({ name: 'a.mp4', mimeType: 'video/mp4' })).toBe(true)
    expect(hasThumbnailProducer({ name: 'a.pdf', mimeType: 'application/pdf' })).toBe(true)
  })

  it('accepts code by extension even when the mime is generic', () => {
    // Uploaded source files routinely arrive as octet-stream.
    expect(hasThumbnailProducer({ name: 'item-actions.ts', mimeType: 'application/octet-stream' })).toBe(true)
    expect(hasThumbnailProducer({ name: 'schema.prisma', mimeType: null })).toBe(true)
    expect(hasThumbnailProducer({ name: 'notes.md', mimeType: null })).toBe(true)
  })

  it('rejects types with no renderer', () => {
    expect(hasThumbnailProducer({ name: 'song.mp3', mimeType: 'audio/mpeg' })).toBe(false)
    expect(hasThumbnailProducer({ name: 'archive.zip', mimeType: 'application/zip' })).toBe(false)
    expect(hasThumbnailProducer({ name: 'app.exe', mimeType: null })).toBe(false)
  })
})

describe('canBackfillThumbnail', () => {
  const base = {
    type: 'file' as const,
    name: 'db.ts',
    size: 1_600,
    mimeType: 'text/plain',
  }

  it('backfills a small code file with no thumbnail', () => {
    expect(canBackfillThumbnail(base)).toBe(true)
    expect(canBackfillThumbnail({ ...base, thumbnailUrls: [] })).toBe(true)
    expect(canBackfillThumbnail({ ...base, thumbnailUrls: [null, '#ff0000'] })).toBe(true)
  })

  it('skips items that already have a real thumbnail', () => {
    expect(
      canBackfillThumbnail({ ...base, thumbnailUrls: ['https://cdn/x.webp?v=2'] })
    ).toBe(false)
  })

  it('skips folders and collections', () => {
    expect(canBackfillThumbnail({ ...base, type: 'folder' })).toBe(false)
    expect(canBackfillThumbnail({ ...base, type: 'collection' })).toBe(false)
  })

  it('skips empty files and anything past the size cap', () => {
    expect(canBackfillThumbnail({ ...base, size: 0 })).toBe(false)
    expect(canBackfillThumbnail({ ...base, size: BACKFILL_MAX_BYTES })).toBe(true)
    expect(canBackfillThumbnail({ ...base, size: BACKFILL_MAX_BYTES + 1 })).toBe(false)
  })

  it('skips types the pipeline cannot render', () => {
    expect(
      canBackfillThumbnail({ ...base, name: 'song.mp3', mimeType: 'audio/mpeg' })
    ).toBe(false)
  })
})

describe('canThumbnailFromMemory', () => {
  const base = { type: 'file', name: 'photo.png', size: 1000, mimeType: 'image/png' }

  it('accepts a renderable file with no thumbnail yet', () => {
    expect(canThumbnailFromMemory(base)).toBe(true)
  })

  it('has no size cap — nothing is downloaded', () => {
    expect(canThumbnailFromMemory({ ...base, size: BACKFILL_MAX_BYTES * 3 })).toBe(true)
    expect(canBackfillThumbnail({ ...base, size: BACKFILL_MAX_BYTES * 3 })).toBe(false)
  })

  it('refuses a file that already has a real thumbnail', () => {
    expect(canThumbnailFromMemory({ ...base, thumbnailUrls: ['https://cdn/x.webp?v=2'] })).toBe(false)
  })

  it('refuses folders and types with no renderer', () => {
    expect(canThumbnailFromMemory({ ...base, type: 'folder' })).toBe(false)
    expect(canThumbnailFromMemory({ ...base, name: 'a.zip', mimeType: 'application/zip' })).toBe(false)
  })
})

describe('isConnectionTooSlow', () => {
  it('opts out on Data Saver and 2g-class links', () => {
    expect(isConnectionTooSlow({ saveData: true })).toBe(true)
    expect(isConnectionTooSlow({ effectiveType: '2g' })).toBe(true)
    expect(isConnectionTooSlow({ effectiveType: 'slow-2g' })).toBe(true)
  })

  it('allows fast links and browsers without the API', () => {
    expect(isConnectionTooSlow({ effectiveType: '4g' })).toBe(false)
    expect(isConnectionTooSlow(undefined)).toBe(false)
    expect(isConnectionTooSlow(null)).toBe(false)
  })
})

describe('thumbnailSourceRange', () => {
  const video = { size: 40_000_000, mimeType: 'video/x-matroska' }

  it('downloads a small file whole', () => {
    expect(thumbnailSourceRange({ size: 1_600, mimeType: 'text/plain' })).toEqual({ ranged: false })
    expect(thumbnailSourceRange({ size: BACKFILL_MAX_BYTES, mimeType: 'video/mp4' })).toEqual({ ranged: false })
  })

  it('reads only the head of a video over the cap', () => {
    expect(thumbnailSourceRange(video)).toEqual({ ranged: true, bytes: THUMBNAIL_HEAD_BYTES })
    expect(thumbnailSourceRange({ ...video, mimeType: 'video/matroska' })).toEqual({ ranged: true, bytes: THUMBNAIL_HEAD_BYTES })
  })

  it('refuses a big file of any other type, and empty files', () => {
    expect(thumbnailSourceRange({ size: 40_000_000, mimeType: 'image/png' })).toBeNull()
    expect(thumbnailSourceRange({ size: 40_000_000, mimeType: 'application/pdf' })).toBeNull()
    expect(thumbnailSourceRange({ size: 0, mimeType: 'video/mp4' })).toBeNull()
  })
})

describe('canBackfillThumbnail with a big video', () => {
  const big = { type: 'file', name: 'a.mkv', size: 40_000_000, mimeType: 'video/x-matroska' }
  it('is allowed for video, still refused for other big types', () => {
    expect(canBackfillThumbnail(big)).toBe(true)
    expect(canBackfillThumbnail({ ...big, name: 'a.png', mimeType: 'image/png' })).toBe(false)
  })
})
