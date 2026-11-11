---
name: stashly-thumbnail-pipeline
description: Stashly client-side 3-stage WebP thumbnail pipeline — the XState scheduler in app/machines/thumbnail (thumbnails made only for cards on screen, memory and download lanes, held upload files), the compute worker, PDF.js OffscreenCanvas handling, presign/PUT/PATCH flow, and gallery thumbnail queries. Load when working on thumbnails, previews, the upload thumbnail runner, or Web Workers.
---

# Stashly Thumbnail Pipeline

Client-side 3-stage progressive generation. All output is **WebP**. Read `app/machines/thumbnail/README.md` before editing anything in it.

**A thumbnail is made when its card comes on screen, and only then.** `useThumbnailWhenVisible` (wired into `ItemCard.Thumbnail` and `ItemCard.Cover` via a callback ref) is the only trigger. Nothing is made for a card nobody has seen — including fresh uploads, and the contents of a folder trashed mid-batch. **Memoize any composed ref** (`composeRefs` in `item-card.tsx`): a fresh callback each render detaches and re-attaches the observer.

**Orchestration is the XState manager in `app/machines/thumbnail/`.** One module-scope manager, two lanes, decided by where the bytes come from:

| Lane | When | Cap | Paused |
|---|---|---|---|
| `memoryLane` (`fromMemory` jobs) | the file was uploaded in this tab and is still held in `held-files.ts` | 4 | never |
| `downloadLane` (`fromDownload` jobs) | no file in memory; the original is downloaded (≤ 16 MB `BACKFILL_MAX_BYTES`) and stage 3 is skipped | 2 | while uploads move bytes (`pauseDownloads`/`resumeDownloads`) |

Both lanes take the newest request first. Retry is 800 ms with a budget of 2; leaving the screen drops a *queued* job only. It calls plain `fetch`, not `useFetcher`, so it does **not** revalidate the route — the card repaints from the manager's progress map (`useLiveThumbnail`).

**Each job is one `thumbnail-item.machine.ts` actor**, a flat machine whose states say what happens (`downloadingOriginal`, `paintingBlurPreview`, `resizingThumbnail`, `uploadingResizedThumbnail`, `croppingSalientRegion`, … ending in `thumbnailed`, `noThumbnailForType`, `alreadyThumbnailed`, `sourceUnavailable` or `failed`). Every state carries a `description`, enforced by `__tests__/state-descriptions.test.ts` for both thumbnail machines; the chart is in the README.

**Upload hand-off**: `upload-thumbnail-runner.tsx` watches for `status === 'itemCreated'` (not `'done'`) and calls `holdUploadedFile(id, file)` plus `enqueueIndexing(id, file)`. It starts no thumbnail work. A card already on screen re-checks when its file arrives (`useSyncExternalStore` on `held-files.ts`), and a queued download job for it switches to memory (`fileHeld` event).

**"Already tried" is per kind of job** (`attempt-store.ts`): a failed memory job releases its file and leaves one download attempt open; only download failures reach the `sessionStorage` skip list. **A thumbnail painted in this tab counts as done**: the loader's `thumbnails` stay empty until a reload, so `requestThumbnail` and the hook both check the progress map.

**Search indexing is not part of this pipeline.** It runs in `app/machines/indexing/`, queued for every upload regardless of visibility: metadata right after each row exists (2 at a time), then chunk embeddings and OCR in a deferred lane that the runner pauses while any upload is in flight and resumes after 2 s idle (tech-debt item 53). `useIndexingRevalidation()` reloads the page once per batch after the metadata lane drains — with `revalidate()`, never `navigate(<current URL>)`, which would cancel a navigation in progress.

**Compute logic lives in `@/utils/thumbnail-stages/` and nowhere else** — one producer per file type (`image.ts`, `pdf.ts`, `video.ts`, `text.ts`, each `{ matches, preview, resize, salientCrop? }`), picked by `producerFor(file)` in match order (text last). The machine's actors are `fromPromise` wrappers around `generateStage1Preview`, `generateStage2Resize`, `generateStage3Salient`, `putThumbnailToS3` and `stageViewUrl` from its index. **A new type is one producer file plus one line in `PRODUCERS`** — don't add a type check to a stage function. The compute-worker RPC is `compute()` in `@/utils/compute-worker` (shared with OCR and metadata); EXIF/ID3/document metadata is `@/utils/media-metadata`, used only by indexing. `thumbnail-pipeline.ts` is gone.

