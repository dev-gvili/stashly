/**
 * Thin orchestrator for the progressive thumbnail pipeline.
 *
 * Composes pure helpers from `@/utils/thumbnail-pipeline`, route-fetcher
 * HTTP calls, and a swappable broadcast channel from
 * `@/hooks/thumbnail-signal` (store / fetcher / xstate).
 *
 * Pipeline:
 *   1. local blob preview          → publishLocal
 *   2. resize 512 → S3 PUT → PATCH → publishPersisted(2)
 *   3. salient crop → S3 PUT → PATCH → publishPersisted(3)  [images only]
 *
 * Metadata + chunk embedding fire-and-forget after stage 2.
 *
 * Stage 0 (hex color) is gone — every consumer filters `url.startsWith('#')`,
 * so writing it to the DB was pure waste.
 */
import { useCallback, useRef } from 'react'
import { useFetcher } from 'react-router'
import {
  generateStage1Preview,
  generateStage2Resize,
  generateStage3Salient,
  putThumbnailToS3,
  makeStageUrl,
  extractMediaMetadata,
  buildMediaMetadataFormData,
} from '@/utils/thumbnail-pipeline'
import { useThumbnailPublisher } from '@/hooks/thumbnail-signal'
import { classifyDegradation, reportDegraded } from '@/utils/report-degraded'

const POLL_MS = 16

/**
 * Waits for a React Router fetcher to complete a round trip. Polls a *ref* to
 * the fetcher, not the render-captured value, because the pipeline runs inside
 * one long-lived async callback that would otherwise hold a stale snapshot
 * forever. Resolves only after the fetcher has been seen non-idle and then idle
 * again, so a call made before the submit lands can't resolve instantly.
 *
 * @param fetcherRef - Ref whose `.current.state` tracks the live fetcher.
 * @param timeoutMs - Give up after this long (default 30s), rejecting.
 *
 * @example
 * // Wait for a presign GET before reading its data
 * presignRef.current.load(`/api/thumbnails/${itemId}/presign`)
 * await waitForIdle(presignRef).catch(() => null)
 *
 * @example
 * // Shorter bound for a small PATCH
 * await waitForIdle(metadataRef, 5_000)
 */
function waitForIdle(
  fetcherRef: { current: { state: 'idle' | 'loading' | 'submitting' } },
  timeoutMs = 30_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    let sawNonIdle = false
    const tick = () => {
      const state = fetcherRef.current.state
      if (Date.now() - start > timeoutMs) {
        reject(new Error('fetcher wait timeout'))
        return
      }
      if (state !== 'idle') sawNonIdle = true
      if (sawNonIdle && state === 'idle') {
        resolve()
        return
      }
      setTimeout(tick, POLL_MS)
    }
    tick()
  })
}

/**
 * Runs the progressive thumbnail pipeline for one item, from the upload path
 * where the original `File` is still in memory. Each stage publishes as soon as
 * it lands, so the card paints a local preview immediately and sharpens twice
 * afterwards; a stage that fails leaves the previous one on screen. Media
 * metadata, search chunks, and OCR fire alongside stage 2 and run for every file
 * type, thumbnail or not.
 *
 * @param itemId - The created item's ID, used for the presign, PUT and PATCH routes.
 *
 * @example
 * // Kick the pipeline once the item row exists
 * const { run } = useThumbnail(itemId)
 * useEffect(() => { void run(file) }, [itemId])
 *
 * @example
 * // In the upload thumbnail runner — one hook instance per queued file
 * function ThumbnailRunner({ itemId, file }: { itemId: string; file: File }) {
 *   const { run } = useThumbnail(itemId)
 *   useEffect(() => { void run(file) }, [run, file])
 *   return null
 * }
 *
 * @example
 * // `run` resolves when the pipeline stops — including on an early bail-out
 * await run(file)
 */
