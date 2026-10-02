---
name: stashly-thumbnail-pipeline
description: Stashly client-side 3-stage WebP thumbnail pipeline — the XState scheduler in app/machines/thumbnail, the legacy useThumbnail orchestrator, thumbnail-signal architecture, the compute worker, PDF.js OffscreenCanvas handling, presign/PUT/PATCH flow, and gallery thumbnail queries. Load when working on thumbnails, previews, the upload thumbnail runner, or Web Workers.
---

# Stashly Thumbnail Pipeline

Client-side 3-stage progressive generation. All output is **WebP**.

**Orchestration is the XState manager in `app/machines/thumbnail/`** — `USE_THUMBNAIL_MACHINE = true` in its `index.ts` selects it, and every call site imports the hooks from there. One module-scope manager owns two lanes (upload: cap 4, FIFO · backfill: cap 2, LIFO, pause is a state), spawns one item machine per file (thumbnail stages only), and gives the pipeline retry (800 ms, budget 2) and real cancellation. It calls plain `fetch`, not `useFetcher`, so it does **not** revalidate the route. Read `app/machines/thumbnail/README.md` before editing it.

**Search indexing is not part of this pipeline.** Metadata, chunk embeddings and OCR run in their own queue and machine, `app/machines/indexing/` (FIFO, 2 at a time). The upload runner calls `enqueueIndexing(id, file)` for every upload at `itemCreated`, ahead of the thumbnail slot, and `useIndexingRevalidation()` reloads the page once per batch after the indexing queue drains — with `revalidate()`, never `navigate(<current URL>)`, which would cancel a navigation in progress. On the legacy path (`USE_THUMBNAIL_MACHINE = false`) `useThumbnail` still indexes by itself and the indexing queue stays empty.

The legacy orchestrator, reachable only by flipping that constant off, is `app/hooks/useThumbnail.ts` (`useThumbnailV2.ts` was folded into it) — a thin orchestrator over the same pure helpers in `@/utils/thumbnail-pipeline` (`generateStage1Preview`, `generateStage2Resize`, `generateStage3Salient`, `putThumbnailToS3`, `makeStageUrl`) plus a swappable broadcast channel from `@/hooks/thumbnail-signal`, spawned per-file by `app/components/upload/upload-thumbnail-runner.tsx`.

**Both paths share the stage helpers.** Compute logic lives in `@/utils/thumbnail-pipeline` and nowhere else — the machine's actors are `fromPromise` wrappers around it.

**Stage 0 (hex color) was removed in V2** — every consumer already filters `url.startsWith('#')`, so writing it to the DB was pure waste. The pipeline now starts at stage 1.

**Gate**: pipeline starts only after `status === 'itemCreated'` (not `'done'`). `upload-thumbnail-runner.tsx` watches for `itemCreated` and calls `runThumbnail(file)`. A module-level `thumbnailedIds = new Set<string>()` (shared across hook instances) ensures the pipeline fires exactly once per file.

## On-demand backfill (items that never got a thumbnail)

