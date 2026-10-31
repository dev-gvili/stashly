/**
 * Browser-side OCR with PaddleOCR PP-OCRv6 (Baidu), on ONNX Runtime Web.
 *
 * The default OCR engine. Two small models read a page: a detector finds the
 * text lines, a recognizer reads each one (pre/post-processing lives in
 * `@/utils/paddle-ocr`). About 31 MB together, against GLM-OCR's 623 MB, and
 * each call is short, which also keeps the GPU clear of the Windows watchdog
 * reset GLM-OCR triggered on long dispatches (31 Oct 2026).
 *
 * Its recognizer covers Chinese, Japanese, English and Latin scripts, not
 * Hebrew. The caller compares {@link PaddlePage.confidence} with
 * {@link PADDLE_FALLBACK_BELOW} and re-reads doubtful pages with GLM-OCR.
 *
 * Like the other `*.ai.ts` modules this runs on the main thread, one page per
 * job on the shared AI queue.
 */
import * as ort from 'onnxruntime-web/webgpu'
import { enqueue, isDeviceLostError } from './ai-queue'
import {
  cropRgba,
  ctcGreedyDecode,
  detectionInput,
  extractTextBoxes,
  MIN_LINE_CONFIDENCE,
  orderLines,
  pageConfidence,
  parseCharacterDict,
  recognitionInput,
  type RecognizedLine,
  type RgbaImage,
} from '@/utils/paddle-ocr'

// Pinned to commits so an upstream push can't change what runs.
const DET_URL =
  'https://huggingface.co/PaddlePaddle/PP-OCRv6_small_det_onnx/resolve/28fe5895c24fd108c19eb3e8479f4ab385fbfc62/inference.onnx'
const REC_BASE =
  'https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx/resolve/b8f84f0b80c529de40b4fbb3544b84fa7233a513'

/** Cache Storage bucket; rename it when the pinned commits change. */
const MODEL_CACHE = 'stashly-paddle-ocr-v6'

/**
 * Pixel budget for a page render. Recognition reads line crops from the full
 * render, so it gets more pixels than GLM-OCR's 1.0M: about A4 at 150 dpi.
 * Not tuned yet; overridable with `stashly:ocr-max-pixels`.
 */
export const PADDLE_MAX_PIXELS = 2_000_000

/**
 * Page confidence below which the caller re-reads the page with GLM-OCR.
 *
 * Measured 31 Oct 2026 on clean synthetic renders (not scans), NVIDIA Turing:
 * English 0.992–0.993 (28px Arial, 14px Times); Hebrew 0.654 (Arial) and
 * 0.737 (David), both read as garbage; Hebrew mixed with Latin and digits
 * 0.868. Set above the mixed page. A doubtful English scan that falls below
 * costs time, not correctness, since GLM-OCR reads English too. Not yet
 * checked against real scans; each page logs its confidence.
 */
export const PADDLE_FALLBACK_BELOW = 0.9

/** What one page produced. */
export interface PaddlePage {
  text: string
  /** Length-weighted mean line confidence; null when no line was found. */
  confidence: number | null
  lines: number
}

interface Models {
  det: ort.InferenceSession
  rec: ort.InferenceSession
  dictionary: string[]
}

let modelsPromise: Promise<Models> | null = null

/**
 * A model file from Cache Storage, downloading it on first use. `resolve`
 * redirects to short-lived signed URLs, so the HTTP cache rarely keeps them.
 */
async function fetchCached(url: string): Promise<Response> {
  let cache: Cache | null = null
  try {
    cache = await caches.open(MODEL_CACHE)
    const hit = await cache.match(url)
    if (hit) return hit
  } catch {
    // No Cache Storage (insecure context, blocked storage): download each time.
  }
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  if (cache) await cache.put(url, response.clone()).catch(() => {})
  return response
}

