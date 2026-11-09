/**
 * A minimal ZIP writer for the selection toolbar's multi-file Download.
 *
 * Files are **stored**, not deflated: the gallery's files are JPEG/PNG/WebP,
 * already compressed, so deflate would cost CPU for almost no saving. Plain
 * ZIP (no ZIP64) caps an archive at 65,535 entries and 4 GiB, which
 * `createZip` checks rather than writing a corrupt file.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/**
 * CRC-32 (IEEE 802.3), as ZIP headers require.
 *
 * @example
 * crc32(new TextEncoder().encode('123456789')) // → 0xcbf43926
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Makes names unique inside one archive: a second `a.png` becomes
 * `a (2).png`, so no entry overwrites another when it is extracted.
 *
 * @example
 * uniqueZipNames(['a.png', 'a.png', 'b']) // → ['a.png', 'a (2).png', 'b']
 */
export function uniqueZipNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((raw) => {
    // No folders or absolute paths inside the archive.
    const name = raw.replace(/[\\/]/g, '_') || 'file'
    if (!used.has(name.toLowerCase())) {
      used.add(name.toLowerCase())
      return name
    }
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot) : ''
    let n = 2
    while (used.has(`${stem} (${n})${ext}`.toLowerCase())) n++
    const next = `${stem} (${n})${ext}`
    used.add(next.toLowerCase())
    return next
  })
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

export type ZipEntry = { name: string; data: Uint8Array; date?: Date }

const UTF8_FLAG = 0x0800
const MAX_ENTRIES = 0xffff
const MAX_BYTES = 0xffffffff

/**
 * Builds a stored (uncompressed) ZIP archive. Names are written as UTF-8 and
 * made unique with `uniqueZipNames`.
 *
 * @throws {RangeError} Past 65,535 entries or 4 GiB (no ZIP64).
 *
 * @example
 * const zip = createZip([{ name: 'a.txt', data: new TextEncoder().encode('hi') }])
 * new Blob([zip], { type: 'application/zip' })
 */
export function createZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  if (entries.length > MAX_ENTRIES) throw new RangeError('Too many files for one zip')
  const encoder = new TextEncoder()
  const names = uniqueZipNames(entries.map((e) => e.name)).map((n) => encoder.encode(n))

  let localSize = 0
  let centralSize = 0
  for (let i = 0; i < entries.length; i++) {
    localSize += 30 + names[i].length + entries[i].data.length
    centralSize += 46 + names[i].length
  }
  const total = localSize + centralSize + 22
  if (localSize > MAX_BYTES || total > MAX_BYTES) throw new RangeError('Zip larger than 4 GiB')

  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  const offsets: number[] = []
  const crcs: number[] = []
  let p = 0

  entries.forEach((entry, i) => {
    const { time, date } = dosDateTime(entry.date ?? now)
    const crc = crc32(entry.data)
    offsets.push(p)
    crcs.push(crc)
    view.setUint32(p, 0x04034b50, true)
    view.setUint16(p + 4, 20, true) // version needed
    view.setUint16(p + 6, UTF8_FLAG, true)
    view.setUint16(p + 8, 0, true) // method: stored
    view.setUint16(p + 10, time, true)
    view.setUint16(p + 12, date, true)
    view.setUint32(p + 14, crc, true)
    view.setUint32(p + 18, entry.data.length, true)
    view.setUint32(p + 22, entry.data.length, true)
    view.setUint16(p + 26, names[i].length, true)
    view.setUint16(p + 28, 0, true) // extra length
    out.set(names[i], p + 30)
    out.set(entry.data, p + 30 + names[i].length)
    p += 30 + names[i].length + entry.data.length
  })

  const centralStart = p
  entries.forEach((entry, i) => {
    const { time, date } = dosDateTime(entry.date ?? now)
    view.setUint32(p, 0x02014b50, true)
    view.setUint16(p + 4, 20, true) // version made by
    view.setUint16(p + 6, 20, true) // version needed
    view.setUint16(p + 8, UTF8_FLAG, true)
    view.setUint16(p + 10, 0, true)
    view.setUint16(p + 12, time, true)
    view.setUint16(p + 14, date, true)
    view.setUint32(p + 16, crcs[i], true)
    view.setUint32(p + 20, entry.data.length, true)
    view.setUint32(p + 24, entry.data.length, true)
    view.setUint16(p + 28, names[i].length, true)
    // extra, comment, disk, internal attrs: 0; external attrs: 0
    view.setUint32(p + 42, offsets[i], true)
    out.set(names[i], p + 46)
    p += 46 + names[i].length
  })

  view.setUint32(p, 0x06054b50, true)
  view.setUint16(p + 8, entries.length, true)
  view.setUint16(p + 10, entries.length, true)
  view.setUint32(p + 12, p - centralStart, true)
  view.setUint32(p + 16, centralStart, true)
  return out
}
