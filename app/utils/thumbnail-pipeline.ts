/**
 * Pure pipeline helpers for the progressive thumbnail flow.
 *
 * No React, no fetchers — just compute + raw `fetch` for S3 PUTs.
 * The orchestrator hook composes these with route-fetcher calls.
 */
import { dataUrlToBlob } from '@/utils/thumbnail'
import { classifyDegradation, reportDegraded } from '@/utils/report-degraded'
import { generateVideoThumbnail, getVideoMetadata } from '@/utils/video'
import { isMarkdownFile } from '@/utils/markdown'
import { isTextRenderableFile } from '@/utils/text-thumbnail'
import exifr from 'exifr'
import type {
  ComputeRequest,
  ComputeResponse,
} from '@/workers/thumbnail.compute.worker'

// ── Compute worker singleton ─────────────────────────────────────────────

let computeWorker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, (msg: ComputeResponse) => void>()

function getComputeWorker(): Worker | null {
  if (typeof window === 'undefined') return null
  if (computeWorker) return computeWorker

  try {
    computeWorker = new Worker(
      new URL('../workers/thumbnail.compute.worker.ts', import.meta.url),
      { type: 'module' }
    )
  } catch (err) {
    console.error('[thumbnail compute worker] failed to construct', err)
    return null
  }
  computeWorker.onmessage = (e: MessageEvent<ComputeResponse>) => {
    const handler = pending.get(e.data.id)
    if (handler) {
      pending.delete(e.data.id)
      handler(e.data)
    }
  }
  computeWorker.onerror = (e) => {
    console.error(
      '[thumbnail compute worker] error event',
      e.message,
      e.filename,
      e.lineno
    )
  }
  return computeWorker
}

const COMPUTE_TIMEOUT_MS = 60_000

/**
 * Rasterizing a whole document at OCR resolution is minutes of work, well past
 * the budget sized for single-page thumbnail ops. Must stay >= the worker's
 * own `PDF_PAGES_TIMEOUT_MS`, or the caller gives up on a request the worker
 * is still faithfully processing.
 */
const PDF_PAGES_TIMEOUT_MS = 200_000

export function compute<TKind extends ComputeRequest['kind']>(
  req: Omit<Extract<ComputeRequest, { kind: TKind }>, 'id'>
): Promise<Extract<ComputeResponse, { kind: TKind | 'error' }>> {
  return new Promise((resolve) => {
    const worker = getComputeWorker()
    if (!worker) {
      resolve({ id: 0, kind: 'error', message: 'no worker available' } as never)
      return
    }
    const id = nextRequestId++
    const budget =
      req.kind === 'pdfPages' ? PDF_PAGES_TIMEOUT_MS : COMPUTE_TIMEOUT_MS
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        console.error(
          `[thumbnail compute] timeout waiting for ${req.kind} (id=${id})`
        )
        resolve({ id, kind: 'error', message: `timeout: ${req.kind}` } as never)
      }
    }, budget)
    pending.set(id, (msg) => {
      clearTimeout(timer)
      resolve(msg as never)
    })
    worker.postMessage({ ...req, id } as ComputeRequest)
  })
}

// ── Stage producers ──────────────────────────────────────────────────────

export async function generateStage1Preview(file: File): Promise<Blob | null> {
  if (file.type.startsWith('image/')) {
    const res = await compute({ kind: 'tinyImage', file })
    return res.kind === 'tinyImage' ? res.blob : null
  }
  if (file.type === 'application/pdf') {
    const res = await compute({ kind: 'tinyPdf', file })
    return res.kind === 'tinyPdf' ? res.blob : null
  }
  if (file.type.startsWith('video/')) {
    const dataUrl = await generateVideoThumbnail(file).catch(() => null)
    return dataUrl ? dataUrlToBlob(dataUrl) : null
  }
  if (isTextRenderableFile(file)) {
    const res = await compute({ kind: 'tinyText', file })
    return res.kind === 'tinyText' ? res.blob : null
  }
  return null
}

export interface ResizedThumbnail {
  blob: Blob
  width: number
  height: number
}

