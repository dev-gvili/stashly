# Thumbnail Pipeline — Living Thumbnails

A 5-stage progressive thumbnail generation system. Each stage upgrades the thumbnail asynchronously after upload completes — from an instant color hash placeholder to a Florence-2-captioned image. All output is **WebP**.

Driven primarily client-side from `app/hooks/useThumbnail.ts`, with AI stages running in `app/workers/thumbnail.ai.ts`.

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
9. [Hide Stage 4 from Gallery (Caption Cap)](#9-hide-stage-4-from-gallery-caption-cap)
10. [Concurrency Notes — AI Stages](#10-concurrency-notes--ai-stages)

---

## 1. Stages

| Stage | What it produces | Where it lives | Mechanism | Latency |
|-------|------------------|---------------|-----------|---------|
| 0 | Deterministic hex color from file name + MIME (e.g. `#a3b5c7`) | `Thumbnail.url` in DB | `hashToColor()` — no S3 | Instant |
| 1 | 8×8 WebP blur preview | **Local-session `URL.createObjectURL` only — never persisted to S3 or DB** | Image: `extractTinyThumbnail(file)` · Video: `generateVideoThumbnail(file)` · PDF: `generatePdfThumbnail(file)` | <1s |
| 2 | 512px-max WebP resize | S3 + DB | Image: `canvasResize(file, 512)` · Video: re-encode tiny frame · PDF: `renderPdfPageToBlob(file, 512)` | 1–3s |
| 3 | Saliency-cropped WebP with face-aware crop via native `FaceDetector` API | ViT saliency model in AI worker — **images only** | 2–5s |
| 4 | Caption overlay (Florence-2 VLM) | Florence-2 in AI worker, drawn onto stage-3 image — **images only** | 5–15s |

Stages 1+ are not blocking — the gallery shows whatever the latest non-hex thumbnail is. PDFs stop after stage 2 (saliency/caption don't apply to documents).

### File-Type Coverage

| File type | Stages produced |
|-----------|-----------------|
| `image/*` | 0 → 1 → 2 → 3 → 4 |
| `video/*` | 0 → 1 → 2 |
| `application/pdf` | 0 → 1 → 2 |
| Other | 0 only (color hash) |

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

`useUpload.ts` watches for the transition:

```typescript
useEffect(() => {
  for (const mediaFile of files) {
    if (mediaFile.status === 'itemCreated' && !thumbnailedIds.has(mediaFile.id)) {
      thumbnailedIds.add(mediaFile.id)
      navigate(location.pathname + location.search, {
        replace: true,
        state: { reset: true },
      })
      runThumbnail(mediaFile.id, mediaFile.file).catch(console.error)
    }
  }
}, [files])
```

**`thumbnailedIds`** is a **module-level `Set<string>`** shared across hook instances. This guarantees the pipeline runs exactly once per file even if `useUpload` is mounted in multiple components.

The `navigate(..., { state: { reset: true } })` triggers `usePagination`'s reset detection. **Do NOT use `useRevalidator`** — it doesn't update `usePagination`.

See: [`docs/upload-multipart.md`](upload-multipart.md#post-upload-chain--db-item-creation) for the full upload → DB chain.

---

## 3. Presign → PUT → PATCH Pattern

Stages 1–4 all follow the same three-step write pattern:

```typescript
// 1. Get a presigned URL for this item's thumbnail key
const { uploadUrl, publicUrl } = await fetcher.load(
  `/api/thumbnails/${itemId}/presign`
).data

// 2. PUT the WebP blob directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: blob,
  headers: { 'Content-Type': 'image/webp' },
})

// 3. PATCH the Thumbnail record with the new URL + dimensions + stage
await fetcher.submit(
  { stage, url: publicUrl, width, height },
  { method: 'patch', action: `/api/thumbnails/${itemId}` },
)
```

Stage 0 skips S3 entirely — the hex color is stored directly:

```typescript
// Stage 0
const color = hashToColor(file.name, file.type)
await fetcher.submit(
  { itemId, url: color },
  { method: 'post', action: `/api/thumbnails/${itemId}` },
)
```

---

## 4. S3 Storage

**One WebP per item.** Predictable key:

```
thumbnails/{itemId}.webp
```

Public URL: `https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp`

Each successful stage (2+) **overwrites** the same S3 object. Stage 1 is **not** persisted to S3 — it lives only as an in-session `objectURL` to avoid the cache collision described below.

### Cache-busting via `?v={stage}`

Because stages 2/3/4 share the same S3 key, a naive write would mean: browser fetches stage 2, caches it under `Cache-Control: public, max-age=3600`, then stage 3 overwrites the S3 object — but the browser keeps showing stage 2 from cache. The fix: the URL written to `Thumbnail.url` includes a stage version query param:

```
https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp?v=2
https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp?v=3
https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp?v=4
```

Each stage produces a distinct URL → browser refetches → `<AvatarImage>` re-runs its load lifecycle and the DOM updates.

### S3 client checksum config

`app/.server/s3.ts` sets `requestChecksumCalculation: 'WHEN_REQUIRED'` on the `S3Client`. Without this, AWS SDK v3 auto-injects a CRC32 checksum requirement on `PutObjectCommand` and signs `x-amz-checksum-crc32=AAAAAA==` (CRC32 of empty body) into the presigned URL. Browser PUTs of any non-empty blob then fail with a checksum mismatch on Tigris. The setting confines checksum injection to operations that actually require one (multipart `UploadPart` is unaffected — it uses ETag for integrity).

There are no per-view (`grid` / `river` / `waterfall`) or per-size (`small` / `medium` / `large`) variants — those concepts are legacy fields on the model that are no longer used for new uploads.

---

## 5. API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/thumbnails/:itemId/presign` | Returns `{ uploadUrl, publicUrl }` for the next thumbnail write |
| `POST` | `/api/thumbnails/:itemId` | Creates the initial thumbnail record (stage 0 with hex color) |
| `PATCH` | `/api/thumbnails/:itemId` | Updates `url`, `stage`, `width`, `height` for stages 1–4 |
| `GET` | `/api/thumbnails/:itemId` | Redirects to the S3 presigned URL (1h expiry) — used by `useThumbnail` for displaying thumbnails |

The presign route is registered with `id: 'thumbnail-presign'` to disambiguate from the detail route. See `app/routes.ts`.

---

## 6. Prisma Model

`prisma/models/thumbnail.prisma`:

```prisma
model Thumbnail {
  id      String  @id
  itemId  String?       // nullable for stage-0 cases pre-itemCreated, but the gate now prevents this
  url     String?       // null = not yet stored; "#abc123" = hex placeholder; otherwise S3 URL
  stage   Int     @default(0)
  size    String?       // legacy: 'small' | 'medium' | 'large' | 'custom'
  view    String?       // legacy: 'grid' | 'river' | 'waterfall'
  width   Int?
  height  Int?
}
```

- `url` starting with `#` indicates a hex-color stage-0 placeholder
- `url = null` means "not yet stored"
- Real WebP URLs do not start with `#`

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
  take: 1,
  where: { NOT: { url: { startsWith: '#' } } },
  // orderBy: { stage: 'desc' }   // optional, see §9 for current cap
  select: { url: true, width: true, height: true, stage: true, size: true, view: true, id: true },
},
```

Used in `app/routes/stash/gallery.tsx` and any other route that lists items by thumbnail.

---

## 8. Utilities

All output is **WebP**. Located in `app/utils/thumbnail.ts`:

| Function | Purpose |
|----------|---------|
| `hashToColor(name, type)` | Deterministic hex color from HSL — same input always produces same color |
| `extractTinyThumbnail(file)` | 8×8 WebP data-URL via canvas (stage 1) |
| `canvasResize(file, maxSize?)` | WebP `Blob`, max 512×512 preserving aspect ratio (stage 2) |
| `dataUrlToBlob(dataUrl)` | Convert data-URL to `Blob`, fallback MIME `image/webp` |

For video thumbnails, use `generateVideoThumbnail(file)` from `app/utils/video.ts` (extracts a frame, then runs through the WebP pipeline).

For PDF thumbnails, use `generatePdfThumbnail(file)` (stage 1) and `renderPdfPageToBlob(file, maxSize)` (stage 2) from `app/utils/pdf.ts`. Both call into PDF.js (`pdfjs-dist`), render the first page to canvas with a white background, and return WebP. The Vite worker URL is set globally on import:

```typescript
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
```

`getPdfMetadata(file)` returns `{ pageCount, width, height }` from page 1 — useful when extending document metadata persistence in `saveMediaMetadata`.

`extractPdfText(file, { maxPages = 5, maxChars = 20_000 })` returns `{ text, pageCount, pagesRead }` for indexing. `useThumbnail.ts` calls this for `application/pdf` uploads inside `saveMediaMetadata` and POSTs the result via the existing `save_media_metadata` intent (new fields: `documentText`, `documentPageCount`). The server stores it in `Search.content` (document-level fallback) and chunks it into `SearchChunk` rows (passage-level retrieval) via `upsertSearchChunks`. The chunked indexing flow is described in `## Semantic Search` below.

---

## 9. Hide Stage 4 from Gallery (Caption Cap)

Stage 4 (Florence-2 caption overlay) is currently produced and stored, but **hidden from gallery views**. The gallery query treats stage 3 as the highest visible stage. This was an explicit product decision (commit `1201c3c`: "keep stage-4 pipeline but hide captioned thumbnails from gallery (cap at stage 3)") — captions are useful for accessibility/search but were visually noisy as default thumbnails.

If reactivating stage-4 visibility, add `orderBy: { stage: 'desc' }` to the gallery thumbnail select.

---

## 10. Concurrency Notes — AI Stages

The AI stages share a single WebGPU context. Running multiple AI stages concurrently causes WebGPU conflicts.

The pipeline **serializes** stages 3 and 4 per file (commit `67e2830`: "serialize AI stages to prevent concurrent WebGPU conflicts + log errors"). Within stages 1 and 2 (pure canvas work, no GPU model), files can pipeline freely.

If extending the AI portion, respect this serialization — wrap each stage in an awaited block, and surface errors via `console.error` rather than swallowing them.

---

## 11. Compute Worker — Off-main-thread Pipeline

`app/workers/thumbnail.compute.worker.ts` is a **dedicated module worker** that owns all heavy thumbnail compute for image and PDF uploads. It exists because parallel uploads were freezing the main thread (4 PDFs simultaneously decoding through PDF.js + canvas resize blocked the UI for minutes).

### What runs in the worker

| Compute kind | Source util |
|--------------|------------|
| `tinyImage` | `extractTinyThumbnail` |
| `tinyPdf` | `generatePdfThumbnail` |
| `resizeImage` | `canvasResize` |
| `resizePdf` | `renderPdfPageToBlob` |
| `pdfText` | `extractPdfText` |
| `imageDimensions` | `createImageBitmap` |

### What stays on main

- **Stage 0** — single fetcher.submit (instant)
- **Video thumbnailing** — uses `<video>` DOM element, not available in workers
- **EXIF parsing** — `exifr` runs from main alongside the rest of `saveMediaMetadata`
- **HTTP + React state** — presigns, PUTs, PATCHes, setState; these don't block
- **Stages 3 and 4** — image-only AI in `app/workers/thumbnail.ai.ts` (which despite the path is a regular module, not a Worker; runs on main with WebGPU)

### RPC protocol

Main → worker: `{ id: number, kind: ..., file, ...args }`
Worker → main: `{ id, kind, blob | result | message }` correlated by `id`.

`useThumbnail.ts` exposes a typed `compute({ kind, file })` helper that returns the matching response variant — narrow on `res.kind` to access the result.

### Concurrency cap

The worker enforces `MAX_CONCURRENT = 1`. Additional requests queue and dispatch as slots free. This is the global cap — doesn't matter how many `useThumbnail` hooks fire in parallel from how many `useUpload` instances; the worker is a singleton.

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

## Related Documentation

- [`docs/upload-multipart.md`](upload-multipart.md) — Upload flow + post-upload DB item creation chain
- [`docs/ai-pipeline.md`](ai-pipeline.md) — AI worker architecture, WebGPU detection
- [`docs/superpowers/specs/2026-04-24-living-thumbnails-design.md`](superpowers/specs/2026-04-24-living-thumbnails-design.md) — Original design spec
- [`docs/superpowers/plans/2026-04-24-living-thumbnails.md`](superpowers/plans/2026-04-24-living-thumbnails.md) — Implementation plan
- [`CLAUDE.md`](../CLAUDE.md) — `## Thumbnail Pipeline` section
