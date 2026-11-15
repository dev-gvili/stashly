/**
 * Reads a video's container header: codec, frame rate, audio format and the
 * rest of what a `<video>` element cannot tell (it exposes only size and
 * length). Matroska/WebM and MP4/QuickTime, from bytes alone, so it runs
 * anywhere (main thread, worker, Node tests) and never decodes a frame.
 *
 * Nothing here guesses: a field the header does not carry is left out.
 *
 * The header sits at the start of a Matroska file and, for most MP4s, right
 * after `ftyp`. An MP4 written without "faststart" keeps `moov` at the end;
 * {@link readVideoContainer} finds it through the top-level box sizes and
 * reads just that range.
 */

/** What the header says about a video file. Durations in seconds. */
export interface VideoContainerInfo {
  /** `matroska`, `webm`, `mp4` or `quicktime`. */
  container: string
  duration?: number
  width?: number
  height?: number
  /** Frames per second, from the header's frame duration or sample table. */
  frameRate?: number
  /** Short lowercase name where known (`h264`, `av1`), else the raw id. */
  codec?: string
  /** The four-character code of the sample entry, MP4 only. */
  fourCC?: string
  audioFormat?: string
  audioChannels?: number
  audioSamplesPerSecond?: number
  audioBitsPerSample?: number
}

/** Where bytes come from: a `File`, or ranged reads of a stored object. */
export interface ByteSource {
  size: number
  read(start: number, end: number): Promise<Uint8Array>
}

/** Bytes read first. Matroska headers and most MP4 `moov` boxes fit. */
export const HEAD_BYTES = 3 * 1024 * 1024

/** Largest `moov` we will read (a long video's sample tables). */
const MAX_MOOV_BYTES = 64 * 1024 * 1024

const MATROSKA_MAGIC = [0x1a, 0x45, 0xdf, 0xa3]

const VIDEO_CODECS: Record<string, string> = {
  V_AV1: 'av1',
  'V_MPEG4/ISO/AVC': 'h264',
  'V_MPEGH/ISO/HEVC': 'hevc',
  V_VP8: 'vp8',
  V_VP9: 'vp9',
  V_MPEG2: 'mpeg2',
  'V_MPEG4/ISO/SP': 'mpeg4',
  'V_MPEG4/ISO/ASP': 'mpeg4',
  V_THEORA: 'theora',
}

const AUDIO_CODECS: Record<string, string> = {
  A_AAC: 'aac',
  A_OPUS: 'opus',
  A_VORBIS: 'vorbis',
  A_FLAC: 'flac',
  A_AC3: 'ac3',
  A_EAC3: 'eac3',
  A_DTS: 'dts',
  A_MPEG_L3: 'mp3',
  'A_MPEG/L3': 'mp3',
  'A_MPEG/L2': 'mp2',
}

const MP4_AUDIO: Record<string, string> = {
  mp4a: 'aac',
  'ac-3': 'ac3',
  'ec-3': 'eac3',
  Opus: 'opus',
  alac: 'alac',
  fLaC: 'flac',
}

const MP4_VIDEO: Record<string, string> = {
  avc1: 'h264',
  avc3: 'h264',
  hvc1: 'hevc',
  hev1: 'hevc',
  av01: 'av1',
  vp08: 'vp8',
  vp09: 'vp9',
  mp4v: 'mpeg4',
}

// ── Matroska / WebM ────────────────────────────────────────────────────────

const ID = {
  ebml: 0x1a45dfa3,
  segment: 0x18538067,
  info: 0x1549a966,
  tracks: 0x1654ae6b,
  cluster: 0x1f43b675,
  trackEntry: 0xae,
  video: 0xe0,
  audio: 0xe1,
  timecodeScale: 0x2ad7b1,
  duration: 0x4489,
  docType: 0x4282,
  trackType: 0x83,
  codecId: 0x86,
  defaultDuration: 0x23e383,
  pixelWidth: 0xb0,
  pixelHeight: 0xba,
  samplingFrequency: 0xb5,
  channels: 0x9f,
  bitDepth: 0x6264,
} as const

/** Elements whose children we read. Everything else is skipped by size. */
const MASTERS: ReadonlySet<number> = new Set([
  ID.ebml,
  ID.segment,
  ID.info,
  ID.tracks,
  ID.trackEntry,
  ID.video,
  ID.audio,
])

interface Vint {
  value: number
  length: number
  /** The all-ones "size unknown" marker. */
  unknown: boolean
}

