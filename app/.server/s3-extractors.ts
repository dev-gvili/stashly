/**
 * S3 streaming extractors using local, open-source models only (no paid cloud services).
 *
 * Capabilities provided here:
 * - PDF: range requests + pdf.js data range transport (no full-file buffering)
 * - DOCX/PPTX/XLSX: streamed to a temp file and parsed with unzipper / exceljs
 * - Text/Markdown/Code: stream a bounded prefix
 * - Images: attempt image captioning using a local image->text model (via @xenova/transformers), fallback to OCR (tesseract.js) if available
 * - Audio/Video: stream to temp file then transcribe locally via a Whisper model (via @xenova/transformers)
 *
 * Notes:
 * - These utilities intentionally avoid any paid/external cloud ML services.
 * - They stream from S3 to avoid OOM; for some model workloads (ASR / vision) a temp file is used because most local model loaders expect a file-like buffer.
 */

import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { pipeline as streamPipeline } from 'stream/promises'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as pdfjsLib from 'pdfjs-dist'
import * as unzipper from 'unzipper'
import * as sax from 'sax'
import ExcelJS from 'exceljs'
import { pipeline, env,type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { s3 } from '@/services/s3'

async function streamToTempFile(
  s3client: S3Client = s3,
  bucket: string,
  key: string,
  opts?: { maxSizeBytes?: number }
) {
  const resp = await s3client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!resp.Body) throw new Error('S3 object had no Body')

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 's3-'))
  const tmpPath = path.join(tmpDir, path.basename(key))
  const ws = fs.createWriteStream(tmpPath)

  let bytes = 0
  const reader = resp.Body as any
  reader.on?.('data', (c: Buffer) => {
    bytes += c.length
    if (opts?.maxSizeBytes && bytes > opts.maxSizeBytes) {
      reader.destroy(
        new Error('Exceeded max size while streaming S3 to temp file')
      )
    }
  })

  await streamPipeline(reader, ws)
  return tmpPath
}

// ---------------- PDF (range streaming) ----------------

async function getS3ObjectLength(s3: S3Client, bucket: string, key: string) {
  const head = await s3.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  )
  return Number(head.ContentLength ?? 0)
}

async function getS3Range(
  s3: S3Client,
  bucket: string,
  key: string,
  begin: number,
  end: number
) {
  const range = `bytes=${begin}-${end - 1}`
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: range })
  )
  if (!resp.Body) throw new Error('No body for range')
  const chunks: Buffer[] = []
  const stream = resp.Body as any
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

class S3DataRangeTransport extends pdfjsLib.PDFDataRangeTransport {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly key: string
  constructor(client: S3Client, bucket: string, key: string, length: number) {
    // PDFDataRangeTransport constructor: (length, initialData: Uint8Array | null, progressiveDone?: boolean)
    // Provide `null` for `initialData` and `false` for `progressiveDone` to match the expected types.
    super(length, null, false)
    this.client = client
    this.bucket = bucket
    this.key = key
  }

  
  override async requestDataRange(begin: number, end: number) {
    try {
      const chunk = await getS3Range(
        this.client,
        this.bucket,
        this.key,
        begin,
        end
      )
      this.onDataRange(begin, chunk)
    } catch (err) {
      console.error('Error fetching S3 range:', err)
      this.abort()
    }
  }
}

export async function extractPdfTextFromS3({
  bucket,
  key,
  s3Client = s3,
  maxPages,
}: {
  bucket: string
  key: string
  s3Client?: S3Client
  maxPages?: number
}) {
  const totalLength = await getS3ObjectLength(s3Client, bucket, key)
  const transport = new S3DataRangeTransport(s3Client, bucket, key, totalLength)
  const loadingTask = (pdfjsLib as any).getDocument({
    length: totalLength,
    range: transport,
  })
  const doc = await loadingTask.promise
  const pages = maxPages ? Math.min(doc.numPages, maxPages) : doc.numPages
  const parts: string[] = []
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i)
    const text = await page.getTextContent()
    parts.push((text.items as any[]).map((it) => it.str).join(' '))
  }
  try {
    await doc.cleanup()
  } catch {}
  return parts.join('\n')
}

// ---------------- Office files (DOCX / PPTX / XLSX) ----------------

