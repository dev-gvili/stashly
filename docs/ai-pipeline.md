# AI Pipeline — Transformers.js, Transcription & Summarization

This document covers the AI pipeline architecture for Stashly, including production-ready Transformers.js integration, the auto-detect language transcription pipeline (Node-AV + Whisper), and the summarizer recommendation.

> ⚠️ **Status (2026-08-13): §2 and §3 are reference notes, not shipped code.** All AI inference in Stashly runs **in the browser** on WebGPU via `@huggingface/transformers` — there is no server-side inference, no Node-AV/Whisper transcription service, and no Gemini integration anywhere in the codebase. `/api/ai/*` routes are registered but `app/routes/api/ai.ts` is a placeholder that returns `501 AI API not implemented yet`. See [As built](#as-built) below for the real architecture.

---

## Table of Contents

0. [As built](#as-built) — what actually ships today
1. [Production AI Pipeline with Transformers.js (Browser/React)](#1-production-ai-pipeline-with-transformersjs-browserreact)
2. [AI Transcription Pipeline with Auto-Detect Language (Node.js)](#2-ai-transcription-pipeline-with-auto-detect-language-nodejs)
3. [Summarizer Recommendation](#3-summarizer-recommendation)

---

## As built

| Piece | Location | Notes |
|-------|----------|-------|
| Worker entry | `app/workers/stash.worker.ts` | Real module Worker (`new Worker(new URL('../../workers/stash.worker.ts', import.meta.url), { type: 'module' })`), not a Blob Worker. Boots an XState actor and posts serialized snapshots to the main thread, throttled to ~one per 16ms for progress-only updates. |
| State machine | `app/machines/pipeline/pipeline.machine.ts` + `pipeline.actors.ts` | Stages: detect language → transcribe → correct transcript → summarize → extract keywords → generate tags, plus a `detectHardwareActor`. |
| Inference | `app/workers/stash.ai.ts` | `detectLanguage`, `transcribeAudio`, `summarizeText`, `generateTagsFromText`, `extractKeywordsFromText`. A `PipelineManager` singleton caches pipelines per `task-model` key with per-model dtype overrides. |
| Multimodal client | `app/.client/stashly-ai.ts` | `transcribe()` (chat-template prompt over an audio input), `StashlyAI.caption()`, `StashlyAI.processImage()`. |
| Text embedding | `app/workers/embedding.ai.ts` | Search embeddings — see [`docs/semantic-search.md`](./semantic-search.md). |
| WebGPU serialization | `app/workers/ai-queue.ts` | One inference job at a time; concurrent jobs cause device-lost errors. |
| Consumer | `app/routes/stash/demo.tsx` | The only route that spawns `stash.worker.ts` today. |

**Models actually loaded** (all ONNX, in-browser):

| Purpose | Model | dtype |
|---------|-------|-------|
| Language ID | `Xenova/mms-lid-126` | `q4` |
| Transcription | `onnx-community/gemma-4-E4B-it-ONNX` (via `.client/stashly-ai.ts` `getMoE`) | — |
| Summarize / tags | `onnx-community/tiny-aya-global-ONNX` | `q4` |
| Keywords | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | default |
| Image classify | `Xenova/vit-base-patch16-224` | `fp32` |
| Captioning | `onnx-community/Florence-2-base-ft` | — |
| Search embedding | `Xenova/all-mpnet-base-v2` | `q4` |

`onnx-community/whisper-large-v3-turbo` still has a dtype entry in `MODEL_DTYPE`, but every call site that used it is commented out — Whisper is not on a live path.

---

## Table of Contents

1. [Production AI Pipeline with Transformers.js (Browser/React)](#1-production-ai-pipeline-with-transformersjs-browserreact)
2. [AI Transcription Pipeline with Auto-Detect Language (Node.js)](#2-ai-transcription-pipeline-with-auto-detect-language-nodejs)
3. [Summarizer Recommendation](#3-summarizer-recommendation)

---

## 1. Production AI Pipeline with Transformers.js (Browser/React)

> **Partly built.** The WebGPU-in-a-Worker shape is real (see [As built](#as-built)) but the specifics below diverge: Stashly uses `@huggingface/transformers` **4.2.0** (not `@xenova/transformers` from a CDN), a **URL-based module Worker** (not a Blob Worker), an XState machine (not a `useAIWorker` hook — no such hook exists), and **no Gemini API** — there is no `callGemini`, no `generativelanguage.googleapis.com` call, and no Gemini key anywhere in the repo. `HuggingFaceTB/SmolLM2-135M-Instruct` is not among the loaded models.

### Overview

A hybrid AI pipeline combining **local WebGPU inference** (via Transformers.js v3) with **cloud LLM intelligence** (Gemini API). Designed as a React Router v7 Route Module.

**Key features:**
- SSR-ready with server-side `loader` and `meta`
- WebGPU acceleration with automatic WASM (CPU) fallback
- Off-main-thread processing via Web Worker (no UI freezing)
- Real-time token streaming for "ChatGPT-like" typing effect
- Model: `HuggingFaceTB/SmolLM2-135M-Instruct` (~150MB, loads quickly in-browser)
- Blob Worker pattern for single-file portability (no Vite worker config needed)

### Architecture

```
Server (SSR)
  → returns initial HTML shell + suggestedPrompts via loader
Client (hydration)
  → Web Worker created from Blob URL
  → Worker loads model via Transformers.js (device: 'webgpu', dtype: 'q4')
  → UI sends inference requests via postMessage
  → Worker returns results + execution time
  → Gemini API called for result explanation / prompt optimization
```

### Worker Pattern (Blob Worker)

```typescript
const WORKER_CODE = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
  static instance = null;
  static async getInstance(progressCallback) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, {
        progress_callback: progressCallback,
        device: 'webgpu',
        dtype: 'q4',
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  if (type === 'load') { ... }
  if (type === 'inference') { ... }
});
`

// In React component:
const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
const workerUrl = URL.createObjectURL(blob)
const worker = new Worker(workerUrl, { type: 'module' })
```

### `useAIWorker` Hook

```typescript
function useAIWorker() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'inferencing'>('idle')
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [result, setResult] = useState<InferenceResult | null>(null)

  // loadModel(task, model) — sends 'load' message to worker
  // runInference(text, options) — sends 'inference' message to worker
  return { status, progress, result, error, loadModel, runInference }
}
```

### Gemini API Integration

```typescript
async function callGemini(prompt: string, systemPrompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`
  // Exponential backoff retry (up to 5 attempts) for rate limits / transient errors
}
```

Use cases:
- **Optimize Prompt:** Rewrites the input to be more effective for small encoder-decoder models
- **Explain Result:** Translates model output into plain language for non-technical users

### Migrating to Full React Router v7

1. **Worker file:** Move `WORKER_CODE` to `public/worker.js`
2. **Route module:** Component becomes `app/routes/analyze.tsx`
3. **Client Loader (optional):** Initialize worker before navigation for instant feel:

```typescript
let worker: Worker | null = null

export async function clientLoader() {
  if (!worker) worker = new Worker('/worker.js', { type: 'module' })
  return null
}
```

**SSR considerations:** `clientLoader` runs only in the browser, so the server never executes WebGPU code. Server returns an HTML shell; client handles AI loading during hydration.

### Supported Pipelines (examples)

| Pipeline | Model | Task |
|----------|-------|------|
| Text Generation | `Xenova/LaMini-Flan-T5-77M` | `text2text-generation` |
| Sentiment Analysis | `Xenova/distilbert-base-uncased-finetuned-sst-2-english` | `text-classification` |

---

## 2. AI Transcription Pipeline with Auto-Detect Language (Node.js)

> ⚠️ **Not implemented.** `node-av` is in `package.json` (`^6.0.0`), but nothing under `app/` imports it — there is no `Demuxer`, `AsyncQueue`, `streamingBatcher`, `floatToAudioFrame`, or `getPresignedGetUrl` for transcription, and `@alexanderolsen/libsamplerate-js` is not a dependency (resampling happens client-side in `resampleAudio` inside `stash.ai.ts`). Transcription today is **in-browser**: `transcribeAudio` in `app/workers/stash.ai.ts` delegates to `transcribe()` in `app/.client/stashly-ai.ts`, which prompts `onnx-community/gemma-4-E4B-it-ONNX` with a chat template over a 16 kHz `Float32Array`. Keep this section as the reference design for a future server-side path.

This section documents the production-ready Node.js pipeline for transcribing audio/video files, including fixes for common FFmpeg/Whisper issues, frame batching, parallel decoding, and real-time S3 streaming.

### Core Components

- **node-av** — FFmpeg bindings for Node.js (Demuxer, Decoder, Frame)
- **@alexanderolsen/libsamplerate-js** — Audio resampling to 16 kHz mono (Whisper requirement)
- **Whisper** — Speech-to-text transcription
- **AsyncQueue** — Bounded producer/consumer queue for parallel decoding + batching

### Key Issue: Remaining Audio Buffer at End of Stream

```
[Parsed_whisper_0 @ ...] Remaining audio buffer 65536 samples (4 seconds) after stopping
```

**Cause:** Whisper's internal filtergraph holds buffered audio. Without a flush signal, the final seconds are never transcribed.

**Fix:** Yield a final empty audio frame after all packets are processed:

```typescript
const flushFrame = Frame.fromAudioBuffer(Buffer.alloc(0), {
  nbSamples: 0,
  format: AV_SAMPLE_FMT_FLT,
  sampleRate: 16000,
  channelLayout: AV_CH_LAYOUT_MONO,
  timeBase: new Rational(1, 16000),
})
flushFrame.pts = lastPts  // last real timestamp from the loop
yield flushFrame
```

**If zero-length flush fails** (some node-av builds reject it), fall back to a 1-sample silent frame:

```typescript
try {
  // zero-length flush
  const flushFrame = Frame.fromAudioBuffer(Buffer.alloc(0), { nbSamples: 0, ... })
  flushFrame.pts = pts
  yield flushFrame
} catch (err) {
  // fallback: 1-sample silent frame
  const silent = new Float32Array(1)
  const buf = Buffer.from(silent.buffer, silent.byteOffset, silent.byteLength)
  const fallback = Frame.fromAudioBuffer(buf, { nbSamples: 1, ... })
  fallback.pts = pts
  yield fallback
}
```

### Critical Buffer Fix: `floatToAudioFrame`

When using `Float32Array.slice()`, the underlying `ArrayBuffer` may be larger than the slice. Always use `byteOffset` and `byteLength`:

```typescript
function floatToAudioFrame(samples: Float32Array, pts: bigint): Frame {
  // IMPORTANT: copies only the used bytes, not the whole ArrayBuffer
  const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)

  const frame = Frame.fromAudioBuffer(buf, {
    nbSamples: samples.length,
    format: AV_SAMPLE_FMT_FLT,
    sampleRate: 16000,
    channelLayout: AV_CH_LAYOUT_MONO,
    timeBase: new Rational(1, 16000),
  })
  frame.pts = pts
  return frame
}
```

### Frame Batching

Instead of yielding one tiny frame per decode, accumulate PCM into 2-second batches before yielding to Whisper. This yields **2x–5x faster transcription**.

```typescript
const batchSize = 16000 * 2  // 2 seconds at 16kHz

function appendToBatch(samples: Float32Array) {
  if (batchOffset + samples.length > batchSize) {
    flushBatch()  // yield current batch as a Whisper Frame
  }
  batchBuffer.set(samples, batchOffset)
  batchOffset += samples.length
}
```

### Parallel Decoding Architecture

```
┌──────────────┐     push      ┌──────────────┐     yield      ┌──────────────┐
│  Decoder      │ ───────────► │   PCM Queue   │ ─────────────► │   Batcher     │
│ (async loop)  │              │ (bounded)     │                │ (async gen)   │
└──────────────┘              └──────────────┘                └──────────────┘
                                                                       │
                                                                 Whisper.transcribe()
```

**AsyncQueue (typed):**

```typescript
class AsyncQueue<T> {
  private queue: T[] = []
  private resolvers: ((value: T) => void)[] = []
  constructor(private max: number = 20) {}

  async push(item: T): Promise<void> {
    while (this.queue.length >= this.max) {
      await new Promise(r => setTimeout(r, 1))
    }
    if (this.resolvers.length > 0) {
      this.resolvers.shift()!(item)
    } else {
      this.queue.push(item)
    }
  }

  async pop(): Promise<T> {
    if (this.queue.length > 0) return this.queue.shift()!
    return new Promise<T>(resolve => this.resolvers.push(resolve))
  }
}
```

**Integration:**

```typescript
type PCMChunk = Float32Array

const queue = new AsyncQueue<PCMChunk | null>(30)
await startDecoder(decoder, demuxer, audioStream, queue)
const frameStream = streamingBatcher(queue)

for await (const segment of whisper.transcribe(frameStream)) {
  console.log(segment.text)
}
```

### Using `decoder.flushFrames()` in the Decoder Stage

After the packet loop, flush the codec's internal buffers before sending the end-of-stream marker:

```typescript
async function startDecoder(decoder, demuxer, audioStream, queue) {
  for await (const packet of demuxer.packets(audioStream.index)) {
    const frames = await decoder.decodeAll(packet)
    for (const frame of frames) {
      await pushResampledPCM(frame, queue)
    }
  }

  // flush codec internal frames
  for await (const frame of decoder.flushFrames()) {
    await pushResampledPCM(frame, queue)
  }

  await queue.push(null)  // end-of-stream marker
}
```

**Note:** `decoder.flushFrames()` flushes the FFmpeg codec buffer (packet → decoded frame). Whisper still needs a separate flush via the empty/silent audio frame.

### Real-Time S3 Streaming Pipeline

`node-av`'s `Demuxer.open(url)` uses HTTP Range Requests internally — point it at a presigned S3 URL and it streams progressively:

```typescript
export async function getPresignedGetUrl(bucket: string, key: string) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  return await getSignedUrl(s3, command, { expiresIn: 3600 })
}

// Full pipeline:
const url = await getPresignedGetUrl(bucket, key)
const demuxer = await Demuxer.open(url)  // FFmpeg sends Range headers
const audioStream = demuxer.audio()
const decoder = await Decoder.create(audioStream)
const queue = new AsyncQueue<Float32Array | null>(50)
startDecoder(decoder, demuxer, audioStream, queue)
const frameStream = streamingBatcher(queue)

for await (const segment of whisper.transcribe(frameStream)) {
  console.log('partial:', segment.text)
}
```

### Handling 403 / Stream Errors

A presigned URL may return `403 Forbidden` due to expiry or gateway issues. Recommended robust strategy:

1. **Preflight HEAD + small range read** before opening with FFmpeg
2. **Regenerate the presigned URL** once on 403 with exponential backoff
3. **Fallback to local download** when streaming repeatedly fails
4. **Prefer audio-only demuxing** (`demuxer.audio()`) to avoid video container errors

```typescript
async function transcribeAudioWithResilience(
  presignedUrl: string,
  regeneratePresignedUrl?: () => Promise<string>
) {
  const result = await ensureCompleteUrl(presignedUrl, regeneratePresignedUrl)
  const source = result.type === 'stream' ? result.url : result.path

  const demuxer = await Demuxer.open(source)
  // ... rest of pipeline
  if (result.type === 'file') {
    try { await fs.promises.unlink(result.path) } catch {}
  }
}
```

### `streamingBatcher` — Final Production Version

```typescript
async function* streamingBatcher(
  queue: AsyncQueue<PCMChunk | null>
): AsyncGenerator<Frame> {
  const batchSize = 8000  // 0.5s at 16kHz for low latency
  let batch = new Float32Array(batchSize)
  let offset = 0
  let pts: bigint = 0n

  while (true) {
    const chunk = await queue.pop()
    if (chunk === null) break

    if (offset + chunk.length > batchSize) {
      const slice = batch.slice(0, offset)
      yield floatToAudioFrame(slice, pts)
      pts += BigInt(slice.length)
      offset = 0
    }
    batch.set(chunk, offset)
    offset += chunk.length
  }

  // Flush remaining audio
  if (offset > 0) {
    const slice = batch.slice(0, offset)
    yield floatToAudioFrame(slice, pts)
    pts += BigInt(slice.length)
  }

  // Final flush: try zero-length first, fallback to 1-sample silent frame
  try {
    const flushFrame = Frame.fromAudioBuffer(Buffer.alloc(0), {
      nbSamples: 0, format: AV_SAMPLE_FMT_FLT,
      sampleRate: 16000, channelLayout: AV_CH_LAYOUT_MONO,
      timeBase: new Rational(1, 16000),
    })
    flushFrame.pts = pts
    yield flushFrame
  } catch (err) {
    const silent = new Float32Array(1)
    const buf = Buffer.from(silent.buffer, silent.byteOffset, silent.byteLength)
    const fallback = Frame.fromAudioBuffer(buf, {
      nbSamples: 1, format: AV_SAMPLE_FMT_FLT,
      sampleRate: 16000, channelLayout: AV_CH_LAYOUT_MONO,
      timeBase: new Rational(1, 16000),
    })
    fallback.pts = pts
    yield fallback
  }
}
```

---

## 3. Summarizer Recommendation

> ⚠️ **Not implemented as described.** There is no `POST /api/summarize` route and none of the env vars below (`HF_TOKEN`, `SUMMARIZER_MODEL`, `SUMMARIZER_CHUNK_SIZE`, `SUMMARIZER_OVERLAP`) are read anywhere. `/api/ai/summarize` *is* registered in `app/routes.ts` but maps to the placeholder `app/routes/api/ai.ts`, which returns `501` for both `loader` and `action` — so `summarizeMachine` in `app/machines/ai/ai.machine.ts` (which POSTs `intent=summarize-text` there) currently fails. The working summarizer is client-side: `summarizeText` in `app/workers/stash.ai.ts` using **`onnx-community/tiny-aya-global-ONNX`** (`q4`), driven by `summarizeActor` in the pipeline machine. No Hugging Face Inference API calls are made. None of the models below (`distilbart-cnn-12-6`, `bart-large-cnn`, `led-base-16384`, `long-t5`) are used.

### Model Recommendations

| Use Case | Model | Notes |
|----------|-------|-------|
| Default (fast, reliable) | `sshleifer/distilbart-cnn-12-6` | App default for transcript summarization |
| Higher quality | `facebook/bart-large-cnn` | Slower; may need chunking for very long inputs |
| Long context | `allenai/led-base-16384` or `google/long-t5` | Only if your inference provider hosts them |

### API Integration

```
POST /api/summarize
Content-Type: application/json

{
  "text": "Long transcript text...",
  "model": "sshleifer/distilbart-cnn-12-6",  // optional
  "chunkSize": 4000,                           // optional, chars
  "overlap": 200                               // optional, chars
}

Response: {
  "ok": true,
  "finalSummary": "...",
  "chunkSummaries": [...],
  "modelUsed": "sshleifer/distilbart-cnn-12-6"
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HF_TOKEN` | required | Hugging Face inference access token |
| `SUMMARIZER_MODEL` | `sshleifer/distilbart-cnn-12-6` | Default summarization model |
| `SUMMARIZER_CHUNK_SIZE` | `4000` | Chunk size (chars) for long inputs |
| `SUMMARIZER_OVERLAP` | `200` | Chunk overlap (chars) for long inputs |

### Quick Test

```bash
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"text":"Long transcript text..."}'
```