export async function generateStage2Resize(
  file: File,
  videoFrame?: Blob | null
): Promise<ResizedThumbnail | null> {
  if (file.type.startsWith('image/')) {
    const res = await compute({ kind: 'resizeImage', file })
    if (res.kind === 'resizeImage' && res.result) {
      return {
        blob: res.result.blob,
        width: res.result.width,
        height: res.result.height,
      }
    }
    return null
  }
  if (file.type === 'application/pdf') {
    const res = await compute({ kind: 'resizePdf', file })
    if (res.kind === 'resizePdf' && res.result) {
      return {
        blob: res.result.blob,
        width: res.result.width,
        height: res.result.height,
      }
    }
    return null
  }
  if (file.type.startsWith('video/') && videoFrame) {
    const frameFile = new File([videoFrame], 'frame.webp', {
      type: 'image/webp',
    })
    const res = await compute({ kind: 'resizeImage', file: frameFile })
    if (res.kind === 'resizeImage' && res.result) {
      return {
        blob: res.result.blob,
        width: res.result.width,
        height: res.result.height,
      }
    }
    return null
  }
  if (isTextRenderableFile(file)) {
    const res = await compute({ kind: 'resizeText', file })
    if (res.kind === 'resizeText' && res.result) {
      return {
        blob: res.result.blob,
        width: res.result.width,
        height: res.result.height,
      }
    }
    return null
  }
  return null
}

export async function generateStage3Salient(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null
  const { generateSalientCrop } = await import('@/workers/thumbnail.ai')
  return generateSalientCrop(file).catch((e) => {
    console.error('[generateSalientCrop]', e)
    // Reported here rather than at the call site: this function also returns
    // null for non-images above, which is expected and not a degradation.
    reportDegraded('thumbnail_stage3', classifyDegradation(e))
    return null
  })
}

// ── S3 PUT ───────────────────────────────────────────────────────────────

export async function putThumbnailToS3(
  uploadUrl: string,
  blob: Blob,
  itemId: string,
  stage: number
): Promise<boolean> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': 'image/webp',
      'x-amz-acl': 'public-read',
    },
  }).catch((err) => {
    console.error(`[stage ${stage} PUT] network error`, itemId, err)
    return null
  })
  if (!res || !res.ok) {
    console.error(`[stage ${stage} PUT] non-ok`, itemId, res?.status)
    return false
  }
  return true
}

export function makeStageUrl(publicUrl: string, stage: 2 | 3): string {
  return `${publicUrl}?v=${stage}`
}

// ── Metadata extraction (pure, no fetcher) ───────────────────────────────

export interface MediaMetadata {
  // image
  imageWidth?: number
  imageHeight?: number
  horizontalResolution?: number
  verticalResolution?: number
  bitDepth?: number
  cameraMake?: string
  cameraModel?: string
  iso?: number
  fNumber?: number
  exposureTime?: number
  focalLength?: number
  takenDateTime?: string
  latitude?: number
  longitude?: number
  // video
  videoWidth?: number
  videoHeight?: number
  duration?: number
  /**
   * PDF with no extractable text layer. Client-only signal — never submitted
   * to the server — telling the caller an OCR pass is worth running after the
   * metadata POST has landed.
   */
  needsOcr?: boolean
  // document
  documentText?: string
  documentPageCount?: number
  // pdf document info
  pdfTitle?: string
  pdfAuthor?: string
  pdfSubject?: string
  pdfKeywords?: string
  pdfCreator?: string
  pdfProducer?: string
  pdfVersion?: string
  pdfLanguage?: string
  pdfIsEncrypted?: boolean
  pdfHasFormFields?: boolean
  pdfHasAnnotations?: boolean
  pdfHasSignatures?: boolean
  pdfPageWidth?: number
  pdfPageHeight?: number
  pdfDocCreatedAt?: string
  pdfDocModifiedAt?: string
  // markdown document info
  mdTitle?: string
  mdAuthor?: string
  mdDescription?: string
  mdTags?: string
  mdWordCount?: number
  mdReadingTime?: number
  mdHeadingCount?: number
  mdLinkCount?: number
  mdImageCount?: number
  mdCodeBlockCount?: number
  mdTaskCount?: number
  mdHasFrontmatter?: boolean
  mdDocCreatedAt?: string
  mdDocModifiedAt?: string
  // audio
  audioDuration?: number
  audioBitrate?: number
  audioTitle?: string
  audioArtist?: string
  audioAlbum?: string
  audioAlbumArtist?: string
  audioComposer?: string
  audioGenre?: string
  audioCopyright?: string
  audioYear?: number
  audioTrack?: number
  audioTrackCount?: number
  audioDisc?: number
  audioDiscCount?: number
}

