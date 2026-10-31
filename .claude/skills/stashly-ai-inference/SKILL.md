---
name: stashly-ai-inference
description: Stashly browser-side AI inference — the shared WebGPU ai-queue and its priorities, PDF OCR (PaddleOCR PP-OCRv6 default on onnxruntime-web, GLM-OCR fallback for low confidence, Florence-2, engine + pixel-budget dev switches, per-page streaming), and the search-embedding backfill. Load when working on OCR, embeddings, the AI queue, or anything that runs a model in the browser in the Stashly repo.
---

# Stashly Browser AI Inference

Every model in Stashly runs **client-side** on WebGPU, via `@huggingface/transformers` except PaddleOCR, which uses `onnxruntime-web` directly. There is no server-side inference. Consumers: image saliency (thumbnail stage 3), text embedding, PDF OCR.

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

FIFO within a priority; a waiting `interactive` job goes ahead of waiting `background` work. **A running job is never preempted** — WebGPU gives no way to do that. That constraint is why long jobs must *enqueue in small pieces*: `ocrPages` enqueues per page so an interactive job never waits behind more than one page, and `embedTexts` enqueues per `EMBED_BATCH_SIZE` (16) texts. Any new long-running consumer must do the same.

**Batch size is also a memory limit.** GPU memory grows with batch × sequence length²: MPNet's attention scores alone are batch × 12 heads × 512 × 512 × 4 bytes, about 12.6 MB per text. Unbatched, a 338-chunk file asked WebGPU for one 4,253,024,256-byte buffer, over its 2 GiB per-buffer limit; the call failed and **every later embedding in the tab failed with the same message**. A 170-chunk file fit and took the GPU process from about 5 GB to 10.9 GB, which it never gave back (measured 2 Oct 2026). Never pass a model an unbounded array.

**Models hold their memory until disposed.** On integrated graphics (the dev machine is an Intel UHD with 0 MB dedicated) every byte the GPU holds is system RAM, and a loaded pipeline keeps its buffers until `dispose()` or the tab closes. `embedding.ai.ts` releases the embedding model after `EMBEDDING_IDLE_RELEASE_MS` (60 s) without use, as a `background` queue job so it never releases under a running inference; the next call reloads it. Measured: GPU process 1,551 → 199 MB about 60 s after the last batch (2 Oct, when the model still ran on the page). The image (ViT) and OCR models do not do this yet.

**The embedding model runs in a dedicated worker** (`app/workers/embedding.worker.ts`, since 2026-10-09). `embedding.ai.ts` is only its main-thread client, and its API is unchanged. Each batch is still one `ai-queue` job, and that job awaits the worker's reply, so the one-GPU-job-at-a-time rule holds across the page and the worker even though the worker has its own WebGPU device. Release is `worker.terminate()`, which frees that whole device; a worker that errors is discarded and the next call starts a fresh one. Unit tests can't run a real `Worker` (Node env): `app/workers/__tests__/fake-embedding-worker.ts` speaks the same message protocol. The other models (saliency, OCR) still run on the page.

A failure settles the caller *and* frees the queue (`.finally`), because an unreleased `running` flag deadlocks every later job.

**A lost GPU device must drop every cached model.** Windows' GPU watchdog (TDR) can reset the device mid-inference (`DXGI_ERROR_DEVICE_HUNG`, seen 31 Oct 2026 on page 1 of a GLM-OCR run on an NVIDIA Turing card). That reset kills every WebGPU device on the adapter, the embedding worker's included. A model cached across jobs then fails every later call with `[Device] is lost`, and before the fix 30 indexing jobs in a row did. `isDeviceLostError` (`ai-queue.ts`) is the shared check. `ocr.ai.ts` drops `modelPromise` on it, and `embedding.ai.ts` ends the worker on it. `streamOcrPdf` stops the run instead of reloading 623 MB to hang the GPU again on the next page. Saliency goes through `PipelineManager` (`stash.ai.ts`), which already resets on `device.lost`. Any new consumer that caches a model needs the same handling.

