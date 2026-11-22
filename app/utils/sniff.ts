// Disambiguates the `.ts` extension collision: browsers report TypeScript
// files as MPEG transport stream video ('video/vnd.dlna.mpeg-tts' /
// 'video/mp2t') because the extension predates TypeScript in OS MIME tables.
//
// - Client: `normalizeFile(file)` peeks at the first 1KB and rebuilds the
//   File with a corrected type before it enters the upload machine.
// - Server: `sniffTsBytes(bytes)` is the same check, run against a ranged
//   GetObject after complete-multipart-upload as the authoritative check.

const MPEGTS_SYNC = 0x47
const MPEGTS_PACKET = 188

export type TsKind = 'typescript' | 'mpeg-ts' | 'unknown'

export interface SniffResult {
  kind: TsKind
  contentType: string
}

/**
 * Inspect the leading bytes of a `.ts` file and decide what it really is.
 *
 * Real MPEG transport streams have a 0x47 sync byte at every 188-byte
 * packet boundary. TypeScript source is valid UTF-8 text. Anything else
 * falls through to `unknown`.
 *
 * @param bytes - First bytes of the file (1KB is plenty; needs >= 376
 *                bytes to positively identify MPEG-TS).
 */
export function sniffTsBytes(bytes: Uint8Array): SniffResult {
  const packets = Math.min(3, Math.floor(bytes.length / MPEGTS_PACKET))
  if (packets >= 2) {
    let isTransportStream = true
    for (let i = 0; i < packets; i++) {
      if (bytes[i * MPEGTS_PACKET] !== MPEGTS_SYNC) {
        isTransportStream = false
        break
      }
    }
    if (isTransportStream) {
      return { kind: 'mpeg-ts', contentType: 'video/mp2t' }
    }
  }

  try {
    // fatal: true throws on any invalid UTF-8 sequence
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { kind: 'typescript', contentType: 'text/typescript' }
  } catch {
    return { kind: 'unknown', contentType: 'application/octet-stream' }
  }
}

/** `.ts` / `.tsx` — the extensions whose browser-reported MIME can't be trusted. */
export function isAmbiguousTsFile(nameOrKey: string): boolean {
  return /\.tsx?$/i.test(nameOrKey)
}

/**
 * Client-side normalization. Reads only the first 1KB (`file.slice` is
 * lazy — safe for multi-GB files) and, when the browser-reported type
 * disagrees with the content, returns a new File with the corrected type.
 *
 * Call this at the choke point (useUpload `add` / `addBatch`) BEFORE
 * `toMediaFile`, so every downstream consumer of `mediaFile.file.type`
 * (toCategory, toItemPayload, create-multipart-upload metadata) sees the
 * corrected value.
 */
export async function normalizeFile(file: File): Promise<File> {
  if (!isAmbiguousTsFile(file.name)) {
    const mediaType = untypedMediaType(file)
    return mediaType ? retype(file, mediaType) : file
  }

  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const { contentType } = sniffTsBytes(head)
  if (contentType === file.type) return file
  return retype(file, contentType)
}

/**
 * Media types by extension, for a file that reaches us untyped. Chrome takes
 * the type from the OS, and a Windows machine with nothing registered for
 * `.m4a` (or a drag from some apps) hands over `''`. `toCategory` reads media
 * from the type alone, so such a file was filed as unknown with no stored
 * type, and its metadata was never read.
 */
const MEDIA_TYPES: Record<string, string> = {
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  weba: 'audio/webm',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
}

/** The extension's media type when the browser gave none, else `undefined`. */
function untypedMediaType(file: File): string | undefined {
  if (file.type !== '' && file.type !== 'application/octet-stream') return
  const dot = file.name.lastIndexOf('.')
  if (dot === -1) return
  return MEDIA_TYPES[file.name.slice(dot + 1).toLowerCase()]
}

function retype(file: File, type: string): File {
  const normalized = new File([file], file.name, {
    type,
    lastModified: file.lastModified,
  })

  // `webkitRelativePath` carries the folder hierarchy for directory uploads,
  // but it's read-only and the `File` constructor has no way to set it — so a
  // reconstructed file comes back with it empty and uploads flat, losing its
  // parent folders. Reinstate it explicitly. (`.ts`/`.tsx` files hit this path
  // first, which is exactly why a source-tree upload flattened.)
  if (file.webkitRelativePath) {
    Object.defineProperty(normalized, 'webkitRelativePath', {
      value: file.webkitRelativePath,
      configurable: true,
    })
  }
  return normalized
}