// ── ID3v2 parser ─────────────────────────────────────────────────────────

function readSyncsafe(view: DataView, offset: number): number {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  )
}

function decodeTextFrame(data: Uint8Array): string {
  if (data.length < 2) return ''
  const enc = data[0]
  let payload = data.slice(1)
  let end = payload.length
  if (enc === 1 || enc === 2) {
    while (end >= 2 && payload[end - 1] === 0 && payload[end - 2] === 0)
      end -= 2
  } else {
    while (end > 0 && payload[end - 1] === 0) end--
  }
  payload = payload.slice(0, end)
  if (enc === 0) return new TextDecoder('latin1').decode(payload)
  if (enc === 1) return new TextDecoder('utf-16').decode(payload)
  if (enc === 2) return new TextDecoder('utf-16be').decode(payload)
  return new TextDecoder('utf-8').decode(payload)
}

const ID3_GENRES = [
  'Blues',
  'Classic Rock',
  'Country',
  'Dance',
  'Disco',
  'Funk',
  'Grunge',
  'Hip-Hop',
  'Jazz',
  'Metal',
  'New Age',
  'Oldies',
  'Other',
  'Pop',
  'R&B',
  'Rap',
  'Reggae',
  'Rock',
  'Techno',
  'Industrial',
  'Alternative',
  'Ska',
  'Death Metal',
  'Pranks',
  'Soundtrack',
  'Euro-Techno',
  'Ambient',
  'Trip-Hop',
  'Vocal',
  'Jazz+Funk',
  'Fusion',
  'Trance',
  'Classical',
  'Instrumental',
  'Acid',
  'House',
  'Game',
  'Sound Clip',
  'Gospel',
  'Noise',
  'Alternative Rock',
  'Bass',
  'Soul',
  'Punk',
  'Space',
  'Meditative',
  'Instrumental Pop',
  'Instrumental Rock',
  'Ethnic',
  'Gothic',
  'Darkwave',
  'Techno-Industrial',
  'Electronic',
  'Pop-Folk',
  'Eurodance',
  'Dream',
  'Southern Rock',
  'Comedy',
  'Cult',
  'Gangsta',
  'Top 40',
  'Christian Rap',
  'Pop/Funk',
  'Jungle',
  'Native American',
  'Cabaret',
  'New Wave',
  'Psychedelic',
  'Rave',
  'Showtunes',
  'Trailer',
  'Lo-Fi',
  'Tribal',
  'Acid Punk',
  'Acid Jazz',
  'Polka',
  'Retro',
  'Musical',
  'Rock & Roll',
  'Hard Rock',
]

function parseId3Genre(raw: string): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/^\((\d+)\)(.*)$/)
  if (m) {
    const refinement = m[2].trim()
    return refinement || ID3_GENRES[parseInt(m[1])] || raw
  }
  return raw || undefined
}

function parseId3TrackNum(raw: string): { num?: number; total?: number } {
  if (!raw) return {}
  const parts = raw.split('/')
  const num = parseInt(parts[0])
  const total = parts[1] !== undefined ? parseInt(parts[1]) : NaN
  return {
    num: isNaN(num) ? undefined : num,
    total: isNaN(total) ? undefined : total,
  }
}

function parseId3Year(raw: string): number | undefined {
  const m = raw?.match(/\d{4}/)
  return m ? parseInt(m[0]) : undefined
}