Upload-time generation only ever runs from the upload queue, where the original `File` is in memory. When it fails (compute timeout, tab closed mid-run, a deeply-nested file in a huge batch), the item shows the category icon forever. `app/hooks/useThumbnailBackfill.ts` closes that gap: it re-downloads the original and runs **stage 2 only** (stage 3's salient crop is the most expensive stage and buys the least here). Video is the one exception — its stage 2 needs a frame, so `generateStage1Preview` runs first and is fed into `generateStage2Resize`.

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
| 2 | 512px resize | Image: `canvasResize(file, 512)` · Video: re-encode frame · PDF: `renderPdfPageToBlob(file, 512)` · Text: `renderTextPageToBlob(file, 512)` → presign → PUT to S3, stored as the `?v=2` locator |
| 3 | Salient crop | `generateSalientCrop` in `thumbnail.ai.ts` — **images only**, stored as the `?v=3` locator. Native `FaceDetector` (Chrome) crops on the largest face; otherwise a ViT-informed geometric center crop. Serialized through `app/workers/ai-queue.ts` at `'default'` priority, shared with embedding and OCR, because WebGPU can't take concurrent inference |

**Cache-bust**: stages 2/3 share one S3 key, so the stored locator carries `?v={stage}` and the signed URL varies per stage — see the signed-read section below.

**S3 client config**: `app/.server/s3.ts` sets `requestChecksumCalculation: 'WHEN_REQUIRED'` on `S3Client`. Without this, AWS SDK v3 signs a CRC32 checksum requirement (`x-amz-checksum-crc32=AAAAAA==`, CRC32 of empty body) into presigned `PutObject` URLs, causing browser PUTs to fail with a checksum mismatch.

PDFs and text-based files stop after stage 2. The PDF.js worker URL is set globally on import in `app/utils/pdf.ts` via `pdfjs-dist/build/pdf.worker.min.mjs?url`.

**PDF text extraction is indexing, not thumbnailing**: the indexing machine's `readingMetadata` state dispatches the `pdfText` compute RPC, and when it comes back empty (a scan with no text layer) the machine moves to `transcribingScannedPdf`, which runs `streamOcrPdf` — page-by-page vision-model OCR, persisted per page. That path is documented in the `stashly-ai-inference` skill; don't add OCR logic here.

**Text thumbnails**: `app/utils/text-thumbnail.ts` "screenshots" the first ~32 KB of a text-based file (plain text, markdown, code, config) onto an A4-proportioned white page via OffscreenCanvas — sans-serif for prose extensions, monospace for code/config (extension wins over mime because code files often arrive as `text/plain`/`application/octet-stream`). Detection is `isTextRenderableFile`; compute-worker RPC kinds are `tinyText`/`resizeText`. Empty files return null — no thumbnail beats a blank page. Line layout (`layoutTextLines`) is pure and unit-tested in `app/utils/__tests__/text-thumbnail.test.ts`.

## Compute worker

Heavy thumbnail compute runs in a singleton dedicated worker at `app/workers/thumbnail.compute.worker.ts` with an internal concurrency cap of **1** and a 30-second per-op timeout. RPC kinds: `tinyImage` / `tinyPdf` / `tinyText`, `resizeImage` / `resizePdf` / `resizeText`, `pdfText`, `pdfMeta`, `mdMeta`, `imageDimensions`. The pipeline helpers in `@/utils/thumbnail-pipeline` dispatch RPC requests via `compute({ kind, file })`; The orchestration layer handles HTTP on main. Video thumbnails stay on main because they require `<video>` DOM access. Stage 3 (image AI) also stays on main — it calls into `app/workers/thumbnail.ai.ts`, which is a regular module using WebGPU (not a Worker — the file location is historical).

The cap is 1 because PDF.js inside a dedicated worker falls back to **fake worker mode** (it can't spawn a sub-worker reliably from inside another worker). In fake-worker mode, multiple concurrent PDF operations terminate each other's tasks ("Worker task was terminated" warnings) — serializing is safer than the throughput win.

**OffscreenCanvas**: `app/utils/thumbnail.ts` and `app/utils/pdf.ts` use `OffscreenCanvas` rather than `document.createElement('canvas')` so they work in both main and worker contexts. `extractTinyThumbnail` and `generatePdfThumbnail` return `Blob` (not data URL).

**PDF.js `OffscreenCanvasFactory`**: passing our own `OffscreenCanvas` as the *target* of `page.render()` is not enough — PDF.js's default `DOMCanvasFactory` calls `document.createElement('canvas')` for **internal auxiliary canvases** (subpixel-AA font detection, intermediate image-scaling buffers). In a worker, `document` is undefined and rendering crashes silently with `Cannot read properties of undefined (reading 'createElement')`. `app/utils/pdf.ts` defines a custom `OffscreenCanvasFactory` (`{ create, reset, destroy }`) and passes it via `getDocument({ CanvasFactory: OffscreenCanvasFactory })` only when `typeof document === 'undefined'`. In a normal page context the default `DOMCanvasFactory` is used. Without this, simple PDFs render fine but anything with text + AA or images blows up — the user-visible symptom was "stage 0 only".

**PDF.js verbosity**: `pdfjs.getDocument(...)` calls pass `verbosity: 0` (errors only) to silence the high-frequency `"Worker task was terminated"` warnings PDF.js emits on every `doc.destroy()` in fake-worker mode. They are non-fatal (PDF.js logs them with "ignoring errors") but spam the console.

## Presign → PUT → PATCH pattern (stages 2–3)

Stage 1 never leaves the browser, so only stages 2 and 3 run this:

1. `GET /api/thumbnails/:itemId/presign` → `{ uploadUrl, viewUrls: { 2, 3 } }` (5-minute PUT with **no ACL**, plus one signed GET per persisted stage, from `presignThumbnailUpload`)
2. `PUT blob` to S3 `uploadUrl` with `Content-Type: image/webp` only (`putThumbnailToS3`) — **never** an `x-amz-acl` header: Tigris applies that header even unsigned on a bucket that allows object ACLs, which would publish the thumbnail
3. `PATCH /api/thumbnails/:itemId` with `{ stage, url, width, height }` → echoes `{ ok, stage, url, width, height }` with a freshly **signed** `url`, which is what the fetcher-signal consumer reads as `fetcher.data`. The submitted `url` is only the consumer's optimistic src — the server ignores it

`app/routes/api/thumbnails.ts` exports **only an `action`** (POST creates, PATCH updates, anything else 405) — there is no `GET` loader on the detail route.

**S3 key**: `thumbnails/{itemId}.webp` — one file per item, overwritten as stages improve.

## Thumbnails are private — every read is signed

Nothing in a user bucket is public. `Thumbnail.url` stores a **locator**, not a URL:
`s3://{bucket}/thumbnails/{itemId}.webp?v={stage}`. It can't be loaded as-is, so a read path that forgets to sign it shows a broken image rather than a working public link. Rows written before this change keep the old `https://{bucket}.t3.tigrisfiles.io/...?v=N` form and `parseThumbnailLocator` still reads them, so there was no data migration.

- **Read path**: wrap every query result in `signThumbnails` (`thumbnail-actions.ts`). It walks the result at any depth and signs each `thumbnails[].url`, using the nearest enclosing `id` as the expected item. `getPaginatedItems`, `paginateItems`, `getFolderContent`, `getFavoritedItems`, `getFileItem`, `getSuggestedItems`, pins, locks, search, duplicates, invitations and the two raw-SQL reads all call it, so most routes inherit it. **Authorization stays with the caller** — signing happens after the loader has already scoped the rows.
- **The server derives what it stores.** `updateThumbnail` builds the locator from the session's bucket and requires read permission on the item. A client-supplied `url` would be a read primitive: the server signs whatever is stored, with credentials that reach every user's bucket. `parseThumbnailLocator` refuses anything but `thumbnails/<itemId>.webp`, and an item id that doesn't match the row.
- **Signing is local HMAC work**, no network call: 1.2–1.9 ms per URL, so a page of them is cheap (verified 2026-09-18).

**Cache-bust**: the signing date is rounded to the hour and the expiry is 2 h, so every render within the window produces a byte-identical URL the browser can cache — and a URL is always valid for at least an hour after it is handed out. The stage rides in the signed `response-content-disposition`, so stages 2 and 3 differ. **Never append a param to a signed URL** (`url + '&v=2'`, `buildSrcSet`): it falls outside the signature and Tigris returns 403 (verified 2026-09-16). Responses also carry `Cache-Control: private, max-age=3600` via `response-cache-control`, since the stored objects have none.

**Expiry**: a tab open past the window paints broken images. The first `onError` in `ItemCard.Thumbnail` triggers one revalidation, throttled to once per 10 minutes per tab.

**Per-object ACLs stay off.** `setObjectAclEnabled` (`app/.server/s3.ts`) exists only for the one-off `scripts/sweep-thumbnail-acls.ts`, which makes pre-existing thumbnails private again and turns the flag off. With the flag on, Tigris honours an `x-amz-acl` header from any presigned PUT, signed or not (verified 2026-09-16).

## Gallery query

Always exclude hex-color stage-0 placeholders from both the item filter and the thumbnail select:
```typescript
// where (items must have a real thumbnail)
thumbnails: { some: { url: { not: null }, NOT: { url: { startsWith: '#' } } } }
// select (best thumbnail per item)
thumbnails: { orderBy: { stage: 'desc' }, take: 1, where: { NOT: { url: { startsWith: '#' } } } }
```
`orderBy: { stage: 'desc' }` is what makes `take: 1` mean "highest stage" rather than "whichever row comes back first" — see `app/routes/stash/gallery.tsx`. `ItemCard.Cover` instead picks `thumbnails.find(t => t.stage === 2)` directly, since stage 3 crops are the wrong shape for a cover strip.

**Thumbnail utils** (`app/utils/thumbnail.ts`): `hashToColor` (stage 0 only — legacy, kept for `useThumbnail.ts`), `extractTinyThumbnail`, `canvasResize`, `blurImageBlob`, `dataUrlToBlob`. For video thumbnails: `generateVideoThumbnail(file)` from `app/utils/video.ts`.

**Legacy V1**: `app/hooks/useThumbnail.ts` is the pre-V2 hook (stage 0 hex colors, its own inline compute-worker singleton). It is still exported from `app/hooks/index.ts` but **no component calls it** — don't extend it, and don't mistake it for the live pipeline.

## Web Workers (general)

CPU-intensive work runs off the main thread in `app/workers/`:
- `thumbnail.compute.worker.ts` — the only real thumbnail `Worker` (see above)
- `stash.worker.ts` / `stash.worker.helpers.ts` — language detection and tokenization for stash items
- `stash.ai.ts` — AI inference helpers for the stash worker
- `embedding.ai.ts` — embedding inference
- `thumbnail.ai.ts` — saliency crop; a regular module on main, not a `Worker`
- `ocr.ai.ts` / `ocr-florence.ai.ts` — PDF OCR engines (see the `stashly-ai-inference` skill)
- `ai-queue.ts` — shared **priority** queue so saliency, embedding and OCR never hit WebGPU at once

Workers are loaded via `new Worker(new URL('./workers/...', import.meta.url))`. Type augmentations for third-party worker APIs live in `app/types/tokenizers-augment.d.ts`.
