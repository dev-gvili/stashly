# Semantic Search for a File‑Hosting App (TypeScript + Prisma + PostgreSQL)

> Free‑for‑commercial‑use, completely self‑hosted solution.  
> Uses the open‑source **`all‑MiniLM‑L6‑v2`** sentence‑transformer model, the **`pgvector`** extension for PostgreSQL, and **Prisma** as the ORM.

---

## 📚 Table of Contents

- [Semantic Search for a File‑Hosting App (TypeScript + Prisma + PostgreSQL)](#semantic-search-for-a-filehosting-app-typescript--prisma--postgresql)
  - [📚 Table of Contents](#-table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Choose the embedding model](#choose-the-embedding-model)
  - [Install dependencies](#install-dependencies)
  - [Load the model from Node – src/embeddings.ts](#load-the-model-from-node--srcembeddingsts)
  - [PostgreSQL + Prisma configuration](#postgresql--prisma-configuration)
    - [Install pgvector extension (once)](#install-pgvector-extension-once)
    - [Prisma schema (prisma/schema.prisma)](#prisma-schema-prismaschemaprisma)
      - [Run migrations](#run-migrations)
  - [Extracting file content (optional but recommended)](#extracting-file-content-optional-but-recommended)
    - [Extract text from pdf file stored in s3 using streaming](#extract-text-from-pdf-file-stored-in-s3-using-streaming)
    - [How it works, step‑by‑step](#how-it-works-stepbystep)
  - [Up‑sert a file + its embedding](#upsert-a-file--its-embedding)
  - [Semantic search function (searchService.ts)](#semantic-search-function-searchservicets)

---

## Prerequisites

| Tool                  | Version (or higher)                      |
| --------------------- | ---------------------------------------- |
| **Node.js**           | 18.x (supports ES modules & WebAssembly) |
| **PostgreSQL**        | 13+ (must support extensions)            |
| **pnpm / npm / yarn** | any                                      |
| **Git** (optional)    | –                                        |

Make sure your PostgreSQL instance allows installing extensions (you may need superuser rights the first time).

---

## Choose the embedding model

| Model                                    | Output dim | License                      | Why it works                                                                                                         |
| ---------------------------------------- | ---------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `sentence‑transformers/all‑MiniLM‑L6‑v2` | **384**    | Apache‑2.0 (commercial‑free) | Small (≈33 M params), < 1 GB RAM, fast on CPU, solid quality for names, descriptions, tags, and extracted file text. |

> **Alternative** (if you need higher accuracy & have more RAM): `intfloat/e5-large-v2` (1024‑dim, Apache‑2.0).

---

## Install dependencies

```bash
# From the project root
npm i @xenova/transformers pg prisma @prisma/client pgvector pdf-parse textract @aws-sdk/client-s3 pdfjs-dist
# (or pnpm/yarn)
npx prisma init   # creates prisma/ folder and .env
```

## Load the model from Node – src/embeddings.ts

```ts
// src/embeddings.ts
import { pipeline } from '@xenova/transformers'

let embedder: ReturnType<typeof pipeline> | null = null

/** Initialise the transformer once at app start */
export async function initEmbeddingModel() {
	embedder = await pipeline(
		'feature-extraction',
		'sentence-transformers/all-MiniLM-L6-v2',
		{
			// Uncomment to reduce RAM usage (tiny accuracy loss)
			// quantize: 'q8',
		}
	)
	console.log('✅ Embedding model loaded')
}

/** Encode a string (or array of strings) → L2‑normalised float array */
export async function encodeText(text: string | string[]): Promise<number[]> {
	if (!embedder)
		throw new Error(
			'Embedding model not initialised – call initEmbeddingModel() first'
		)

	// `embedder` returns a tensor [batch, seq_len, hidden]
	const out = await embedder(text, { pooling: 'mean' })

	// Flatten + L2‑normalise
	const flat = out.data as Float32Array
	const norm = Math.sqrt(flat.reduce((s, v) => s + v * v, 0))
	return Array.from(flat, (v) => v / norm)
}
```

> First run downloads ~150 MB of model files into ~/.cache/huggingface/hub.
> You can change the cache folder with the cache_dir option if you prefer a project‑local directory.

---

## PostgreSQL + Prisma configuration

### Install pgvector extension (once)

```sql
-- Connect with psql (or any SQL client) and run:
CREATE EXTENSION IF NOT EXISTS vector;
```

### Prisma schema (prisma/schema.prisma)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  extensions = [pgvector] // <-- optional, just documentation
}

model Item {
    embedding   Unsupported("vector")? @db.Vector(384) // 384 matches all-MiniLM-L6-v2 output dim
    @@index([embedding], type: Gist) // GIST index for cosine similarity
}
```

> Note:
>
> -   `@db.Vector(384)` tells **Prisma** that the column is a **vector(384)** in Postgres.
> -   The **GIST** index allows fast `<=>` (cosine distance) queries.

#### Run migrations

```shell
# From the project root
pnpm exec prisma migrate dev --name init
```

## Extracting file content (optional but recommended)

The quality of semantic search depends a lot on the text you embed.
Below are tiny utilities for the most common file types. Feel free to add more (e.g., pptx, epub, etc.).

```ts
// src/fileService.ts
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { extract as extractText } from 'textract';
import { getDocument } from 'pdf-parse';

/** Extracts text content from various file types. */
 * 
export async function extractFileContent(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath);
  const fileType = await fileTypeFromBuffer(buffer);

  switch (fileType?.ext) {
    case 'pdf':
      return extractTextFromPDF(filePath);
    case 'docx':
      return extractTextFromDocx(filePath);
    case 'epub':
      return extractTextFromEpub(filePath);
    case 'txt':
    case 'md':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported file type: ${fileType?.ext}`);
  }
}

/** Extracts text content from a PDF file. */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  const data = await getDocument(filePath).promise;
  return data.text;
}

/** Extracts text content from a DOCX file. */
export async function extractTextFromDocx(filePath: string): Promise<string> {
  return new Promise((resolve, reject)) =>
    extractText(filePath, { type: 'docx' }, (err, text) => {
      if (err) reject(err);
      else resolve(text);
    });
  };

/** Extracts text content from an EPUB file. */
export async function extractTextFromEpub(filePath: string): Promise<string> {
    return new Promise((resolve, reject)) =>
        extractText(filePath, { type: 'epub' }, (err, text) => {
            if (err) reject(err);
            else resolve(text);
        });
    };
```

```ts
// src/extractFromS3.ts
import {
  S3Client,
  GetObjectCommand,
  GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import textract from 'textract';
import pdfParse from 'pdf-parse';

/**
 * Convert a Node readable stream into a single Buffer.
 * While streaming we enforce an optional `maxSize` to avoid OOM.
 */
async function streamToBuffer(
  stream: Readable,
  opts?: { maxSizeBytes?: number }
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let accumulated = 0;
  const max = opts?.maxSizeBytes ?? Infinity;

  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    accumulated += buf.length;
    if (accumulated > max) {
      throw new Error(
        `S3 object exceeds the allowed ${max}‑byte limit (${accumulated} bytes received)`
      );
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

/**
 * Extract raw text from a **buffer** that represents a file.
 *
 * @param buffer   The full file contents (already in memory).
 * @param filename The original S3 key – used only for extension / mime guessing.
 *
 * @returns plain‑text representation.
 *
 * @throws if the file type is unsupported or the extractor fails.
 */
async function extractTextFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const extMatch = filename.match(/\.([^.\/\\]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';

  // -------- PDF ---------------------------------------------------------
  if (ext === 'pdf') {
    // pdf‑parse expects a Buffer and returns { text, ... }
    const result = await pdfParse(buffer);
    return result.text;
  }

  // -------- All other formats -----------------------------------------
  // textract can work with a Buffer if we also give it a fake filename.
  return new Promise<string>((resolve, reject) => {
    textract.fromBufferWithName(filename, buffer, (err, text) => {
      if (err) reject(err);
      else resolve(text);
    });
  });
}

/**
 * PUBLIC API
 *
 * Download an object from S3 *as a stream*, turn it into a Buffer,
 * then extract its text **without ever touching the local filesystem**.
 *
 * @param args
 *   - bucket:      S3 bucket name
 *   - key:         Object key (including any folder prefixes)
 *   - s3Client?:  Optional pre‑configured S3 client (reuse if you have one)
 *   - maxSizeBytes?: Optional hard limit (default = 500 MB). Helps avoid OOM.
 *
 * @returns extracted plain‑text string.
 *
 * @throws on download errors, size limit breaches, or unsupported formats.
 */
export async function extractTextFromS3Object(args: {
  bucket: string;
  key: string;
  s3Client?: S3Client;
  maxSizeBytes?: number; // safety guard – e.g. 500 * 1024 * 1024
}): Promise<string> {
  const { bucket, key, s3Client, maxSizeBytes } = args;
  const client = s3Client ?? new S3Client({}); // default credential chain

  // 1️⃣ Get the object as a stream
  const getCmdInput: GetObjectCommandInput = { Bucket: bucket, Key: key };
  const response = await client.send(new GetObjectCommand(getCmdInput));

  if (!response.Body) {
    throw new Error(`S3 object ${bucket}/${key} returned no Body`);
  }

  // 2️⃣ Stream → Buffer (with optional size guard)
  const buffer = await streamToBuffer(
    response.Body as Readable,
    maxSizeBytes ? { maxSizeBytes } : undefined
  );

  // 3️⃣ Extract text from the buffer using the appropriate library
  const text = await extractTextFromBuffer(buffer, key);
  return text;
}
```

### Extract text from pdf file stored in s3 using streaming

```ts
// src/s3PdfExtractor.ts
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'; // legacy build works in Node

/**
 * ------------------------------------------------------------
 * 1️⃣ Helper – read a *range* of bytes from S3 and return a Buffer
 * ------------------------------------------------------------
 */
async function getS3Range(
  client: S3Client,
  bucket: string,
  key: string,
  begin: number,
  end: number // end is **exclusive** (like pdf.js expects)
): Promise<Buffer> {
  const getCmdInput: GetObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    // S3 Range header is inclusive, so we subtract 1 from end‑1.
    Range: `bytes=${begin}-${end - 1}`,
  };
  const resp = await client.send(new GetObjectCommand(getCmdInput));

  if (!resp.Body) {
    throw new Error(`S3 object ${bucket}/${key} returned no Body for range`);
  }

  // Stream the range into a Buffer (the range is usually small – ~64 KB)
  const chunks: Buffer[] = [];
  const stream = resp.Body as Readable;
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * ------------------------------------------------------------
 * 2️⃣ pdf.js “PDFDataRangeTransport” subclass that uses the helper above
 * ------------------------------------------------------------
 *
 * pdf.js will call `requestDataRange(begin, end)` whenever it needs more
 * bytes.  We forward the request to S3, then hand the data back to pdf.js
 * via the `onData(begin, chunk)` callback that the base class provides.
 */
class S3DataRangeTransport extends pdfjsLib.PDFDataRangeTransport {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly key: string;

  constructor(
    client: S3Client,
    bucket: string,
    key: string,
    length: number // total size of the PDF (bytes)
  ) {
    // `disableAutoFetch = false` – let pdf.js decide when to ask for the next range.
    super(length, false);
    this.client = client;
    this.bucket = bucket;
    this.key = key;
  }

  /**
   * Called by pdf.js whenever it wants a new byte window.
   */
  override async requestDataRange(begin: number, end: number): Promise<void> {
    try {
      const chunk = await getS3Range(this.client, this.bucket, this.key, begin, end);
      // pdf.js expects a Uint8Array; Buffer is a Uint8Array subclass → works.
      this.onData(begin, chunk);
    } catch (e) {
      // Forward the error to pdf.js so the promise it returned is rejected.
      this.onError(e as any);
    }
  }
}

/**
 * ------------------------------------------------------------
 * 3️⃣ Public helper – extract *all* the text from a PDF stored in S3
 * ------------------------------------------------------------
 *
 * @param bucket  S3 bucket name
 * @param key     Object key (including any prefixes)
 * @param client? Optional pre‑configured S3 client (reuse if you have one)
 *
 * @returns concatenated plain‑text for the whole document
 *
 * @throws when the object does not exist, is not a PDF, or any network error occurs.
 */
export async function extractPdfTextFromS3(params: {
  bucket: string;
  key: string;
  client?: S3Client;
}): Promise<string> {
  const { bucket, key, client } = params;
  const s3 = client ?? new S3Client({}); // default credentials chain

  // ------------------------------------------------------------
  // STEP 1 – determine the total length of the object (HeadObject)
  // ------------------------------------------------------------
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (!head.ContentLength) {
    throw new Error(`Unable to obtain ContentLength for ${bucket}/${key}`);
  }
  const totalLength = Number(head.ContentLength);

  // ------------------------------------------------------------
  // STEP 2 – create the pdf.js range‑transport
  // ------------------------------------------------------------
  const transport = new S3DataRangeTransport(s3, bucket, key, totalLength);

  // `rangeChunkSize` defaults to 64 KB inside pdf.js; you can tweak it
  // via the second argument of `getDocument` if you like.
  const loadingTask = pdfjsLib.getDocument({
    length: totalLength,
    range: transport,
  });

  // ------------------------------------------------------------
  // STEP 3 – read every page, collect the textual items
  // ------------------------------------------------------------
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const allPageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();

    // `textContent.items` is an array of TextItem objects.  The `str` property holds the actual text.
    const pageString = (textContent.items as any[])
      .map((item) => item.str)
      .join(' ');
    allPageTexts.push(pageString);
  }

  // Optional clean‑up (releases internal buffers)
  await pdfDocument.cleanup();

  // Join all pages with a line break – you can change the separator if you like.
  return allPageTexts.join('\n');
}
```

### How it works, step‑by‑step

| Step                             | What happens                                                                                                                           | Why it’s memory‑friendly                                                                                                                                            |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HeadObject                       | Retrieves only the object’s metadata → gives us the total byte length.                                                                 | No file data transferred.                                                                                                                                           |
| S3DataRangeTransport             | Subclass of pdf.js’s PDFDataRangeTransport. When pdf.js needs bytes begin…end‑1, we issue an S3 Range GET request (bytes=begin‑end‑1). | Only the tiny chunk required for the current page (default 64 KB) is fetched and kept in memory.                                                                    |
| pdf.js getDocument({range,…})    | pdf.js orchestrates the paging, asking for more ranges as needed.                                                                      | The whole PDF is never fully materialised; only the ranges needed for the currently‑processed page live in RAM.                                                     |
| Iterate pages → getTextContent() | For each page pdf.js parses the received bytes and returns the text items.                                                             | After a page is processed its buffers are released (via page.cleanup() or at the end via pdfDocument.cleanup()).                                                    |
| Result                           | All page strings are concatenated and returned.                                                                                        | Memory usage stays roughly proportional to the rangeChunkSize (≈64 KB) plus a few page‑level structures – even a 5 GB PDF only needs a few MB of RAM at any moment. |


> Tip: Store the extracted text (content column) only if you later want to display a preview or re‑embed it after a model upgrade. It isn’t required for the search itself – you could delete the column to save space.

---

## Up‑sert a file + its embedding

```ts
// src/fileService.ts  (excerpt)
import { extractTextFromS3Object } from './extractFromS3';

export async function upsertFile(params: {
  id?: string;
  name: string;
  description?: string;
  tags?: string[];
  filePath?: string;                         // local uploads (old way)
  s3Location?: { bucket: string; key: string }; // NEW – S3 stored file
}) {
  const { id, name, description, tags = [], filePath, s3Location } = params;

  // --------------------------------------------------------------
  // 1️⃣ Grab the raw textual payload (local OR S3)
  // --------------------------------------------------------------
  let content: string | null = null;
  if (filePath) {
    // existing helper that works on a local file path
    content = await extractTextFromPath(filePath);
  } else if (s3Location) {
    // NEW – pure‑stream extraction from S3
    content = await extractTextFromS3Object({
      bucket: s3Location.bucket,
      key:    s3Location.key,
      // Example safety guard: reject anything > 300 MB
      maxSizeBytes: 300 * 1024 * 1024,
    });
  }

  // --------------------------------------------------------------
  // 2️⃣ Create the embedding
  // --------------------------------------------------------------
  const textToEmbed = [
    name,
    description ?? '',
    tags.join(' '),
    content ?? '',
  ].join(' ');
  const embedding = await encodeText(textToEmbed);

  // --------------------------------------------------------------
  // 3️⃣ Persist in Postgres
  // --------------------------------------------------------------
  const data = {
    name,
    description,
    tags,
    content,
    embedding,
  };
  if (id) await prisma.file.update({ where: { id }, data });
  else await prisma.file.create({ data });
}
```
>Batch uploads – you can call encodeText([txt1, txt2, …]) to get many vectors in one go and then use prisma.file.createMany.

---

## Semantic search function (searchService.ts)

```ts
// app/.server/searchService.ts
import { prisma } from '@/services/db';
import { encodeText } from '@/services/embeddings';

type SearchResult = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  similarity: number; // 0‑1 (higher = more similar)
};

/**
 * Perform a semantic search against the stored file embeddings.
 *
 * @param query   Raw user query, e.g. "invoice March 2023"
 * @param topK    How many results to return (default 10)
 */
export async function semanticSearch(query: string, topK = 10): Promise<SearchResult[]> {
  const queryEmbedding = await encodeText(query); // → 384‑dim array

  const rows = await prisma.$queryRaw<
    SearchResult[]
  >`
    SELECT
      id,
      name,
      description,
      tags,
      1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM "File"
    ORDER BY similarity DESC
    LIMIT ${topK};
  `;

  return rows;
}
```

> Note:    
> `<=>` = cosine `distance` (provided by **pgvector**).    
> `1 - distance` converts it to an intuitive similarity score.

