/**
 * Browser-side OCR via `onnx-community/Florence-2-base-ft` on WebGPU.
 *
 * A second, independent implementation of the same job `ocr.ai.ts` does with
 * GLM-OCR, kept side by side so the two can be measured against each other on
 * real documents rather than argued about from model cards. Neither imports
 * the other; `app/utils/ocr-compare.ts` drives both.
 *
 * **Measured, and it lost — do not adopt this without re-reading why.**
 *
 * On a 15-page image-only PDF (Intel Gen12LP) it was 3.5x faster than
 * GLM-OCR — 9.1s/page against 31.8 — and extracted the *same volume* of text
 * (476 chars/page against 453). Both numbers argue for it. The raw output
 * does not:
 *
 *   GLM-OCR:    "...browser-side WebGPU AI inference, XState 5 orchestration"
 *   Florence-2: "...Browser-side Side PU ATinference, Xstate 5 ororch"
 *
 * It emits no word separation (`Architecture ofCLIENT:BROWSER`), interleaves
 * diagram captions into body text because it has no reading-order model, and
 * garbles technical vocabulary. `WebGPU AI inference` became `PU ATinference`,
 * so a phrase search that succeeds against GLM-OCR's text finds nothing
 * against this.
 *
 * The cause is architectural: this is a 0.23B general vision model with an
 * `<OCR>` task token, built for scene text and captions, whereas GLM-OCR is
 * purpose-built for document transcription — layout analysis, reading order,
 * dense text. Speed was never the binding constraint; fidelity was.
 *
 * It is also English-only, with no published RTL support, so it never
 * addressed the Hebrew requirement that started the search for a model.
 *
 * Kept so the comparison can be re-run rather than re-argued. Selectable via
 * `app/utils/ocr-engine.ts` (`'florence'` or `'compare'`).
 *
 * Also worth knowing: unlike GLM-OCR, every Florence-2 ONNX variant is a
 * single self-contained file — no `.onnx_data` sidecars — so the
 * external-data failure that blocked GLM-OCR cannot happen here.
 *
 * Two API differences from the chat-style VLMs, both easy to get wrong:
 *   1. The processor is called `(image, task)` — image first, the reverse of
 *      `Qwen2VLProcessor`/`Glm46VProcessor`'s `(text, images)`.
 *   2. Decoding must keep special tokens (`skip_special_tokens: false`);
 *      `post_process_generation` parses them to extract the task's answer.
 *
 * @see app/workers/ocr.ai.ts — the GLM-OCR implementation this is compared to
 */
import {
  AutoProcessor,
  Florence2ForConditionalGeneration,
  RawImage,
  type ProgressCallback,
} from '@huggingface/transformers'
import { createModelCache, enqueue } from './ai-queue'

const MODEL_ID = 'onnx-community/Florence-2-base-ft'

/** Florence-2's native transcription task token. */
const OCR_TASK = '<OCR>'

/** Pages sent through the model per document. Matches `ocr.ai.ts` for fairness. */
export const FLORENCE_MAX_PAGES = 15

/** Cap on characters kept per page, mirroring `extractPdfText`'s budget. */
const OCR_MAX_CHARS_PER_PAGE = 6_000

/** Generation ceiling per page. Dense slide text needs the headroom. */
const MAX_NEW_TOKENS = 1024

/**
 * Pause between pages.
 *
 * On integrated Intel graphics the browser needs a moment to reclaim the
 * previous page's VRAM buffers before the next allocation. Without it, a long
 * document walks steadily toward an out-of-memory crash on exactly the
 * hardware this is meant to help.
 */
const VRAM_YIELD_MS = 100

/**
 * The processor and model, loaded on first use and dropped when their WebGPU
 * device is lost, so the next page loads them on a fresh device instead of
 * failing against the dead one. A failed load is not kept either.
 */
