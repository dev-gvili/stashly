/**
 * Item-machine tests.
 *
 * Every actor is stubbed, so these assert *orchestration* only: which stages
 * run for which file type, what a retry does, and which terminal state a
 * failure lands in. The compute those actors wrap is already covered by
 * `app/utils/__tests__/thumbnail.test.ts` and `text-thumbnail.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createActor, fromPromise, toPromise } from 'xstate'
import { thumbnailItemMachine } from '../thumbnail-item.machine'
import type { ThumbProgress } from '../thumbnail.types'

// jsdom is not in play here (vitest runs `environment: 'node'`), and the
// machine creates an object URL for the stage-1 blur.
beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:stage1')
  globalThis.URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
})

const imageFile = () =>
  new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
const pdfFile = () =>
  new File([new Uint8Array([1])], 'a.pdf', { type: 'application/pdf' })
const zipFile = () =>
  new File([new Uint8Array([1])], 'a.zip', { type: 'application/zip' })

const tinyBlob = new Blob([new Uint8Array([1])], { type: 'image/webp' })
const resized = { blob: tinyBlob, width: 512, height: 384 }

/** Actor stubs that all succeed; individual tests override what they care about. */
function happyActors(over: Record<string, unknown> = {}) {
  return {
    acquireSource: fromPromise(async () => ({
      kind: 'file' as const,
      file: imageFile(),
    })),
    stage1: fromPromise(async () => tinyBlob),
    stage2: fromPromise(async () => resized),
    stage3: fromPromise(async () => tinyBlob),
    presign: fromPromise(async () => ({
      uploadUrl: 'https://s3.test/put',
      viewUrls: {
        2: 'https://s3.test/thumbnails/i.webp?sig=s2',
        3: 'https://s3.test/thumbnails/i.webp?sig=s3',
      },
    })),
    putStage: fromPromise(async () => undefined),
    patchThumbnail: fromPromise(async () => undefined),
    ...over,
    // eslint-disable-next-line no-restricted-syntax -- test stub standing in for a child machine or actor, only the events this test sends exist
  } as any
}

/** Starts a machine, collecting everything it emits, and resolves with its output. */
async function run(
  input: { itemId: string; mode: 'fromMemory' | 'fromDownload'; file: File | null },
  actors: Record<string, unknown> = {}
) {
  const progress: ThumbProgress[] = []
  const emitted: string[] = []
  const actor = createActor(
    thumbnailItemMachine.provide({ actors: happyActors(actors) }),
    { input }
  )
  actor.on('progress', (e) => progress.push(e.progress))
  actor.on('failed', () => emitted.push('failed'))
  actor.start()
  const output = await toPromise(actor)
  return { output, progress, emitted, stages: progress.map((p) => p.stage) }
}

describe('thumbnailItemMachine — from memory', () => {
  it('runs all three stages for an image and reports a thumbnail', async () => {
    const { output, stages } = await run({
      itemId: 'i1',
      mode: 'fromMemory',
      file: imageFile(),
    })

    expect(stages).toEqual([1, 2, 3])
    expect(output).toEqual({ itemId: 'i1', thumbnailed: true })
  })

  it('stops after stage 2 for a PDF — stage 3 is images only', async () => {
    const { output, stages } = await run({
      itemId: 'i2',
      mode: 'fromMemory',
      file: pdfFile(),
    })

    expect(stages).toEqual([1, 2])
    expect(output.thumbnailed).toBe(true)
  })

  it('cache-busts the stage URLs so an overwritten S3 key still repaints', async () => {
    const { progress } = await run({
      itemId: 'i3',
      mode: 'fromMemory',
      file: imageFile(),
    })

    expect(progress[1].src).toBe('https://s3.test/thumbnails/i.webp?sig=s2')
    expect(progress[2].src).toBe('https://s3.test/thumbnails/i.webp?sig=s3')
  })

  it('reports no thumbnail when the type has no stage-2 producer', async () => {
    const { output, stages } = await run(
      { itemId: 'i4', mode: 'fromMemory', file: zipFile() },
      {
        stage1: fromPromise(async () => null),
        stage2: fromPromise(async () => null),
      }
    )

    expect(stages).toEqual([])
    expect(output.thumbnailed).toBe(false)
  })

  it('a failed stage 1 costs only the blur, not the pipeline', async () => {
    const { output, stages } = await run(
      { itemId: 'i6', mode: 'fromMemory', file: imageFile() },
      {
        stage1: fromPromise(async () => {
          throw new Error('compute timeout')
        }),
      }
    )

    expect(stages).toEqual([2, 3])
    expect(output.thumbnailed).toBe(true)
  })

  it('keeps stage 3 even when the stage-2 PATCH fails — the bytes are already live', async () => {
    const { output, stages } = await run(
      { itemId: 'i7', mode: 'fromMemory', file: imageFile() },
      {
        patchThumbnail: fromPromise(async () => {
          throw new Error('500')
        }),
      }
    )

    expect(stages).toEqual([1, 2, 3])
    expect(output.thumbnailed).toBe(true)
  })
})

