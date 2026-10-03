/**
 * Actors for the thumbnail item machine.
 *
 * Every one of these is a thin wrapper around a helper that already exists in
 * `@/utils/thumbnail-stages` or `@/utils/thumbnail-backfill`. No compute
 * logic lives here — this file is the seam between "what the pipeline does"
 * (unchanged, pure, unit-tested) and "when it does it" (the machine).
 *
 * **Plain `fetch`, not `useFetcher`.** A module-scope actor has no component to
 * own a React Router fetcher, so every HTTP call here is a raw `fetch`. That is
 * what deletes the 16 ms `waitForIdle` poll the hook needed to await a fetcher,
 * and it means none of these calls reload the page's data. The card repaints
 * from the manager's progress map instead.
 *
 * The search-indexing actors (metadata, embeddings, OCR) live in
 * `app/machines/indexing/indexing.actors.ts`.
 *
 * **Failure convention.** An actor *throws* when the step could plausibly
 * succeed on a retry (network blip, S3 5xx) and *resolves with null* when the
 * answer is a legitimate "there is nothing here" (a zip file has no thumbnail).
 * The machine's guards read that difference: throw → retry budget, null → done.
 */
import { fromPromise } from 'xstate'
import {
  generateStage1Preview,
  generateStage2Resize,
  generateStage3Salient,
  putThumbnailToS3,
  type ResizedThumbnail,
} from '@/utils/thumbnail-stages'

// ── Source acquisition (backfill only) ─────────────────────────────────────

interface SourceResponse {
  status: 'ready' | 'exists' | 'unsupported'
  downloadUrl?: string
  mimeType?: string | null
  name?: string
  url?: string
  stage?: 2 | 3
}

export type AcquireResult =
  /** Downloaded and ready to run the stages over. */
  | { kind: 'file'; file: File }
  /** Another client already backfilled this item — paint theirs, do no work. */
  | { kind: 'existing'; url: string; stage: 2 | 3 }
  /** Server declined (permission, size cap, unsupported type). Never retry. */
  | { kind: 'unavailable' }

/**
 * Re-downloads an item's original so a backfill has something to render.
 *
 * The server re-checks read permission and the 16 MB cap, and answers
 * `exists` when someone else won the race — which is why this returns a
 * three-way result rather than a `File | null`.
 */
export const acquireSourceActor = fromPromise<
  AcquireResult,
  { itemId: string }
>(async ({ input, signal }) => {
  const sourceRes = await fetch(`/api/thumbnails/${input.itemId}?intent=source`, {
    signal,
  })
  if (!sourceRes.ok) return { kind: 'unavailable' }

  const source = (await sourceRes
    .json()
    .catch(() => null)) as SourceResponse | null
  if (!source) return { kind: 'unavailable' }
  if (source.status === 'exists' && source.url) {
    return { kind: 'existing', url: source.url, stage: source.stage ?? 2 }
  }
  if (source.status !== 'ready' || !source.downloadUrl) {
    return { kind: 'unavailable' }
  }

  const blobRes = await fetch(source.downloadUrl, { signal })
  if (!blobRes.ok) return { kind: 'unavailable' }
  const blob = await blobRes.blob()

  return {
    kind: 'file',
    file: new File([blob], source.name ?? input.itemId, {
      // The stored mime is authoritative; S3 often serves octet-stream for code.
      type: source.mimeType || blob.type,
    }),
  }
})

// ── Compute stages ─────────────────────────────────────────────────────────

/**
 * Stage 1 — the 8×8 blur preview, local only. Resolves null for types with no
 * tiny producer; a *throw* here is non-fatal and the machine walks on to stage 2,
 * because a missing blur costs the user nothing but a slightly later first paint.
 */
export const stage1Actor = fromPromise<Blob | null, { file: File }>(
  ({ input }) => generateStage1Preview(input.file)
)

/**
 * Stage 2 — the 512 px resize that becomes the real thumbnail.
 *
 * `videoFrame` is stage 1's output: video is the one type whose stage 2 needs a
 * decoded frame rather than the original bytes.
 */
export const stage2Actor = fromPromise<
  ResizedThumbnail | null,
  { file: File; videoFrame: Blob | null }
>(({ input }) => generateStage2Resize(input.file, input.videoFrame))

/**
 * Stage 3 — the saliency crop. Images only; already serialized behind the
 * shared WebGPU queue in `ai-queue.ts`, and already reports its own degradation.
 */
export const stage3Actor = fromPromise<Blob | null, { file: File }>(
  ({ input }) => generateStage3Salient(input.file)
)

// ── Persistence ────────────────────────────────────────────────────────────

export interface Presign {
  uploadUrl: string
  /** Signed GET per persisted stage. The object is private; these expire. */
  viewUrls: Record<2 | 3, string>
}

/** Five-minute presigned PUT plus a signed GET for each stage to paint. */
export const presignActor = fromPromise<Presign, { itemId: string }>(
  async ({ input, signal }) => {
    const res = await fetch(`/api/thumbnails/${input.itemId}?intent=presign`, {
      signal,
    })
    if (!res.ok) throw new Error(`presign failed: ${res.status}`)
    const data = (await res.json()) as Partial<Presign>
    if (!data.uploadUrl || !data.viewUrls?.[2] || !data.viewUrls?.[3]) {
      throw new Error('presign missing uploadUrl/viewUrls')
    }
    return { uploadUrl: data.uploadUrl, viewUrls: data.viewUrls }
  }
)

/**
 * Uploads one stage's bytes to S3. Throws on failure so the machine's retry
 * budget applies — `putThumbnailToS3` itself only ever returns a boolean.
 */
export const putStageActor = fromPromise<
  void,
  { uploadUrl: string; blob: Blob; itemId: string; stage: 2 | 3 }
>(async ({ input }) => {
  const ok = await putThumbnailToS3(
    input.uploadUrl,
    input.blob,
    input.itemId,
    input.stage
  )
  if (!ok) throw new Error(`stage ${input.stage} PUT failed`)
})

/**
 * Points the item's `Thumbnail` row at the freshly uploaded object.
 *
 * The server derives and stores the locator itself; `url` here is only the
 * optimistic src the fetcher-signal consumer reads back from `formData` while
 * the PATCH is in flight. Stages 2 and 3 share one S3 key, so each stage has
 * its own signed URL with `v` signed in — without that the browser would keep
 * showing the previous stage from cache after the object was overwritten.
 */
export const patchThumbnailActor = fromPromise<
  void,
  { itemId: string; stage: 2 | 3; url: string; width: number; height: number }
>(async ({ input, signal }) => {
  const fd = new FormData()
  fd.append('stage', String(input.stage))
  fd.append('url', input.url)
  fd.append('width', String(input.width))
  fd.append('height', String(input.height))
  const res = await fetch(`/api/thumbnails/${input.itemId}`, {
    method: 'PATCH',
    body: fd,
    signal,
  })
  if (!res.ok) throw new Error(`thumbnail PATCH failed: ${res.status}`)
})
