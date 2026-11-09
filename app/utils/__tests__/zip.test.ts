import { describe, it, expect } from 'vitest'
import { createZip, crc32, uniqueZipNames } from '../zip'

const enc = new TextEncoder()
const dec = new TextDecoder()

/** Reads a stored zip back through its central directory. */
function readZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const eocd = zip.length - 22
  expect(view.getUint32(eocd, true)).toBe(0x06054b50)
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const files: { name: string; data: Uint8Array; crc: number; flags: number }[] = []
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50)
    const crc = view.getUint32(p + 16, true)
    const size = view.getUint32(p + 24, true)
    const nameLen = view.getUint16(p + 28, true)
    const flags = view.getUint16(p + 8, true)
    const local = view.getUint32(p + 42, true)
    const name = dec.decode(zip.subarray(p + 46, p + 46 + nameLen))
    expect(view.getUint32(local, true)).toBe(0x04034b50)
    const localNameLen = view.getUint16(local + 26, true)
    const start = local + 30 + localNameLen
    files.push({ name, data: zip.subarray(start, start + size), crc, flags })
    p += 46 + nameLen
  }
  return files
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('uniqueZipNames', () => {
  it('suffixes duplicates before the extension, case-insensitively', () => {
    expect(uniqueZipNames(['a.png', 'A.png', 'a.png', 'b'])).toEqual([
      'a.png',
      'A (2).png',
      'a (3).png',
      'b',
    ])
  })

  it('strips path separators so nothing extracts outside the folder', () => {
    expect(uniqueZipNames(['../x/y.png'])).toEqual(['.._x_y.png'])
  })
})

describe('createZip', () => {
  it('round-trips names, bytes and checksums through the central directory', () => {
    const a = enc.encode('hello')
    const b = new Uint8Array([0, 1, 2, 255])
    const files = readZip(
      createZip([
        { name: 'hello.txt', data: a },
        { name: 'שלום.bin', data: b },
      ])
    )
    expect(files.map((f) => f.name)).toEqual(['hello.txt', 'שלום.bin'])
    expect(Array.from(files[0].data)).toEqual(Array.from(a))
    expect(Array.from(files[1].data)).toEqual(Array.from(b))
    expect(files[0].crc).toBe(crc32(a))
    // UTF-8 names are flagged so extractors decode them correctly.
    expect(files[1].flags & 0x0800).toBe(0x0800)
  })

  it('writes an empty but valid archive', () => {
    expect(readZip(createZip([]))).toEqual([])
  })

  it('renames duplicate entries instead of writing two with one name', () => {
    const names = readZip(
      createZip([
        { name: 'p.jpg', data: enc.encode('1') },
        { name: 'p.jpg', data: enc.encode('2') },
      ])
    ).map((f) => f.name)
    expect(names).toEqual(['p.jpg', 'p (2).jpg'])
  })
})
