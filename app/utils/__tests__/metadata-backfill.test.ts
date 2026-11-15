import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { rangedSource } from '../metadata-backfill'
import { HEAD_BYTES, readVideoContainer } from '../video-container'

/**
 * `rangedSource` reads a stored object with HTTP `Range` requests. These run
 * against a real local HTTP server that answers ranges the way S3 does (206
 * with the slice), so what is asserted is what goes over the wire.
 */
const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)))

function boxHeader(type: string, payloadSize: number): Uint8Array {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setUint32(0, payloadSize + 8)
  out.set(
    [...type].map((c) => c.charCodeAt(0)),
    4
  )
  return out
}

// An MP4 with `moov` last, 5 MB of payload before it.
const ftyp = fixture('h264-aac.mp4.ftyp')
const moov = fixture('h264-aac.mp4.moov')
const payload = new Uint8Array(5_000_000)
const object = new Uint8Array([
  ...ftyp,
  ...boxHeader('mdat', payload.length),
  ...payload,
  ...moov,
])

let server: Server
let url: string
let ranges: string[] = []
let ignoreRange = false

beforeAll(async () => {
  server = createServer((req, res) => {
    const range = req.headers.range
    ranges.push(range ?? '(none)')
    if (!range || ignoreRange) {
      res.writeHead(200, { 'content-length': object.length })
      res.end(object)
      return
    }
    const [, from, to] = /bytes=(\d+)-(\d+)/.exec(range)!
    const slice = object.subarray(Number(from), Number(to) + 1)
    res.writeHead(206, {
      'content-length': slice.length,
      'content-range': `bytes ${from}-${to}/${object.length}`,
    })
    res.end(slice)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/video.mp4`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

describe('rangedSource', () => {
  it('reads one range per call', async () => {
    ranges = []
    ignoreRange = false
    const bytes = await rangedSource(url, object.length).read(10, 20)
    expect(Array.from(bytes)).toEqual(Array.from(object.subarray(10, 20)))
    expect(ranges).toEqual(['bytes=10-19'])
  })

  it('serves the head from memory and asks only for what lies beyond it', async () => {
    ranges = []
    const head = object.subarray(0, 100)
    const source = rangedSource(url, object.length, head)
    expect(Array.from(await source.read(0, 50))).toEqual(
      Array.from(head.subarray(0, 50))
    )
    expect(ranges).toEqual([])
    await source.read(100, 110)
    expect(ranges).toEqual(['bytes=100-109'])
  })

  it('copes with a server that ignores Range and sends the whole object', async () => {
    ignoreRange = true
    const bytes = await rangedSource(url, object.length).read(5, 15)
    ignoreRange = false
    expect(Array.from(bytes)).toEqual(Array.from(object.subarray(5, 15)))
  })

  it('finds the moov of a file larger than the head with one extra range', async () => {
    ranges = []
    const head = new Uint8Array(HEAD_BYTES)
    head.set(object.subarray(0, HEAD_BYTES))
    const info = await readVideoContainer(
      rangedSource(url, object.length, head)
    )
    expect(info).toMatchObject({ codec: 'h264', width: 576, height: 1024 })
    // Two 16-byte box headers' worth of probing is served by one tail read:
    // the moov range itself, never the 5 MB of payload.
    const moovStart = object.length - moov.length
    expect(ranges).toContain(`bytes=${moovStart}-${object.length - 1}`)
    expect(ranges.some((r) => r === 'bytes=0-4999999')).toBe(false)
  })
})
