import { describe, expect, it } from 'vitest'
import { classifyObject, thumbnailItemId } from '../s3-orphans'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-10-01T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY)
const refs = {
  fileKeys: new Set(['fld_1/report.pdf']),
  liveItemIds: new Set(['item_live']),
}

describe('thumbnailItemId', () => {
  it('reads the item id from a thumbnail key', () => {
    expect(thumbnailItemId('thumbnails/item_abc.webp')).toBe('item_abc')
  })
  it('returns null for a file key, even one that mentions thumbnails', () => {
    expect(thumbnailItemId('fld_1/thumbnails/item_abc.webp')).toBeNull()
    expect(thumbnailItemId('fld_1/report.pdf')).toBeNull()
  })
})

describe('classifyObject', () => {
  it('keeps a file a File row points at', () => {
    expect(classifyObject({ key: 'fld_1/report.pdf', lastModified: daysAgo(30) }, refs, now, DAY)).toBe('referenced')
  })

  it('keeps the thumbnail of an item that still exists', () => {
    expect(classifyObject({ key: 'thumbnails/item_live.webp', lastModified: daysAgo(30) }, refs, now, DAY)).toBe('referenced')
  })

  it('flags an old file nothing references', () => {
    expect(classifyObject({ key: 'fld_gone/old.pdf', lastModified: daysAgo(3) }, refs, now, DAY)).toBe('orphan-file')
  })

  it('flags an old thumbnail whose item is gone', () => {
    expect(classifyObject({ key: 'thumbnails/item_gone.webp', lastModified: daysAgo(3) }, refs, now, DAY)).toBe('orphan-thumbnail')
  })

  it('keeps an unreferenced object younger than the age floor — likely an upload in flight', () => {
    expect(classifyObject({ key: 'fld_1/uploading.mov', lastModified: new Date(now.getTime() - 60_000) }, refs, now, DAY)).toBe('too-young')
  })

  it('never deletes a referenced object, however old', () => {
    expect(classifyObject({ key: 'fld_1/report.pdf', lastModified: daysAgo(3650) }, refs, now, DAY)).toBe('referenced')
  })
})
