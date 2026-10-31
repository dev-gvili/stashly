/**
 * Transcribes one scanned PDF (a PDF with no text layer) with the OCR model.
 *
 * ```
 * transcribing ──→ transcribed
 *      │  └─ each page saved → emits pageChunks (the queue embeds them)
 *      └──────────→ failed
 * ```
 *
 * OCR only. Each page's text is saved as soon as it is read (`save_ocr_page`),
 * and its chunks are handed out through `pageChunks` for `embed.machine`, so
 * this machine makes no vectors of its own. It runs in the indexing queue's
 * deferred lane, once uploads are idle (tech-debt item 53).
 *
 * No retry: a model or a page that fails once won't on a second try. The pages
 * already saved stay saved.
 */
import { setup, assign, emit } from 'xstate'
import { transcribeScannedPdf } from './indexing.actors'
import { errorOf } from './indexing-item.machine'
import type {
  OcrContext,
  OcrEmitted,
  OcrEvent,
  OcrInput,
  OcrOutcome,
  OcrOutput,
} from './indexing.types'

export const ocrMachine = setup({
  types: {
    context: {} as OcrContext,
    input: {} as OcrInput,
    output: {} as OcrOutput,
    events: {} as OcrEvent,
    emitted: {} as OcrEmitted,
  },

  actors: {
    transcribeScannedPdf,
  },

  actions: {
    /** Hands a saved page's chunks to the queue, which embeds them. */
    announcePageChunks: emit(({ context, event }) => ({
      type: 'pageChunks' as const,
      itemId: context.itemId,
      chunks: (event as OcrEvent).chunks,
    })),
    storeFailureReason: assign({
      failureReason: ({ event }) => errorOf(event),
    }),
    announceFailure: emit(({ context }) => ({
      type: 'failed' as const,
      itemId: context.itemId,
      reason: context.failureReason ?? 'unknown',
    })),
    recordOutcome: assign((_, params: { outcome: OcrOutcome }) => ({
      outcome: params.outcome,
    })),
  },
}).createMachine({
  id: 'ocr',
  description:
    'Reads a scanned PDF page by page with the OCR model, saving each page and handing its chunks out to be embedded.',
  context: ({ input }) => ({
    itemId: input.itemId,
    file: input.file,
    failureReason: null,
    outcome: null,
  }),
  output: ({ context }) => ({
    itemId: context.itemId,
    outcome: context.outcome ?? 'failed',
  }),
  initial: 'transcribing',

  states: {
    transcribing: {
      description:
        'Renders, transcribes and saves the PDF one page at a time (save_ocr_page), up to OCR_MAX_PAGES. Can take minutes.',
      invoke: {
        src: 'transcribeScannedPdf',
        input: ({ context, self }) => ({
          itemId: context.itemId,
          file: context.file,
          onPageChunks: (chunks) => self.send({ type: 'pageSaved', chunks }),
        }),
        onDone: 'transcribed',
        onError: { target: 'failed', actions: 'storeFailureReason' },
      },
      on: {
        pageSaved: { actions: 'announcePageChunks' },
      },
    },

    transcribed: {
      description: 'Every page OCR could read is saved.',
      type: 'final',
      entry: { type: 'recordOutcome', params: { outcome: 'transcribed' } },
    },

    failed: {
      description:
        'OCR broke: no WebGPU, a model that would not load, or a page that would not render. Pages saved before stay saved. Logged by the queue.',
      type: 'final',
      entry: [
        { type: 'recordOutcome', params: { outcome: 'failed' } },
        'announceFailure',
      ],
    },
  },
})