function parseId3Tags(
  bytes: Uint8Array,
  view: DataView,
  version: number
): Record<string, string> {
  const frames: Record<string, string> = {}
  const tagEnd = Math.min(10 + readSyncsafe(view, 6), bytes.length)
  const flags = bytes[5]
  let pos = 10

  // Skip extended header (ID3v2.3/4)
  if (version >= 3 && flags & 0x40) {
    pos += version === 4 ? readSyncsafe(view, pos) : 4 + view.getUint32(pos)
  }

  while (pos < tagEnd - 6) {
    if (version === 2) {
      const id = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2])
      const size =
        (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5]
      pos += 6
      if (id[0] === '\0' || size <= 0 || size > 1_000_000) break
      if (id[0] === 'T')
        frames[id] = decodeTextFrame(bytes.slice(pos, pos + size))
      pos += size
    } else {
      if (pos + 10 > tagEnd) break
      const id = String.fromCharCode(
        bytes[pos],
        bytes[pos + 1],
        bytes[pos + 2],
        bytes[pos + 3]
      )
      const size =
        version === 4 ? readSyncsafe(view, pos + 4) : view.getUint32(pos + 4)
      pos += 10
      if (id[0] === '\0' || size <= 0 || size > 1_000_000) break
      if (id[0] === 'T')
        frames[id] = decodeTextFrame(bytes.slice(pos, pos + size))
      pos += size
    }
  }
  return frames
}

function getAudioDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(undefined)
      return
    }
    const el = document.createElement('audio')
    const url = URL.createObjectURL(file)
    el.src = url
    el.preload = 'metadata'
    const cleanup = () => URL.revokeObjectURL(url)
    el.addEventListener(
      'loadedmetadata',
      () => {
        cleanup()
        resolve(isFinite(el.duration) ? el.duration : undefined)
      },
      { once: true }
    )
    el.addEventListener(
      'error',
      () => {
        cleanup()
        resolve(undefined)
      },
      { once: true }
    )
    setTimeout(() => {
      cleanup()
      resolve(undefined)
    }, 10_000)
  })
}

async function extractAudioMetadata(
  file: File
): Promise<Partial<MediaMetadata>> {
  const [duration, id3] = await Promise.all([
    getAudioDuration(file),
    (async () => {
      const buf = await file.slice(0, 512 * 1024).arrayBuffer()
      const bytes = new Uint8Array(buf)
      const view = new DataView(buf)
      // Check "ID3" magic and version 2-4
      if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33)
        return null
      const ver = bytes[3]
      if (ver < 2 || ver > 4) return null
      return parseId3Tags(bytes, view, ver)
    })(),
  ])

  const meta: Partial<MediaMetadata> = {}

  if (duration !== undefined) {
    meta.audioDuration = Math.round(duration)
    meta.audioBitrate =
      duration > 0 ? Math.round((file.size * 8) / (duration * 1000)) : undefined
  }

  if (id3) {
    const f = (v2: string, v3: string) => id3[v3] || id3[v2] || undefined
    meta.audioTitle = f('TT2', 'TIT2')
    meta.audioArtist = f('TP1', 'TPE1')
    meta.audioAlbum = f('TAL', 'TALB')
    meta.audioAlbumArtist = f('TP2', 'TPE2')
    meta.audioComposer = f('TCM', 'TCOM')
    meta.audioCopyright = f('TCR', 'TCOP')
    meta.audioGenre = parseId3Genre(f('TCO', 'TCON') ?? '')

    meta.audioYear = parseId3Year(f('TYE', 'TDRC') ?? f('TYE', 'TYER') ?? '')

    const { num: track, total: trackCount } = parseId3TrackNum(
      f('TRK', 'TRCK') ?? ''
    )
    meta.audioTrack = track
    meta.audioTrackCount = trackCount

    const { num: disc, total: discCount } = parseId3TrackNum(
      f('TPA', 'TPOS') ?? ''
    )
    meta.audioDisc = disc
    meta.audioDiscCount = discCount
  }

  return meta
}

/**
 * Reads bits-per-channel from a raw image header for formats where EXIF omits
 * it. Handles PNG (IHDR chunk) and JPEG (SOF marker); returns undefined for
 * anything else. Only the first ~128 KB is read — SOF/IHDR always appear early.
 */
async function readImageBitDepth(file: File): Promise<number | undefined> {
  const buf = new Uint8Array(await file.slice(0, 131072).arrayBuffer())

  // PNG: 8-byte signature, then IHDR whose bit-depth byte sits at offset 24.
  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  if (isPng) {
    const depth = buf[24]
    return depth > 0 ? depth : undefined
  }

  // JPEG: scan marker segments for a Start-Of-Frame (SOFn) — its first data
  // byte is the sample precision (bits per channel, almost always 8).
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8
  if (isJpeg) {
    let i = 2
    while (i + 1 < buf.length) {
      if (buf[i] !== 0xff) {
        i++
        continue
      }
      const marker = buf[i + 1]
      // Standalone markers (no length payload): padding + RSTn.
      if (marker === 0xff || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2
        continue
      }
      const len = (buf[i + 2] << 8) | buf[i + 3]
      // SOF0–SOF15 except DHT (C4), JPG (C8), DAC (CC).
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      if (isSof) {
        const precision = buf[i + 4]
        return precision > 0 ? precision : undefined
      }
      i += 2 + len
    }
  }

  return undefined
}

