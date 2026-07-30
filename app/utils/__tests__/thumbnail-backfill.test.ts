import { describe, it, expect } from 'vitest'
import {
  BACKFILL_MAX_BYTES,
  canBackfillThumbnail,
  hasThumbnailProducer,
  isConnectionTooSlow,
  isRealThumbnailUrl,
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
