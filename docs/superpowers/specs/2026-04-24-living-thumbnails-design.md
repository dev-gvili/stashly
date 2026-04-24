# Living Thumbnails — Design Spec

**Date:** 2026-04-24  
**Status:** Approved  
**Scope:** Phase 1 = images + videos + PDFs. Phase 2+ = all file types + AI enhancement.

---

## Overview

Thumbnails are not generated once — they evolve through 5 progressive stages, each enriching the same `Thumbnail` DB record in place. The UI renders whatever stage is available and upgrades automatically as higher stages arrive, giving users instant visual feedback that keeps getting sharper without any explicit loading state.

---

## Trigger

- **Primary:** Eager, automatic — thumbnail generation begins the moment a file is selected for upload (Stage 0) and completes asynchronously after upload finishes (Stages 2–4).
- **Secondary (future):** On-demand — if a thumbnail is missing when an item is first displayed in the gallery, trigger generation then.

---

## Scope

- **Phase 1 (this spec):** Images, videos, PDFs
- **Phase 2 (next session):** All file types — code (cityscape AST visualization), CSV (heatmap), archives (treemap), text (constellation from embeddings)
- **Phase D (end game):** Full AI enhancement — smart crop, best-frame selection for video, VLM caption overlay for all types

---

## The 5 Stages

| Stage | Trigger | Source | AI | Output |
|-------|---------|--------|----|--------|
| 0 | File selected (sync) | Filename + type hash | No | Hex color string stored in `url` |
| 1 | First upload chunk decoded | file.machine | No | 4×4 JPEG upscaled (blurhash-style) |
| 2 | Upload complete | Full file blob / PDF.js | No | 512×512 JPEG resize or PDF page 1 |
| 3 | After stage 2 | Stage 2 thumbnail | Yes — ViT saliency | Smart-cropped JPEG |
| 4 | After stage 3 | Stage 3 thumbnail | Yes — LiquidAI VLM | Caption overlay JPEG |

Stages 3 and 4 are skipped silently when WebGPU is unavailable (WASM fallback not used for these — too slow).

---

## Architecture

### Workers

Two separate workers — thumbnail generation does not compete with the audio/text pipeline:

- **`thumbnail.worker.ts`** — boots the thumbnail XState machine, throttled postMessage (same pattern as `stash.worker.ts`)
- **`stash.worker.ts`** — unchanged, handles audio/text pipeline

### Machines

- **`thumbnail.machine.ts`** — XState machine with states: `idle → stage0 → stage1 → stage2 → stage3 → stage4 → complete | error`
- **`thumbnail.actors.ts`** — `fromCallback` actors bridging machine ↔ worker (mirrors `pipeline.actors.ts` pattern)

### AI Models

| Stage | Model | Already in MODEL_DTYPE? |
|-------|-------|------------------------|
| 3 | `Xenova/vit-base-patch16-224` | No — add |
| 4 | `LiquidAI/LFM2.5-VL-1.6B-ONNX` | Yes |

### Storage

All thumbnails stored as `content` (PostgreSQL `bytea`) in the `Thumbnail` table. Stage 0 exception: hex color stored in `url` field, `content` is null.

Served via `GET /api/thumbnails/:itemId` as `image/jpeg`. Cache busted by appending `?v={stage}` to the src URL.

### Schema Change

Add `stage Int @default(0)` to the `Thumbnail` model. One `Thumbnail` record per item targeting `grid` view + `medium` size. Updated in place as stages progress. Other view variants (river, waterfall) reuse the same content bytes for now — per-view thumbnails are a Phase 2+ concern.

---

## New Files

| File | Purpose |
|------|---------|
| `prisma/models/thumbnail.prisma` | Add `stage` field |
| `app/workers/thumbnail.worker.ts` | Worker entry point |
| `app/workers/thumbnail.ai.ts` | `extractColorSample()`, `canvasResize()`, `generateSalientCrop()`, `generateCaption()` |
| `app/machines/thumbnail/thumbnail.machine.ts` | XState machine (5 stage states) |
| `app/machines/thumbnail/thumbnail.actors.ts` | XState actors |
| `app/.server/thumbnail-actions.ts` | `createThumbnail()`, `updateThumbnail()`, `getThumbnailByItemId()` |
| `app/routes/api/thumbnails.ts` | POST / PATCH / GET endpoints |
| `app/hooks/useThumbnail.ts` | `useThumbnail(itemId)` → `{ stage, src }` |

---

## Modified Files

