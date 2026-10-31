/**
 * Browser-side OCR via `onnx-community/GLM-OCR-ONNX` on WebGPU.
 *
 * Exists because a PDF with no text layer — a scan, or an export whose pages
 * are images — extracts to zero characters and therefore indexes nothing at
 * all. It uploads fine, thumbnails fine, and is silently unfindable by
 * content. This recovers that text.
 *
 * **Why this model.** It replaced Qwen3-VL-2B, which was chosen for the one
 * thing GLM-OCR does not document: Hebrew. Qwen names Hebrew among 32 OCR
 * languages; Z.ai publishes only "8 languages" without listing them. That
 * choice was reversed on measurement — Qwen3-VL ran at ~4 tok/s on integrated
 * graphics (Intel Gen12LP), about three minutes for a dense page, which is
 * not a usable upload-time cost.
 *
 * GLM-OCR is 0.9B against Qwen's 2B, and the decoder — where generation time
 * actually goes, one forward pass per token — is 322MB against 949MB at the
 * same quantization. It is also purpose-built for document transcription
 * rather than general vision-language work, and scores 94.62 on OmniDocBench
 * v1.5.
 *
 * **The open question is Hebrew**, and it is empirical: if RTL transcription
 * comes back wrong, the plumbing here is model-agnostic and Qwen3-VL is a
 * one-constant revert.
 *
 * Costs: **~623MB of weights** at q4f16 on first use (decoder 322, vision 251,
 * embeddings 50), and generation is autoregressive, so a page takes seconds
 * rather than milliseconds. Both are why this runs only as a fallback and
 * never speculatively.
 *
 * Despite living under `app/workers/`, this is a plain module on the main
 * thread — the same pattern as `embedding.ai.ts` and `thumbnail.ai.ts`.
 * Compute goes to WebGPU rather than to a Worker, and job ordering is shared
 * with all other AI work through `ai-queue.ts`.
 */
import {
  AutoProcessor,
  AutoModelForImageTextToText,
  BaseStreamer,
  RawImage,
  type ProgressCallback,
} from '@huggingface/transformers'
import { enqueue, isDeviceLostError } from './ai-queue'
import { OCR_MAX_PAGES } from '@/utils/ocr-engine'

/**
 * Stamps the moment the first *generated* token arrives.
 *
 * Splits a page's cost into image-side work (encoding the page, processing the
 * prompt) and token generation, which is the only way to know which knob
 * matters: render resolution moves prefill, token caps and decoder size move
 * decode. An earlier attempt used `generate`'s `callback_function`, which is
 * the v2 API — it never fired, and every page reported `decode 0ms`.
 *
 * `generate` pushes the prompt to the streamer before any generated token
 * (this is what `TextStreamer.next_tokens_are_prompt` exists to skip), so the
 * first `put` is discarded and the second marks the real start of decoding.
 */
class FirstTokenTimer extends BaseStreamer {
  firstTokenAt = 0
  private sawPrompt = false

  put(_value: bigint[][]): void {
    if (!this.sawPrompt) {
      this.sawPrompt = true
      return
    }
    if (this.firstTokenAt === 0) this.firstTokenAt = performance.now()
  }

  end(): void {}
}

const MODEL_ID = 'onnx-community/GLM-OCR-ONNX'

/** Cap on characters kept per page, mirroring `extractPdfText`'s budget. */
const OCR_MAX_CHARS_PER_PAGE = 6_000

/**
 * Generation ceiling per page.
 *
 * The dominant cost of a page is autoregressive decoding — one forward pass
 * per token — so this is the main latency lever, ahead of image size. 768
 * tokens is roughly 3,000 characters, more than a typical slide or diagram
 * page and enough for most body text; a page that would exceed it gets
 * truncated rather than holding the queue indefinitely.
 */
const MAX_NEW_TOKENS = 768

/**
 * Pixel budget handed to the processor, matching transformers.js'
 * `smart_resize` default (`14*14*4*1280`).
 *
 * Stated explicitly because {@link renderPdfPagesToBlobs} has to render to the
 * same budget. Rendering larger is pure waste: the processor downscales to
 * this anyway, so the extra pixels cost rasterization time and buy nothing.
 */