`aiQueueDepth()` exposes `{ waiting, running }` for status UI.

## PDF OCR

Recovers text from PDFs that have **no text layer**. Entry: `streamOcrPdf` (in `@/utils/thumbnail-ocr`) runs after `pdfText` compute comes back empty — `ocr.machine.ts` in `app/machines/indexing/` (actor `transcribeScannedPdf` in `indexing.actors.ts`), in the indexing queue's deferred lane, which is paused while uploads are in flight and resumes after 2 s idle. It saves each page and hands the page's chunks to `embed.machine.ts` for vectors; OCR embeds nothing itself (tech-debt item 53).

- **Rasterization** goes through the compute worker (off main thread); **inference** runs on the main thread through the shared queue, matching every other model.
- **Per-page streaming.** `streamOcrPdf(file, onPage)` renders → transcribes → hands over → drops, one page at a time. Two reasons: a closed tab at page 12 of 15 no longer throws away twelve pages of work (~30s/page), and exactly one decoded bitmap is alive at a time. `onPage` is awaited so persistence back-pressures rendering.
- Each page is persisted immediately via the `save_ocr_page` intent on `POST /api/items`. That intent is in `SEARCH_INDEX_INTENTS` (`app/utils/revalidation.ts`) — it must not revalidate loaders.
- `ocrPdfFallback` is the non-streaming counterpart; the upload path uses the streaming one.
- **Best-effort by construction.** No WebGPU, a model that won't download, a page that won't rasterize — the document stays indexed by name and tags, exactly as it would have been. The failure is *reported*, not swallowed, so a systematically broken OCR path is visible rather than looking like "this PDF just has no text".
- `OCR_MAX_PAGES = 15`, in `ocr-engine.ts` (engine-neutral).

### Default engine: PaddleOCR PP-OCRv6 (since 31 Oct 2026)

`app/workers/paddle-ocr.ai.ts` runs Baidu's `PaddlePaddle/PP-OCRv6_small_det_onnx` (10 MB) and `_small_rec_onnx` (21 MB) on **`onnxruntime-web` directly** (`onnxruntime-web/webgpu`, WebGPU then WASM), not transformers.js. transformers.js 4.3 has no `paddleocr_vl` architecture, and the PaddleOCR-VL ONNX exports on the Hub are CPU/OpenVINO builds without a KV cache, so VL is not an option in the browser. Port of the `runemic-ai/ocr-arena` Space's `paddle.js`.

