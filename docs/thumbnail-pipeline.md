# Thumbnail pipeline

Thumbnails are made in the browser, as WebP, only for cards that come on
screen. The working rules for changing this code are in the
`stashly-thumbnail-pipeline` skill, and the state chart is in
`app/machines/thumbnail/README.md`. This page is the map.

## Trigger

`useThumbnailWhenVisible` (`app/machines/thumbnail/hooks.ts`), attached to
`ItemCard.Thumbnail` and `ItemCard.Cover`, is the only trigger. A card without
a thumbnail asks the scheduler for one when it becomes visible. Nothing is made
for a card nobody has seen, including fresh uploads.

An upload does not start thumbnail work. When a file reaches `itemCreated`,
`upload-thumbnail-runner.tsx` calls `holdUploadedFile(id, file)`
(`held-files.ts`), so a card that comes on screen later can use the local file
instead of downloading it.

## Scheduler

`thumbnail-manager.machine.ts`, one module-scope actor, has two lanes chosen by
where the bytes come from:

| Lane | When | At a time | Paused |
|---|---|---|---|
| `memoryLane` | the file was uploaded in this tab and is still held | 4 | never |
| `downloadLane` | the original must be downloaded; the salient crop is skipped | 2 | while an upload is moving bytes |

Both lanes start the newest request first. A queued job is dropped when its
card leaves the screen; a running one finishes. `attempt-store.ts` remembers
failures per kind of job, and only download failures go to the
`sessionStorage` skip list.

The scheduler uses plain `fetch`, not `useFetcher`, so a thumbnail never
revalidates the route. A card repaints from the manager's progress map
(`useLiveThumbnail`), and a thumbnail made in this tab counts as done until
the next load.

## Per-item machine

`thumbnail-item.machine.ts` runs one job. Its states name each step
(`downloadingOriginal`, `paintingBlurPreview`, `resizingThumbnail`,
`requestingUploadUrl`, `uploadingResizedThumbnail`, `savingResizedThumbnail`,
`croppingSalientRegion`, …) and end in `thumbnailed`, `noThumbnailForType`,
`alreadyThumbnailed`, `sourceUnavailable` or `failed`. A failed step waits
800 ms and retries a limited number of times. Every state has a
`description`, checked by `__tests__/state-descriptions.test.ts`.

## Stages

| Stage | Output | Stored |
|---|---|---|
| 1 | 8×8 blur preview | No. A local object URL only |
| 2 | 512 px resize | `thumbnails/{itemId}.webp`, stage 2 |
| 3 | Salient crop, images only | Same key, overwritten, stage 3 |

Stage 0 (a hex colour placeholder) is no longer produced; old rows keep it in
`Thumbnail.color`.

The per-type code is in `app/utils/thumbnail-stages/`: one producer per type
(`image.ts`, `pdf.ts`, `video.ts`, `text.ts`), each with `preview`, `resize`
and optionally `salientCrop`, chosen by `producerFor(file)` from `PRODUCERS`
in that order. A new file type is one producer file and one entry in
`PRODUCERS`. PDFs, text and video stop after stage 2.

- Video: the stage-1 frame grab (`generateVideoThumbnail`) feeds stage 2. It
  runs on the main thread because it needs a `<video>` element.
- Text: `app/utils/text-thumbnail.ts` draws the start of the file on a white
  page (monospace for code and config, sans-serif for prose).
- Stage 3: `generateSalientCrop` in `app/workers/thumbnail.ai.ts` (a module on
  the main thread, not a worker). It goes through `app/workers/ai-queue.ts`
  like every other WebGPU job.

## Compute worker

`app/workers/thumbnail.compute.worker.ts` is one shared worker, reached through
`compute()` in `app/utils/compute-worker.ts`. It runs one operation at a time
(PDF.js inside a worker falls back to fake-worker mode, where concurrent
documents kill each other's tasks) with a 30 s timeout per operation (180 s for
`pdfPages`). Its operations: `tinyImage`, `tinyPdf`, `tinyText`,
`resizeImage`, `resizePdf`, `resizeText`, `pdfText`, `pdfPages`, `pdfPageAt`,
`pdfMeta`, `mdMeta`, `imageDimensions`. Indexing and OCR use it too.

`app/utils/pdf.ts` passes PDF.js a custom `OffscreenCanvasFactory` when there
is no `document`, because PDF.js creates helper canvases with
`document.createElement` otherwise.

## Storage and the API

`/api/thumbnails/:itemId` (`app/routes/api/thumbnails.ts`, actions in
`app/.server/thumbnail-actions.ts`):

| Request | Does |
|---|---|
| `GET ?intent=presign` | `presignThumbnailUpload`: a short-lived PUT for `thumbnails/{itemId}.webp` plus a signed GET per stage |
| `GET ?intent=source` | `getThumbnailSource`: re-checks read access and the 16 MB cap (`BACKFILL_MAX_BYTES`), and returns a short-lived GET on the original, or `{ status: 'exists' }` when the thumbnail was already made |
| `POST` / `PATCH` | `createThumbnail` / `updateThumbnail`: records a stage |

- The PUT carries only `Content-Type: image/webp`, never an `x-amz-acl`
  header: nothing in a user bucket is public.
- `Thumbnail` stores `bucket` and `stage`; the server sets `bucket` from the
  item's file, never from the request. `url` is deprecated and written as null.
- Every read is signed on the server: query results go through
  `signThumbnails`, which signs each thumbnail for its item. The signing time
  is rounded so repeated renders give the same URL and the browser can cache
  it. The stage is part of the signed request, so stages 2 and 3 get different
  URLs. Never append a query parameter to a signed URL: Tigris answers 403.
- `app/.server/s3.ts` sets `requestChecksumCalculation: 'WHEN_REQUIRED'`;
  without it presigned PUTs from the browser fail a checksum check.

Gallery queries take items that have a stored thumbnail
(`bucket: { not: null }`) and the highest stage (`orderBy: { stage: 'desc' }, take: 1`).
`ItemCard.Cover` uses the stage-2 thumbnail, since a stage-3 crop is the wrong
shape for it.

## Not part of this pipeline

Search indexing (metadata, chunk embeddings, PDF text and OCR) runs in
`app/machines/indexing/`, for every upload whether or not it is on screen. See
[semantic-search.md](semantic-search.md) and [ai-pipeline.md](ai-pipeline.md).
