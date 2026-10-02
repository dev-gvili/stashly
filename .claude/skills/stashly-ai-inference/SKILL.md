---
name: stashly-ai-inference
description: Stashly browser-side AI inference — the shared WebGPU ai-queue and its priorities, PDF OCR (GLM-OCR / Florence-2, engine + pixel-budget dev switches, per-page streaming), and the search-embedding backfill. Load when working on OCR, embeddings, the AI queue, or anything that runs a model in the browser in the Stashly repo.
---

# Stashly Browser AI Inference

Every model in Stashly runs **client-side** on WebGPU via `@huggingface/transformers`. There is no server-side inference. Consumers: image saliency (thumbnail stage 3), text embedding, PDF OCR.

## The shared queue — `app/workers/ai-queue.ts`

One WebGPU context. Concurrent inference crashes with device-lost / context-busy errors, so **every consumer funnels through `enqueue(fn, priority)`** and exactly one job touches the GPU at a time. Never call a model directly.

```ts
type AiPriority = 'interactive' | 'default' | 'background'
```

| Priority | For |
|----------|-----|
| `interactive` | Someone is watching a spinner — a search query being embedded. Jumps the queue. |
| `default` | Upload-time pipeline work. |
| `background` | Backfills, OCR. Nobody is blocked. |

FIFO within a priority; a waiting `interactive` job goes ahead of waiting `background` work. **A running job is never preempted** — WebGPU gives no way to do that. That constraint is why long jobs must *enqueue in small pieces*: `ocrPages` enqueues per page so an interactive job never waits behind more than one page. Any new long-running consumer must do the same.

A failure settles the caller *and* frees the queue (`.finally`), because an unreleased `running` flag deadlocks every later job.

`aiQueueDepth()` exposes `{ waiting, running }` for status UI.

## PDF OCR

Recovers text from PDFs that have **no text layer**. Entry: `streamOcrPdf` (in `@/utils/thumbnail-ocr`) runs after `pdfText` compute comes back empty — the `transcribingScannedPdf` state of the indexing machine in `app/machines/indexing/` (actor `transcribeScannedPdf` in `indexing.actors.ts`), or `useThumbnail` on the legacy path.

- **Rasterization** goes through the compute worker (off main thread); **inference** runs on the main thread through the shared queue, matching every other model.
- **Per-page streaming.** `streamOcrPdf(file, onPage)` renders → transcribes → hands over → drops, one page at a time. Two reasons: a closed tab at page 12 of 15 no longer throws away twelve pages of work (~30s/page), and exactly one decoded bitmap is alive at a time. `onPage` is awaited so persistence back-pressures rendering.
- Each page is persisted immediately via the `save_ocr_page` intent on `POST /api/items`. That intent is in `SEARCH_INDEX_INTENTS` (`app/utils/revalidation.ts`) — it must not revalidate loaders.
- `ocrPdfFallback` is the non-streaming counterpart; the upload path uses the streaming one.
- **Best-effort by construction.** No WebGPU, a model that won't download, a page that won't rasterize — the document stays indexed by name and tags, exactly as it would have been. The failure is *reported*, not swallowed, so a systematically broken OCR path is visible rather than looking like "this PDF just has no text".
- `OCR_MAX_PAGES = 15`.

### Dev switches (localStorage, not settings or env)

Two engines exist side by side and the choice is still open — GLM-OCR 0.9B (~623MB, default, multilingual-ish) vs Florence-2 base-ft (~340MB, English-only). `app/utils/ocr-engine.ts`:

| Key | Values | Notes |
|-----|--------|-------|
| `stashly:ocr-engine` | `glm` \| `florence` \| `compare` | `compare` runs both sequentially and logs the difference — ~960MB and double the time, so it is opt-in |
| `stashly:ocr-max-pixels` | number | Pixel budget per page render |

They live in `localStorage` because they are developer switches that must survive a reload mid-experiment and change without a rebuild. Blocked storage falls back to the default rather than breaking uploads.

**`OCR_MAX_PIXELS` is the most important knob in the pipeline**: ~70% of a page's ~28s is spent before the first token (CPU preprocessing + vision encoder), and both scale with pixel count. Profile before changing anything else. Report real measurements — never `unknown` placeholder telemetry.

## Search-embedding backfill

Heals `SearchChunk` rows whose `vector` is NULL — chunk text is written server-side *before* the browser embeds it, so any interrupted run (tab closed, navigation, WebGPU fault) leaves passages permanently invisible to semantic search with no error to show for it.

Split mirrors `thumbnail-backfill.ts` / `useThumbnailBackfill.ts`:

- `app/utils/embedding-backfill.ts` — pure policy, no fetch/DOM, unit-tested. `PENDING_EMBEDDING_BATCH = 32`, `PENDING_EMBEDDING_MAX = 100`, `MAX_BACKFILL_BATCHES = 8`. `clampPendingLimit` treats the limit as untrusted URL input (`''`, `'abc'`, `'-5'`, `'1e9'` must all land somewhere sane).
- `app/hooks/useEmbeddingBackfill.ts` — effects. **Once per tab** (module flag, not per-mount, so client navigation doesn't restart it), idle-scheduled, batched and capped, enqueued at `background` priority, silent on failure.
- `pending_search_embeddings` loader intent + `save_search_chunk_embeddings` action intent in `app/routes/api/items.ts`.
- Status UI: `app/components/core-components/embedding-backfill-status.tsx`.

A document whose owner never returns stays unembedded — covering that would need a server-side pass.

## Related

- Thumbnail stage 3 (salient crop) also rides this queue — see the `stashly-thumbnail-pipeline` skill.
- What consumes the OCR text and the embeddings — see the `stashly-search` skill.
- Tests: `app/utils/__tests__/ai-queue.test.ts`, `embedding-backfill.test.ts`.
