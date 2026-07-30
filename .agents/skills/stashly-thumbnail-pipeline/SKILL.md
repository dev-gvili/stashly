---
name: stashly-thumbnail-pipeline
description: Stashly client-side 3-stage WebP thumbnail pipeline — useThumbnailV2, thumbnail-signal architecture, the compute worker, PDF.js OffscreenCanvas handling, presign/PUT/PATCH flow, and gallery thumbnail queries. Load when working on thumbnails, previews, the upload thumbnail runner, or Web Workers.
---

# Stashly Thumbnail Pipeline

Client-side 3-stage progressive generation. All output is **WebP**. Entry point: `app/hooks/useThumbnailV2.ts` — a thin orchestrator that composes pure helpers from `@/utils/thumbnail-pipeline` (`generateStage1Preview`, `generateStage2Resize`, `generateStage3Salient`, `putThumbnailToS3`, `makeStageUrl`) and a swappable broadcast channel from `@/hooks/thumbnail-signal`. Spawned per-file by `app/components/upload/upload-thumbnail-runner.tsx`, which keys the component on `mediaFile.id` so each upload gets its own hook instance.

**Stage 0 (hex color) was removed in V2** — every consumer already filters `url.startsWith('#')`, so writing it to the DB was pure waste. The pipeline now starts at stage 1.

**Gate**: pipeline starts only after `status === 'itemCreated'` (not `'done'`). `upload-thumbnail-runner.tsx` watches for `itemCreated` and calls `runThumbnail(file)`. A module-level `thumbnailedIds = new Set<string>()` (shared across hook instances) ensures the pipeline fires exactly once per file.

## On-demand backfill (items that never got a thumbnail)

