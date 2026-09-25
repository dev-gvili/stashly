import { describe, it, expect } from 'vitest'
import {
  parseThumbnailLocator,
  signThumbnails,
  thumbnailLocator,
} from '../thumbnail-actions'

const BUCKET = 'stashly-jane-a1b2c3d4'
const ITEM = 'itm_Kj8-_xQ1'
const LOCATOR = `s3://${BUCKET}/thumbnails/${ITEM}.webp?v=2`
const LEGACY = `https://${BUCKET}.t3.tigrisfiles.io/thumbnails/${ITEM}.webp?v=2`

describe('thumbnailLocator', () => {
  it('builds the stored form', () => {
    expect(thumbnailLocator(BUCKET, ITEM, 2)).toBe(LOCATOR)
    expect(thumbnailLocator(BUCKET, ITEM, 3)).toBe(
      `s3://${BUCKET}/thumbnails/${ITEM}.webp?v=3`
    )
  })

  it('rejects a malformed bucket or item id', () => {
    expect(() => thumbnailLocator('Bad_Bucket', ITEM, 2)).toThrow()
    expect(() => thumbnailLocator(BUCKET, 'no-prefix', 2)).toThrow()
    // A slash in the item id would escape the thumbnails/ prefix.
    expect(() => thumbnailLocator(BUCKET, 'itm_a/../../x', 2)).toThrow()
  })
})

describe('parseThumbnailLocator', () => {
  it('parses the stored form', () => {
    expect(parseThumbnailLocator(LOCATOR)).toEqual({
      bucket: BUCKET,
      key: `thumbnails/${ITEM}.webp`,
      itemId: ITEM,
      stage: 2,
    })
  })

  it('parses legacy public URLs, so old rows need no migration', () => {
    expect(parseThumbnailLocator(LEGACY)).toEqual({
      bucket: BUCKET,
      key: `thumbnails/${ITEM}.webp`,
      itemId: ITEM,
      stage: 2,
    })
  })

  it('reads the stage from ?v=', () => {
    expect(parseThumbnailLocator(LOCATOR.replace('v=2', 'v=3'))?.stage).toBe(3)
  })

  it('returns null for empty values and stage-0 placeholders', () => {
    expect(parseThumbnailLocator(null)).toBeNull()
    expect(parseThumbnailLocator(undefined)).toBeNull()
    expect(parseThumbnailLocator('')).toBeNull()
    expect(parseThumbnailLocator('#a1b2c3')).toBeNull()
  })

  it('returns null without a usable stage', () => {
    expect(parseThumbnailLocator(`s3://${BUCKET}/thumbnails/${ITEM}.webp`)).toBeNull()
    expect(parseThumbnailLocator(LOCATOR.replace('v=2', 'v=1'))).toBeNull()
    expect(parseThumbnailLocator(LOCATOR.replace('v=2', 'v=9'))).toBeNull()
  })

  // The server signs whatever is stored, and its credentials reach every
  // bucket — so anything but a thumbnail key must be refused.
  it('refuses keys outside thumbnails/<itemId>.webp', () => {
    expect(parseThumbnailLocator(`s3://${BUCKET}/private/tax.pdf?v=2`)).toBeNull()
    expect(
      parseThumbnailLocator(`s3://${BUCKET}/thumbnails/${ITEM}.pdf?v=2`)
    ).toBeNull()
    expect(
      parseThumbnailLocator(`s3://${BUCKET}/thumbnails/nested/${ITEM}.webp?v=2`)
    ).toBeNull()
  })

  it('refuses path traversal in either form', () => {
    expect(
      parseThumbnailLocator(`s3://${BUCKET}/thumbnails/../private/tax.pdf?v=2`)
    ).toBeNull()
    expect(
      parseThumbnailLocator(
        `https://${BUCKET}.t3.tigrisfiles.io/thumbnails/../private/tax.pdf?v=2`
      )
    ).toBeNull()
  })

  it('refuses hosts that are not the Tigris public host', () => {
    expect(
      parseThumbnailLocator(`https://evil.example.com/thumbnails/${ITEM}.webp?v=2`)
    ).toBeNull()
    expect(
      parseThumbnailLocator(`http://${BUCKET}.t3.tigrisfiles.io/thumbnails/${ITEM}.webp?v=2`)
    ).toBeNull()
    expect(
      parseThumbnailLocator(`https://${BUCKET}.t3.tigrisfiles.io.evil.com/thumbnails/${ITEM}.webp?v=2`)
    ).toBeNull()
  })

  it('refuses a malformed bucket', () => {
    expect(parseThumbnailLocator(`s3:///thumbnails/${ITEM}.webp?v=2`)).toBeNull()
    expect(
      parseThumbnailLocator(`s3://UPPER-case/thumbnails/${ITEM}.webp?v=2`)
    ).toBeNull()
  })

  it('refuses a locator belonging to another item', () => {
    expect(parseThumbnailLocator(LOCATOR, ITEM)).not.toBeNull()
    expect(parseThumbnailLocator(LOCATOR, 'itm_other')).toBeNull()
    expect(parseThumbnailLocator(LEGACY, 'itm_other')).toBeNull()
  })
})

describe('signThumbnails (shape walk)', () => {
  // Values that never parse are returned as null without signing, so these
  // cases exercise the walk itself with no S3 credentials in play.
  it('walks nested relations and leaves other fields alone', async () => {
    const created = new Date('2026-09-18T10:00:00Z')
    const input = {
      id: 'itm_parent',
      name: 'photo.png',
      createdAt: created,
      size: 10n,
      thumbnails: [{ url: 'not-a-locator', stage: 2 }],
      parent: {
        id: 'itm_grandparent',
        thumbnails: [{ url: 'also-not-a-locator', stage: 2 }],
      },
      children: [
        { id: 'itm_child', thumbnails: [{ url: '#a1b2c3', stage: 0 }] },
      ],
    }

    const out = await signThumbnails(input)

    expect(out.thumbnails[0].url).toBeNull()
    expect(out.parent.thumbnails[0].url).toBeNull()
    // Placeholders survive — consumers filter them themselves.
    expect(out.children[0].thumbnails[0].url).toBe('#a1b2c3')
    // Everything else is untouched, including non-plain values.
    expect(out.name).toBe('photo.png')
    expect(out.size).toBe(10n)
    expect(out.createdAt).toBe(created)
    expect(out.thumbnails[0].stage).toBe(2)
  })

  it('passes null and empty collections through', async () => {
    const input = { id: 'itm_a', thumbnails: [], parent: null }
    expect(await signThumbnails(input)).toEqual(input)
  })

  it('handles arrays of rows', async () => {
    const out = await signThumbnails([
      { id: 'itm_a', thumbnails: [{ url: 'nope' }] },
      { id: 'itm_b', thumbnails: [] },
    ])
    expect(out[0].thumbnails[0].url).toBeNull()
    expect(out[1].thumbnails).toEqual([])
  })
})
