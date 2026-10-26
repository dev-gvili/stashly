import { describe, expect, it } from 'vitest'
import {
  buildMediaMetadataFormData,
  hasMetadataToSave,
  type MediaMetadata,
} from '@/utils/media-metadata'

/**
 * `hasMetadataToSave` decides whether the indexing machine posts
 * `save_media_metadata` at all (tech-debt item 40). It must never say "nothing"
 * for a form that would have carried a field, or that field is silently lost.
 */
const CASES: [string, MediaMetadata][] = [
  ['nothing read (a zip)', {}],
  ['only the client-only flag', { needsOcr: false }],
  ['a scanned PDF flag alone', { needsOcr: true }],
  ['a key left undefined', { imageWidth: undefined }],
  ['image dimensions', { imageWidth: 800, imageHeight: 600 }],
  ['a zero', { audioDuration: 0 }],
  ['a false flag', { pdfIsEncrypted: false }],
  ['text only', { documentText: 'hello' }],
]

/** Fields the form carries beyond `intent` and `itemId`. */
const formFields = (meta: MediaMetadata) =>
  [...buildMediaMetadataFormData('item_1', meta).keys()].filter(
    (k) => k !== 'intent' && k !== 'itemId'
  )

describe('hasMetadataToSave', () => {
  it.each(CASES)('agrees with the form for %s', (_, meta) => {
    expect(hasMetadataToSave(meta)).toBe(formFields(meta).length > 0)
  })

  it('says nothing for a zip, something for an image', () => {
    expect(hasMetadataToSave({})).toBe(false)
    expect(hasMetadataToSave({ needsOcr: false })).toBe(false)
    expect(hasMetadataToSave({ imageWidth: 800 })).toBe(true)
  })
})
