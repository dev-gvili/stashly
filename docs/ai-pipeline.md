# AI in the browser

Every model in Stashly runs in the browser on WebGPU. There is no server-side
inference: the `/api/ai/*` routes are registered in `app/routes.ts`, but
`app/routes/api/ai.ts` answers every request with
`501 AI API not implemented yet`. The working rules are in the
`stashly-ai-inference` skill.

## What runs, and where it is used

| Use | Model | Code | Used by |
|---|---|---|---|
| Search embeddings | `Xenova/all-mpnet-base-v2` (q4, 768-dim) | `app/workers/embedding.worker.ts`, client `embedding.ai.ts` | indexing and every semantic query ([semantic-search.md](semantic-search.md)) |
| PDF OCR, default | PaddleOCR PP-OCRv6 small (`PaddlePaddle/PP-OCRv6_small_det_onnx` + `_rec_onnx`), on `onnxruntime-web` | `app/workers/paddle-ocr.worker.ts`, client `paddle-ocr.ai.ts`, pure half `app/utils/paddle-ocr.ts` | indexing of PDFs with no text layer |
| PDF OCR, fallback | `onnx-community/GLM-OCR-ONNX` | `app/workers/ocr.ai.ts` | pages PaddleOCR reads with low confidence (Hebrew) |
| PDF OCR, selectable | `onnx-community/Florence-2-base-ft` | `app/workers/ocr-florence.ai.ts` | only with the `stashly:ocr-engine` dev switch |
| Thumbnail salient crop | `Xenova/vit-base-patch16-224`, or the browser's `FaceDetector` when present | `app/workers/thumbnail.ai.ts` | stage 3 of image thumbnails ([thumbnail-pipeline.md](thumbnail-pipeline.md)) |
| Audio pipeline | `Xenova/mms-lid-126` (language), `onnx-community/gemma-4-E4B-it-ONNX` (transcription, `transcribe()` in `app/.client/stashly-ai.ts`), `onnx-community/tiny-aya-global-ONNX` (correction, summary, tags), `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (keywords) | `app/workers/stash.worker.ts`, `stash.ai.ts`, `app/machines/pipeline/` | only the `/:me/stash/demo` page |

`stash.ai.ts` also lists `whisper-large-v3-turbo`, Qwen and Phi models in its
dtype table, but no live code loads them. `StashlyAI.caption` and
`processImage` in `app/.client/stashly-ai.ts` have no callers.
`/:me/stash/ai-studio` is a static design page that runs no model.

## The shared queue

`app/workers/ai-queue.ts`: one WebGPU job at a time, because concurrent
inference loses the device. Every consumer calls `enqueue(fn, priority)`:

| Priority | For |
|---|---|
| `interactive` | someone is waiting (a search query being embedded) |
| `default` | upload-time work |
| `background` | backfills and OCR |

A running job can't be interrupted, so long work is queued in small pieces:
OCR one page per job, embeddings `EMBED_BATCH_SIZE` (16) texts per job. The
batch size also bounds GPU memory. The embedding model and PaddleOCR run in
their own workers; each queue job waits for the worker's answer, so the
one-job rule still holds.

When Windows resets the GPU mid-job, every WebGPU device on it is lost.
`isDeviceLostError` is the shared check: `ocr.ai.ts` drops its cached model,
the embedding and PaddleOCR workers are ended and restarted on the next job,
and an OCR run stops instead of reloading. The embedding model is also released
after 60 s without use (`EMBEDDING_IDLE_RELEASE_MS`).

## PDF OCR

Runs only when a PDF's text layer comes back empty. `ocr.machine.ts`
(indexing, deferred lane) calls `streamOcrPdf` (`app/utils/thumbnail-ocr.ts`),
which for each of up to 15 pages renders the page in the compute worker, reads
it with PaddleOCR, re-reads it with GLM-OCR if the page confidence is below
0.89, saves it with `save_ocr_page`, and drops the bitmap before the next page.
GLM-OCR (and transformers.js with it) loads only when a page falls back.
Failures are reported to `/api/metrics` under the `ocr` stage and leave the
file indexed by name.

Dev switches in `localStorage` (`app/utils/ocr-engine.ts`):
`stashly:ocr-engine` = `paddle` (default) | `glm` | `florence` | `compare`,
and `stashly:ocr-max-pixels`. Measurements behind the engine choice are in
tech-debt item 54.

## Embedding backfill

Chunk text is written on the server before the browser embeds it, so an
interrupted run leaves chunks without vectors. `useEmbeddingBackfill`
(`app/hooks/useEmbeddingBackfill.ts`, policy in
`app/utils/embedding-backfill.ts`) fetches the user's unembedded chunks on a
later visit and embeds them at `background` priority, once per tab and in one
tab at a time (a Web Lock). Status: `app/components/core-components/embedding-backfill-status.tsx`.

## Degraded stages

When an optional stage can't run (no WebGPU, a model that won't load, a PDF
that won't render), the browser reports it to `POST /api/metrics`, counted as
`stashly_client_degraded_total{stage,reason}` (`app/utils/report-degraded.ts`).
Both labels are fixed lists.

## Tests

`app/utils/__tests__/ai-queue.test.ts`, `embedding-backfill.test.ts`,
`paddle-ocr` tests, and `app/workers/__tests__/` (pipeline actors and flow,
with a fake embedding worker, since Vitest can't run a real `Worker`).