/**
 * Recover text from a PDF that has no text layer, by rendering its pages and
 * reading them with a vision model.
 *
 * Best-effort by construction. A browser without WebGPU, a model that won't
 * download, a page that won't rasterize — each leaves the document indexed by
 * name and tags exactly as before, which is what it would have been anyway.
 * The failure is reported rather than swallowed so a systematically broken
 * OCR path is visible instead of looking like "this PDF just has no text".
 *
 * Rasterization goes through the compute worker (off the main thread);
 * inference runs on the main thread through the shared AI queue, matching how
 * every other model in the app is scheduled.
 */
/**
 * OCR a PDF one page at a time, handing each page's text to `onPage` as soon
 * as it exists.
 *
 * The streaming counterpart to {@link ocrPdfFallback}, and the one the upload
 * path uses. Two problems it solves:
 *
 *   • **Durability.** OCR is ~30s per page, so a 15-page scan is minutes of
 *     work. Returning one string at the end meant a closed tab at page 12 threw
 *     away all twelve. Each page is now persisted as it completes.
 *   • **Memory.** Rendering every page up front holds N decoded bitmaps while
 *     the model works through them serially. Here exactly one page is alive:
 *     rendered, transcribed, handed over, then dropped before the next.
 *
 * `onPage` is awaited, so persistence back-pressures rendering rather than
 * queueing work behind a fast producer.
 *
 * @returns Total characters recovered across all pages.
 */
export async function streamOcrPdf(
  file: File,
  onPage: (page: { pageNum: number; text: string }) => Promise<void> | void,
  options: { maxPages?: number } = {},
): Promise<number> {
  try {
    console.info(
      `[ocr] "${file.name}" has no text layer — streaming OCR page by page.`
    )
    const { OCR_MAX_PAGES, OCR_MAX_PIXELS, ocrSinglePage } = await import(
      '@/workers/ocr.ai'
    )
    const maxPages = options.maxPages ?? OCR_MAX_PAGES

    // Keep the engine switch working here too. Streaming can run either single
    // engine; `compare` needs both over an identical page set, so it defers to
    // the batch path rather than doubling every page of a streamed run.
    const { getOcrEngine, getOcrMaxPixels } = await import('@/utils/ocr-engine')
    const engine = getOcrEngine()
    // Prefill dominates a page and scales with pixel count, so this is the
    // knob worth A/B-ing. Overridable at runtime to avoid a rebuild per trial.
    const maxPixels = getOcrMaxPixels(OCR_MAX_PIXELS)

    const transcribePage = async (
      blob: Blob,
      pageNum: number,
      totalPages: number,
    ) => {
      if (engine === 'florence') {
        const { ocrImageFlorence } = await import('@/workers/ocr-florence.ai')
        return { text: await ocrImageFlorence(blob) }
      }
      return ocrSinglePage({ blob, pageNum }, { totalPages })
    }

    if (engine === 'compare') {
      console.info(
        '[ocr] engine="compare" — using the batch path so both engines see identical pages.'
      )
      const text = await ocrPdfFallback(file)
      if (text) await onPage({ pageNum: 1, text })
      return text?.length ?? 0
    }

    let totalChars = 0
    let pageCount = Infinity

    for (let pageNum = 1; pageNum <= Math.min(maxPages, pageCount); pageNum++) {
      const rendered = await compute<'pdfPageAt'>({
        kind: 'pdfPageAt',
        file,
        pageNum,
        maxPixels,
      })
      if (rendered.kind !== 'pdfPageAt' || !rendered.result) {
        console.error(`[ocr] could not render page ${pageNum} of "${file.name}"`)
        break
      }

      // Learned on the first render, which lets the loop run without a
      // separate metadata pass.
      pageCount = rendered.result.pageCount

      try {
        const { text } = await transcribePage(
          rendered.result.blob,
          pageNum,
          Math.min(maxPages, pageCount),
        )
        if (text) {
          totalChars += text.length
          // Awaited so a slow save throttles the next render rather than
          // letting rendered pages pile up behind it.
          await onPage({ pageNum, text })
        }
      } catch (err) {
        // One unreadable page must not discard the pages already saved —
        // which, unlike before, are already durable on the server.
        console.error(`[ocr] page ${pageNum} failed`, err)
      }

      reportOcrProgress(file.name, {
        page: pageNum,
        totalPages: Math.min(maxPages, pageCount),
        charsSoFar: totalChars,
      })
    }

    reportOcrProgress(file.name, null)
    console.info(
      `[ocr] streaming done — ${totalChars} chars from "${file.name}"`
    )
    return totalChars
  } catch (err) {
    console.error('[ocr] streaming pdf fallback failed', file.name, err)
    reportDegraded('ocr', classifyDegradation(err))
    reportOcrProgress(file.name, null)
    return 0
  }
}

