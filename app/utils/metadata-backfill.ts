/**
 * Reads the metadata of an already-uploaded video or audio file from storage,
 * for files whose upload-time metadata step never ran.
 *
 * A video is read from its header, not downloaded: the first
 * {@link HEAD_BYTES} for the browser's own measurement and the container
 * reader, plus (MP4 without faststart) the one `moov` range. An audio file is
 * read whole, because its length and bit rate depend on all of it.
 */
import {
  buildMediaMetadataFormData,
  extractMediaMetadata,
  hasMetadataToSave,
  mergeVideoMetadata,
  type MediaMetadata,
} from '@/utils/media-metadata'
import {
  HEAD_BYTES,
  readVideoContainer,
  type ByteSource,
} from '@/utils/video-container'
import { getVideoMetadata } from '@/utils/video'
import type { MetadataBackfillCandidate } from '@/types/api.types'

/** Per request and per read, so one stalled transfer cannot hold the run. */
export const BACKFILL_STEP_TIMEOUT_MS = 20_000

/** Candidates asked for per request. */
export const METADATA_BACKFILL_BATCH = 20

/** Requests per page load; a larger backlog continues on the next visit. */
export const METADATA_BACKFILL_MAX_BATCHES = 5

export type { MetadataBackfillCandidate }

/**
 * A `ByteSource` over a signed URL. The first `head` bytes are served from
 * memory (already read for the browser's measurement); anything else is one
 * ranged request.
 *
 * @example
 * const source = rangedSource(url, size, headBytes)
 * const moov = await source.read(offset, offset + length)
 */
export function rangedSource(
  url: string,
  size: number,
  head: Uint8Array = new Uint8Array(0),
  timeoutMs = BACKFILL_STEP_TIMEOUT_MS
): ByteSource {
  return {
    size,
    read: async (start, end) => {
      if (end <= head.length) return head.subarray(start, end)
      const res = await fetch(url, {
        headers: { Range: `bytes=${start}-${end - 1}` },
        signal: AbortSignal.timeout(timeoutMs),
      })
      // 206 is the range; a 200 means the whole object came back instead.
      if (res.status !== 206 && res.status !== 200) {
        throw new Error(`range read failed: ${res.status}`)
      }
      const bytes = new Uint8Array(await res.arrayBuffer())
      return res.status === 206 ? bytes : bytes.subarray(start, end)
    },
  }
}

/** Rejects after `ms`, so a media element that never answers can't hold the run. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out')), ms)
    ),
  ])
}

/**
 * Metadata for one candidate, read from storage.
 *
 * @returns What was read; `{}` when nothing could be (an undecodable file with
 *   no readable header), which the caller must not save.
 */
export async function readBackfillMetadata(
  candidate: MetadataBackfillCandidate
): Promise<MediaMetadata> {
  if (candidate.kind === 'audio') {
    const res = await fetch(candidate.url, {
      signal: AbortSignal.timeout(BACKFILL_STEP_TIMEOUT_MS * 3),
    })
    if (!res.ok) throw new Error(`download failed: ${res.status}`)
    const file = new File([await res.blob()], candidate.name, {
      type: candidate.mimeType,
    })
    return extractMediaMetadata(file)
  }

  const head = await rangedSource(candidate.url, candidate.size).read(
    0,
    Math.min(candidate.size, HEAD_BYTES)
  )
  const headFile = new File([head as BlobPart], candidate.name, {
    type: candidate.mimeType,
  })
  const source = rangedSource(candidate.url, candidate.size, head)
  const [browser, container] = await Promise.all([
    withTimeout(getVideoMetadata(headFile), BACKFILL_STEP_TIMEOUT_MS).catch(
      () => null
    ),
    readVideoContainer(source).catch(() => null),
  ])
  // The browser saw only the head, but its size and length come from the
  // container header, so they describe the whole file.
  return mergeVideoMetadata(browser, container, candidate.size)
}

/**
 * Saves one candidate's metadata through `save_media_metadata`.
 *
 * @returns true when a facet was saved; false when there was nothing to save.
 * @throws On a non-2xx answer.
 */
export async function saveBackfillMetadata(
  itemId: string,
  meta: MediaMetadata,
  signal?: AbortSignal
): Promise<boolean> {
  if (!hasMetadataToSave(meta)) return false
  const res = await fetch('/api/items', {
    method: 'POST',
    body: buildMediaMetadataFormData(itemId, meta),
    signal,
  })
  if (!res.ok) throw new Error(`save_media_metadata failed: ${res.status}`)
  return true
}