export function useThumbnail(itemId: string) {
  const presignFetcher = useFetcher<{ uploadUrl: string; publicUrl: string }>()
  const metadataFetcher = useFetcher<{
    chunks?: { id: string; ord: number; content: string }[]
  }>()
  const embeddingFetcher = useFetcher()

  const presignRef = useRef(presignFetcher)
  const metadataRef = useRef(metadataFetcher)
  const embeddingRef = useRef(embeddingFetcher)
  presignRef.current = presignFetcher
  metadataRef.current = metadataFetcher
  embeddingRef.current = embeddingFetcher

  const publisher = useThumbnailPublisher(itemId)

  const run = useCallback(
    async (file: File) => {
      // ── Stage 1: local preview ──────────────────────────────────────────
      let tinyBlob: Blob | null = null
      try {
        tinyBlob = await generateStage1Preview(file)
      } catch (err) {
        console.error('[thumb stage 1]', err)
        reportDegraded('thumbnail_stage1', classifyDegradation(err))
      }

      let stage1ObjectUrl: string | null = null
      if (tinyBlob) {
        stage1ObjectUrl = URL.createObjectURL(tinyBlob)
        publisher.publishLocal({ src: stage1ObjectUrl })
      }

      // ── Stage 2: resize + persist ───────────────────────────────────────
      const resized = await generateStage2Resize(file, tinyBlob).catch((e) => {
        console.error('[thumb stage 2 compute]', e)
        reportDegraded('thumbnail_stage2', classifyDegradation(e))
        return null
      })

      // Metadata + indexing run for all file types regardless of thumbnail availability.
      void runMetadataPipeline(
        itemId,
        file,
        metadataFetcher,
        metadataRef,
        embeddingFetcher,
        embeddingRef
      )

      if (!resized) return

      presignRef.current.load(`/api/thumbnails/${itemId}/presign`)
      await waitForIdle(presignRef).catch(() => null)
      const presign = presignRef.current.data
      if (!presign?.uploadUrl || !presign?.publicUrl) {
        console.error('[thumbnail] presign missing uploadUrl/publicUrl', itemId)
        return
      }

      const put2Ok = await putThumbnailToS3(
        presign.uploadUrl,
        resized.blob,
        itemId,
        2
      )
      if (!put2Ok) return

      const stage2Url = makeStageUrl(presign.publicUrl, 2)
      publisher.publishPersisted({
        stage: 2,
        src: stage2Url,
        width: resized.width,
        height: resized.height,
      })

      if (stage1ObjectUrl) {
        URL.revokeObjectURL(stage1ObjectUrl)
        stage1ObjectUrl = null
      }

      // ── Stage 3: salient crop (images only) ─────────────────────────────
      const salient = await generateStage3Salient(file)
      if (!salient) return

      const put3Ok = await putThumbnailToS3(
        presign.uploadUrl,
        salient,
        itemId,
        3
      )
      if (!put3Ok) return

      const stage3Url = makeStageUrl(presign.publicUrl, 3)
      publisher.publishPersisted({
        stage: 3,
        src: stage3Url,
        width: 512,
        height: 512,
      })
    },
    [itemId, publisher, metadataFetcher, embeddingFetcher]
  )

  return { run }
}

/**
 * Extracts media metadata, persists it, and indexes whatever text the file
 * yields — then, for PDFs that need it, runs OCR as a second pass.
 *
 * Deliberately independent of the thumbnail result: a file with no renderable
 * preview still has page counts, EXIF and searchable content worth saving. The
 * OCR pass runs *after* the metadata POST rather than inside it, because OCR is
 * minutes of work and would otherwise hold the facets hostage — and lose
 * everything if the tab closed. Failures are reported as degradations, never
 * thrown, since this leg is why a document can end up with chunk text but no
 * vector.
 *
 * @param itemId - Item being indexed.
 * @param file - The original file, still in memory from the upload.
 * @param metadataFetcher - Fetcher used to POST metadata and OCR pages.
 * @param metadataRef - Ref to the same fetcher, for {@link waitForIdle}.
 * @param embeddingFetcher - Fetcher used to write chunk vectors back.
 * @param embeddingRef - Ref to the embedding fetcher, for {@link waitForIdle}.
 *
 * @example
 * // Fire alongside stage 2 — never awaited by the thumbnail path
 * void runMetadataPipeline(itemId, file, metadataFetcher, metadataRef, embeddingFetcher, embeddingRef)
 *
 * @example
 * // Runs for every file type, including ones with no thumbnail at all
 * void runMetadataPipeline(itemId, zipFile, …)
 */