async function parseXmlStreamToText(stream: NodeJS.ReadableStream) {
  return await new Promise<string>((resolve, reject) => {
    const parser = sax.createStream(true)
    const out: string[] = []
    parser.on('error', (e) => reject(e))
    parser.on('text', (t) => out.push(String(t)))
    parser.on('end', () => resolve(out.join(' ')))
    stream.pipe(parser)
  })
}

export async function extractDocxTextFromS3({
  bucket,
  key,
  s3Client = s3,
  maxSizeBytes,
}: {
  bucket: string
  key: string
  s3Client?: S3Client
  maxSizeBytes?: number
}) {
  const tmp = await streamToTempFile(s3Client, bucket, key, { maxSizeBytes })
  try {
    const dir = await unzipper.Open.file(tmp)
    const entry = dir.files.find((f) => f.path === 'word/document.xml')
    if (!entry) return ''
    const stream = await entry.stream()
    return await parseXmlStreamToText(stream)
  } finally {
    try {
      await fs.promises.unlink(tmp)
    } catch {}
  }
}

export async function extractPptxTextFromS3({
  bucket,
  key,
  s3Client = s3,
  maxSlides,
  maxSizeBytes,
}: {
  bucket: string
  key: string
  s3Client?: S3Client
  maxSlides?: number
  maxSizeBytes?: number
}) {
  const tmp = await streamToTempFile(s3Client, bucket, key, { maxSizeBytes })
  try {
    const dir = await unzipper.Open.file(tmp)
    const slides = dir.files.filter((f) =>
      f.path.startsWith('ppt/slides/slide')
    )
    const selected = maxSlides ? slides.slice(0, maxSlides) : slides
    const parts: string[] = []
    for (const s of selected) {
      const st = await s.stream()
      parts.push(await parseXmlStreamToText(st))
    }
    return parts.join('\n')
  } finally {
    try {
      await fs.promises.unlink(tmp)
    } catch {}
  }
}

export async function extractXlsxTextFromS3({
  bucket,
  key,
  s3Client = s3,
  maxRowsPerSheet = 200,
  maxSizeBytes,
}: {
  bucket: string
  key: string
  s3Client?: S3Client
  maxRowsPerSheet?: number
  maxSizeBytes?: number
}) {
  const tmp = await streamToTempFile(s3Client, bucket, key, { maxSizeBytes })
  try {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(tmp)
    const out: string[] = []
    wb.eachSheet((ws) => {
      let rows = 0
      ws.eachRow((row) => {
        if (rows++ >= (maxRowsPerSheet ?? 200)) return
        out.push(
          row.values
            ?.slice(1)
            .map((c: any) => (c == null ? '' : String(c)))
            .join(' ')
        )
      })
    })
    return out.join('\n')
  } finally {
    try {
      await fs.promises.unlink(tmp)
    } catch {}
  }
}

// ---------------- Plain text / code files (bounded streaming) ----------------

export async function extractTextFileFromS3({
  bucket,
  key,
  s3Client = s3,
  maxBytes = 5 * 1024 * 1024,
}: {
  bucket: string
  key: string
  s3Client?: S3Client
  maxBytes?: number
}) {
  const resp = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  )
  if (!resp.Body) throw new Error('No body')
  const stream = resp.Body as any
  const chunks: Buffer[] = []
  let n = 0
  for await (const c of stream) {
    chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
    n += c.length
    if (n >= maxBytes) break
  }
  return Buffer.concat(chunks).toString('utf8')
}

// ---------------- Vision (image captioning / OCR fallback) ----------------

class VisionLocal {
  static model = 'Salesforce/blip-image-captioning-base'
  static instance: any = null
  static async getInstance() {
    if (!this.instance)
      this.instance = await pipeline('image-to-text', this.model)
    return this.instance
  }
}

