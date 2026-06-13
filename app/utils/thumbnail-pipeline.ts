/**
 * Pure pipeline helpers for the progressive thumbnail flow.
 *
 * No React, no fetchers — just compute + raw `fetch` for S3 PUTs.
 * The orchestrator hook composes these with route-fetcher calls.
 */
import { dataUrlToBlob } from '@/utils/thumbnail'
import { generateVideoThumbnail, getVideoMetadata } from '@/utils/video'
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
      { type: 'module' },
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
    console.error('[thumbnail compute worker] error event', e.message, e.filename, e.lineno)
  }
  return computeWorker
}

const COMPUTE_TIMEOUT_MS = 60_000

export function compute<TKind extends ComputeRequest['kind']>(
  req: Omit<Extract<ComputeRequest, { kind: TKind }>, 'id'>,
): Promise<Extract<ComputeResponse, { kind: TKind | 'error' }>> {
  return new Promise((resolve) => {
    const worker = getComputeWorker()
    if (!worker) {
      resolve({ id: 0, kind: 'error', message: 'no worker available' } as never)
      return
    }
    const id = nextRequestId++
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        console.error(`[thumbnail compute] timeout waiting for ${req.kind} (id=${id})`)
        resolve({ id, kind: 'error', message: `timeout: ${req.kind}` } as never)
      }
    }, COMPUTE_TIMEOUT_MS)
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
  return null
}

export interface ResizedThumbnail {
  blob: Blob
  width: number
  height: number
}

export async function generateStage2Resize(
  file: File,
  videoFrame?: Blob | null,
): Promise<ResizedThumbnail | null> {
  if (file.type.startsWith('image/')) {
    const res = await compute({ kind: 'resizeImage', file })
    if (res.kind === 'resizeImage' && res.result) {
      return { blob: res.result.blob, width: res.result.width, height: res.result.height }
    }
    return null
  }
  if (file.type === 'application/pdf') {
    const res = await compute({ kind: 'resizePdf', file })
    if (res.kind === 'resizePdf' && res.result) {
      return { blob: res.result.blob, width: res.result.width, height: res.result.height }
    }
    return null
  }
  if (file.type.startsWith('video/') && videoFrame) {
    const frameFile = new File([videoFrame], 'frame.webp', { type: 'image/webp' })
    const res = await compute({ kind: 'resizeImage', file: frameFile })
    if (res.kind === 'resizeImage' && res.result) {
      return { blob: res.result.blob, width: res.result.width, height: res.result.height }
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
    return null
  })
}

// ── S3 PUT ───────────────────────────────────────────────────────────────

export async function putThumbnailToS3(
  uploadUrl: string,
  blob: Blob,
  itemId: string,
  stage: number,
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
    while (end >= 2 && payload[end - 1] === 0 && payload[end - 2] === 0) end -= 2
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
  'Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop','Jazz',
  'Metal','New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock','Techno',
  'Industrial','Alternative','Ska','Death Metal','Pranks','Soundtrack','Euro-Techno',
  'Ambient','Trip-Hop','Vocal','Jazz+Funk','Fusion','Trance','Classical','Instrumental',
  'Acid','House','Game','Sound Clip','Gospel','Noise','Alternative Rock','Bass','Soul',
  'Punk','Space','Meditative','Instrumental Pop','Instrumental Rock','Ethnic','Gothic',
  'Darkwave','Techno-Industrial','Electronic','Pop-Folk','Eurodance','Dream',
  'Southern Rock','Comedy','Cult','Gangsta','Top 40','Christian Rap','Pop/Funk',
  'Jungle','Native American','Cabaret','New Wave','Psychedelic','Rave','Showtunes',
  'Trailer','Lo-Fi','Tribal','Acid Punk','Acid Jazz','Polka','Retro','Musical',
  'Rock & Roll','Hard Rock',
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

function parseId3Tags(bytes: Uint8Array, view: DataView, version: number): Record<string, string> {
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
      const size = (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5]
      pos += 6
      if (id[0] === '\0' || size <= 0 || size > 1_000_000) break
      if (id[0] === 'T') frames[id] = decodeTextFrame(bytes.slice(pos, pos + size))
      pos += size
    } else {
      if (pos + 10 > tagEnd) break
      const id = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3])
      const size = version === 4 ? readSyncsafe(view, pos + 4) : view.getUint32(pos + 4)
      pos += 10
      if (id[0] === '\0' || size <= 0 || size > 1_000_000) break
      if (id[0] === 'T') frames[id] = decodeTextFrame(bytes.slice(pos, pos + size))
      pos += size
    }
  }
  return frames
}

function getAudioDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(undefined); return }
    const el = document.createElement('audio')
    const url = URL.createObjectURL(file)
    el.src = url
    el.preload = 'metadata'
    const cleanup = () => URL.revokeObjectURL(url)
    el.addEventListener('loadedmetadata', () => { cleanup(); resolve(isFinite(el.duration) ? el.duration : undefined) }, { once: true })
    el.addEventListener('error', () => { cleanup(); resolve(undefined) }, { once: true })
    setTimeout(() => { cleanup(); resolve(undefined) }, 10_000)
  })
}

async function extractAudioMetadata(file: File): Promise<Partial<MediaMetadata>> {
  const [duration, id3] = await Promise.all([
    getAudioDuration(file),
    (async () => {
      const buf = await file.slice(0, 512 * 1024).arrayBuffer()
      const bytes = new Uint8Array(buf)
      const view = new DataView(buf)
      // Check "ID3" magic and version 2-4
      if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null
      const ver = bytes[3]
      if (ver < 2 || ver > 4) return null
      return parseId3Tags(bytes, view, ver)
    })(),
  ])

  const meta: Partial<MediaMetadata> = {}

  if (duration !== undefined) {
    meta.audioDuration = Math.round(duration)
    meta.audioBitrate = duration > 0 ? Math.round((file.size * 8) / (duration * 1000)) : undefined
  }

  if (id3) {
    const f = (v2: string, v3: string) => id3[v3] || id3[v2] || undefined
    meta.audioTitle       = f('TT2', 'TIT2')
    meta.audioArtist      = f('TP1', 'TPE1')
    meta.audioAlbum       = f('TAL', 'TALB')
    meta.audioAlbumArtist = f('TP2', 'TPE2')
    meta.audioComposer    = f('TCM', 'TCOM')
    meta.audioCopyright   = f('TCR', 'TCOP')
    meta.audioGenre       = parseId3Genre(f('TCO', 'TCON') ?? '')

    meta.audioYear = parseId3Year(f('TYE', 'TDRC') ?? f('TYE', 'TYER') ?? '')

    const { num: track, total: trackCount } = parseId3TrackNum(f('TRK', 'TRCK') ?? '')
    meta.audioTrack      = track
    meta.audioTrackCount = trackCount

    const { num: disc, total: discCount } = parseId3TrackNum(f('TPA', 'TPOS') ?? '')
    meta.audioDisc      = disc
    meta.audioDiscCount = discCount
  }

  return meta
}

export async function extractMediaMetadata(file: File): Promise<MediaMetadata> {
  const meta: MediaMetadata = {}

  if (file.type.startsWith('image/')) {
    const dimsRes = await compute({ kind: 'imageDimensions', file })
    if (dimsRes.kind === 'imageDimensions' && dimsRes.result) {
      meta.imageWidth = dimsRes.result.width
      meta.imageHeight = dimsRes.result.height
    }
    const exif = await exifr.parse(file, {
      pick: ['Make', 'Model', 'ISO', 'FNumber', 'ExposureTime', 'FocalLength', 'DateTimeOriginal'],
    }).catch(() => null)
    if (exif) {
      if (exif.Make) meta.cameraMake = exif.Make
      if (exif.Model) meta.cameraModel = exif.Model
      if (exif.ISO != null) meta.iso = exif.ISO
      if (exif.FNumber != null) meta.fNumber = exif.FNumber
      if (exif.ExposureTime != null) meta.exposureTime = exif.ExposureTime
      if (exif.FocalLength != null) meta.focalLength = exif.FocalLength
      if (exif.DateTimeOriginal) meta.takenDateTime = new Date(exif.DateTimeOriginal).toISOString()
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
  } else if (file.type.startsWith('audio/')) {
    const audioMetadata = await extractAudioMetadata(file)
    console.log("audioMetadata: ", audioMetadata)
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

export function buildMediaMetadataFormData(itemId: string, meta: MediaMetadata): FormData {
  const fd = new FormData()
  fd.append('intent', 'save_media_metadata')
  fd.append('itemId', itemId)
  for (const [k, v] of Object.entries(meta)) {
    if (v != null) fd.append(k, String(v))
  }
  return fd
}