Upload-time generation only ever runs from the upload queue, where the original `File` is in memory. When it fails (compute timeout, tab closed mid-run, a deeply-nested file in a huge batch), the item shows the category icon forever. `app/hooks/useThumbnailBackfill.ts` closes that gap: it re-downloads the original and runs **stage 2 only** (stage 3's ViT crop is the most expensive stage and buys the least here).

Wired into `ItemCard.Thumbnail` and `ItemCard.Cover` roots via a callback ref — every grid view gets it for free. **Memoize any composed ref** (`composeRefs` in `item-card.tsx`): a fresh callback each render detaches and re-attaches the observer every re-render.

The guards *are* the feature — a backfill costs a full download, so:

| Guard | Where |
|-------|-------|
| Viewport-gated (one shared `IntersectionObserver`, `rootMargin: 300px`) | `useThumbnailBackfill.ts` |
| LIFO queue — newest request runs first, so fast scrolling favours where you stopped | `queue.pop()` in `drain()` |
| `MAX_CONCURRENT = 2`, jobs started inside `requestIdleCallback` | `drain()` / `whenIdle()` |
| Yields to uploads — `pauseBackfill()`/`resumeBackfill()` called by `upload-thumbnail-runner.tsx` | exported from the hook |
| Attempted once — in-memory `Set` + `sessionStorage` skip list for permanent failures | `rememberFailure()` |
| Type/size eligibility, Data-Saver and 2g opt-out | `app/utils/thumbnail-backfill.ts` (pure, unit-tested) |

`GET /api/thumbnails/:itemId/source` (→ `getThumbnailSource` in `thumbnail-actions.ts`) presigns a 5-minute GET on the original. It re-checks read permission and the 16 MB `BACKFILL_MAX_BYTES` cap server-side, and returns `{ status: 'exists', url }` when another client already backfilled the item — the client paints that instead of downloading again. **Keep the client and server caps in sync** or the client burns a round trip discovering the server said no.

A card that unmounts mid-job (route change) lets the in-flight job finish and persists via a plain `fetch` PATCH rather than the keyed fetcher; only *queued* jobs are dropped.

## Signal architecture

`app/hooks/thumbnail-signal/`: three interchangeable implementations behind a single `ACTIVE_SIGNAL` constant in `index.ts`. Both producer (`useThumbnailPublisher`) and consumer (`useLiveThumbnail`) import from the index, so flipping the constant changes both sides atomically. Implementations: `signal-store.ts` (module-store + `useSyncExternalStore`), `signal-fetcher.ts` (keyed `useFetcher`), `signal-xstate.ts` (actor).

**Currently chosen: `'fetcher'`** (`signal-fetcher.ts`). Producer and consumer both call `useFetcher({ key: 'thumb:<itemId>' })`. Stages 2/3 ride the fetcher itself: producer submits the PATCH via `patchFetcher.submit(fd, { method: 'patch', action: '/api/thumbnails/:id' })`; consumer reads `fetcher.formData?.get('url')` for the optimistic value (available immediately on submit) and `fetcher.data?.url` after the PATCH lands. React Router retains keyed-fetcher state globally, so the consumer sees the latest stage across mount/unmount of any single ItemCard. Stage 1 (local blob URL, no HTTP) rides a tiny side `Map<id, {src}>` with `useSyncExternalStore` subscribers — only what can't go through a fetcher uses the side channel.

## Stages

| Stage | What | Mechanism |
|-------|------|-----------|
| 1 | 8×8 blur preview | Image: `extractTinyThumbnail` · Video: `generateVideoThumbnail` · PDF: `generatePdfThumbnail` (from `@/utils/pdf`) · Text: `generateTextThumbnail` (from `@/utils/text-thumbnail`) — **local `URL.createObjectURL` only, NOT persisted to S3 or DB** |
| 2 | 512px resize | Image: `canvasResize(file, 512)` · Video: re-encode frame · PDF: `renderPdfPageToBlob(file, 512)` · Text: `renderTextPageToBlob(file, 512)` → presign → PUT to S3, URL written as `${publicUrl}?v=2` |
| 3 | ViT saliency crop | AI worker (`thumbnail.ai.ts`) — **images only**, URL written as `${publicUrl}?v=3` |

**Cache-bust query param**: stages 2/3 share the same S3 key, so the URL written to `Thumbnail.url` includes `?v={stage}`. Without this, browser cache (`Cache-Control: max-age=3600` on the S3 object) keeps showing the prior stage even after the object is overwritten.

**S3 client config**: `app/.server/s3.ts` sets `requestChecksumCalculation: 'WHEN_REQUIRED'` on `S3Client`. Without this, AWS SDK v3 signs a CRC32 checksum requirement (`x-amz-checksum-crc32=AAAAAA==`, CRC32 of empty body) into presigned `PutObject` URLs, causing browser PUTs to fail with a checksum mismatch.

PDFs and text-based files stop after stage 2. The PDF.js worker URL is set globally on import in `app/utils/pdf.ts` via `pdfjs-dist/build/pdf.worker.min.mjs?url`.

**Text thumbnails**: `app/utils/text-thumbnail.ts` "screenshots" the first ~32 KB of a text-based file (plain text, markdown, code, config) onto an A4-proportioned white page via OffscreenCanvas — sans-serif for prose extensions, monospace for code/config (extension wins over mime because code files often arrive as `text/plain`/`application/octet-stream`). Detection is `isTextRenderableFile`; compute-worker RPC kinds are `tinyText`/`resizeText`. Empty files return null — no thumbnail beats a blank page. Line layout (`layoutTextLines`) is pure and unit-tested in `app/utils/__tests__/text-thumbnail.test.ts`.

## Compute worker

Heavy thumbnail compute (PDF.js parsing, canvas resize, image decoding, PDF text extraction) runs in a singleton dedicated worker at `app/workers/thumbnail.compute.worker.ts` with an internal concurrency cap of **1** and a 30-second per-op timeout. The pipeline helpers in `@/utils/thumbnail-pipeline` dispatch RPC requests via `compute({ kind, file })`; `useThumbnailV2` handles HTTP + React state on main. Video thumbnails stay on main because they require `<video>` DOM access. Stage 3 (image AI) also stays on main — it calls into `app/workers/thumbnail.ai.ts`, which is a regular module using WebGPU (not a Worker — the file location is historical).

The cap is 1 because PDF.js inside a dedicated worker falls back to **fake worker mode** (it can't spawn a sub-worker reliably from inside another worker). In fake-worker mode, multiple concurrent PDF operations terminate each other's tasks ("Worker task was terminated" warnings) — serializing is safer than the throughput win.

**OffscreenCanvas**: `app/utils/thumbnail.ts` and `app/utils/pdf.ts` use `OffscreenCanvas` rather than `document.createElement('canvas')` so they work in both main and worker contexts. `extractTinyThumbnail` and `generatePdfThumbnail` return `Blob` (not data URL).

**PDF.js `OffscreenCanvasFactory`**: passing our own `OffscreenCanvas` as the *target* of `page.render()` is not enough — PDF.js's default `DOMCanvasFactory` calls `document.createElement('canvas')` for **internal auxiliary canvases** (subpixel-AA font detection, intermediate image-scaling buffers). In a worker, `document` is undefined and rendering crashes silently with `Cannot read properties of undefined (reading 'createElement')`. `app/utils/pdf.ts` defines a custom `OffscreenCanvasFactory` (`{ create, reset, destroy }`) and passes it via `getDocument({ CanvasFactory: OffscreenCanvasFactory })` only when `typeof document === 'undefined'`. In a normal page context the default `DOMCanvasFactory` is used. Without this, simple PDFs render fine but anything with text + AA or images blows up — the user-visible symptom was "stage 0 only".

**PDF.js verbosity**: `pdfjs.getDocument(...)` calls pass `verbosity: 0` (errors only) to silence the high-frequency `"Worker task was terminated"` warnings PDF.js emits on every `doc.destroy()` in fake-worker mode. They are non-fatal (PDF.js logs them with "ignoring errors") but spam the console.

## Presign → PUT → PATCH pattern (stages 1–4)

1. `GET /api/thumbnails/:itemId/presign` → `{ uploadUrl, publicUrl }`
2. `PUT blob` to S3 `uploadUrl` with `Content-Type: image/webp`
3. `PATCH /api/thumbnails/:itemId` with `{ stage, url, width, height }`

**S3 key**: `thumbnails/{itemId}.webp` — one file per item, overwritten as stages improve. `publicUrl = https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp`.

## Gallery query

Always exclude hex-color stage-0 placeholders from both the item filter and the thumbnail select:
```typescript
// where (items must have a real thumbnail)
thumbnails: { some: { url: { not: null }, NOT: { url: { startsWith: '#' } } } }
// select (best thumbnail per item)
thumbnails: { take: 1, where: { NOT: { url: { startsWith: '#' } } } }
```

**Thumbnail utils** (`app/utils/thumbnail.ts`): `hashToColor`, `extractTinyThumbnail`, `canvasResize`, `dataUrlToBlob`. For video thumbnails: `generateVideoThumbnail(file)` from `app/utils/video.ts`.

## Web Workers (general)

CPU-intensive work runs off the main thread in `app/workers/`:
- `stash.worker.ts` — language detection and tokenization for stash items
- `stash.ai.ts` — AI inference helpers for the stash worker
- `thumbnail.ai.ts` — thumbnail generation AI worker

Workers are loaded via `new Worker(new URL('./workers/...', import.meta.url))`. Type augmentations for third-party worker APIs live in `app/types/tokenizers-augment.d.ts`.
