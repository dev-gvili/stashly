/**
 * Dedicated worker that runs PaddleOCR PP-OCRv6 (Baidu's official ONNX
 * models) on ONNX Runtime Web, off the main thread.
 *
 * Two reasons it is a worker. After a GPU reset (Windows TDR, seen twice on
 * 31 Oct 2026), ONNX Runtime on the page stayed broken until a reload: session
 * creation failed with `DEVICE_REMOVED`, then with "another WebGPU EP inference
 * session is being created" on every later try. Ending a worker discards its
 * whole ONNX Runtime and WebGPU device, so `paddle-ocr.ai.ts` starts a fresh
 * one instead. And the pre/post-processing (up to ~1 s a page) no longer runs
 * on the main thread.
 *
 * The worker does not schedule anything: `paddle-ocr.ai.ts` runs each page as
 * one job on the main-thread `ai-queue` and waits for the reply, so only one
 * AI job touches a GPU at a time.
 *
 * Protocol: one `PaddleRequest` in, exactly one `loaded`, `page` or `error`
 * with the same `id` back.
 */
import * as ort from 'onnxruntime-web/webgpu'
import {
  cropRgba,
  ctcGreedyDecode,
  detectionInput,
  extractTextBoxes,
  MIN_LINE_CONFIDENCE,
  orderLines,
  pageConfidence,
  parseCharacterDict,
  recognitionBatchInput,
  REC_BATCH_SIZE,
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

/** What one page produced. */
export interface PaddlePage {
  text: string
  /** From `pageConfidence`; null when nothing on the page looks like text. */
  confidence: number | null
  lines: number
}

/** Where a page's time went, logged per page to say which part to optimise. */
export interface PageTiming {
  /** Detector input, run and box extraction. */
  detMs: number
  /** Recognizer runs, including copying their output back from the GPU. */
  recMs: number
  /** CTC decoding of that output. */
  decodeMs: number
  /** Recognizer output read back, in MB. */
  outMB: number
  /** Page pixels as rendered. */
  pixels: number
}

export type PaddleRequest =
  | { id: number; type: 'load' }
  | { id: number; type: 'read'; blob: Blob }

export type PaddleResponse =
  /** `loadMs` is set when this request loaded the models. */
  | { id: number; type: 'loaded'; loadMs?: number }
  | { id: number; type: 'page'; page: PaddlePage; timing: PageTiming; loadMs?: number }
  | { id: number; type: 'error'; message: string }

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

/** Loads both models on first use; `loadMs` says whether this call did. */
async function getModels(): Promise<{ models: Models; loadMs?: number }> {
  if (modelsPromise) return { models: await modelsPromise }
  const startedAt = performance.now()
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
    // One after the other: ORT's WebGPU backend rejects a second session while
    // one is being created.
    const det = await ort.InferenceSession.create(new Uint8Array(detBytes), options)
    const rec = await ort.InferenceSession.create(new Uint8Array(recBytes), options)
    return { det, rec, dictionary: parseCharacterDict(yaml) }
  })()
  return { models: await modelsPromise, loadMs: Math.round(performance.now() - startedAt) }
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

async function readPage(
  models: Models,
  page: RgbaImage,
): Promise<{ lines: RecognizedLine[]; timing: PageTiming }> {
  const { det, rec, dictionary } = models
  const timing: PageTiming = {
    detMs: 0,
    recMs: 0,
    decodeMs: 0,
    outMB: 0,
    pixels: page.width * page.height,
  }
  const detStart = performance.now()
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
  timing.detMs = performance.now() - detStart

  // Batched by aspect ratio, so lines of similar width share a run and little
  // of each batch is padding. Results go back to their box by index.
  const crops = boxes.map((box) => cropRgba(page, box))
  const ratio = (i: number) => crops[i].width / crops[i].height
  const order = crops.map((_, i) => i).sort((a, b) => ratio(a) - ratio(b))
  const lines: RecognizedLine[] = new Array(boxes.length)
  for (let start = 0; start < order.length; start += REC_BATCH_SIZE) {
    const indices = order.slice(start, start + REC_BATCH_SIZE)
    const batch = recognitionBatchInput(indices.map((i) => crops[i]))
    const recStart = performance.now()
    const recOut = await rec.run({
      [rec.inputNames[0]]: new ort.Tensor('float32', batch.data, [
        batch.batch,
        3,
        batch.height,
        batch.width,
      ]),
    })
    const output = recOut[rec.outputNames[0]]
    const [, steps, classes] = output.dims
    const probs = output.data as Float32Array
    const decodeStart = performance.now()
    timing.recMs += decodeStart - recStart
    timing.outMB += probs.byteLength / 1e6
    indices.forEach((i, b) => {
      const { text, confidence } = ctcGreedyDecode(
        probs.subarray(b * steps * classes, (b + 1) * steps * classes),
        steps,
        classes,
        dictionary,
      )
      lines[i] = { ...boxes[i], text, confidence }
    })
    timing.decodeMs += performance.now() - decodeStart
  }
  return { lines, timing }
}

function post(message: PaddleResponse) {
  ;(self as unknown as Worker).postMessage(message)
}

self.onmessage = async (event: MessageEvent<PaddleRequest>) => {
  const request = event.data
  try {
    const { models, loadMs } = await getModels()
    if (request.type === 'load') {
      post({ id: request.id, type: 'loaded', loadMs })
      return
    }
    const { lines, timing } = await readPage(models, await decodePage(request.blob))
    const text = orderLines(lines.filter((l) => l.text && l.confidence > MIN_LINE_CONFIDENCE))
    post({
      id: request.id,
      type: 'page',
      page: { text, confidence: pageConfidence(lines), lines: lines.length },
      timing,
      loadMs,
    })
  } catch (err) {
    // The caller ends this worker on any error, so nothing here is reused.
    post({ id: request.id, type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
