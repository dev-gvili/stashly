import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  blobSource,
  isMatroska,
  parseMatroska,
  readVideoContainer,
} from '../video-container'

// Fixtures are real header bytes cut from files in the owner's stash: the
// Matroska ones end where the first Cluster starts, the MP4 ones are the real
// `ftyp` and `moov` boxes with the media payload left out.
const fixture = (name: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))

/** An MP4 box header for a payload of `payloadSize` bytes. */
function boxHeader(type: string, payloadSize: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setUint32(0, payloadSize + 8)
  out.set(
    [...type].map((c) => c.charCodeAt(0)),
    4
  )
  return out
}

describe('parseMatroska', () => {
  // Expected durations and sizes are what Chrome reported for the same files.
  it('reads an AV1 + Opus file', () => {
    const info = parseMatroska(fixture('av1-opus.mkv.head'))
    expect(info).toMatchObject({
      container: 'matroska',
      width: 1280,
      height: 720,
      codec: 'av1',
      audioFormat: 'opus',
      audioChannels: 2,
      audioSamplesPerSecond: 48000,
    })
    expect(info?.duration).toBeCloseTo(214.161, 3)
    expect(info?.frameRate).toBeCloseTo(23.976, 2)
  })

  it('reads an H.264 + AAC file', () => {
    const info = parseMatroska(fixture('h264-aac.mkv.head'))
    expect(info).toMatchObject({
      width: 654,
      height: 480,
      codec: 'h264',
      audioFormat: 'aac',
      audioSamplesPerSecond: 44100,
    })
    expect(info?.duration).toBeCloseTo(256.186, 3)
    expect(info?.frameRate).toBeCloseTo(29.97, 2)
  })

  it('reads past subtitle tracks', () => {
    const info = parseMatroska(fixture('av1-aac-subs.mkv.head'))
    expect(info).toMatchObject({ width: 1280, height: 720, codec: 'av1' })
    expect(info?.duration).toBeCloseTo(235.264, 3)
    expect(info?.frameRate).toBe(25)
  })

  it('leaves out the sample size of lossy audio', () => {
    // The header says 32 for Opus and AAC; that is not the stored audio.
    const info = parseMatroska(fixture('av1-opus.mkv.head'))
    expect(info).not.toHaveProperty('audioBitsPerSample')
  })

  it('answers null for bytes that are not Matroska', () => {
    expect(
      isMatroska(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]))
    ).toBe(false)
    expect(parseMatroska(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull()
  })

  it('does not throw on a header cut in the middle', () => {
    const head = fixture('av1-opus.mkv.head')
    for (const cut of [4, 20, 100, 400, head.length - 1]) {
      expect(() => parseMatroska(head.subarray(0, cut))).not.toThrow()
    }
  })
})

describe('readVideoContainer (MP4)', () => {
  const ftyp = fixture('h264-aac.mp4.ftyp')
  const moov = fixture('h264-aac.mp4.moov')
  const expected = {
    container: 'mp4',
    codec: 'h264',
    fourCC: 'avc1',
    width: 576,
    height: 1024,
    frameRate: 30,
    audioFormat: 'aac',
    audioChannels: 2,
    audioSamplesPerSecond: 44100,
  }

  it('reads a file with moov first (faststart)', async () => {
    const mdat = new Uint8Array(200_000)
    const file = new Blob([ftyp, moov, boxHeader('mdat', mdat.length), mdat])
    const info = await readVideoContainer(blobSource(file))
    expect(info).toMatchObject(expected)
    expect(info?.duration).toBeCloseTo(234.404, 3)
  })

  it('finds moov at the end of a file larger than the head', async () => {
    // 5 MB of payload pushes moov past the 3 MB head.
    const mdat = new Uint8Array(5_000_000)
    const file = new Blob([ftyp, boxHeader('mdat', mdat.length), mdat, moov])
    const reads: Array<[number, number]> = []
    const source = blobSource(file)
    const info = await readVideoContainer({
      size: source.size,
      read: (start, end) => {
        reads.push([start, end])
        return source.read(start, end)
      },
    })
    expect(info).toMatchObject(expected)
    // It read the head, then a 16-byte header for mdat's neighbour and moov.
    expect(reads.some(([s, e]) => e - s === moov.length)).toBe(true)
    expect(Math.max(...reads.map(([s, e]) => e - s))).toBeLessThanOrEqual(
      3 * 1024 * 1024
    )
  })

  it('answers null for a file with no moov', async () => {
    const mdat = new Uint8Array(1000)
    const file = new Blob([ftyp, boxHeader('mdat', mdat.length), mdat])
    expect(await readVideoContainer(blobSource(file))).toBeNull()
  })

  it('answers null for something that is not a video container', async () => {
    const text = new Blob(['just some text, nothing like a box'])
    expect(await readVideoContainer(blobSource(text))).toBeNull()
  })
})

describe('readVideoContainer (Matroska)', () => {
  it('reads the header of a file through a byte source', async () => {
    const head = fixture('h264-aac.mkv.head')
    const info = await readVideoContainer(
      blobSource(new Blob([head, new Uint8Array(1_000_000)]))
    )
    expect(info).toMatchObject({ codec: 'h264', width: 654 })
  })
})