const modelCache = createModelCache(
  async (onProgress?: ProgressCallback) => {
    console.info(`[ocr:florence] loading ${MODEL_ID} (~340MB on first run)…`)
    const loadStart = performance.now()
    try {
      const [processor, model] = await Promise.all([
        AutoProcessor.from_pretrained(MODEL_ID, {
          progress_callback: onProgress,
        }),
        Florence2ForConditionalGeneration.from_pretrained(MODEL_ID, {
          device: 'webgpu',
          // Split by what each component is sensitive to. fp16 on the vision
          // side uses the adapter's `shader-f16` path; 4-bit on the language
          // side keeps the buffers well under the 2GB `maxBufferSize` an
          // integrated GPU exposes.
          //
          // ~340MB total: vision 175, embed 75, decoder 61, encoder 29.
          dtype: {
            embed_tokens: 'fp16',
            vision_encoder: 'fp16',
            encoder_model: 'q4',
            decoder_model_merged: 'q4',
          },
          progress_callback: onProgress,
        }),
      ])
      console.info(
        `[ocr:florence] model ready in ${Math.round((performance.now() - loadStart) / 1000)}s`,
      )
      return { processor, model }
    } catch (err) {
      console.error(
        `[ocr:florence] model load FAILED for ${MODEL_ID}: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
      throw err
    }
  },
  ({ model }) => model.dispose(),
)

function getModel(onProgress?: ProgressCallback) {
  return modelCache.get(onProgress)
}

/**
 * Drops the cached model when `err` is a lost WebGPU device. True when it did,
 * so a page loop can stop instead of failing every later page the same way.
 */
function discardModelIfDeviceLost(err: unknown): boolean {
  if (!modelCache.failed(err)) return false
  console.warn('[ocr:florence] WebGPU device lost — the model will reload on next use')
  return true
}

/** Progress for a multi-page run. */
export interface FlorenceOcrProgress {
  page: number
  totalPages: number
  charsSoFar: number
}

/**
 * Transcribe one rendered page with the `<OCR>` task.
 *
 * Returns the generated token count alongside the text so callers can report
 * tokens/sec — the only reliable signal of whether WebGPU is really engaged,
 * since ONNX Runtime never reports which execution provider it chose.
 */
async function transcribe(
  processor: any,
  model: any,
  image: Blob,
): Promise<{ text: string; generated: number }> {
  const raw = await RawImage.fromBlob(image)

  // Image first — Florence2Processor's signature is `(images, text)`, the
  // opposite of the chat-style VLM processors.
  const inputs = await processor(raw, OCR_TASK)

  const output = await model.generate({
    ...inputs,
    max_new_tokens: MAX_NEW_TOKENS,
    // Transcription is not creative work: sampling invents text that was never
    // on the page, which is worse than a gap in a search index.
    do_sample: false,
  })

  // Special tokens are deliberately kept — `post_process_generation` reads
  // them to find the task's answer. Stripping them yields an unparseable blob.
  const decoded = processor.batch_decode(output, {
    skip_special_tokens: false,
  })

  const parsed = processor.post_process_generation(
    decoded[0] ?? '',
    OCR_TASK,
    raw.size,
  )

  // The post-processor returns `{ '<OCR>': string }` for this task; fall back
  // to the raw decode if a future version changes that shape.
  const text =
    typeof parsed?.[OCR_TASK] === 'string'
      ? parsed[OCR_TASK]
      : String(parsed?.[OCR_TASK] ?? decoded[0] ?? '')

  const promptLength = inputs.input_ids?.dims?.at(-1) ?? 0
  return {
    text: text.trim().slice(0, OCR_MAX_CHARS_PER_PAGE),
    generated: Math.max(0, (output.dims?.at(-1) ?? promptLength) - promptLength),
  }
}

/** Transcribe a single image. */
export function ocrImageFlorence(
  image: Blob,
  onProgress?: ProgressCallback,
): Promise<string> {
  return enqueue(async () => {
    const { processor, model } = await getModel(onProgress)
    try {
      const { text } = await transcribe(processor, model, image)
      return text
    } catch (err) {
      discardModelIfDeviceLost(err)
      throw err
    }
  }, 'background')
}

/**
 * Transcribe rendered pages in order.
 *
 * Mirrors `ocrPages` in `ocr.ai.ts` so the two are measured on equal terms:
 * the model is loaded once up front (a failure aborts rather than retrying per
 * page), each page is a separate `'background'` queue job so an interactive
 * search can jump ahead, and pages are joined the same way `extractPdfText`
 * joins them.
 */
export function ocrPagesFlorence(
  pages: { blob: Blob; pageNum: number }[],
  options: {
    maxPages?: number
    onProgress?: ProgressCallback
    onPage?: (progress: FlorenceOcrProgress) => void
  } = {},
): Promise<{ text: string; pagesRead: number }> {
  const { maxPages = FLORENCE_MAX_PAGES, onProgress, onPage } = options

  return (async () => {
    if (pages.length === 0) return { text: '', pagesRead: 0 }

    const slice = pages.slice(0, maxPages)
    const parts: string[] = []
    let chars = 0

    console.info(
      `[ocr:florence] starting — ${slice.length} page(s) via ${MODEL_ID}. First run downloads ~340MB.`,
    )
    const startedAt = performance.now()

    let loaded: Awaited<ReturnType<typeof getModel>>
    try {
      loaded = await enqueue(() => getModel(onProgress), 'background')
    } catch (err) {
      console.error(
        `[ocr:florence] aborting — ${MODEL_ID} could not be loaded.`,
        err,
      )
      throw err
    }

    for (const page of slice) {
      const pageStart = performance.now()
      try {
        const { text, generated } = await enqueue(
          () => transcribe(loaded.processor, loaded.model, page.blob),
          'background',
        )
        if (text) {
          parts.push(text)
          chars += text.length
        }
        const elapsed = performance.now() - pageStart
        const rate = generated > 0 ? (generated / (elapsed / 1000)).toFixed(1) : '?'
        console.info(
          `[ocr:florence] page ${page.pageNum}/${slice.length}: ${text.length} chars, ` +
            `${generated} tokens in ${Math.round(elapsed)}ms (${rate} tok/s)`,
        )
      } catch (err) {
        console.error(`[ocr:florence] page ${page.pageNum} failed`, err)
        // `loaded` is bound to the dead device, so every later page would fail
        // the same way.
        if (discardModelIfDeviceLost(err)) break
      }
      onPage?.({ page: page.pageNum, totalPages: slice.length, charsSoFar: chars })

      // Let the GC reclaim the page's VRAM before the next allocation.
      await new Promise((resolve) => setTimeout(resolve, VRAM_YIELD_MS))
    }

    const text = parts.join('\n\n').trim()
    const seconds = Math.round((performance.now() - startedAt) / 1000)
    if (text.length === 0) {
      console.warn(
        `[ocr:florence] done but empty — ${slice.length} page(s) produced no text in ${seconds}s.`,
      )
    } else {
      console.info(
        `[ocr:florence] done — ${text.length} chars from ${slice.length} page(s) in ${seconds}s`,
      )
    }
    return { text, pagesRead: slice.length }
  })()
}