function getModels(): Promise<Models> {
  if (!modelsPromise) {
    const startedAt = performance.now()
    console.info('[ocr] loading PaddleOCR PP-OCRv6 (~31MB on first run)…')
    // ORT prints routine warnings (shape ops placed on the CPU) through
    // console.error, which reads as a failure.
    ort.env.logLevel = 'error'
    const options: ort.InferenceSession.SessionOptions = {
      executionProviders: ['webgpu', 'wasm'],
      graphOptimizationLevel: 'all',
    }
    modelsPromise = (async () => {
      const [detBytes, recBytes, yaml] = await Promise.all([
        fetchCached(DET_URL).then((r) => r.arrayBuffer()),
        fetchCached(`${REC_BASE}/inference.onnx`).then((r) => r.arrayBuffer()),
        fetchCached(`${REC_BASE}/inference.yml`).then((r) => r.text()),
      ])
      // One after the other: ORT's WebGPU backend rejects a second session
      // while one is being created ("another WebGPU EP inference session is
      // being created").
      const det = await ort.InferenceSession.create(new Uint8Array(detBytes), options)
      const rec = await ort.InferenceSession.create(new Uint8Array(recBytes), options)
      console.info(
        `[ocr] PaddleOCR ready in ${Math.round(performance.now() - startedAt)}ms`,
      )
      return { det, rec, dictionary: parseCharacterDict(yaml) }
    })()
    modelsPromise.catch((err) => {
      console.error('[ocr] PaddleOCR load FAILED', err)
      modelsPromise = null
    })
  }
  return modelsPromise
}

/**
 * Loads both models as one queue job. A run calls this before its first page
 * so a model that cannot load fails the run once, not once per page.
 */
export function preloadPaddleOcr(): Promise<void> {
  return enqueue(async () => {
    await getModels()
  }, 'background')
}

/** Drops the sessions on a lost device so the next page builds fresh ones. */
function discardModelsIfDeviceLost(err: unknown): void {
  if (!isDeviceLostError(err) || !modelsPromise) return
  const lost = modelsPromise
  modelsPromise = null
  console.warn('[ocr] WebGPU device lost — PaddleOCR will reload on next use')
  void lost
    .then(({ det, rec }) => Promise.all([det.release(), rec.release()]))
    .catch(() => {})
}

async function decodePage(blob: Blob): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('No 2D context for OCR page decode')
    context.drawImage(bitmap, 0, 0)
    const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    return { data, width, height }
  } finally {
    bitmap.close()
  }
}

async function readPage(models: Models, page: RgbaImage): Promise<RecognizedLine[]> {
  const { det, rec, dictionary } = models
  const input = detectionInput(page)
  const detOut = await det.run({
    [det.inputNames[0]]: new ort.Tensor('float32', input.data, [1, 3, input.height, input.width]),
  })
  const prob = detOut[det.outputNames[0]].data as Float32Array
  const boxes = extractTextBoxes(
    prob,
    input.width,
    input.height,
    page.width / input.width,
    page.height / input.height,
  )

  const lines: RecognizedLine[] = []
  for (let i = 0; i < boxes.length; i++) {
    const line = recognitionInput(cropRgba(page, boxes[i]))
    const recOut = await rec.run({
      [rec.inputNames[0]]: new ort.Tensor('float32', line.data, [1, 3, line.height, line.width]),
    })
    const output = recOut[rec.outputNames[0]]
    const [, steps, classes] = output.dims
    const { text, confidence } = ctcGreedyDecode(
      output.data as Float32Array,
      steps,
      classes,
      dictionary,
    )
    lines.push({ ...boxes[i], text, confidence })
    // The pre/post-processing runs on the main thread; let the page paint.
    if (i % 4 === 3) await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return lines
}

/**
 * Reads one rendered page, as its own AI-queue job.
 *
 * @param page - The page render (from the compute worker's `pdfPageAt`).
 * @returns The page text in reading order, its confidence and line count.
 *
 * @example
 * const { text, confidence } = await paddleOcrPage({ blob, pageNum: 1 }, { totalPages: 3 })
 */
export function paddleOcrPage(
  page: { blob: Blob; pageNum: number },
  options: { totalPages?: number } = {},
): Promise<PaddlePage> {
  return enqueue(async () => {
    const models = await getModels()
    const startedAt = performance.now()
    let lines: RecognizedLine[]
    let pixels: number
    try {
      const image = await decodePage(page.blob)
      pixels = image.width * image.height
      lines = await readPage(models, image)
    } catch (err) {
      discardModelsIfDeviceLost(err)
      throw err
    }

    const confidence = pageConfidence(lines)
    const text = orderLines(lines.filter((l) => l.text && l.confidence > MIN_LINE_CONFIDENCE))
    console.info(
      `[ocr] paddle page ${page.pageNum}${options.totalPages ? `/${options.totalPages}` : ''}: ` +
        `${text.length} chars, ${lines.length} lines, confidence ` +
        `${confidence === null ? 'n/a (no lines)' : confidence.toFixed(3)} ` +
        `in ${Math.round(performance.now() - startedAt)}ms (${Math.round(pixels / 1000)}k px)`,
    )
    return { text, confidence, lines: lines.length }
  }, 'background')
}