**Stage 0 (hex color) was removed** — old rows keep their placeholder in `Thumbnail.color`, and `signStoredThumbnail` still hands it out as the `url`, so every consumer keeps filtering `url.startsWith('#')`. The pipeline starts at stage 1.

## Downloading the original

`GET /api/thumbnails/:itemId?intent=source` (→ `getThumbnailSource` in `thumbnail-actions.ts`) presigns a 5-minute GET on the original. It re-checks read permission and the 16 MB cap server-side, and returns `{ status: 'exists', url }` when another client already made the thumbnail — the client paints that instead of downloading. **Keep the client and server caps in sync** or the client burns a round trip discovering the server said no. Video is the one type whose stage 2 needs a frame, so stage 1 runs first and feeds it. Type/size eligibility and the Data-Saver/2g opt-out are pure functions in `app/utils/thumbnail-backfill.ts` (`canBackfillThumbnail`, `canThumbnailFromMemory`, `isConnectionTooSlow`), unit-tested.
## Stages

| Stage | What | Mechanism |
|-------|------|-----------|
| 1 | 8×8 blur preview | Image: `extractTinyThumbnail` · Video: `generateVideoThumbnail` · PDF: `generatePdfThumbnail` (from `@/utils/pdf`) · Text: `generateTextThumbnail` (from `@/utils/text-thumbnail`) — **local `URL.createObjectURL` only, NOT persisted to S3 or DB** |
| 2 | 512px resize | Image: `canvasResize(file, 512)` · Video: re-encode frame · PDF: `renderPdfPageToBlob(file, 512)` · Text: `renderTextPageToBlob(file, 512)` → presign → PUT to S3, recorded as `stage: 2` |
| 3 | Salient crop | `generateSalientCrop` in `thumbnail.ai.ts` — **images only**, recorded as `stage: 3`. Native `FaceDetector` (Chrome) crops on the largest face; otherwise a ViT-informed geometric center crop. Serialized through `app/workers/ai-queue.ts` at `'default'` priority, shared with embedding and OCR, because WebGPU can't take concurrent inference |

**Cache-bust**: stages 2/3 share one S3 key; the row's `stage` goes into the signed request, so the signed URL varies per stage — see the signed-read section below.

**S3 client config**: `app/.server/s3.ts` sets `requestChecksumCalculation: 'WHEN_REQUIRED'` on `S3Client`. Without this, AWS SDK v3 signs a CRC32 checksum requirement (`x-amz-checksum-crc32=AAAAAA==`, CRC32 of empty body) into presigned `PutObject` URLs, causing browser PUTs to fail with a checksum mismatch.

PDFs and text-based files stop after stage 2. The PDF.js worker URL is set globally on import in `app/utils/pdf.ts` via `pdfjs-dist/build/pdf.worker.min.mjs?url`.

**PDF text extraction is indexing, not thumbnailing**: the metadata machine's (`indexing-item.machine.ts`) `readingMetadata` state dispatches the `pdfText` compute RPC, and when it comes back empty (a scan with no text layer) the queue hands the file to `ocr.machine.ts`, which runs `streamOcrPdf` — page-by-page OCR (PaddleOCR PP-OCRv6 in its own worker, GLM-OCR for low-confidence pages), persisted per page. It rasterizes each page with the same compute worker (`pdfPageAt`). That path is documented in the `stashly-ai-inference` skill; don't add OCR logic here.

**Text thumbnails**: `app/utils/text-thumbnail.ts` "screenshots" the first ~32 KB of a text-based file (plain text, markdown, code, config) onto an A4-proportioned white page via OffscreenCanvas — sans-serif for prose extensions, monospace for code/config (extension wins over mime because code files often arrive as `text/plain`/`application/octet-stream`). Detection is `isTextRenderableFile`; compute-worker RPC kinds are `tinyText`/`resizeText`. Empty files return null — no thumbnail beats a blank page. Line layout (`layoutTextLines`) is pure and unit-tested in `app/utils/__tests__/text-thumbnail.test.ts`.

## Compute worker