- **Pure half** in `app/utils/paddle-ocr.ts`, unit-tested: dictionary from `inference.yml`, detector input (long side 960, multiples of 32, BGR, ImageNet norm), DB box extraction with v6 thresholds 0.2 / 0.45 / unclip 1.4 (the Space hard-codes v5's), recognizer input (height 48), greedy CTC, reading order, `pageConfidence`.
- **Models pinned to commits** and kept in Cache Storage (`stashly-paddle-ocr-v6`); `resolve` redirects to short-lived signed URLs, so the HTTP cache rarely keeps them. Bump the cache name with the commits.
- **Sessions are created one after the other**: ORT's WebGPU backend throws "another WebGPU EP inference session is being created" on a parallel create.
- The ORT WASM file is the build's own asset (Vite emits it from `import.meta.url`), not a CDN.
- **No Hebrew.** A page whose `pageConfidence` is below `PADDLE_FALLBACK_BELOW` (0.89) is re-read with GLM-OCR in `streamOcrPdf`. Measured: 27 real English scan pages 0.92–0.997; synthetic Hebrew 0.649 (Arial) and 0 (David); Hebrew mixed with Latin and digits 0.868. `pageConfidence` skips empty *picture-shaped* regions (aspect < `EMPTY_LINE_MIN_ASPECT` = 3): counting the detector's icon boxes at confidence 0 sent an English cover (0.848) to GLM, which then reset the GPU. Empty *line-shaped* regions still count, or a Hebrew page that reads as nothing looks blank. A misrouted page is not free: GLM-OCR has hung this NVIDIA Turing twice. `ocr.ai.ts`, and with it transformers.js, loads only when a page falls back.
- Measured 31 Oct 2026 (NVIDIA Turing) on the real 12-page, 443-line "Stashly upload load audit.pdf": 17.5–17.8 s warm through `streamOcrPdf` (GLM-OCR took ~28 min on the same file). `PADDLE_MAX_PIXELS = 2_000_000` (≈A4 at 150 dpi), untuned.
- **Cost grows with lines, not pixels.** Each page logs `detect / recognize / decode` and the recognizer output size. The recognizer emits ~18,000 class scores per step, so a dense page copies 120–370 MB back from the GPU, and that readback dominates. Lines are batched 8 per run, sorted by aspect ratio and zero-padded (`REC_BATCH_SIZE`): recognition 12.9 → 7.0 s on that file, total −25%. The next lever is an argmax on the GPU (an ONNX graph edit), not more batching. Measure on a real PDF, not a synthetic page: synthetic pages hid this speed-up.

### Dev switches (localStorage, not settings or env)

`app/utils/ocr-engine.ts`. GLM-OCR 0.9B (~623MB, multilingual-ish) and Florence-2 base-ft (~340MB, English-only) stay selectable:

| Key | Values | Notes |
|-----|--------|-------|
| `stashly:ocr-engine` | `paddle` (default) \| `glm` \| `florence` \| `compare` | `compare` runs GLM-OCR and Florence-2 sequentially and logs the difference — ~960MB and double the time, so it is opt-in |
| `stashly:ocr-max-pixels` | number | Pixel budget per page render, for whichever engine runs |

They live in `localStorage` because they are developer switches that must survive a reload mid-experiment and change without a rebuild. Blocked storage falls back to the default rather than breaking uploads.

**For GLM-OCR, `OCR_MAX_PIXELS` is the most important knob**: ~70% of a page's ~28s is spent before the first token (CPU preprocessing + vision encoder), and both scale with pixel count. Profile before changing anything else. Report real measurements — never `unknown` placeholder telemetry.

## Search-embedding backfill

Heals `SearchChunk` rows whose `vector` is NULL — chunk text is written server-side *before* the browser embeds it, so any interrupted run (tab closed, navigation, WebGPU fault) leaves passages permanently invisible to semantic search with no error to show for it.

Pure policy in one file, effects in a hook:

- `app/utils/embedding-backfill.ts` — pure policy, no fetch/DOM, unit-tested. `PENDING_EMBEDDING_BATCH = 32`, `PENDING_EMBEDDING_MAX = 100`, `MAX_BACKFILL_BATCHES = 8`. `clampPendingLimit` treats the limit as untrusted URL input (`''`, `'abc'`, `'-5'`, `'1e9'` must all land somewhere sane).
- `app/hooks/useEmbeddingBackfill.ts` — effects. **Once per tab** (module flag, not per-mount, so client navigation doesn't restart it) and **one tab at a time** (the `stashly:embedding-backfill` Web Lock via `runInOneTab`; a tab that finds it held reports `skipped`, "Running in another tab"), idle-scheduled, batched and capped, enqueued at `background` priority, silent on failure.
- `pending_search_embeddings` loader intent + `save_search_chunk_embeddings` action intent in `app/routes/api/items.ts`.
- Status UI: `app/components/core-components/embedding-backfill-status.tsx`.

A document whose owner never returns stays unembedded — covering that would need a server-side pass.

## Related

- Thumbnail stage 3 (salient crop) also rides this queue — see the `stashly-thumbnail-pipeline` skill.
- What consumes the OCR text and the embeddings — see the `stashly-search` skill.
- Tests: `app/utils/__tests__/ai-queue.test.ts`, `embedding-backfill.test.ts`.
