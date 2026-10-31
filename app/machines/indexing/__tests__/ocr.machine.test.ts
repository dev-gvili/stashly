/**
 * OCR machine tests.
 *
 * The OCR actor is stubbed, so these check that each saved page's chunks are
 * handed out for embedding and which ending a failure lands in — not the OCR
 * model, rasterizing or the server, which have their own coverage.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createActor, fromPromise, toPromise } from 'xstate'
import { ocrMachine } from '../ocr.machine'
import type { SearchChunkDraft } from '../indexing.types'

afterEach(() => vi.restoreAllMocks())

const pdf = () => new File(['%PDF-'], 'scan.pdf', { type: 'application/pdf' })

type OcrInputStub = {
  itemId: string
  file: File
  onPageChunks: (chunks: SearchChunkDraft[]) => void
}

function start(transcribe: (input: OcrInputStub) => Promise<number>) {
  const pageChunks: SearchChunkDraft[][] = []
  const failures: string[] = []
  const actor = createActor(
    ocrMachine.provide({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actors: { transcribeScannedPdf: fromPromise(({ input }) => transcribe(input as OcrInputStub)) as any },
    }),
    { input: { itemId: 'p1', file: pdf() } }
  )
  actor.on('pageChunks', (e) => pageChunks.push(e.chunks))
  actor.on('failed', (e) => failures.push(e.reason))
  actor.start()
  return { actor, pageChunks, failures }
}

describe('ocrMachine', () => {
  it("hands out each saved page's chunks for embedding, then ends transcribed", async () => {
    const { actor, pageChunks } = start(async ({ onPageChunks }) => {
      onPageChunks([{ id: 'a', content: 'page one' }])
      onPageChunks([{ id: 'b', content: 'page two' }])
      return 16
    })
    const output = await toPromise(actor)

    expect(pageChunks).toEqual([
      [{ id: 'a', content: 'page one' }],
      [{ id: 'b', content: 'page two' }],
    ])
    expect(output).toEqual({ itemId: 'p1', outcome: 'transcribed' })
  })

  it('ends failed and announces it when OCR breaks', async () => {
    const { actor, failures } = start(async () => {
      throw new Error('model crashed')
    })
    const output = await toPromise(actor)

    expect(output.outcome).toBe('failed')
    expect(failures).toEqual(['model crashed'])
  })
})