Heavy thumbnail compute runs in a singleton dedicated worker at `app/workers/thumbnail.compute.worker.ts` with an internal concurrency cap of **1** and a 30-second per-op timeout. RPC kinds: `tinyImage` / `tinyPdf` / `tinyText`, `resizeImage` / `resizePdf` / `resizeText`, `pdfText`, `pdfMeta`, `mdMeta`, `imageDimensions`. The producers in `@/utils/thumbnail-stages` and `@/utils/media-metadata` dispatch RPC requests via `compute({ kind, file })` from `@/utils/compute-worker`; The orchestration layer handles HTTP on main. Video thumbnails stay on main because they require `<video>` DOM access. Stage 3 (image AI) also stays on main — it calls into `app/workers/thumbnail.ai.ts`, which is a regular module using WebGPU (not a Worker — the file location is historical).

The cap is 1 because PDF.js inside a dedicated worker falls back to **fake worker mode** (it can't spawn a sub-worker reliably from inside another worker). In fake-worker mode, multiple concurrent PDF operations terminate each other's tasks ("Worker task was terminated" warnings) — serializing is safer than the throughput win.

**OffscreenCanvas**: `app/utils/thumbnail.ts` and `app/utils/pdf.ts` use `OffscreenCanvas` rather than `document.createElement('canvas')` so they work in both main and worker contexts. `extractTinyThumbnail` and `generatePdfThumbnail` return `Blob` (not data URL).

**PDF.js `OffscreenCanvasFactory`**: passing our own `OffscreenCanvas` as the *target* of `page.render()` is not enough — PDF.js's default `DOMCanvasFactory` calls `document.createElement('canvas')` for **internal auxiliary canvases** (subpixel-AA font detection, intermediate image-scaling buffers). In a worker, `document` is undefined and rendering crashes silently with `Cannot read properties of undefined (reading 'createElement')`. `app/utils/pdf.ts` defines a custom `OffscreenCanvasFactory` (`{ create, reset, destroy }`) and passes it via `getDocument({ CanvasFactory: OffscreenCanvasFactory })` only when `typeof document === 'undefined'`. In a normal page context the default `DOMCanvasFactory` is used. Without this, simple PDFs render fine but anything with text + AA or images blows up — the user-visible symptom was "stage 0 only".

**PDF.js verbosity**: `pdfjs.getDocument(...)` calls pass `verbosity: 0` (errors only) to silence the high-frequency `"Worker task was terminated"` warnings PDF.js emits on every `doc.destroy()` in fake-worker mode. They are non-fatal (PDF.js logs them with "ignoring errors") but spam the console.

## Presign → PUT → PATCH pattern (stages 2–3)

Stage 1 never leaves the browser, so only stages 2 and 3 run this:

1. `GET /api/thumbnails/:itemId?intent=presign` → `{ uploadUrl, viewUrls: { 2, 3 } }` (5-minute PUT with **no ACL**, plus one signed GET per persisted stage, from `presignThumbnailUpload`). The PUT targets the bucket holding the item's file, not the caller's
2. `PUT blob` to S3 `uploadUrl` with `Content-Type: image/webp` only (`putThumbnailToS3`) — **never** an `x-amz-acl` header: Tigris applies that header even unsigned on a bucket that allows object ACLs, which would publish the thumbnail
3. `PATCH /api/thumbnails/:itemId` with `{ stage, url, width, height }` → echoes `{ ok, stage, url, width, height }` with a freshly **signed** `url`. The submitted `url` is only the client's optimistic src — the server ignores it

`app/routes/api/thumbnails.ts` has a **loader** for the GET reads, discriminated on `?intent=presign|source`, and an **action** for the writes (POST creates, PATCH updates, anything else 405).

**S3 key**: `thumbnails/{itemId}.webp` — one file per item, overwritten as stages improve.

## Thumbnails are private — every read is signed

Nothing in a user bucket is public. A `Thumbnail` row stores **where the object is, not a URL**: `bucket` + `stage`, with the key derived from the item id (`thumbnails/{itemId}.webp`, `thumbnailLocation`). `url` is the retired locator column and is written `null`; the stage-0 placeholder lives in `color`. A read path that forgets to sign therefore has no URL to show, rather than a working public link.

- **Read path**: wrap every query result in `signThumbnails` (`thumbnail-actions.ts`). It walks the result at any depth, turns each `thumbnails[]` row into a signed `url` (`signStoredThumbnail`) and drops the `bucket`/`color` columns, using the nearest enclosing `id` as the expected item. **Select `bucket`, `stage` and `color`** on every `thumbnails` relation; a row without them signs to `null`. `getPaginatedItems`, `paginateItems`, `getFolderContent`, `getFavoritedItems`, `getFileItem`, `getSuggestedItems`, pins, locks, search, duplicates, invitations and the two raw-SQL reads all call it, so most routes inherit it. **Authorization stays with the caller** — signing happens after the loader has already scoped the rows.
- **The server derives what it stores.** `updateThumbnail` takes the bucket from the item's file (so a collaborator's backfill lands next to the owner's file) and the key from the item id, and requires read permission on the item. A client-supplied location would be a read primitive: the server signs whatever is stored, with credentials that reach every user's bucket. A stored bucket that fails the bucket-name checks signs to `null`.
- **Signing is local HMAC work**, no network call: 1.2–1.9 ms per URL, so a page of them is cheap (verified 2026-09-18).

**Cache-bust**: the signing date is rounded to the hour and the expiry is 2 h, so every render within the window produces a byte-identical URL the browser can cache — and a URL is always valid for at least an hour after it is handed out. The stage rides in the signed `response-content-disposition`, so stages 2 and 3 differ. **Never append a param to a signed URL** (`url + '&v=2'`, `buildSrcSet`): it falls outside the signature and Tigris returns 403 (verified 2026-09-16). Responses also carry `Cache-Control: private, max-age=3600` via `response-cache-control`, since the stored objects have none.

**Expiry**: a tab open past the window paints broken images. The first `onError` in `ItemCard.Thumbnail` triggers one revalidation, throttled to once per 10 minutes per tab.

**Per-object ACLs stay off.** `setObjectAclEnabled` (`app/.server/s3.ts`) exists only for the one-off `scripts/sweep-thumbnail-acls.ts`, which makes pre-existing thumbnails private again and turns the flag off. With the flag on, Tigris honours an `x-amz-acl` header from any presigned PUT, signed or not (verified 2026-09-16).

## Gallery query

Only rows with a stored object count, so filter on `bucket` in both the item filter and the thumbnail select (a stage-0 placeholder has no bucket):
```typescript
// where (items must have a real thumbnail)
thumbnails: { some: { bucket: { not: null } } }
// select (best thumbnail per item) — then sign with signThumbnails
thumbnails: { orderBy: { stage: 'desc' }, take: 1, where: { bucket: { not: null } }, select: { bucket: true, stage: true, color: true, … } }
```
`orderBy: { stage: 'desc' }` is what makes `take: 1` mean "highest stage" rather than "whichever row comes back first" — see `getGalleryMedia` in `thumbnail-actions.ts`, used by `app/routes/stash/gallery.tsx`. `ItemCard.Cover` instead picks `thumbnails.find(t => t.stage === 2)` directly, since stage 3 crops are the wrong shape for a cover strip.

**Thumbnail utils** (`app/utils/thumbnail.ts`): `extractTinyThumbnail`, `canvasResize`, `blurImageBlob`, `dataUrlToBlob`, and `hashToColor` (stage 0 only; nothing calls it outside its own test). For video thumbnails: `generateVideoThumbnail(file)` from `app/utils/video.ts`.

The old hook-based pipeline (`app/hooks/useThumbnail.ts`, `useThumbnailBackfill.ts`, `thumbnail-signal/`) and the `USE_THUMBNAIL_MACHINE` switch were deleted on 2 Oct 2026; the machine is the only path.

## Web Workers (general)

CPU-intensive work runs off the main thread in `app/workers/`:
- `thumbnail.compute.worker.ts` — the only real thumbnail `Worker` (see above)
- `stash.worker.ts` / `stash.worker.helpers.ts` — language detection and tokenization for stash items
- `stash.ai.ts` — AI inference helpers for the stash worker
- `embedding.ai.ts` — embedding inference
- `thumbnail.ai.ts` — saliency crop; a regular module on main, not a `Worker`
- `paddle-ocr.ai.ts` + `paddle-ocr.worker.ts` (default), `ocr.ai.ts` (GLM-OCR fallback), `ocr-florence.ai.ts` — PDF OCR engines (see the `stashly-ai-inference` skill)
- `ai-queue.ts` — shared **priority** queue so saliency, embedding and OCR never hit WebGPU at once

Workers are loaded via `new Worker(new URL('./workers/...', import.meta.url))`. Type augmentations for third-party worker APIs live in `app/types/tokenizers-augment.d.ts`.
