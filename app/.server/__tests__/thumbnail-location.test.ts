import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  signStoredThumbnail,
  signThumbnails,
  thumbnailKey,
  thumbnailLocation,
} from '../thumbnail-actions'

const BUCKET = 'stashly-jane-a1b2c3d4'
const ITEM = 'itm_Kj8-_xQ1'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('thumbnailKey', () => {
  it('derives the one key an item may have', () => {
    expect(thumbnailKey(ITEM)).toBe(`thumbnails/${ITEM}.webp`)
  })
})

describe('thumbnailLocation', () => {
  it('builds a location for a persisted stage', () => {
    expect(thumbnailLocation({ bucket: BUCKET, stage: 2 }, ITEM)).toEqual({
      bucket: BUCKET,
      key: `thumbnails/${ITEM}.webp`,
      itemId: ITEM,
      stage: 2,
    })
    expect(thumbnailLocation({ bucket: BUCKET, stage: 3 }, ITEM)?.stage).toBe(3)
  })

  it('is null for stages that are never stored as objects', () => {
    for (const stage of [0, 1, 4, null, undefined]) {
      expect(thumbnailLocation({ bucket: BUCKET, stage }, ITEM)).toBeNull()
    }
  })

  it('is null without a bucket or an item', () => {
    expect(thumbnailLocation({ bucket: null, stage: 2 }, ITEM)).toBeNull()
    expect(thumbnailLocation({ bucket: '', stage: 2 }, ITEM)).toBeNull()
    expect(thumbnailLocation({ bucket: BUCKET, stage: 2 }, undefined)).toBeNull()
  })

  it('refuses a malformed bucket', () => {
    for (const bucket of ['UPPER-case', 'a', 'has/slash', '-leading', 'x'.repeat(64)]) {
      expect(thumbnailLocation({ bucket, stage: 2 }, ITEM)).toBeNull()
    }
  })

  it('refuses an item id that could escape the thumbnails prefix', () => {
    for (const itemId of ['no-prefix', 'itm_a/../../x', 'itm_a.webp', '']) {
      expect(thumbnailLocation({ bucket: BUCKET, stage: 2 }, itemId)).toBeNull()
    }
  })

  it('builds the key from the caller-supplied item, not the row', () => {
    expect(thumbnailLocation({ bucket: BUCKET, stage: 2 }, 'itm_other')?.key).toBe(
      'thumbnails/itm_other.webp'
    )
  })
})

describe('signStoredThumbnail (unsigned branches)', () => {
  it('returns a hex placeholder colour unchanged', async () => {
    expect(await signStoredThumbnail({ color: '#a1b2c3', stage: 0 }, ITEM)).toBe('#a1b2c3')
    expect(await signStoredThumbnail({ color: '#abc', stage: 0 }, ITEM)).toBe('#abc')
  })

  it('drops a colour that is not a hex colour — it is client-supplied', async () => {
    for (const color of ['javascript:alert(1)', 'https://evil.example.com/x.png', '#zzz', 'red']) {
      expect(await signStoredThumbnail({ color, stage: 0 }, ITEM)).toBeNull()
    }
  })

  it('is null for an empty row', async () => {
    expect(await signStoredThumbnail({}, ITEM)).toBeNull()
  })

  it('refuses to sign a stored bucket that fails the checks, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await signStoredThumbnail({ bucket: 'Bad_Bucket', stage: 2 }, ITEM)).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('signThumbnails (shape walk)', () => {
  // Rows here never produce a location (stage 0, or a bucket that fails the
  // checks), so the walk is exercised with no S3 credentials in play.
  it('walks nested relations and leaves other fields alone', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const created = new Date('2026-09-18T10:00:00Z')
    const input = {
      id: 'itm_parent',
      name: 'photo.png',
      createdAt: created,
      size: 10n,
      thumbnails: [{ bucket: 'Bad_Bucket', color: null, stage: 2, width: 512 }],
      parent: {
        id: 'itm_grandparent',
        thumbnails: [{ bucket: 'Bad_Bucket', color: null, stage: 3 }],
      },
      children: [
        {
          id: 'itm_child',
          thumbnails: [{ bucket: null, color: '#a1b2c3', stage: 0 }],
        },
      ],
    }

    const out = await signThumbnails(input)

    expect(out.thumbnails[0].url).toBeNull()
    expect(out.parent.thumbnails[0].url).toBeNull()
    // Placeholders survive as `url` — consumers filter them themselves.
    expect(out.children[0].thumbnails[0].url).toBe('#a1b2c3')
    // Other thumbnail fields and everything outside thumbnails are untouched.
    expect(out.thumbnails[0].stage).toBe(2)
    expect(out.thumbnails[0].width).toBe(512)
    expect(out.name).toBe('photo.png')
    expect(out.size).toBe(10n)
    expect(out.createdAt).toBe(created)
  })

  it('strips the storage columns and any stale url from the payload', async () => {
    const out = await signThumbnails({
      id: ITEM,
      thumbnails: [
        { bucket: null, color: '#abc', stage: 0, url: 's3://stale/locator?v=2' },
      ],
    })
    expect(out.thumbnails[0]).toEqual({ stage: 0, url: '#abc' })
  })

  it('passes null and empty collections through', async () => {
    const input = { id: 'itm_a', thumbnails: [], parent: null }
    expect(await signThumbnails(input)).toEqual(input)
  })

  it('handles arrays of rows', async () => {
    const out = await signThumbnails([
      { id: 'itm_a', thumbnails: [{ bucket: null, color: null, stage: 0 }] },
      { id: 'itm_b', thumbnails: [] },
    ])
    expect(out[0].thumbnails[0].url).toBeNull()
    expect(out[1].thumbnails).toEqual([])
  })
})