export async function ocrPdfFallback(file: File): Promise<string | null> {
  try {
    console.info(
      `[ocr] "${file.name}" has no text layer — falling back to OCR.`
    )
    const { OCR_MAX_PAGES, OCR_MAX_PIXELS } = await import('@/workers/ocr.ai')

    // Explicit type argument: `TKind` can't be inferred from an object literal
    // that carries kind-specific optional fields, so it widens to the whole
    // union and `Omit` collapses to the keys every variant shares.
    const rendered = await compute<'pdfPages'>({
      kind: 'pdfPages',
      file,
      maxPages: OCR_MAX_PAGES,
      maxPixels: OCR_MAX_PIXELS,
    })
    if (rendered.kind !== 'pdfPages' || !rendered.result) {
      console.error(
        `[ocr] rasterizing failed for "${file.name}":`,
        rendered.kind === 'error' ? rendered.message : 'no result'
      )
      return null
    }
    const { pages } = rendered.result
    if (pages.length === 0) {
      console.error(`[ocr] no pages rendered for "${file.name}"`)
      return null
    }
    console.info(`[ocr] rasterized ${pages.length} page(s) of "${file.name}"`)

    // Which implementation runs is a developer switch (see `ocr-engine.ts`),
    // defaulting to GLM-OCR so a normal upload keeps its existing cost.
    const { getOcrEngine } = await import('@/utils/ocr-engine')
    const engine = getOcrEngine()
    const onPage = (progress: {
      page: number
      totalPages: number
      charsSoFar: number
    }) => reportOcrProgress(file.name, progress)

    // Every import here is lazy: a session that never meets a scanned PDF
    // must never pull in a model wrapper, and never trigger its download.
    let text = ''

    if (engine === 'florence') {
      const { ocrPagesFlorence } = await import('@/workers/ocr-florence.ai')
      text = (await ocrPagesFlorence(pages, { onPage })).text
    } else if (engine === 'compare') {
      // Both, over the identical rendered pages, sequentially — they share one
      // WebGPU context, so overlapping them would measure contention rather
      // than the models. GLM's output is what gets indexed, keeping the
      // comparison observational: switching to 'compare' changes what is
      // logged, not what is stored.
      console.info(
        `[ocr] engine="compare" — running both pipelines over ${pages.length} page(s) of "${file.name}". ` +
          `This downloads ~960MB on a cold cache and takes roughly twice as long.`,
      )

      const glmStart = performance.now()
      const { ocrPages } = await import('@/workers/ocr.ai')
      const glm = await ocrPages(pages, { onPage })
      const glmMs = Math.round(performance.now() - glmStart)

      const florenceStart = performance.now()
      const { ocrPagesFlorence } = await import('@/workers/ocr-florence.ai')
      const florence = await ocrPagesFlorence(pages, { onPage })
      const florenceMs = Math.round(performance.now() - florenceStart)

      const { printUploadComparison } = await import('@/utils/ocr-compare')
      printUploadComparison(file.name, pages.length, [
        { label: 'GLM-OCR', ms: glmMs, text: glm.text },
        { label: 'Florence-2', ms: florenceMs, text: florence.text },
      ])

      text = glm.text
    } else {
      const { ocrPages } = await import('@/workers/ocr.ai')
      text = (await ocrPages(pages, { onPage })).text
    }

    reportOcrProgress(file.name, null)
    return text || null
  } catch (err) {
    console.error('[ocr] pdf fallback failed', file.name, err)
    reportDegraded('ocr', classifyDegradation(err))
    reportOcrProgress(file.name, null)
    return null
  }
}

