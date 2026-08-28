/// <reference lib="webworker" />

/**
 * Content-hash worker.
 *
 * Hashing a file means reading every one of its bytes, so it belongs off the
 * main thread: on a 100-file batch the `ArrayBuffer` churn alone is enough to
 * stall the UI and the upload machines' transitions. The main thread only ever
 * posts a `File` handle across (structured clone of a `File` is a reference to
 * the same blob data, not a copy) and gets a short string back.
 *
 * Requests are handled one at a time, in arrival order. There is nothing to
 * gain from parallelism here — the work is bound by disk reads and a single
 * SHA-256 stream — and a queue keeps peak memory at one chunk.
 */

export type HashRequest = { id: number; file: File }
export type HashResponse = { id: number; hash: string | null }

/**
 * Chunk size for the large-file scheme. 8 MiB keeps a multi-gigabyte file to a
 * handful of digests without ever holding the whole thing on the heap —
 * `file.arrayBuffer()` on a 2 GB video would blow the worker up.
 *
 * Changing this number changes every `sha256-8m:` hash it produces, which would
 * silently split existing duplicate groups. Don't tune it casually.
 */
const CHUNK_BYTES = 8 * 1024 * 1024

/** Byte → 2-char hex, built once. Beats `toString(16).padStart(2,'0')` per byte. */
const HEX = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, '0')
)

function toHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += HEX[bytes[i]]
  return out
}

/**
 * Content hash for a file.
 *
 * Stored on `File.hash` and read back by the duplicate-resolution screen, which
 * only promotes a group to `risk: 'exact'` when every copy carries the same
 * non-null hash — this is what turns "same name, same size" from a guess into
 * proof.
 *
 * Two schemes, picked by size and named in the prefix so the value is
 * self-describing:
 *
 * - `sha256:<hex>` — files up to 8 MiB, byte-for-byte what `sha256sum` prints.
 * - `sha256-8m:<hex>` — larger files: SHA-256 over the concatenated SHA-256 of
 *   each 8 MiB chunk. WebCrypto has no incremental digest, and this streams in
 *   constant memory. It is NOT the file's plain SHA-256 — never compare it to
 *   one.
 *
 * The scheme depends only on `file.size`, and duplicate groups are already
 * keyed by size, so two copies in the same group always used the same scheme.
 *
 * Returns `null` rather than throwing when WebCrypto is missing or a read
 * fails: a missing hash costs a group its `exact` verdict, but must never cost
 * the user their upload.
 */
async function hashFile(file: File): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  try {
    if (file.size <= CHUNK_BYTES) {
      return `sha256:${toHex(await subtle.digest('SHA-256', await file.arrayBuffer()))}`
    }

    const chunkCount = Math.ceil(file.size / CHUNK_BYTES)
    const digests = new Uint8Array(chunkCount * 32)
    for (let index = 0; index < chunkCount; index++) {
      const start = index * CHUNK_BYTES
      const chunk = file.slice(start, start + CHUNK_BYTES)
      const digest = await subtle.digest('SHA-256', await chunk.arrayBuffer())
      digests.set(new Uint8Array(digest), index * 32)
    }
    return `sha256-8m:${toHex(await subtle.digest('SHA-256', digests))}`
  } catch {
    return null
  }
}

// ── Serial queue ──────────────────────────────────────────────────────────
// A promise chain rather than a worker pool: concurrent digests would multiply
// peak memory by the pool size for no throughput gain.

let chain: Promise<unknown> = Promise.resolve()

self.onmessage = (event: MessageEvent<HashRequest>) => {
  const { id, file } = event.data
  chain = chain
    .then(() => hashFile(file))
    .then((hash) => {
      ;(self as unknown as Worker).postMessage({ id, hash } as HashResponse)
    })
    .catch(() => {
      ;(self as unknown as Worker).postMessage({
        id,
        hash: null,
      } as HashResponse)
    })
}