describe('thumbnailItemMachine — retries', () => {
  it('retries a failing stage 2 and succeeds on the third attempt', async () => {
    vi.useFakeTimers()
    let calls = 0
    const progress: ThumbProgress[] = []
    const actor = createActor(
      thumbnailItemMachine.provide({
        actors: happyActors({
          stage2: fromPromise(async () => {
            calls++
            if (calls < 3) throw new Error('transient')
            return resized
          }),
        }),
      }),
      { input: { itemId: 'r1', mode: 'fromMemory', file: imageFile() } }
    )
    actor.on('progress', (e) => progress.push(e.progress))
    actor.start()

    // Two retries at 800 ms each, plus the microtask turns between them.
    await vi.advanceTimersByTimeAsync(3_000)

    expect(calls).toBe(3)
    expect(progress.map((p) => p.stage)).toEqual([1, 2, 3])
  })

  it('gives up after the retry budget and reports no thumbnail', async () => {
    vi.useFakeTimers()
    let calls = 0
    const actor = createActor(
      thumbnailItemMachine.provide({
        actors: happyActors({
          stage2: fromPromise(async () => {
            calls++
            throw new Error('permanent')
          }),
        }),
      }),
      { input: { itemId: 'r2', mode: 'fromMemory', file: imageFile() } }
    )
    actor.start()
    await vi.advanceTimersByTimeAsync(5_000)

    // Initial attempt + MAX_ATTEMPTS retries.
    expect(calls).toBe(3)
    expect(actor.getSnapshot().output).toEqual({
      itemId: 'r2',
      thumbnailed: false,
    })
  })
})

describe('thumbnailItemMachine — from download', () => {
  it('downloads the original and stops after stage 2', async () => {
    const stage3 = vi.fn(async () => tinyBlob)
    const { output, stages } = await run(
      { itemId: 'b1', mode: 'fromDownload', file: null },
      { stage3: fromPromise(stage3) }
    )

    expect(stages).toEqual([1, 2])
    expect(stage3).not.toHaveBeenCalled()
    expect(output.thumbnailed).toBe(true)
  })

  it('paints what another client already produced instead of doing the work', async () => {
    const stage2 = vi.fn(async () => resized)
    const { output, progress } = await run(
      { itemId: 'b2', mode: 'fromDownload', file: null },
      {
        acquireSource: fromPromise(async () => ({
          kind: 'existing' as const,
          url: 'https://s3.test/thumbnails/b2.webp?sig=s2',
          stage: 2 as const,
        })),
        stage2: fromPromise(stage2),
      }
    )

    expect(stage2).not.toHaveBeenCalled()
    expect(progress).toEqual([
      { stage: 2, src: 'https://s3.test/thumbnails/b2.webp?sig=s2' },
    ])
    expect(output.thumbnailed).toBe(true)
  })

  it("reports the stage the other client actually reached, not an assumed 2", async () => {
    const { progress } = await run(
      { itemId: 'b4', mode: 'fromDownload', file: null },
      {
        acquireSource: fromPromise(async () => ({
          kind: 'existing' as const,
          url: 'https://s3.test/thumbnails/b4.webp?sig=s3',
          stage: 3 as const,
        })),
      }
    )

    // Stages 2 and 3 share one S3 key, and a signed URL carries no cache
    // buster — the server reports the stage as its own field.
    expect(progress).toEqual([
      { stage: 3, src: 'https://s3.test/thumbnails/b4.webp?sig=s3' },
    ])
  })

  it('never retries a source the server declined', async () => {
    vi.useFakeTimers()
    const acquire = vi.fn(async () => ({ kind: 'unavailable' as const }))
    const actor = createActor(
      thumbnailItemMachine.provide({
        actors: happyActors({ acquireSource: fromPromise(acquire) }),
      }),
      { input: { itemId: 'b3', mode: 'fromDownload', file: null } }
    )
    actor.start()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(acquire).toHaveBeenCalledTimes(1)
    expect(actor.getSnapshot().output).toEqual({
      itemId: 'b3',
      thumbnailed: false,
    })
  })
})
