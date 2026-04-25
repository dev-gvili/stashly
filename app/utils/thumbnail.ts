/** Deterministic hex color from filename + mime type */
export function hashToColor(name: string, type: string): string {
  const str = name + type
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const h = Math.abs(hash) % 360
  const s = 55 + (Math.abs(hash >> 8) % 25)
  const l = 40 + (Math.abs(hash >> 16) % 20)
  return hslToHex(h, s, l)
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100
  const ln = l / 100
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.min(1, Math.max(0, color))).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Extract an 8×8 JPEG data-URL from an image File.
 * Returns null if the browser can't decode the image.
 */
export async function extractTinyThumbnail(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: 8,
      resizeHeight: 8,
      resizeQuality: 'pixelated',
    })
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()
    return canvas.toDataURL('image/webp', 0.5)
  } catch {
    return null
  }
}

/**
 * Resize an image File to at most maxSize×maxSize, returning a Blob.
 * Preserves aspect ratio. Returns null on failure.
 */
export async function canvasResize(
  file: File,
  maxSize = 512,
): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const ratio = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1)
    const w = Math.round(bitmap.width * ratio)
    const h = Math.round(bitmap.height * ratio)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.82),
    )
  } catch {
    return null
  }
}

/** Convert a data-URL to a Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1) return new Blob([], { type: 'image/webp' })
  const header = dataUrl.slice(0, commaIdx)
  const base64 = dataUrl.slice(commaIdx + 1)
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/webp'
  const bytes = atob(base64)
  const buf = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
  return new Blob([buf], { type: mime })
}