async function runMetadataPipeline(
  itemId: string,
  file: File,
  metadataFetcher: {
    submit: (data: FormData, opts: { method: 'post'; action: string }) => void
  },
  metadataRef: {
    current: { state: 'idle' | 'loading' | 'submitting'; data: unknown }
  },
  embeddingFetcher: {
    submit: (data: FormData, opts: { method: 'post'; action: string }) => void
  },
  embeddingRef: {
    current: { state: 'idle' | 'loading' | 'submitting'; data: unknown }
  }
) {
  try {
    const meta = await extractMediaMetadata(file)
    const fd = buildMediaMetadataFormData(itemId, meta)
    metadataFetcher.submit(fd, { method: 'post', action: '/api/items' })
    await waitForIdle(metadataRef).catch(() => null)

    const data = metadataRef.current.data as
      | { chunks?: { id: string; content: string }[] }
      | undefined
    await embedAndSaveChunks(data?.chunks ?? [], embeddingFetcher, embeddingRef)

    // ── OCR second pass ────────────────────────────────────────────────────
    // Deliberately after the metadata POST, not inside `extractMediaMetadata`.
    // OCR is minutes of work; running it inline would hold the facet, page
    // count and search content hostage for the whole run and lose everything
    // if the tab closed. Now the item is fully saved first and the recovered
    // text is a strict improvement layered on top.
    if (meta.needsOcr) {
      const { streamOcrPdf } = await import('@/utils/thumbnail-pipeline')

      // Each page is persisted and embedded the moment it is transcribed, so
      // closing the tab mid-run keeps every page finished so far instead of
      // discarding the whole document. Nothing accumulates across pages.
      const totalChars = await streamOcrPdf(file, async (page) => {
        const ofd = new FormData()
        ofd.append('intent', 'save_ocr_page')
        ofd.append('itemId', itemId)
        ofd.append('pageNum', String(page.pageNum))
        ofd.append('text', page.text)
        metadataFetcher.submit(ofd, { method: 'post', action: '/api/items' })
        await waitForIdle(metadataRef).catch(() => null)

        const pageData = metadataRef.current.data as
          | { chunks?: { id: string; content: string }[] }
          | undefined
        await embedAndSaveChunks(
          pageData?.chunks ?? [],
          embeddingFetcher,
          embeddingRef
        )
      })

      if (totalChars > 0) {
        console.info(
          `[ocr] indexed ${totalChars} recovered chars for ${itemId}`
        )
      }
    }
  } catch (e) {
    console.error('[runMetadataPipeline]', e)
    // Covers the embedding leg too: a failure here is why a document can end
    // up with chunk text but no vector, so it must not stay invisible.
    reportDegraded('metadata_pipeline', classifyDegradation(e))
  }
}

/**
 * Embed freshly-created chunks and write the vectors back.
 *
 * Shared by the initial metadata pass and the OCR second pass — both produce
 * the same `{ id, content }[]` and need identical handling, and duplicating it
 * is how the two paths drift. Vectors are matched to chunks by index, so a count
 * mismatch aborts the write rather than saving misaligned vectors.
 *
 * @param chunks - Freshly created chunks to embed; an empty array is a no-op.
 * @param embeddingFetcher - Fetcher used to POST the vectors back.
 * @param embeddingRef - Ref to the same fetcher, for {@link waitForIdle}.
 *
 * @example
 * // Initial metadata pass
 * await embedAndSaveChunks(data?.chunks ?? [], embeddingFetcher, embeddingRef)
 *
 * @example
 * // OCR second pass — one call per transcribed page, so a closed tab keeps
 * // every page finished so far
 * await embedAndSaveChunks(pageData?.chunks ?? [], embeddingFetcher, embeddingRef)
 */
async function embedAndSaveChunks(
  chunks: { id: string; content: string }[],
  embeddingFetcher: {
    submit: (data: FormData, opts: { method: 'post'; action: string }) => void
  },
  embeddingRef: {
    current: { state: 'idle' | 'loading' | 'submitting'; data: unknown }
  }
) {
  if (chunks.length === 0) return

  const { embedTexts } = await import('@/workers/embedding.ai')
  const vectors = await embedTexts(chunks.map((c) => c.content))
  if (vectors.length !== chunks.length) {
    console.error(
      '[embed chunks] vector count mismatch',
      vectors.length,
      chunks.length
    )
    return
  }
  const payload = chunks.map((c, i) => ({ chunkId: c.id, vector: vectors[i] }))
  const efd = new FormData()
  efd.append('intent', 'save_search_chunk_embeddings')
  efd.append('embeddings', JSON.stringify(payload))
  embeddingFetcher.submit(efd, { method: 'post', action: '/api/items' })
  await waitForIdle(embeddingRef).catch(() => null)
}
