# Search indexing

Indexes every uploaded file for search: its metadata facets, its text cut into
`SearchChunk` rows, a vector per chunk, and OCR text for scanned PDFs.

## Why it is its own machine

It used to be a parallel `indexing` region inside the thumbnail item machine.
That coupled two jobs that have nothing to do with each other:

- A slow embedding (hundreds of chunks for a large source file) held a
  thumbnail slot until it finished, although the thumbnail was long done.
- When a backfill job was already running for an item, the thumbnail manager
  ignored the upload job for it, and with it the only indexing that item would
  ever get. The file was never searchable.

Now the upload runner queues indexing for every upload as soon as its `Item`
row exists, before and independently of the thumbnail.

## Layout

| File | Role |
|---|---|
| `indexing.types.ts` | Job, context, events, emitted events, outcomes |
| `indexing.actors.ts` | One `fromPromise` actor per step: read metadata, save metadata, embed, save vectors, OCR |
| `indexing-item.machine.ts` | One file's indexing, step by step |
| `indexing-queue.machine.ts` | FIFO, 2 at a time; collects metadata saves for the page reload |
| `client.ts` | The tab's queue instance, `enqueueIndexing`, `markIndexingRevalidated` |
| `hooks.ts` | `useIndexingRevalidation`: one page reload per batch |
| `index.ts` | Public exports |

```
indexingQueue (module scope, FIFO, 2 at a time)
└── spawn(indexingItemMachine, { itemId, file })
     readingMetadata → savingMetadata ─┬─ chunks ─→ embeddingChunks → savingVectors ─┐
                                       ├─ scanned PDF ─────────────────────────────┐ │
                                       └─ neither → indexed                       │ │
                                                        choosingNextStep ←─────────┼─┘
                                                          ├─ scanned PDF → transcribingScannedPdf
                                                          └─ indexed | indexedWithoutVectors
```

## Decisions worth knowing before editing

- **Only server writes retry** (twice, 800 ms apart). Reading the file and
  running a model don't: a file that can't be read or embedded once won't be on
  a second try.
- **Missing vectors don't fail the file.** Its chunks are already saved and
  keyword-searchable, and `useEmbeddingBackfill` adds vectors to chunks that
  have none. That ending is `indexedWithoutVectors`.
- **One page reload per batch.** `save_media_metadata` writes facets the page
  shows, and the actors use plain `fetch`, which reloads nothing. The queue
  collects the saves and `useIndexingRevalidation` calls `revalidate()` once
  the queue is empty. Never `navigate(<current URL>)`: while you are navigating
  it cancels your navigation (React Router's `startNavigation` aborts the
  pending one) and keeps you on the page you were leaving.
- **Every state has a `description`**, which is what the Stately editor shows.
  `__tests__/state-descriptions.test.ts` fails the build if one is missing.

## Embedding is batched

`embedTexts` sends at most `EMBED_BATCH_SIZE` (16) chunks per GPU call, each
call its own AI-queue job. It used to send a whole file at once. Measured on
2 Oct 2026 with the 64-file Prisma client folder: a 338-chunk file asked WebGPU
for one 4,253,024,256-byte buffer (338 × 12 heads × 512² × 4 bytes) and was
refused, after which every later embedding in the tab failed the same way, and
a 170-chunk file took the GPU process from about 5 GB to 10.9 GB. The raw
numbers are in `.claude/evidence/phase2-before.json` and
`phase2-gpu-memory.csv`.