/**
 * Broadcasts OCR progress on a DOM event.
 *
 * A custom event rather than an imported store because this module is
 * deliberately React-free (see the file header) and is also reachable from
 * contexts that have no component tree. Anything that wants to show progress
 * subscribes; nothing has to.
 */
function reportOcrProgress(
  fileName: string,
  progress: { page: number; totalPages: number; charsSoFar: number } | null,
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('stashly:ocr-progress', {
      detail: { fileName, progress },
    }),
  )
}

export async function extractMediaMetadata(file: File): Promise<MediaMetadata> {
  const meta: MediaMetadata = {}

  if (file.type.startsWith('image/')) {
    const dimsRes = await compute({ kind: 'imageDimensions', file })
    if (dimsRes.kind === 'imageDimensions' && dimsRes.result) {
      meta.imageWidth = dimsRes.result.width
      meta.imageHeight = dimsRes.result.height
    }
    const exif = await exifr
      .parse(file, {
        pick: [
          'Make',
          'Model',
          'ISO',
          'FNumber',
          'ExposureTime',
          'FocalLength',
          'DateTimeOriginal',
          'XResolution',
          'YResolution',
          'ResolutionUnit',
          'BitsPerSample',
        ],
      })
      .catch(() => null)
    if (exif) {
      if (exif.Make) meta.cameraMake = exif.Make
      if (exif.Model) meta.cameraModel = exif.Model
      if (exif.ISO != null) meta.iso = exif.ISO
      if (exif.FNumber != null) meta.fNumber = exif.FNumber
      if (exif.ExposureTime != null) meta.exposureTime = exif.ExposureTime
      if (exif.FocalLength != null) meta.focalLength = exif.FocalLength
      if (exif.DateTimeOriginal)
        meta.takenDateTime = new Date(exif.DateTimeOriginal).toISOString()
      // DPI: EXIF stores X/YResolution with a unit (2 = inches, 3 = cm).
      // Normalize to dots-per-inch so the stored value is always DPI.
      const toDpi = (v: unknown) => {
        const n = typeof v === 'number' ? v : Number(v)
        if (!Number.isFinite(n) || n <= 0) return undefined
        return Math.round(exif.ResolutionUnit === 3 ? n * 2.54 : n)
      }
      const hRes = toDpi(exif.XResolution)
      const vRes = toDpi(exif.YResolution)
      if (hRes != null) meta.horizontalResolution = hRes
      if (vRes != null) meta.verticalResolution = vRes
      // BitsPerSample is per-channel; EXIF reports it as an array (one entry
      // per component). Take the first — all channels share the same depth.
      const bps = Array.isArray(exif.BitsPerSample)
        ? exif.BitsPerSample[0]
        : exif.BitsPerSample
      if (typeof bps === 'number' && bps > 0) meta.bitDepth = bps
    }
    // EXIF BitsPerSample is usually absent on JPEG and never present on PNG
    // (bit depth lives in the IHDR chunk). Fall back to a raw header read.
    if (meta.bitDepth == null) {
      const depth = await readImageBitDepth(file).catch(() => undefined)
      if (depth != null) meta.bitDepth = depth
    }
    const gps = await exifr.gps(file).catch(() => null)
    if (gps) {
      meta.latitude = gps.latitude
      meta.longitude = gps.longitude
    }
  } else if (file.type.startsWith('video/')) {
    const v = await getVideoMetadata(file)
    if (v) {
      meta.videoWidth = v.width
      meta.videoHeight = v.height
      meta.duration = v.duration
    }
  } else if (file.type === 'application/pdf') {
    // The compute worker serializes PDF ops internally (MAX_CONCURRENT = 1),
    // so firing both just queues them back to back.
    const [textRes, metaRes] = await Promise.all([
      compute({ kind: 'pdfText', file }),
      compute({ kind: 'pdfMeta', file }),
    ])
    if (textRes.kind === 'pdfText' && textRes.result) {
      if (textRes.result.text) meta.documentText = textRes.result.text
      meta.documentPageCount = textRes.result.pageCount
    }

    // A PDF with no text layer needs OCR, but that runs *after* this returns
    // — see `ocrPdfFallback` and its caller in `useThumbnailV2`. Doing it
    // inline here would hold the metadata POST for the length of the whole OCR
    // run (minutes), so the item's facet, page count and thumbnail would all
    // wait on it, and closing the tab would lose the lot. The flag tells the
    // caller a second pass is worth attempting.
    meta.needsOcr = !meta.documentText
    if (metaRes.kind === 'pdfMeta' && metaRes.result) {
      const m = metaRes.result
      meta.documentPageCount ??= m.pageCount
      meta.pdfTitle = m.title
      meta.pdfAuthor = m.author
      meta.pdfSubject = m.subject
      meta.pdfKeywords = m.keywords
      meta.pdfCreator = m.creator
      meta.pdfProducer = m.producer
      meta.pdfVersion = m.pdfVersion
      meta.pdfLanguage = m.language
      meta.pdfIsEncrypted = m.isEncrypted
      meta.pdfHasFormFields = m.hasFormFields
      meta.pdfHasAnnotations = m.hasAnnotations
      meta.pdfHasSignatures = m.hasSignatures
      meta.pdfPageWidth = m.pageWidth
      meta.pdfPageHeight = m.pageHeight
      meta.pdfDocCreatedAt = m.docCreatedAt
      meta.pdfDocModifiedAt = m.docModifiedAt
    }
  } else if (isMarkdownFile(file)) {
    const res = await compute({ kind: 'mdMeta', file })
    if (res.kind === 'mdMeta' && res.result) {
      const m = res.result
      // Body text feeds the same search-indexing path PDFs use.
      if (m.text) meta.documentText = m.text
      meta.mdTitle = m.title
      meta.mdAuthor = m.author
      meta.mdDescription = m.description
      meta.mdTags = m.tags
      meta.mdWordCount = m.wordCount
      meta.mdReadingTime = m.readingTime
      meta.mdHeadingCount = m.headingCount
      meta.mdLinkCount = m.linkCount
      meta.mdImageCount = m.imageCount
      meta.mdCodeBlockCount = m.codeBlockCount
      meta.mdTaskCount = m.taskCount
      meta.mdHasFrontmatter = m.hasFrontmatter
      meta.mdDocCreatedAt = m.docCreatedAt
      meta.mdDocModifiedAt = m.docModifiedAt
    }
  } else if (file.type.startsWith('audio/')) {
    const audioMetadata = await extractAudioMetadata(file)
    console.log('audioMetadata: ', audioMetadata)
    meta.audioAlbum = audioMetadata.audioAlbum
    meta.audioAlbumArtist = audioMetadata.audioAlbumArtist
    meta.audioArtist = audioMetadata.audioArtist
    meta.audioBitrate = audioMetadata.audioBitrate
    meta.audioComposer = audioMetadata.audioComposer
    meta.audioCopyright = audioMetadata.audioCopyright
    meta.audioDisc = audioMetadata.audioDisc
    meta.audioDiscCount = audioMetadata.audioDiscCount
    meta.audioDuration = audioMetadata.audioDuration
    meta.audioGenre = audioMetadata.audioGenre
    meta.audioTitle = audioMetadata.audioTitle
    meta.audioTrack = audioMetadata.audioTrack
    meta.audioTrackCount = audioMetadata.audioTrackCount
    meta.audioYear = audioMetadata.audioYear
  }

  return meta
}

export function buildMediaMetadataFormData(
  itemId: string,
  meta: MediaMetadata
): FormData {
  const fd = new FormData()
  fd.append('intent', 'save_media_metadata')
  fd.append('itemId', itemId)
  for (const [k, v] of Object.entries(meta)) {
    // Client-only signals that drive the caller's next step and have no
    // server-side field. Zod would strip them anyway, but sending them
    // invites confusion the first time someone reads the request payload.
    if (CLIENT_ONLY_META_KEYS.has(k)) continue
    if (v != null) fd.append(k, String(v))
  }
  return fd
}

/** Keys of `MediaMetadata` that must never reach `save_media_metadata`. */
const CLIENT_ONLY_META_KEYS: ReadonlySet<string> = new Set(['needsOcr'])