export const OCR_MAX_PIXELS = 14 * 14 * 4 * 1280

/**
 * Task instruction given per page.
 *
 * GLM-OCR is task-tuned rather than instruction-tuned: its documented usage is
 * a terse task label, and `Text Recognition:` is the one that yields a plain
 * transcription. A conversational prompt (the kind a general VLM wants) pushes
 * it toward describing the image instead, which would poison the search index
 * with text that is not in the document.
 *
 * Naming no language is deliberate — the point is to recover Hebrew *as*
 * Hebrew, not to have it translated.
 */
const OCR_PROMPT = 'Text Recognition:'

let modelPromise: Promise<{
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
  model: Awaited<ReturnType<typeof AutoModelForImageTextToText.from_pretrained>>
}> | null = null

async function getModel(onProgress?: ProgressCallback) {
  if (!modelPromise) {
    console.info(`[ocr] loading ${MODEL_ID} (~623MB on first run)…`)
    const loadStart = performance.now()
    modelPromise = (async () => {
      const [processor, model] = await Promise.all([
        AutoProcessor.from_pretrained(MODEL_ID, {
          progress_callback: onProgress,
        }),
        AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
          device: 'webgpu',
          // q4f16 throughout: 623MB total (decoder 322, vision 251, embed 50).
          //
          // Measurement on the previous model argued against paying for fp16
          // here. Moving its vision encoder and embeddings from q4f16 to fp16
          // cost ~900MB of download and changed throughput not at all —
          // 4.6 tok/s before, 3.3-4.5 after. Decoding dominates, and only the
          // decoder's size moves that number.
          dtype: 'q4f16',

          // Works around an incomplete `transformers.js_config` in the model
          // repo. Every weight here lives in a sidecar `.onnx_data` file, and
          // transformers.js only fetches those when the file is declared in
          // `use_external_data_format`. GLM-OCR's config declares its fp32 and
          // fp16 variants but not q4/q4f16:
          //
          //   {"vision_encoder.onnx":1,"decoder_model_merged.onnx":2,
          //    "embed_tokens.onnx":1,"vision_encoder_fp16.onnx":1, ...}
          //
          // `resolveExternalDataFormat` looks up the full filename then the
          // bare name, finds neither for a q4f16 session, and returns 0. ORT
          // then loads a stub `.onnx` that references data it was never given:
          //   "Deserialize tensor model_embed_tokens_weight_scales failed.
          //    Failed to load external data file "embed_tokens_q4f16.onnx_data",
          //    error: Module.MountedFiles is not available."
          //
          // Declaring it here overrides the repo's config (the option is read
          // as `options.use_external_data_format ?? custom_config...`). Both
          // 4-bit variants are listed so switching `dtype` between them stays
          // a one-word change. Each has exactly one data chunk.
          use_external_data_format: {
            'embed_tokens_q4f16.onnx': 1,
            'vision_encoder_q4f16.onnx': 1,
            'decoder_model_merged_q4f16.onnx': 1,
            'embed_tokens_q4.onnx': 1,
            'vision_encoder_q4.onnx': 1,
            'decoder_model_merged_q4.onnx': 1,
          },
          progress_callback: onProgress,
        }),
      ])
      console.info(
        `[ocr] model ready in ${Math.round((performance.now() - loadStart) / 1000)}s`,
      )
      // ONNX Runtime doesn't expose the execution provider it settled on, so
      // asking the model is a dead end (an earlier attempt at this printed
      // "unknown" for every session). Report what the platform can actually
      // offer instead, and let the tokens/sec figure logged per page settle
      // whether the GPU is really being used. Reference point: the 2B model
      // this replaced managed ~4 tok/s on integrated graphics with WebGPU
      // confirmed active, so "slow" alone does not imply a CPU fallback.
      void logGpuAdapter()
      return { processor, model }
    })()
    // A failed load must not be cached as a permanent rejection — the next
    // attempt should get a fresh chance rather than replaying the error.
    modelPromise.catch((err) => {
      console.error(
        `[ocr] model load FAILED for ${MODEL_ID}: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
      modelPromise = null
    })
  }
  return modelPromise
}

/**
 * Drops the cached model when `err` is a lost WebGPU device, so the next page
 * loads it again on a fresh device instead of failing against the dead one.
 * The `.catch` in {@link getModel} only covers a failed load, not a model that
 * loaded and later lost its device.
 */
function discardModelIfDeviceLost(err: unknown): void {
  if (!isDeviceLostError(err) || !modelPromise) return
  const lost = modelPromise
  modelPromise = null
  console.warn('[ocr] WebGPU device lost — the model will reload on next use')
  void lost.then(({ model }) => model.dispose()).catch(() => {})
}

/**
 * Log what WebGPU the browser actually offers.
 *
 * `navigator.gpu` merely existing is not enough — `requestAdapter()` can still
 * return null (blocklisted driver, no compatible device, software renderer
 * disabled), and that is the case where transformers.js quietly falls back to
 * wasm and everything runs ~10x slower with no error anywhere.
 */
async function logGpuAdapter(): Promise<void> {
  try {
    const gpu = (navigator as Navigator & { gpu?: any }).gpu
    if (!gpu) {
      console.warn('[ocr] navigator.gpu missing — inference will run on CPU (wasm)')
      return
    }
    const adapter = await gpu.requestAdapter()
    if (!adapter) {
      console.warn('[ocr] requestAdapter() returned null — inference will run on CPU (wasm)')
      return
    }
    const info = (await adapter.requestAdapterInfo?.()) ?? adapter.info
    console.info(
      `[ocr] WebGPU adapter: ${info?.vendor ?? '?'} ${info?.architecture ?? ''} ${info?.description ?? ''}`.trim(),
    )
  } catch (err) {
    console.warn('[ocr] WebGPU probe failed', err)
  }
}

/**
 * Transcribe a single already-rendered page, as its own queue job.
 *
 * The unit of work for streaming OCR: the caller renders one page, calls this,
 * persists the result, and drops the blob before rendering the next. Nothing
 * accumulates, so peak memory is one page whether the document has 3 pages or
 * 300.
 *
 * Exposed separately from {@link ocrPages} rather than replacing it, because
 * the comparison harness needs to run a fixed set of pre-rendered pages
 * through both engines on equal terms.
 */
export function ocrSinglePage(
  page: { blob: Blob; pageNum: number },
  options: { totalPages?: number; onProgress?: ProgressCallback } = {},
): Promise<{ text: string; generated: number }> {
  const { totalPages, onProgress } = options
  return enqueue(async () => {
    const { processor, model } = await getModel(onProgress)
    const startedAt = performance.now()
    let result: Awaited<ReturnType<typeof transcribe>>
    try {
      result = await transcribe(processor, model, page.blob)
    } catch (err) {
      discardModelIfDeviceLost(err)
      throw err
    }

    // Logged here, not only in `ocrPages`. The per-page breakdown originally
    // lived in the batch loop, which the upload path stopped using when it
    // moved to streaming — so the default path went silent and only
    // `compare` mode (which still runs the batch) produced any timings.
    const elapsed = performance.now() - startedAt
    const rate =
      result.generated > 0 && result.decodeMs > 0
        ? (result.generated / (result.decodeMs / 1000)).toFixed(1)
        : '?'
    console.info(
      `[ocr] page ${page.pageNum}${totalPages ? `/${totalPages}` : ''}: ` +
        `${result.text.length} chars, ${result.generated} tokens in ${Math.round(elapsed)}ms ` +
        `(preprocess ${result.processorMs}ms, encode ${result.encodeMs}ms, ` +
        `decode ${result.decodeMs}ms @ ${rate} tok/s, ${Math.round(result.pixels / 1000)}k px)`,
    )

    return result
  }, 'background')
}

/** Warm the model without transcribing, so a caller can time the load alone. */
export function preloadOcrModel(
  onProgress?: ProgressCallback,
): Promise<unknown> {
  return enqueue(() => getModel(onProgress), 'background')
}

/** Progress for a multi-page run, so callers can show something moving. */
export interface OcrProgress {
  page: number
  totalPages: number
  charsSoFar: number
}

/**
 * Transcribe one rendered page.
 *
 * Kept separate from {@link ocrPages} so a caller with a single image (a
 * scanned receipt, one page of a preview) doesn't pay for the batching
 * machinery.
 */
export function ocrImage(
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
 * Transcribe rendered pages in order, returning their text joined the same way
 * `extractPdfText` joins pages — so downstream chunking sees one consistent
 * shape whichever path produced the text.
 *
 * **Enqueued per page, not per document.** Holding the AI queue for a whole
 * scanned PDF starves everything behind it: a search query embedded during an
 * OCR run would wait minutes, and the search UI would sit on "Ranking by
 * meaning…" indefinitely. Per-page jobs give the scheduler a yield point
 * roughly every few seconds, so an `interactive` job waits for one page at
 * worst. The model stays resident between pages because `getModel` caches it.
 */
export function ocrPages(
  pages: { blob: Blob; pageNum: number }[],
  options: {
    maxPages?: number
    onProgress?: ProgressCallback
    onPage?: (progress: OcrProgress) => void
  } = {},
): Promise<{ text: string; pagesRead: number }> {
  const { maxPages = OCR_MAX_PAGES, onProgress, onPage } = options

  return (async () => {
    if (pages.length === 0) return { text: '', pagesRead: 0 }

    const slice = pages.slice(0, maxPages)
    const parts: string[] = []
    let chars = 0

    console.info(
      `[ocr] starting — ${slice.length} page(s) via ${MODEL_ID}. First run downloads ~623MB.`,
    )
    const startedAt = performance.now()

    // Load once, up front, rather than inside the per-page job.
    //
    // `getModel` clears its cached promise on failure so a later attempt can
    // retry — correct across runs, disastrous inside one: a model that cannot
    // load at all was retried once per page, printing six identical "loading"
    // lines and burying the real error. Failing here stops the run instead.
    let loaded: Awaited<ReturnType<typeof getModel>>
    try {
      loaded = await enqueue(() => getModel(onProgress), 'background')
    } catch (err) {
      console.error(
        `[ocr] aborting — ${MODEL_ID} could not be loaded. No pages will be transcribed.`,
        err,
      )
      throw err
    }

    for (const page of slice) {
      const pageStart = performance.now()
      try {
        const { text, generated, processorMs, encodeMs, decodeMs, pixels } =
          await enqueue(
            () => transcribe(loaded.processor, loaded.model, page.blob),
            'background',
          )

        if (text) {
          parts.push(text)
          chars += text.length
        }
        // tokens/sec is the ground truth for whether this is really running on
        // the GPU — ONNX Runtime won't tell us which provider it picked. The
        // prefill/decode split says which knob is worth turning: image
        // resolution only helps a prefill-bound page, token caps only help a
        // decode-bound one.
        const elapsed = performance.now() - pageStart
        const rate =
          generated > 0 && decodeMs > 0
            ? (generated / (decodeMs / 1000)).toFixed(1)
            : '?'
        console.info(
          `[ocr] page ${page.pageNum}/${slice.length}: ${text.length} chars, ` +
            `${generated} tokens in ${Math.round(elapsed)}ms ` +
            `(preprocess ${processorMs}ms, encode ${encodeMs}ms, ` +
            `decode ${decodeMs}ms @ ${rate} tok/s, ${Math.round(pixels / 1000)}k px)`,
        )
      } catch (err) {
        // One unreadable page shouldn't discard the pages already transcribed.
        console.error(`[ocr] page ${page.pageNum} failed`, err)
        // `loaded` is bound to the dead device, so every later page would fail
        // the same way.
        if (isDeviceLostError(err)) {
          discardModelIfDeviceLost(err)
          break
        }
      }
      onPage?.({
        page: page.pageNum,
        totalPages: slice.length,
        charsSoFar: chars,
      })
    }

    const text = parts.join('\n\n').trim()
    const seconds = Math.round((performance.now() - startedAt) / 1000)
    if (text.length === 0) {
      // Distinct from "the pages were blank": every page either threw or the
      // model returned nothing, and the caller is about to treat this document
      // as having no recoverable text. Worth a warning rather than the same
      // cheerful "done" line a successful run prints.
      console.warn(
        `[ocr] done but empty — ${slice.length} page(s) produced no text in ${seconds}s. ` +
          `Check the per-page errors above.`,
      )
    } else {
      console.info(
        `[ocr] done — ${text.length} chars from ${slice.length} page(s) in ${seconds}s`,
      )
    }
    return { text, pagesRead: slice.length }
  })()
}

async function transcribe(
  processor: any,
  model: any,
  image: Blob,
): Promise<{
  text: string
  generated: number
  prefillMs: number
  processorMs: number
  encodeMs: number
  decodeMs: number
  pixels: number
}> {
  const raw = await RawImage.fromBlob(image)
  const startedAt = performance.now()

  const messages = [
    {
      role: 'user',
      content: [{ type: 'image' }, { type: 'text', text: OCR_PROMPT }],
    },
  ]
  const prompt = processor.apply_chat_template(messages, {
    add_generation_prompt: true,
  })

  // Image preprocessing: resize to the pixel budget, normalize, patchify.
  // Runs on the CPU, so it is separated from the GPU vision-encoder pass —
  // they are fixed by different things. Measured at ~20s combined, which is
  // ~70% of a page; knowing which half owns it decides whether the fix is a
  // smaller image, a different vision dtype, or neither.
  const processorStart = performance.now()
  const inputs = await processor(prompt, raw)
  const processorMs = Math.round(performance.now() - processorStart)

  // Split the rest into vision-encode-to-first-token and generation — see
  // `FirstTokenTimer`.
  const timer = new FirstTokenTimer()
  const output = await model.generate({
    ...inputs,
    max_new_tokens: MAX_NEW_TOKENS,
    streamer: timer,
    // Transcription is not a creative task — sampling invents plausible text
    // that was never on the page, which is far worse than a gap in a search
    // index.
    do_sample: false,
    // Greedy decoding on a sparse page (a diagram, a title slide) degenerates
    // into repetition, and the loop runs to `max_new_tokens` instead of
    // emitting EOS. Measured: a page with ~1,700 characters of real text still
    // burned the full 768-token budget at ~4 tok/s — three minutes to
    // transcribe a paragraph, most of it looping.
    //
    // A mild penalty breaks the cycle so the model reaches EOS when it has
    // actually run out of text. Kept low: transcription legitimately repeats
    // words, and penalising that too hard makes it skip real content.
    repetition_penalty: 1.1,
    no_repeat_ngram_size: 12,
  })

  // `generate` returns the prompt tokens plus the completion; slicing off the
  // input length leaves only what the model wrote.
  const promptLength = inputs.input_ids.dims.at(-1)
  const generated = output.slice(null, [promptLength, null])
  const decoded = processor.batch_decode(generated, {
    skip_special_tokens: true,
  })

  const finishedAt = performance.now()
  // A streamer that never fires leaves this at 0. Attribute the whole page to
  // prefill rather than reporting a negative decode time — and the resulting
  // `decode 0ms` is deliberately implausible, so a broken measurement looks
  // broken instead of looking like a fast decoder.
  const firstTokenAt = timer.firstTokenAt
  const prefillMs = Math.round((firstTokenAt || finishedAt) - startedAt)

  return {
    text: (decoded[0] ?? '').trim().slice(0, OCR_MAX_CHARS_PER_PAGE),
    generated: Math.max(0, (output.dims.at(-1) ?? promptLength) - promptLength),
    prefillMs,
    processorMs,
    // Prefill minus CPU preprocessing: the vision encoder's GPU pass plus
    // prompt processing, up to the first generated token.
    encodeMs: Math.max(0, prefillMs - processorMs),
    decodeMs: Math.round(finishedAt - (firstTokenAt || finishedAt)),
    pixels: raw.width * raw.height,
  }
}