export async function describeImageFromS3({
  bucket,
  key,
  s3Client = s3,
  maxLabels = 6,
}: {
  bucket: string
  key: string
  s3Client?: S3Client
  maxLabels?: number
}) {
  const tmp = await streamToTempFile(s3Client, bucket, key)
  try {
    // Try image->text model first
    try {
      const vision = await VisionLocal.getInstance()
      const img = await fs.promises.readFile(tmp)
      const res = await vision(img)
      // Try common response shapes
      const caption = Array.isArray(res)
        ? (res[0]?.generated_text ?? res[0]?.caption ?? res[0]?.text)
        : (res?.generated_text ?? res?.caption ?? res?.text)
      if (caption) return String(caption)
    } catch (e) {
      // swallow and fallback to OCR below
    }

    // Fallback: try OCR via tesseract.js if available
    try {
      // dynamic import so tesseract is optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Tesseract = require('tesseract.js')
      const {
        data: { text },
      } = await Tesseract.recognize(tmp, 'eng')
      if (text && text.trim()) return `Text: ${text.trim().slice(0, 1000)}`
    } catch (e) {
      // ignore
    }

    return 'Image (no caption available)'
  } finally {
    try {
      await fs.promises.unlink(tmp)
    } catch {}
  }
}

// ---------------- Speech (Whisper local) ----------------

class SpeechLocal {
  static model = 'openai/whisper-small'
  static instance: AutomaticSpeechRecognitionPipeline | null = null
  static async getInstance() {
    if (!this.instance)
      this.instance = await pipeline('automatic-speech-recognition', this.model)
    return this.instance
  }
}

export async function transcribeS3WithLocalWhisper({
  bucket,
  key,
  s3Client = s3,
  language = 'en',
}: {
  bucket: string
  key: string
  s3Client?: S3Client
  language?: string
}) {
  const tmp = await streamToTempFile(s3Client, bucket, key)
  try {
    const speech = await SpeechLocal.getInstance()
    const audio = await fs.promises.readFile(tmp)
    const out = await speech(audio)
    // common response shapes
    const text = Array.isArray(out)
      ? (out[0]?.text ?? out[0]?.transcript ?? out[0]?.generated_text)
      : (out?.text ?? out?.transcript ?? out?.generated_text)
    return String(text ?? '')
  } finally {
    try {
      await fs.promises.unlink(tmp)
    } catch {}
  }
}

// ---------------- Auto dispatcher ----------------

export async function extractTextFromS3Auto({
  bucket,
  key,
  s3Client = s3,
  options,
}: {
  bucket: string
  key: string
  s3Client?: S3Client
  options?: any
}) {
  const ext = path.extname(key).toLowerCase()
  if (ext === '.pdf')
    return extractPdfTextFromS3({
      bucket,
      key,
      s3Client,
      maxPages: options?.maxPages,
    })
  if (ext === '.docx')
    return extractDocxTextFromS3({
      bucket,
      key,
      s3Client,
      maxSizeBytes: options?.maxSizeBytes,
    })
  if (ext === '.pptx')
    return extractPptxTextFromS3({
      bucket,
      key,
      s3Client,
      maxSlides: options?.maxSlides,
      maxSizeBytes: options?.maxSizeBytes,
    })
  if (ext === '.xlsx')
    return extractXlsxTextFromS3({
      bucket,
      key,
      s3Client,
      maxRowsPerSheet: options?.maxRowsPerSheet,
      maxSizeBytes: options?.maxSizeBytes,
    })
  if (['.txt', '.md', '.json', '.csv', '.log', '.sql'].includes(ext))
    return extractTextFileFromS3({
      bucket,
      key,
      s3Client,
      maxBytes: options?.maxBytes,
    })
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext))
    return describeImageFromS3({ bucket, key, s3Client })
  if (['.mp3', '.wav', '.m4a', '.mp4', '.mov', '.flac', '.aac'].includes(ext))
    return transcribeS3WithLocalWhisper({ bucket, key, s3Client })

  // Fallback: try to stream a small prefix and return as text
  try {
    return await extractTextFileFromS3({
      bucket,
      key,
      s3Client,
      maxBytes: options?.maxBytes ?? 1024 * 1024,
    })
  } catch (err) {
    throw new Error(`Unsupported file for auto-extraction: ${String(err)}`)
  }
}

export default {
  extractPdfTextFromS3,
  extractDocxTextFromS3,
  extractPptxTextFromS3,
  extractXlsxTextFromS3,
  extractTextFileFromS3,
  describeImageFromS3,
  transcribeS3WithLocalWhisper,
  extractTextFromS3Auto,
}
