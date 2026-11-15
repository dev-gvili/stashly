import { describe, expect, it } from 'vitest'
import {
  buildMediaMetadataFormData,
  hasMetadataToSave,
  mergeVideoMetadata,
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

describe('mergeVideoMetadata', () => {
  const browser = { width: 1280, height: 720, duration: 100 }
  const header = {
    container: 'matroska',
    width: 1280,
    height: 720,
    duration: 100.2,
    codec: 'av1',
    frameRate: 24,
    audioFormat: 'opus',
    audioChannels: 2,
    audioSamplesPerSecond: 48000,
  }

  it('takes size and length from the browser and the rest from the header', () => {
    expect(mergeVideoMetadata(browser, header, 12_500_000)).toEqual({
      videoWidth: 1280,
      videoHeight: 720,
      duration: 100,
      frameRate: 24,
      videoCodec: 'av1',
      videoContainer: 'matroska',
      videoAudioFormat: 'opus',
      videoAudioChannels: 2,
      videoAudioSampleRate: 48000,
      videoBitrate: 1_000_000,
    })
  })

  it('falls back to the header when the browser cannot decode the file', () => {
    const meta = mergeVideoMetadata(null, { ...header, codec: 'hevc' }, 12_500_000)
    expect(meta).toMatchObject({
      videoWidth: 1280,
      duration: 100.2,
      videoCodec: 'hevc',
    })
  })

  it('says nothing when neither source knows anything', () => {
    expect(mergeVideoMetadata(null, null, 1000)).toEqual({})
  })

  it('ignores an infinite duration and then states no bit rate', () => {
    const meta = mergeVideoMetadata({ ...browser, duration: Infinity }, null, 1000)
    expect(meta).toEqual({ videoWidth: 1280, videoHeight: 720 })
  })
})

describe('the video fields through the real request parser', () => {
  it('reaches saveMediaMetadata unchanged, including text that looks like a number', async () => {
    const { parseFormData } = await import('@/utils/parsers')
    const { itemsApiRouteInput } = await import('@/schemas/api.schemas')
    const meta: MediaMetadata = {
      videoWidth: 1280,
      videoHeight: 720,
      duration: 214.161,
      frameRate: 23.976,
      videoCodec: 'av1',
      videoContainer: 'matroska',
      videoFourCC: '2024',
      videoBitrate: 1_090_000,
      videoAudioFormat: 'opus',
      videoAudioChannels: 2,
      videoAudioSampleRate: 48000,
      videoAudioBitDepth: 16,
    }
    const body = buildMediaMetadataFormData('item_1', meta)
    const request = new Request('http://localhost/api/items', { method: 'POST', body })
    const parsed = await parseFormData({ request, schema: itemsApiRouteInput })
    expect(parsed).toMatchObject({ intent: 'save_media_metadata', ...meta })
  })
})