/** Reads an EBML variable-length integer; `keepMarker` for element ids. */
function readVint(
  bytes: Uint8Array,
  pos: number,
  keepMarker: boolean
): Vint | null {
  const first = bytes[pos]
  if (first === undefined || first === 0) return null
  let length = 1
  let mask = 0x80
  while (!(first & mask)) {
    length++
    mask >>= 1
  }
  if (pos + length > bytes.length) return null
  let value = keepMarker ? first : first & (mask - 1)
  let allOnes = (first & (mask - 1)) === mask - 1
  for (let i = 1; i < length; i++) {
    const b = bytes[pos + i]
    value = value * 256 + b
    if (b !== 0xff) allOnes = false
  }
  return { value, length, unknown: !keepMarker && allOnes }
}

function readUint(bytes: Uint8Array, start: number, end: number): number {
  let value = 0
  for (let i = start; i < end; i++) value = value * 256 + bytes[i]
  return value
}

function readFloat(
  bytes: Uint8Array,
  start: number,
  end: number
): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, end - start)
  if (end - start === 4) return view.getFloat32(0)
  if (end - start === 8) return view.getFloat64(0)
  return null
}

function readString(bytes: Uint8Array, start: number, end: number): string {
  let out = ''
  for (let i = start; i < end && bytes[i] !== 0; i++) {
    out += String.fromCharCode(bytes[i])
  }
  return out
}

/**
 * Headers state a sample size for lossy audio too (Matroska writes 32 for
 * Opus), a number about the decoder's output, not the stored audio. Only
 * lossless formats carry a bit depth worth keeping.
 */
function isLossless(format: string | undefined): boolean {
  return format === 'flac' || format === 'alac' || !!format?.startsWith('A_PCM')
}

interface MatroskaTrack {
  type?: number
  codecId?: string
  defaultDuration?: number
  width?: number
  height?: number
  sampleRate?: number
  channels?: number
  bitDepth?: number
}

/** True when the bytes start with an EBML header (Matroska or WebM). */
export function isMatroska(bytes: Uint8Array): boolean {
  return MATROSKA_MAGIC.every((b, i) => bytes[i] === b)
}

/**
 * Parses a Matroska or WebM header: `Info` and `Tracks`, which come before
 * the first `Cluster`. Returns null when the bytes are not Matroska.
 *
 * @param head - The start of the file; 3 MB is plenty.
 */
export function parseMatroska(head: Uint8Array): VideoContainerInfo | null {
  if (!isMatroska(head)) return null

  let docType = 'matroska'
  let timecodeScale = 1_000_000
  let rawDuration: number | null = null
  const tracks: MatroskaTrack[] = []
  let current: MatroskaTrack | null = null

  const walk = (start: number, end: number): boolean => {
    let pos = start
    while (pos < end) {
      const id = readVint(head, pos, true)
      if (!id) return true
      const size = readVint(head, pos + id.length, false)
      if (!size) return true
      const dataStart = pos + id.length + size.length
      const dataEnd = size.unknown ? end : Math.min(dataStart + size.value, end)

      // Past the header: stop, everything we want came earlier.
      if (id.value === ID.cluster) return false

      if (MASTERS.has(id.value)) {
        if (id.value === ID.trackEntry) {
          current = {}
          tracks.push(current)
        }
        if (!walk(dataStart, dataEnd)) return false
      } else {
        switch (id.value) {
          case ID.docType:
            docType = readString(head, dataStart, dataEnd) || docType
            break
          case ID.timecodeScale:
            timecodeScale = readUint(head, dataStart, dataEnd) || timecodeScale
            break
          case ID.duration:
            rawDuration = readFloat(head, dataStart, dataEnd)
            break
          case ID.trackType:
            if (current) current.type = readUint(head, dataStart, dataEnd)
            break
          case ID.codecId:
            if (current) current.codecId = readString(head, dataStart, dataEnd)
            break
          case ID.defaultDuration:
            if (current)
              current.defaultDuration = readUint(head, dataStart, dataEnd)
            break
          case ID.pixelWidth:
            if (current) current.width = readUint(head, dataStart, dataEnd)
            break
          case ID.pixelHeight:
            if (current) current.height = readUint(head, dataStart, dataEnd)
            break
          case ID.samplingFrequency:
            if (current)
              current.sampleRate =
                readFloat(head, dataStart, dataEnd) ?? undefined
            break
          case ID.channels:
            if (current) current.channels = readUint(head, dataStart, dataEnd)
            break
          case ID.bitDepth:
            if (current) current.bitDepth = readUint(head, dataStart, dataEnd)
            break
        }
      }
      pos = dataEnd
    }
    return true
  }
  walk(0, head.length)

  const info: VideoContainerInfo = { container: docType }
  if (rawDuration != null && rawDuration > 0) {
    info.duration = (rawDuration * timecodeScale) / 1e9
  }
  const video = tracks.find((t) => t.type === 1)
  if (video) {
    if (video.width) info.width = video.width
    if (video.height) info.height = video.height
    if (video.codecId) info.codec = VIDEO_CODECS[video.codecId] ?? video.codecId
    if (video.defaultDuration && video.defaultDuration > 0) {
      info.frameRate = 1e9 / video.defaultDuration
    }
  }
  const audio = tracks.find((t) => t.type === 2)
  if (audio) {
    if (audio.codecId) {
      info.audioFormat = AUDIO_CODECS[audio.codecId] ?? audio.codecId
    }
    if (audio.channels) info.audioChannels = audio.channels
    if (audio.sampleRate) info.audioSamplesPerSecond = audio.sampleRate
    if (audio.bitDepth && isLossless(info.audioFormat)) {
      info.audioBitsPerSample = audio.bitDepth
    }
  }
  return info
}

