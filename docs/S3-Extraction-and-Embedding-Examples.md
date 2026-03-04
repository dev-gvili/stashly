# S3 Extraction & Embedding — Examples and Best Practices

This file documents how to use the repository's streaming S3 extractors and embedding helpers (local, open‑source models only). It complements `docs/Sementic Search.md` and shows concrete, runnable examples.

## Prerequisites
- Node 18+
- Install runtime deps:

```bash
pnpm add @aws-sdk/client-s3 pdfjs-dist unzipper sax exceljs @xenova/transformers
# Optional (OCR fallback and performance tools):
pnpm add tesseract.js ffmpeg-static
```

Make sure `ffmpeg` is available on PATH (or use `ffmpeg-static`) if you need to pre-convert video to an audio codec supported by the local ASR model.

## Key files
- `app/.server/s3-extractors.ts` — streaming extractors and local-model transcribe/caption wrappers
- `app/.server/search/embeddings.ts` — embed helpers: `buildSearchTextFromItem`, `embedItemForSearch`, `embedItemForSearchString`
- `app/.server/search/search.repository.ts` — `upsertSearchEmbedding(...)` raw-SQL helper for the `Search.vector` pgvector column

## Typical flow (extract → embed → upsert)

1. Extract textual content from an S3 object using the dispatcher:

```ts
import s3Extractors from 'app/.server/s3-extractors'
import { embedItemForSearch, buildSearchTextFromItem } from 'app/.server/search/embeddings'
import { searchRepository } from 'app/.server/search/search.repository'

const bucket = 'my-bucket'
const key = 'uploads/report.pdf'

// 1) extract text (streamed; low memory)
const content = await s3Extractors.extractTextFromS3Auto({ bucket, key, options: { maxPages: 10 } })

// 2) build the metadata object used by the embedder
const forSearch = {
  name: 'report.pdf',
  description: 'Quarterly report',
  tags: ['finance'],
  category: 'documents',
  type: 'file',
  file: { extension: '.pdf', mimeType: 'application/pdf' },
  extraText: content,
}

// 3) embed (local model)
const vector = await embedItemForSearch(forSearch)

// 4) upsert into Search table
await searchRepository.upsertSearchEmbedding(itemId, vector, buildSearchTextFromItem(forSearch))
```

Notes:
- `extractTextFromS3Auto` chooses the best extractor by extension and returns a concise textual representation for images/audio if available (caption / transcript).
- `embedItemForSearch` uses the configured local pipeline in `embeddings.ts` (ensure the model matches DB vector dim).

## Reindexing all items (skeleton)

Use a reindex job for existing items. Run with low concurrency and checkpointing.

```ts
// scripts/reindex-search.ts (concept)
import pLimit from 'p-limit'
import { prisma } from '@/services/db'
import { embedItemForSearch, buildSearchTextFromItem } from 'app/.server/search/embeddings'
import { searchRepository } from 'app/.server/search/search.repository'
import s3Extractors from 'app/.server/s3-extractors'

const limit = pLimit(4)
const BATCH = 200

async function reindexAll() {
  let cursor: string | undefined
  while (true) {
    const items = await prisma.item.findMany({ take: BATCH, ...(cursor && { cursor: { id: cursor }, skip: 1 }) , orderBy: { id: 'asc' }, include: { file: true, owner: true } })
    if (!items.length) break

    await Promise.all(items.map(it => limit(async () => {
      const content = it.file?.bucket ? await s3Extractors.extractTextFromS3Auto({ bucket: it.file.bucket, key: it.file.key }) : ''
      const forSearch = { name: it.name, description: it.description, tags: it.tags, category: it.category, type: it.type, file: { extension: it.file?.extension, mimeType: it.file?.mimeType }, extraText: content }
      const vec = await embedItemForSearch(forSearch)
      await searchRepository.upsertSearchEmbedding(it.id, vec, buildSearchTextFromItem(forSearch))
    })))

    cursor = items[items.length - 1].id
  }
}

reindexAll().catch((e) => { console.error(e); process.exit(1) })
```

Run:
```bash
pnpm exec tsx ./scripts/reindex-search.ts
```

## Performance & operational tips

- Concurrency: 1–4 concurrent model inferences per CPU core. Use `p-limit` to control.
- Batch sizes: fetch item metadata in batches (100–500) and process with limited concurrency.
- Model memory: MPNet/Whisper/BLIP models can be large. Use quantization (if supported by `@xenova/transformers`, e.g. `quantize: 'q8'`) to reduce RAM.
- Temp files: office/audio/video extraction writes temporary files; ensure host has enough disk and cleanup is performed.
- Vector dim: confirm DB `Search.vector` dimension equals the embedding model output (e.g. 384 vs 768). Mismatches cause runtime errors.

## Example: PDF streaming extraction (already implemented)

The repo includes a PDF range streaming extractor (`extractPdfTextFromS3`) that uses `pdfjs` range transport to avoid loading entire PDFs into memory. Use `maxPages` to limit how many pages you want to index.

## Image & audio notes

- Images: BLIP-based captioning (local) gives short human-like captions; fallback uses Tesseract OCR for text detection. Captions are concise and suitable for embeddings.
- Audio/Video: local Whisper pipeline is used; for large files prefer pre-extracting audio (ffmpeg) and transcribing the audio file. Transcription is CPU intensive — run fewer concurrent jobs.

## Safety & privacy

- All extractors use local model inference; no external paid services or cloud ML APIs are called by these utilities.
- Ensure access controls to S3 objects are enforced — the service doing reindexing must have least-privileged credentials.

## Troubleshooting

- Dimension mismatch error: `expected 768 dimensions, not 384` — fix by matching model in `app/.server/search/embeddings.ts` to the DB vector dimension, or change DB.
- Out of memory: reduce concurrency and/or switch to quantized model.

## Next steps (suggested)

- Add a small monitoring job that checks sample queries and tracks P@k to detect embedding drift after changing models.
- Add a safe rolling migration script if you change vector dimensions (create `vector_new`, reindex to it, swap, rebuild index).

---

File created: `docs/S3-Extraction-and-Embedding-Examples.md`
