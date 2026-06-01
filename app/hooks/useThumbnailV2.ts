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

const POLL_MS = 16

function waitForIdle(
  fetcherRef: { current: { state: 'idle' | 'loading' | 'submitting' } },
  timeoutMs = 30_000,
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

export function useThumbnailV2(itemId: string) {
  const presignFetcher = useFetcher<{ uploadUrl: string; publicUrl: string }>()
  const metadataFetcher = useFetcher<{ chunks?: { id: string; ord: number; content: string }[] }>()
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
      }

      let stage1ObjectUrl: string | null = null
      if (tinyBlob) {
        stage1ObjectUrl = URL.createObjectURL(tinyBlob)
        publisher.publishLocal({ src: stage1ObjectUrl })
      }

      // ── Stage 2: resize + persist ───────────────────────────────────────
      const resized = await generateStage2Resize(file, tinyBlob).catch((e) => {
        console.error('[thumb stage 2 compute]', e)
        return null
      })
      if (!resized) return

      presignRef.current.load(`/api/thumbnails/${itemId}/presign`)
      await waitForIdle(presignRef).catch(() => null)
      const presign = presignRef.current.data
      if (!presign?.uploadUrl || !presign?.publicUrl) {
        console.error('[thumbnail] presign missing uploadUrl/publicUrl', itemId)
        return
      }

      const put2Ok = await putThumbnailToS3(presign.uploadUrl, resized.blob, itemId, 2)
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

      // Metadata + indexing run independently in the background.
      void runMetadataPipeline(itemId, file, metadataFetcher, metadataRef, embeddingFetcher, embeddingRef)

      // ── Stage 3: salient crop (images only) ─────────────────────────────
      const salient = await generateStage3Salient(file)
      if (!salient) return

      const put3Ok = await putThumbnailToS3(presign.uploadUrl, salient, itemId, 3)
      if (!put3Ok) return

      const stage3Url = makeStageUrl(presign.publicUrl, 3)
      publisher.publishPersisted({ stage: 3, src: stage3Url, width: 512, height: 512 })
    },
    [itemId, publisher, metadataFetcher, embeddingFetcher],
  )

  return { run }
}

async function runMetadataPipeline(
  itemId: string,
  file: File,
  metadataFetcher: {
    submit: (data: FormData, opts: { method: 'post'; action: string }) => void
  },
  metadataRef: { current: { state: 'idle' | 'loading' | 'submitting'; data: unknown } },
  embeddingFetcher: {
    submit: (data: FormData, opts: { method: 'post'; action: string }) => void
  },
  embeddingRef: { current: { state: 'idle' | 'loading' | 'submitting'; data: unknown } },
) {
  try {
    const meta = await extractMediaMetadata(file)
    const fd = buildMediaMetadataFormData(itemId, meta)
    metadataFetcher.submit(fd, { method: 'post', action: '/api/items' })
    await waitForIdle(metadataRef).catch(() => null)

    const data = metadataRef.current.data as
      | { chunks?: { id: string; content: string }[] }
      | undefined
    const chunks = data?.chunks ?? []
    if (chunks.length === 0) return

    const { embedTexts } = await import('@/workers/embedding.ai')
    const vectors = await embedTexts(chunks.map((c) => c.content))
    if (vectors.length !== chunks.length) {
      console.error('[embed chunks] vector count mismatch', vectors.length, chunks.length)
      return
    }
    const payload = chunks.map((c, i) => ({ chunkId: c.id, vector: vectors[i] }))
    const efd = new FormData()
    efd.append('intent', 'save_search_chunk_embeddings')
    efd.append('embeddings', JSON.stringify(payload))
    embeddingFetcher.submit(efd, { method: 'post', action: '/api/items' })
    await waitForIdle(embeddingRef).catch(() => null)
  } catch (e) {
    console.error('[runMetadataPipeline]', e)
  }
}
