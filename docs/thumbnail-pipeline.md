# Thumbnail Pipeline — Living Thumbnails

A 3-stage progressive thumbnail generation system. Each stage upgrades the thumbnail asynchronously after upload completes — from an instant local blur preview to a saliency-cropped image. All output is **WebP**.

Driven client-side. Scheduling lives in the XState manager under `app/machines/thumbnail/` (see [section 13](#13-xstate-scheduler)); the stage work itself is the pure helpers in `app/utils/thumbnail-pipeline.ts`, and stage 3's AI runs in `app/workers/thumbnail.ai.ts`. Jobs enter from `app/components/upload/upload-thumbnail-runner.tsx` on upload and from the viewport observer on backfill.

> **V1 → V2.** The original pipeline had five stages. **Stage 0** (a hex color hash written to the DB) was removed — every consumer already filtered `url.startsWith('#')`, so persisting it was pure waste. **Stage 4** (Florence-2 caption overlay) was removed too; the Florence-2 code survives only in `app/.client/stashly-ai.ts` for captioning outside the thumbnail path. `app/hooks/useThumbnail.ts` is now the V2 orchestrator — `useThumbnailV2.ts` was folded back into it (45dbcee), so the V1 hook no longer exists under any name. That hook is the *legacy* orchestration path today: reachable only when `USE_THUMBNAIL_MACHINE` is flipped off. Sections below describe V2 unless marked historical.

---

## Table of Contents

1. [Stages](#1-stages)
2. [The `itemCreated` Gate](#2-the-itemcreated-gate)
3. [Presign → PUT → PATCH Pattern](#3-presign--put--patch-pattern)
4. [S3 Storage](#4-s3-storage)
5. [API Routes](#5-api-routes)
6. [Prisma Model](#6-prisma-model)
7. [Gallery Query — Hex Placeholder Filter](#7-gallery-query--hex-placeholder-filter)
8. [Utilities](#8-utilities)
9. [Stage 4 (Caption Overlay) — Removed](#9-stage-4-caption-overlay--removed-historical)
10. [Concurrency Notes — AI Stage](#10-concurrency-notes--ai-stage)
11. [Compute Worker — Off-main-thread Pipeline](#11-compute-worker--off-main-thread-pipeline)
12. [On-demand Backfill](#12-on-demand-backfill)
13. [XState Scheduler](#13-xstate-scheduler)

---

## 1. Stages

| Stage | What it produces | Where it lives | Mechanism | Latency |
|-------|------------------|---------------|-----------|---------|
| 1 | 8×8 WebP blur preview | **Local-session `URL.createObjectURL` only — never persisted to S3 or DB** | Image: `extractTinyThumbnail(file)` · Video: `generateVideoThumbnail(file)` · PDF: `generatePdfThumbnail(file)` · Text: `generateTextThumbnail(file)` | <1s |
| 2 | 512px-max WebP resize | S3 + DB | Image: `canvasResize(file, 512)` · Video: re-encode tiny frame · PDF: `renderPdfPageToBlob(file, 512)` · Text: `renderTextPageToBlob(file, 512)` | 1–3s |
| 3 | Saliency-cropped WebP | S3 + DB | `generateSalientCrop()` in the AI module — native `FaceDetector` crops on the largest face, else a ViT-informed geometric center crop — **images only** | 2–5s |

No stage blocks — the gallery shows whatever the highest persisted stage is, and stage 1 paints locally in the meantime. PDFs and text files stop after stage 2 (saliency doesn't apply to documents).

### File-Type Coverage

| File type | Stages produced |
|-----------|-----------------|
| `image/*` | 1 → 2 → 3 |
| `video/*` | 1 → 2 |
| `application/pdf` | 1 → 2 |
| Text-renderable (plain text, markdown, code, config — see `isTextRenderableFile`) | 1 → 2 |
| Other | none — the card falls back to its category icon |

---

## 2. The `itemCreated` Gate

The pipeline must NOT start until the DB row for the item exists. Otherwise `prisma.thumbnail.create({ itemId })` throws an FK violation.

The upload status flow is:

```
pending → validating → queued → uploading → done → itemCreated
```

- `'done'` = S3 upload finished
- `'itemCreated'` = DB `Item` row written (set by `markAsItemCreated` action in `upload/upload.machine.ts` after `upload.createItem.success`)

Only `'itemCreated'` is safe for thumbnail writes.

`app/components/upload/upload-thumbnail-runner.tsx` watches for the transition. It mounts one `<FileThumbnailWatcher>` per file in the upload queue, so each file's arrival is noticed independently. Under the machine path the watcher only *enqueues* — the manager owns concurrency and the HTTP calls (section 13). Under the legacy path each watcher gets its own `useThumbnail()` instance and therefore its own fetchers (presign, patch, metadata, embedding):

```typescript
function FileThumbnailWatcher({ mediaFileId }: { mediaFileId: string }) {
  const mediaFile = useUploadFile(mediaFileId)
  const { run: runThumbnail } = useThumbnail(mediaFileId)

  useEffect(() => {
    if (!mediaFile) return
    if (mediaFile.status !== 'itemCreated') return
    if (thumbnailedIds.has(mediaFile.id)) return
    thumbnailedIds.add(mediaFile.id)

    void (async () => {
      const release = await acquireThumbnailSlot()
      try { await runThumbnail(mediaFile.file) }
      catch (err) { console.error(`Thumbnail failed for ${mediaFile.id}:`, err) }
      finally { release() }
    })()
  }, [mediaFile?.status, mediaFile?.id])

  return null
}
```

**`thumbnailedIds`** is a **module-level `Set<string>`** shared across hook instances. This guarantees the pipeline runs exactly once per file even if the runner is mounted in multiple components.

**`MAX_CONCURRENT_THUMBNAILS = 4`** — a module-level slot gate (`acquireThumbnailSlot`). Without it a 534-file upload fires 534 pipelines at once, each doing presign + compute + patch + metadata + embedding, which buried the server.

### Revalidation is debounced, not per-file

The runner fires **one** `navigate(..., { state: { reset: true } })` per burst, on a `REVALIDATE_DEBOUNCE_MS = 700` timer keyed off the count of files at `itemCreated`/`done`. Previously each file navigated on its own, so a 534-file upload meant 534 loader runs pounding the DB.

`state: { reset: true }` triggers `usePagination`'s reset detection. **Do NOT use `useRevalidator`** — it doesn't update `usePagination`.

The runner also calls `pauseBackfill()` while any upload is in flight and `resumeBackfill()` when the queue drains — fresh uploads own the compute worker (see [§12](#12-on-demand-backfill)).

See: [`docs/upload-multipart.md`](upload-multipart.md#post-upload-chain--db-item-creation) for the full upload → DB chain.

---

## 3. Presign → PUT → PATCH Pattern

Stage 1 never leaves the browser, so only **stages 2 and 3** write. Both follow the same three-step pattern:

```typescript
// 1. Get a presigned URL for this item's thumbnail key
const { uploadUrl, publicUrl } = await fetcher.load(
  `/api/thumbnails/${itemId}/presign`
).data

// 2. PUT the WebP blob directly to S3 — `putThumbnailToS3` in thumbnail-pipeline.ts
await fetch(uploadUrl, {
  method: 'PUT',
  body: blob,
  headers: { 'Content-Type': 'image/webp', 'x-amz-acl': 'public-read' },
})

// 3. PATCH the Thumbnail record with the new URL + dimensions + stage
await fetcher.submit(
  { stage, url: makeStageUrl(publicUrl, stage), width, height },
  { method: 'patch', action: `/api/thumbnails/${itemId}` },
)
```

The PATCH echoes `{ ok, stage, url, width, height }` back, which is what the fetcher-based thumbnail signal reads as `fetcher.data` on the consuming card (see the `stashly-thumbnail-pipeline` skill for the signal architecture).

---

## 4. S3 Storage

**One WebP per item.** Predictable key:

```
thumbnails/{itemId}.webp
```

Public URL: `https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp`

Each successful stage (2 and 3) **overwrites** the same S3 object. Stage 1 is **not** persisted to S3 — it lives only as an in-session `objectURL` to avoid the cache collision described below.

### Cache-busting via `?v={stage}`

Because stages 2 and 3 share the same S3 key, a naive write would mean: browser fetches stage 2, caches it under `Cache-Control: public, max-age=3600`, then stage 3 overwrites the S3 object — but the browser keeps showing stage 2 from cache. The fix: `makeStageUrl(publicUrl, stage)` appends a stage version query param to the URL written to `Thumbnail.url`:

```
https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp?v=2
https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp?v=3
```

Each stage produces a distinct URL → browser refetches → `<AvatarImage>` re-runs its load lifecycle and the DOM updates.

### S3 client checksum config

`app/.server/s3.ts` sets `requestChecksumCalculation: 'WHEN_REQUIRED'` on the `S3Client`. Without this, AWS SDK v3 auto-injects a CRC32 checksum requirement on `PutObjectCommand` and signs `x-amz-checksum-crc32=AAAAAA==` (CRC32 of empty body) into the presigned URL. Browser PUTs of any non-empty blob then fail with a checksum mismatch on Tigris. The setting confines checksum injection to operations that actually require one (multipart `UploadPart` is unaffected — it uses ETag for integrity).

There are no per-view (`grid` / `river` / `waterfall`) or per-size (`small` / `medium` / `large`) variants — those concepts are legacy fields on the model that are no longer used for new uploads.

---

## 5. API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/thumbnails/:itemId/presign` | Returns `{ uploadUrl, publicUrl }` for the next thumbnail write — a 5-minute `put` presign with `acl: 'public-read'` |
| `GET` | `/api/thumbnails/:itemId/source` | Backfill only: 5-minute `get` presign on the **original** file, or `{ status: 'exists', url }` if someone already made a thumbnail. See [§12](#12-on-demand-backfill) |
| `POST` | `/api/thumbnails/:itemId` | Creates a thumbnail record (`thumbnailCreateSchema`) |
| `PATCH` | `/api/thumbnails/:itemId` | Updates `url`, `stage`, `width`, `height` (`thumbnailUpdateSchema`) |

`app/routes/api/thumbnails.ts` exports **only an `action`** — POST, PATCH, and a 405 for anything else. There is no `GET` loader on the detail route; cards read `Thumbnail.url` (a public Tigris URL) straight from the loader payload.

The presign and source routes are registered with `id: 'thumbnail-presign'` / `id: 'thumbnail-source'` to disambiguate from the detail route (`id: 'thumbnail-detail'`). See `app/routes.ts`.

---

## 6. Prisma Model

`prisma/models/thumbnail.prisma`:

```prisma
model Thumbnail {
  id        String        @id
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  width     Int?
  height    Int?
  url       String?       // null = not yet stored; "#abc123" = legacy hex placeholder; otherwise S3 URL
  content   Bytes?        @db.ByteA   // unused by the pipeline
  view      ViewType      @default(grid)      // legacy: grid | river | waterfall
  size      ThumbnailSize @default(small)     // legacy: small | medium | large | original | custom
  stage     Int           @default(0)
  itemId    String?
  item      Item?         @relation(fields: [itemId], references: [id], onDelete: Cascade)
}
```

- `url` starting with `#` indicates a hex-color stage-0 placeholder. V2 no longer writes these, but **rows from before the V2 cutover still carry them**, which is why every consumer still filters on the prefix.
- `url = null` means "not yet stored"
- Real WebP URLs do not start with `#`
- `view` and `size` are non-null enums with defaults, so the PATCH route passes `grid`/`medium` from query params rather than leaving them off

---

## 7. Gallery Query — Hex Placeholder Filter

Gallery layouts must filter out stage-0 hex placeholders, both at the item filter level and the thumbnail select level:

```typescript
// where (items must have a real thumbnail)
thumbnails: {
  some: {
    url: { not: null },
    NOT: { url: { startsWith: '#' } },
  },
},
// select (best thumbnail per item)
thumbnails: {
  orderBy: { stage: 'desc' },
  take: 1,
  where: { NOT: { url: { startsWith: '#' } } },
  select: { url: true, width: true, height: true, stage: true, size: true, id: true },
},
```

`orderBy: { stage: 'desc' }` is what makes `take: 1` mean "highest stage" rather than "whichever row comes back first".

Used in `app/routes/stash/gallery.tsx` and any other route that lists items by thumbnail. `ItemCard.Cover` is the exception — it picks `thumbnails.find(t => t.stage === 2)` directly, because a stage-3 salient crop is the wrong shape for a cover strip.

---

## 8. Utilities

All output is **WebP**. Located in `app/utils/thumbnail.ts`:

| Function | Purpose |
|----------|---------|
| `hashToColor(name, type)` | Deterministic hex color from HSL — **legacy stage 0**, only `useThumbnail.ts` (V1) still calls it |
| `extractTinyThumbnail(file)` | 8×8 WebP `Blob` via canvas (stage 1) |
| `canvasResize(file, maxSize?)` | WebP `Blob`, max 512×512 preserving aspect ratio (stage 2) |
| `blurImageBlob(blob, radius)` | Gaussian blur pass over a WebP blob |
| `dataUrlToBlob(dataUrl)` | Convert data-URL to `Blob`, fallback MIME `image/webp` |

The stage functions themselves live in `app/utils/thumbnail-pipeline.ts` — `generateStage1Preview`, `generateStage2Resize`, `generateStage3Salient`, `putThumbnailToS3`, `makeStageUrl`, plus `compute()` (the compute-worker RPC helper), `extractMediaMetadata`, and `buildMediaMetadataFormData`. The orchestration layer — the machine's actors in `app/machines/thumbnail/thumbnail.actors.ts`, or `useThumbnail` on the legacy path — only sequences them and owns the HTTP state.

For video thumbnails, use `generateVideoThumbnail(file)` from `app/utils/video.ts` (extracts a frame, then runs through the WebP pipeline).

For text-renderable files (plain text, markdown, code, config), `app/utils/text-thumbnail.ts` "screenshots" the first ~32 KB onto an A4-proportioned white page via `OffscreenCanvas` — sans-serif for prose extensions, monospace for code/config (extension wins over MIME, because code files often arrive as `text/plain` or `application/octet-stream`). Entry points are `generateTextThumbnail` (stage 1) and `renderTextPageToBlob` (stage 2); eligibility is `isTextRenderableFile`. Empty files return `null` — no thumbnail beats a blank page. The pure line-layout function `layoutTextLines` is unit-tested in `app/utils/__tests__/text-thumbnail.test.ts`.

For PDF thumbnails, use `generatePdfThumbnail(file)` (stage 1) and `renderPdfPageToBlob(file, maxSize)` (stage 2) from `app/utils/pdf.ts`. Both call into PDF.js (`pdfjs-dist`), render the first page to canvas with a white background, and return WebP. The Vite worker URL is set globally on import:

```typescript
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
```

`getPdfMetadata(file)` returns `{ pageCount, width, height }` from page 1; `extractPdfMetadata(file)` returns the fuller `PdfDocumentMetadata` — both feed document metadata persistence.

`extractPdfText(file, { maxPages = 5, maxChars = 20_000 })` returns `{ text, pageCount, pagesRead }` for indexing. `extractMediaMetadata` in `thumbnail-pipeline.ts` dispatches the `pdfText` compute kind for `application/pdf` (and `mdMeta` for markdown), then POSTs the result to `/api/items` under the `save_media_metadata` intent as `documentText` + `documentPageCount`. Server-side (`app/routes/api/items.ts`) that text goes to `upsertSearchContent` for the document-level `Search.content` fallback, and through `chunkText` → `upsertSearchChunks` for passage-level `SearchChunk` rows. See [`docs/semantic-search.md`](semantic-search.md) for the chunked indexing and embedding flow.

---

## 9. Stage 4 (Caption Overlay) — Removed (historical)

Stage 4 drew a Florence-2 VLM caption onto the stage-3 image. It was first hidden from gallery views by capping the gallery select at stage 3 (commit `1201c3c`: "keep stage-4 pipeline but hide captioned thumbnails from gallery (cap at stage 3)") — captions were useful for accessibility/search but visually noisy as default thumbnails — and then dropped entirely in V2. The gallery select now carries `orderBy: { stage: 'desc' }` again, because 3 is the top stage.

Florence-2 itself still lives in `app/.client/stashly-ai.ts` for captioning outside the thumbnail path. Nothing in the thumbnail pipeline calls it.

---

## 10. Concurrency Notes — AI Stage

The AI work shares a single WebGPU context, and concurrent inference conflicts.

Serialization now lives in `app/workers/ai-queue.ts`, a shared queue that `thumbnail.ai.ts` and the embedding worker both go through — so a saliency crop can't collide with an embedding run either. (Originally this was an in-pipeline serialization of stages 3 and 4 per file; commit `67e2830`: "serialize AI stages to prevent concurrent WebGPU conflicts + log errors".) Stages 1 and 2 are pure canvas work with no GPU model, so files pipeline freely there, bounded only by the compute worker's own cap.

If extending the AI portion, go through `ai-queue.ts` rather than adding a second serialization scheme.

### Error handling — no telemetry

Every stage swallows its own failure: `generateStage3Salient` catches and returns `null`, `putThumbnailToS3` catches network errors and returns `false`, and the runner logs `Thumbnail failed for <id>`. Failures are reported by **`console.error` only** — there is no telemetry, error reporting, or server-side record of a stage that didn't land. A file that fails simply keeps whatever lower stage it reached, and (for stage 2 failures) becomes a candidate for on-demand backfill.

---

## 11. Compute Worker — Off-main-thread Pipeline

`app/workers/thumbnail.compute.worker.ts` is a **dedicated module worker** that owns all heavy thumbnail compute for image and PDF uploads. It exists because parallel uploads were freezing the main thread (4 PDFs simultaneously decoding through PDF.js + canvas resize blocked the UI for minutes).

### What runs in the worker

| Compute kind | Source util |
|--------------|------------|
| `tinyImage` | `extractTinyThumbnail` |
| `tinyPdf` | `generatePdfThumbnail` |
| `tinyText` | `generateTextThumbnail` |
| `resizeImage` | `canvasResize` |
| `resizePdf` | `renderPdfPageToBlob` |
| `resizeText` | `renderTextPageToBlob` |
| `pdfText` | `extractPdfText` |
| `pdfMeta` | `extractPdfMetadata` |
| `mdMeta` | markdown metadata + text extraction |
| `imageDimensions` | `createImageBitmap` |

### What stays on main

- **Video thumbnailing** — uses `<video>` DOM element, not available in workers
- **EXIF parsing** — `exifr` runs from main alongside the rest of `extractMediaMetadata`
- **HTTP + React state** — presigns, PUTs, PATCHes, setState; these don't block
- **Stage 3** — image-only AI in `app/workers/thumbnail.ai.ts` (which despite the path is a regular module, not a Worker; runs on main with WebGPU, serialized by `ai-queue.ts`)

### RPC protocol

Main → worker: `{ id: number, kind: ..., file, ...args }`
Worker → main: `{ id, kind, blob | result | message }` correlated by `id`.

`app/utils/thumbnail-pipeline.ts` exposes a typed `compute({ kind, file })` helper that returns the matching response variant — narrow on `res.kind` to access the result.

### Concurrency cap

The worker enforces `MAX_CONCURRENT = 1`. Additional requests queue and dispatch as slots free. This is the global cap — doesn't matter how many jobs the manager runs in parallel across its two lanes; the worker is a singleton.

The cap is 1 (not 2 or higher) because PDF.js inside a dedicated worker falls back to **fake worker mode** — it can't spawn nested workers reliably across browsers, so `getDocument`/`getPage`/`render` run synchronously inside our compute worker. Multiple parallel PDF operations in fake-worker mode terminate each other's tasks ("Worker task was terminated" warnings). Serializing avoids the conflict; throughput cost is acceptable since each PDF op is fast.

A 30-second per-operation timeout is enforced inside the worker — if any compute call (PDF.js or canvas) hangs, it fails fast and the queue keeps moving instead of stalling forever.

### OffscreenCanvas

`app/utils/thumbnail.ts` and `app/utils/pdf.ts` use `new OffscreenCanvas(w, h)` rather than `document.createElement('canvas')` so they work in both contexts. `extractTinyThumbnail` and `generatePdfThumbnail` return `Blob` (was data URL pre-worker refactor).

### PDF.js custom `OffscreenCanvasFactory`

Passing our own `OffscreenCanvas` as the **target** of `page.render(...)` is necessary but not sufficient. PDF.js's default `DOMCanvasFactory` creates additional **auxiliary canvases** internally:

- Subpixel-AA detection on font rendering (via `isFontSubpixelAAEnabled`) — touched by every PDF with text
- Image-scaling intermediate buffers (`_scaleImage`) — touched by every PDF with inline images

These call `document.createElement('canvas')`, which crashes in a Web Worker:

```
TypeError: Cannot read properties of undefined (reading 'createElement')
    at DOMCanvasFactory._createCanvas (pdf.mjs:9066)
    at get isFontSubpixelAAEnabled (pdf.mjs:11681)
```

The fix is a custom canvas factory backed by `OffscreenCanvas` defined in `app/utils/pdf.ts`:

```typescript
class OffscreenCanvasFactory {
  create(width, height)  { /* new OffscreenCanvas + getContext('2d') */ }
  reset(canvasAndContext, width, height)  { /* mutate canvas dims */ }
  destroy(canvasAndContext)  { /* zero dims, null out refs */ }
}

const workerSafeDocOptions =
  typeof document === 'undefined'
    ? { CanvasFactory: OffscreenCanvasFactory }
    : {}

await pdfjs.getDocument({ data: buffer, ...workerSafeDocOptions, verbosity: 0 }).promise
```

The factory is only injected when `typeof document === 'undefined'` (worker context). In a normal page context PDF.js's default `DOMCanvasFactory` is used, so no main-thread regression.

**The user-visible symptom of missing this fix**: simple PDFs (no styled text, no images) render fine, but any normal document blows up silently inside `withFirstPage`'s `try/catch` and lands on stage 0. Restoring this factory was what made stage-2 thumbnails reliable for non-trivial PDFs.

### PDF.js verbosity

Every `pdfjs.getDocument({ ... })` call passes `verbosity: 0` (errors only). PDF.js otherwise emits high-frequency `"Worker task was terminated"` warnings on every `doc.destroy()` in fake-worker mode — non-fatal, but they spam the console enough to obscure real errors.

### Singleton lifecycle

The worker is created lazily on first `compute()` call (guarded by `typeof window !== 'undefined'`) and lives for the app session. There's no cleanup hook — workers are cheap to keep alive idle.

---

## 12. On-demand Backfill

Upload-time generation only ever runs from the upload queue, where the original `File` is still in memory. When it fails — compute timeout, tab closed mid-run, a deeply-nested file in a huge batch — the item shows its category icon forever. `app/hooks/useThumbnailBackfill.ts` closes that gap: when a card without a real thumbnail scrolls into view, it re-downloads the original and runs **stage 2 only** (stage 3's salient crop is the most expensive and buys the least here). Video is the one exception: its stage 2 needs a frame, so `generateStage1Preview` runs first and feeds `generateStage2Resize`.

The hook returns a callback ref, wired into the `ItemCard.Thumbnail` and `ItemCard.Cover` roots, so every grid view gets it for free. **Memoize any composed ref** (`composeRefs` in `item-card.tsx`) — a fresh callback each render detaches and re-attaches the observer on every re-render.

A backfill costs a full download of the original, so the guards *are* the feature:

| Guard | Where |
|-------|-------|
| Viewport-gated — one shared `IntersectionObserver`, `rootMargin: '300px 0px'` | `useThumbnailBackfill.ts` |
| LIFO queue — newest request runs first, so fast scrolling favours where you stopped | `queue.pop()` in `drain()` |
| `MAX_CONCURRENT = 2`, jobs started inside `requestIdleCallback` (2s timeout) | `drain()` / `whenIdle()` |
| Yields to uploads — `pauseBackfill()` / `resumeBackfill()`, called by `upload-thumbnail-runner.tsx` | exported from the hook |
| Attempted once — in-memory `Set` plus a capped `sessionStorage` skip list (`stashly:thumb-backfill-failed`) for permanent failures | `rememberFailure()` |
| Type/size eligibility, Data-Saver and 2g opt-out | `app/utils/thumbnail-backfill.ts` (pure, unit-tested) |

`GET /api/thumbnails/:itemId/source` → `getThumbnailSource` in `app/.server/thumbnail-actions.ts` presigns a 5-minute GET on the original. It re-checks read permission and the 16 MB `BACKFILL_MAX_BYTES` cap server-side, and returns `{ status: 'exists', url }` when another client already backfilled the item — the client paints that instead of downloading again. `{ status: 'unsupported' }` covers folders, missing keys, and oversize files. **Keep the client and server caps in sync** (both read `BACKFILL_MAX_BYTES` from `app/utils/thumbnail-backfill.ts`) or the client burns a round trip discovering the server said no.

A card that unmounts mid-job (route change) lets the in-flight job finish and persists via a plain `fetch` PATCH (`patchDetached`) rather than the keyed fetcher; only *queued* jobs are dropped.

---

## 13. XState Scheduler

`app/machines/thumbnail/` — the orchestration layer that runs today. `USE_THUMBNAIL_MACHINE = true` in `app/machines/thumbnail/index.ts` picks it; flipping that one constant moves every call site back to the original hooks atomically, because both sides export the same three hooks plus the same pause/resume pair. The switch is temporary — see the merge-back checklist in [`app/machines/thumbnail/README.md`](../app/machines/thumbnail/README.md).

### Why it exists

Compute was never the bottleneck. **Scheduling** was, and it was spread across four limiters that knew nothing about each other:

| Gate | Where | Cap |
|---|---|---|
| Upload thumbnails | `upload-thumbnail-runner.tsx` | 4, FIFO, promise semaphore |
| Backfill | `useThumbnailBackfill.ts` | 2, LIFO, `paused` boolean |
| Compute worker | `thumbnail.compute.worker.ts` | 1 (PDF.js fake-worker constraint) |
| WebGPU (stage 3) | `ai-queue.ts` | 1, priority-aware |

Effective concurrency was nobody's decision. Alongside that: `waitForIdle()` polled a React Router fetcher ref every 16 ms because a long-lived async callback had no other way to await one; there was no cancellation; there was no retry, so a stage-2 timeout meant waiting for a *full re-download* via backfill to redo work that had been seconds from done; and the whole indexing leg (metadata → embeddings → minutes of OCR) ran as a `void` promise nobody held.

Those are all scheduler problems. The stages themselves are a straight line and gain little from being modelled — they are in the machine mainly so cancellation and retry have somewhere to live.

### Shape

```
thumbnailManager (module scope — outlives every component)
├── uploadLane    cap 4, FIFO
├── backfillLane  cap 2, LIFO · states: active | paused
└── spawn(thumbnailItemMachine, { itemId, mode, file })
     ├── stages    acquiring? → stage1 → stage2 → presign → put2 → patch2 → stage3 → put3 → patch3
     │              ↳ retrying (after 800 ms, budget 2)
     └── indexing  metadata → embeddings → OCR?          [upload mode only]
```

| File | Role |
|---|---|
| `thumbnail.types.ts` | Context, events, emitted events, job shape |
| `thumbnail.actors.ts` | `fromPromise` wrappers around the **existing** helpers in `@/utils/thumbnail-pipeline` — no compute logic lives here |
| `thumbnail-item.machine.ts` | One actor per file: `stages` ∥ `indexing` |
| `thumbnail-manager.machine.ts` | The scheduler: two lanes, spawn/settle, pause as a state |
| `attempt-store.ts` | Attempted-once bookkeeping + `sessionStorage` skip list |
| `client.ts` | The module-scope singleton and its imperative API |
| `hooks.ts` | React surface, signature-compatible with the hooks it replaces |
| `index.ts` | `USE_THUMBNAIL_MACHINE` — the switch. **Temporary.** |

### Consequences worth knowing

- **Plain `fetch`, not `useFetcher`.** A module-scope actor has no component to own a fetcher, which is what deletes `waitForIdle`. It also means these calls no longer revalidate the route for free — desirable for the search-index writes (precisely what `SEARCH_INDEX_INTENTS` suppresses), but `save_media_metadata` writes *visible* facets, so the machine emits `metadataSaved` and `useThumbnailRevalidation()` folds a burst into one navigation.
- **The retry budget resets on success, never on state entry.** A retry re-enters the failing state, so `entry: 'resetAttempts'` would wipe the counter guarding it and loop forever. That was a real bug, caught by `thumbnail-item.machine.test.ts`.
- **Pause is a state, not a flag.** `drainBackfillNow` is only handled inside `backfillLane.active`, so a paused lane cannot start work even if a caller forgets to check.
- **Cancel drops queued jobs only.** A running job's download is already paid for, and because the manager outlives every card its result still persists after the card is gone — which is why the machine path has no equivalent of the legacy `patchDetached`.
- **Only backfill failures reach the skip list.** An upload-time failure is often transient, and remembering it would block the very backfill that exists to recover from it.
- **`attempt-store.ts` shares its `sessionStorage` key with `useThumbnailBackfill.ts` on purpose**, so flipping the switch inherits the other path's skip list.

### Tests

- **Unit** — `app/machines/thumbnail/__tests__/thumbnail-item.machine.test.ts` and `thumbnail-manager.machine.test.ts`, run by `pnpm test`.
- **E2E** — `tests/e2e/thumbnail-machine.spec.ts` (11 cases) with helpers in `tests/e2e/helpers/thumbnail-machine.ts`. They inspect the live actor through `window.__thumbMgr`, the debug handle `client.ts` attaches, and assert against the real DOM rather than the machine's own account of itself. When the suite last ran (2026-08-25) the scheduler-boot, backfill-lane and pause/cancel cases were green; the upload-pipeline cases were failing on a pre-existing problem in the shared upload fixture, not in the machine.

---

## Related Documentation

- [`docs/upload-multipart.md`](upload-multipart.md) — Upload flow + post-upload DB item creation chain
- [`docs/ai-pipeline.md`](ai-pipeline.md) — AI worker architecture, WebGPU detection
- [`docs/superpowers/specs/2026-04-24-living-thumbnails-design.md`](superpowers/specs/2026-04-24-living-thumbnails-design.md) — Original design spec
- [`docs/superpowers/plans/2026-04-24-living-thumbnails.md`](superpowers/plans/2026-04-24-living-thumbnails.md) — Implementation plan (V1, 5 stages)
- [`docs/semantic-search.md`](semantic-search.md) — Chunked document indexing fed by `pdfText` / `mdMeta`
- [`.claude/skills/stashly-thumbnail-pipeline/SKILL.md`](../.claude/skills/stashly-thumbnail-pipeline/SKILL.md) — Condensed working reference, including the swappable thumbnail-signal architecture