// ── MP4 / QuickTime ────────────────────────────────────────────────────────

interface Box {
  type: string
  /** Where the box starts, header included. */
  start: number
  /** Where the payload starts. */
  dataStart: number
  end: number
}

/** Boxes found one level deep in `bytes[start, end)`. A box cut off by the end is kept with the end it declares. */
function listBoxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length)
  const boxes: Box[] = []
  let pos = start
  while (pos + 8 <= end) {
    let size = view.getUint32(pos)
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8))
    let headerSize = 8
    if (size === 1) {
      if (pos + 16 > end) break
      size = Number(view.getBigUint64(pos + 8))
      headerSize = 16
    } else if (size === 0) {
      size = end - pos
    }
    if (size < headerSize) break
    boxes.push({
      type,
      start: pos,
      dataStart: pos + headerSize,
      end: pos + size,
    })
    pos += size
  }
  return boxes
}

function child(bytes: Uint8Array, parent: Box, type: string): Box | undefined {
  return listBoxes(
    bytes,
    parent.dataStart,
    Math.min(parent.end, bytes.length)
  ).find((b) => b.type === type)
}

function fourCC(bytes: Uint8Array, pos: number): string {
  return String.fromCharCode(...bytes.subarray(pos, pos + 4))
}

/**
 * Parses an MP4 or QuickTime `moov` box (the box itself, header included).
 * Duration comes from `mvhd`; codec, size, audio format and frame rate from
 * the first video and first sound track's sample description and tables.
 */
