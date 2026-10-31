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

## Why metadata, vectors and OCR are three machines

Until tech-debt item 53 one machine per file did everything in one of the
queue's two slots: read and save the metadata, embed the chunks on the GPU,
save the vectors, OCR a scanned PDF. A file's facets therefore waited behind
every earlier file's GPU work, and nothing in the queue survives a reload, so
a tab reloaded mid-batch left the rest with no facets at all (measured: 0 of 30
camera JPEGs in one batch, 15 of 16 after a reload in another). Facets have no
backfill, and downloading originals from S3 to make one was rejected (bandwidth,
S3 calls, client work the user can't see a reason for).

Now metadata runs right after each row exists, and the GPU work waits in a
deferred lane until uploads are idle. Measured on the 655-file `app/` upload:
every metadata save landed 107 s after the last row instead of still running
at 399 s, and the markdown and image files all have their facets.

## Layout

| File | Role |
|---|---|
| `indexing.types.ts` | Jobs, contexts, events, emitted events, outcomes for all four machines |
| `indexing.actors.ts` | One `fromPromise` actor per step: read metadata, save metadata, embed, save vectors, OCR |
| `indexing-item.machine.ts` | One file's metadata: read, save, retry |
| `embed.machine.ts` | One set of chunks' vectors: embed, save, retry |
| `ocr.machine.ts` | One scanned PDF, page by page; hands each page's chunks out |
| `indexing-queue.machine.ts` | Two lanes, 2 at a time each; collects metadata saves for the page reload |
| `client.ts` | The tab's queue instance, `enqueueIndexing`, `pauseDeferredIndexing`, `resumeDeferredIndexing`, `markIndexingRevalidated` |
| `hooks.ts` | `useIndexingRevalidation`: one page reload per batch |
| `index.ts` | Public exports |

```
indexingQueue (module scope, parallel)
├── metadata lane (always open, FIFO, 2 at a time)
│    └── spawn(indexingItemMachine, { itemId, file })
│         readingMetadata ── nothing to save (a zip) ──→ indexed
│         readingMetadata → savingMetadata ⇄ retry ──→ indexed | failed
│         output: chunks, needsOcr ─┐
├── deferred lane (running | paused, FIFO, 2 at a time)  ◄─┘
│    ├── spawn(embedMachine, { itemId, chunks })
│    │     embeddingChunks → savingVectors ⇄ retry ──→ embedded | withoutVectors
│    └── spawn(ocrMachine, { itemId, file })
│          transcribing ──→ transcribed | failed
│            └─ each saved page: pageChunks ──→ a new embed job
```

The upload runner pauses the deferred lane while any file is in flight and
resumes it after 2 s with none (`DEFERRED_RESUME_DELAY_MS`), the same way it
pauses thumbnail downloads. A pause starts nothing new; a running job finishes.

## Decisions worth knowing before editing

- **Only server writes retry** (twice, 800 ms apart). Reading the file and
  running a model don't: a file that can't be read or embedded once won't be on
  a second try.
- **Missing vectors don't fail the file.** Its chunks are already saved and
  keyword-searchable, and `useEmbeddingBackfill` adds vectors to chunks that
  have none. That ending is `withoutVectors`, in `embed.machine`.
- **OCR makes no vectors.** `ocr.machine` saves each page (`save_ocr_page`) and
  emits its chunks; the queue turns each page into an `embed.machine` job. A
  scanned PDF still waiting for OCR when the tab reloads gets no OCR text: OCR
  has no backfill.
- **Metadata keeps pace with the upload because the upload's calls go at low
  priority.** Over HTTP/1.1 (dev) Chrome sends six requests at a time per
  origin. The upload's own calls (`/api/s3/upload`, `create_upload_item`) kept
  the metadata saves queued for seconds, though the server answers in ~15 ms.
  They now send `priority: 'low'`, so `save_media_metadata` (default `high`)
  goes first. Measured on a 660-file upload (tech-debt item 53): saves landed
  by the last row went from 49 to 630, and the last one landed 0.3 s after it
  instead of 6.9 s. Don't send a new upload-time call at default priority.
- **No request when there is nothing to save.** A zip or an unknown binary
  reads as `{}`. `hasMetadataToSave` (`utils/media-metadata.ts`) applies the
  form builder's own rule, so the machine goes straight to `indexed`: no POST,
  and no `metadataSaved`, so a batch of such files reloads nothing either.
- **One page reload per batch.** `save_media_metadata` writes facets the page
  shows, and the actors use plain `fetch`, which reloads nothing. The queue
  collects the saves and `useIndexingRevalidation` calls `revalidate()` once
  the metadata lane is empty (vectors and OCR change nothing the page shows). Never `navigate(<current URL>)`: while you are navigating
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