| File | Change |
|------|--------|
| `app/machines/upload/upload.machine.ts` | After upload done: emit `THUMBNAIL_START` with `{ itemId, file }` |
| `app/machines/upload/file.machine.ts` | On first chunk decoded: extract 4×4 sample, emit `THUMBNAIL_STAGE1` |
| `app/schemas/api.schemas.ts` | Add `ThumbnailCreateSchema`, `ThumbnailUpdateSchema` |
| `app/components/Gallery.tsx` | Use `/api/thumbnails/:itemId?v={stage}` as img src |
| `app/components/views/river-view.tsx` | Same |
| `app/components/views/waterfall-view.tsx` | Same |
| `app/types/machine.types.ts` | Add `ThumbnailContext`, `ThumbnailEvents`, `ThumbnailStage` |
| `app/workers/thumbnail.ai.ts` | Add `Xenova/vit-base-patch16-224` to `MODEL_DTYPE` |

---

## Data Flow

```
Stage 0:  client (sync)     → POST   /api/thumbnails       → DB { stage:0, url:'#hex' }
Stage 1:  file.machine      → PATCH  /api/thumbnails/:id   → DB { stage:1, content:<4x4 JPEG> }
Stage 2:  thumbnail.worker  → PATCH  /api/thumbnails/:id   → DB { stage:2, content:<512px JPEG> }
Stage 3:  thumbnail.worker  → PATCH  /api/thumbnails/:id   → DB { stage:3, content:<smart-crop JPEG> }
Stage 4:  thumbnail.worker  → PATCH  /api/thumbnails/:id   → DB { stage:4, content:<captioned JPEG> }

GET /api/thumbnails/:itemId
  stage 0 → 204 No Content (UI renders hex color div)
  stage 1–4 → 200 image/jpeg, Cache-Control: max-age=3600
```

The `useThumbnail(itemId)` hook exposes `{ stage, src }`. When a PATCH completes, the hook increments `?v={stage}` on the src URL — browser re-fetches new bytes, old ones drop from cache.

---

## Video Frame Extraction

`HTMLVideoElement` is not available in workers. Flow:

1. thumbnail.machine sends `EXTRACT_VIDEO_FRAME` to main thread
2. Main thread creates `<video>`, seeks to 15% duration, captures to `<canvas>`
3. Canvas `toBlob()` → `ImageBitmap` transferred back to worker via `postMessage`
4. Worker continues from Stage 2 as normal

---

## PDF Rendering

`pdf.js` supports `OffscreenCanvas` — runs fully in the thumbnail worker, no main thread needed.

1. Load PDF from File blob via `pdfjsLib.getDocument({ data: arrayBuffer })`
2. Render page 1 to `OffscreenCanvas` at 512px width
3. Extract as JPEG bytes → Stage 2 output

---

## Error Handling

- Any stage failure → machine stays at current stage, error logged, never blocks upload
- No WebGPU → stages 3 and 4 skipped silently; stage 2 always runs
- First chunk too small / non-image for stage 1 → skip to stage 2
- Video frame extraction fails → fall back to colored square with video icon
- PDF.js fails → fall back to colored square with PDF icon
- Thumbnails are non-critical — a missing or partial thumbnail never breaks the app

---

## API Endpoints

```
POST   /api/thumbnails
  body: { itemId, stage: 0, url: '#hex' }
  returns: { id }

PATCH  /api/thumbnails/:itemId
  body: { stage, content?: Uint8Array, width?, height? }
  returns: 200

GET    /api/thumbnails/:itemId?v={stage}
  returns: image/jpeg (stages 1–4) | 204 (stage 0)
```

---

## Zod Schemas (api.schemas.ts)

```ts
ThumbnailCreateSchema = z.object({
  itemId: z.string(),
  stage: z.literal(0),
  url: z.string(), // hex color e.g. '#3b82f6'
})

// PATCH sends multipart/form-data — content is a Blob/File field
ThumbnailUpdateSchema = z.object({
  stage: z.number().int().min(1).max(4),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  // content arrives as a multipart file field, parsed to Buffer server-side
})
```

---

## UI Behavior

The gallery renders thumbnails as follows based on stage:

- **Stage 0:** Colored `<div>` (hex from `url`) — no `<img>` element
- **Stage 1:** Blurry `<img>` (CSS `image-rendering: pixelated`, upscaled)
- **Stages 2–4:** Normal `<img>` with a smooth CSS opacity transition on each upgrade

The transition between stages is a 300ms CSS cross-fade — old thumbnail fades out as new one fades in. No spinner, no "generating..." text.

---

## Future Phases

**Phase 2 — Non-visual file types (Content DNA):**
- Code files: AST cityscape visualization on canvas
- CSV/spreadsheets: numeric column heatmap
- Archives: treemap of internal file sizes
- Text/markdown: sentence embedding constellation (reuse existing `paraphrase-multilingual-MiniLM-L12-v2`)

**Phase D — Full AI enhancement:**
- Best-frame selection for video (semantic keyframe scoring)
- Face/subject detection for portrait-aware cropping
- VLM caption for all file types including non-visual