export function parseMoov(
  moovBytes: Uint8Array,
  brand: string
): VideoContainerInfo {
  const view = new DataView(
    moovBytes.buffer,
    moovBytes.byteOffset,
    moovBytes.length
  )
  const info: VideoContainerInfo = {
    container: brand === 'qt  ' ? 'quicktime' : 'mp4',
  }
  const moov = listBoxes(moovBytes, 0, moovBytes.length)[0]
  if (!moov) return info

  const mvhd = child(moovBytes, moov, 'mvhd')
  if (mvhd) {
    const v1 = moovBytes[mvhd.dataStart] === 1
    const timescale = view.getUint32(mvhd.dataStart + (v1 ? 20 : 12))
    const duration = v1
      ? Number(view.getBigUint64(mvhd.dataStart + 24))
      : view.getUint32(mvhd.dataStart + 16)
    if (timescale > 0 && duration > 0) info.duration = duration / timescale
  }

  const traks = listBoxes(moovBytes, moov.dataStart, moov.end).filter(
    (b) => b.type === 'trak'
  )
  let haveVideo = false
  let haveAudio = false
  for (const trak of traks) {
    const mdia = child(moovBytes, trak, 'mdia')
    const hdlr = mdia && child(moovBytes, mdia, 'hdlr')
    const minf = mdia && child(moovBytes, mdia, 'minf')
    const stbl = minf && child(moovBytes, minf, 'stbl')
    const stsd = stbl && child(moovBytes, stbl, 'stsd')
    if (!mdia || !hdlr || !stsd) continue
    const handler = fourCC(moovBytes, hdlr.dataStart + 8)
    // stsd: version/flags(4) entry_count(4), then the first entry.
    const entry = stsd.dataStart + 8
    const entryType = fourCC(moovBytes, entry + 4)

    if (handler === 'vide' && !haveVideo) {
      haveVideo = true
      info.fourCC = entryType
      info.codec = MP4_VIDEO[entryType] ?? entryType
      // VisualSampleEntry: 6 reserved + dataref(2) + 16 predefined, then w/h.
      info.width = view.getUint16(entry + 8 + 24)
      info.height = view.getUint16(entry + 8 + 26)

      const mdhd = child(moovBytes, mdia, 'mdhd')
      const stts = child(moovBytes, stbl, 'stts')
      if (mdhd && stts) {
        const v1 = moovBytes[mdhd.dataStart] === 1
        const timescale = view.getUint32(mdhd.dataStart + (v1 ? 20 : 12))
        const duration = v1
          ? Number(view.getBigUint64(mdhd.dataStart + 24))
          : view.getUint32(mdhd.dataStart + 16)
        const entries = view.getUint32(stts.dataStart + 4)
        let samples = 0
        for (let i = 0; i < entries; i++) {
          samples += view.getUint32(stts.dataStart + 8 + i * 8)
        }
        if (timescale > 0 && duration > 0 && samples > 0) {
          info.frameRate = samples / (duration / timescale)
        }
      }
    } else if (handler === 'soun' && !haveAudio) {
      haveAudio = true
      info.audioFormat = MP4_AUDIO[entryType] ?? entryType
      // AudioSampleEntry: 6 reserved + dataref(2) + 8 reserved, then
      // channelcount(2) samplesize(2) 4 skipped, samplerate 16.16.
      const channels = view.getUint16(entry + 8 + 16)
      const bits = view.getUint16(entry + 8 + 18)
      const rate = view.getUint32(entry + 8 + 24) / 65536
      if (channels > 0) info.audioChannels = channels
      if (bits > 0 && isLossless(info.audioFormat)) {
        info.audioBitsPerSample = bits
      }
      if (rate > 0) info.audioSamplesPerSecond = Math.round(rate)
    }
  }
  return info
}

// ── Entry point ────────────────────────────────────────────────────────────

/** A `ByteSource` over a `Blob` or `File`. */
export function blobSource(blob: Blob): ByteSource {
  return {
    size: blob.size,
    read: async (start, end) =>
      new Uint8Array(await blob.slice(start, end).arrayBuffer()),
  }
}

/**
 * Reads a video's container info: the first {@link HEAD_BYTES} for Matroska,
 * and for MP4 the `moov` box, wherever it sits, through the top-level box
 * sizes. Resolves null for anything else, or when the header can't be read.
 *
 * @example
 * const info = await readVideoContainer(blobSource(file))
 * info?.codec // 'h264'
 */
export async function readVideoContainer(
  source: ByteSource
): Promise<VideoContainerInfo | null> {
  const head = await source.read(0, Math.min(source.size, HEAD_BYTES))
  if (isMatroska(head)) return parseMatroska(head)

  // MP4 starts with a box whose type is `ftyp` (QuickTime may start at moov).
  const top = listBoxes(head, 0, head.length)
  const ftyp = top.find((b) => b.type === 'ftyp')
  if (!top.length || (!ftyp && !top.some((b) => b.type === 'moov'))) return null
  const brand = ftyp ? fourCC(head, ftyp.dataStart) : ''

  // Walk the top-level boxes by their declared sizes, reading only each
  // box's 16-byte header when it lies beyond the head.
  let pos = 0
  while (pos + 8 <= source.size) {
    const header =
      pos + 16 <= head.length
        ? head.subarray(pos, pos + 16)
        : await source.read(pos, Math.min(source.size, pos + 16))
    if (header.length < 8) return null
    const view = new DataView(header.buffer, header.byteOffset, header.length)
    let size = view.getUint32(0)
    const type = fourCC(header, 4)
    if (size === 1 && header.length >= 16) size = Number(view.getBigUint64(8))
    else if (size === 0) size = source.size - pos
    if (size < 8) return null

    if (type === 'moov') {
      if (size > MAX_MOOV_BYTES) return null
      const moov =
        pos + size <= head.length
          ? head.subarray(pos, pos + size)
          : await source.read(pos, pos + size)
      return parseMoov(moov, brand)
    }
    pos += size
  }
  return null
}
