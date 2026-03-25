# Pipeline Machine in Worker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the XState pipeline machine from the main thread into `stash.worker.ts` so all AI orchestration and inference runs off-thread, keeping the UI unconditionally responsive.

**Architecture:** The worker becomes self-contained: it runs the XState machine as an actor, invokes AI pipeline functions directly (no nested sub-worker), and posts serialized state snapshots to the main thread after every transition. The React component becomes a dumb display layer — it creates the worker, sends typed events, and renders snapshots from `useState`.

**Tech Stack:** XState v5 (`createActor`, `fromCallback`, `fromPromise`), `@huggingface/transformers`, Vitest, React

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Create** | `app/workers/stash.ai.ts` | AI pipeline functions extracted from `stash.worker.ts`, parameterised with callbacks instead of global `self.postMessage` calls |
| **Modify** | `app/workers/stash.worker.ts` | Strip old message-switch handler; import machine; create + start actor; serialize snapshots → `self.postMessage`; forward events from main thread |
| **Modify** | `app/machines/stash/pipeline.actors.ts` | Remove `workerBridgeActor`. Replace with per-task `fromCallback` actors that import from `stash.ai.ts`. Keep `detectHardwareActor` using existing `navigator.gpu` + `adapter.info` impl (no `document.*`). |
| **Modify** | `app/machines/stash/pipeline.machine.ts` | Remove `workerRef` from context. Replace `sendTo(workerRef)` actions with `invoke` on each AI state. Remove `spawnWorkerBridge` action. |
| **Modify** | `app/schemas/machine.schemas.ts` | Remove `workerRef` from `pipelineContextSchema`. Replace `file: File` in `AUDIO_UPLOAD` with flat metadata fields. Simplify `SUMMARIZE` / `EXTRACT_KEYWORDS` to carry no text. |
| **Modify** | `app/types/machine.types.ts` | Add `WorkerSnapshot` type + `initialWorkerSnapshot` constant. Update `PipelineContext` (no `workerRef`). |
| **Modify** | `app/routes/stash/demo.tsx` | Replace `useMachine` with `useRef<Worker>` + `useState<WorkerSnapshot>`. Send typed events via `worker.postMessage` with flat file metadata (not `File` object). |
| **Create** | `app/workers/__tests__/pipeline-actors.test.ts` | Machine transition tests with mocked AI actors |

---

## Task 1 — Extract AI functions to `stash.ai.ts`

**Goal:** Pull every AI function out of `stash.worker.ts` into `stash.ai.ts` with callback parameters instead of calling `self.postMessage` directly. `stash.worker.ts` will import from here.

**Files:**
- Create: `app/workers/stash.ai.ts`
- Modify: `app/workers/stash.worker.ts` (import + delete duplicated code)

- [ ] **Step 1.1: Write the failing test**

  Create `app/workers/__tests__/stash-ai-callbacks.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest'
  import { normalizeTranscript, serializeSummaryPayload } from '../stash.ai'

  describe('normalizeTranscript', () => {
    it('joins partial texts with comma-space', () => {
      expect(normalizeTranscript(['Hello', 'world'])).toBe('Hello, world')
    })
    it('trims leading and trailing whitespace from the result', () => {
      expect(normalizeTranscript(['  Hello  ', 'world  '])).toBe('Hello,   world')
    })
    it('returns empty string for empty array', () => {
      expect(normalizeTranscript([])).toBe('')
    })
  })

  describe('serializeSummaryPayload', () => {
    it('returns generated_text from array payload', () => {
      expect(serializeSummaryPayload([{ generated_text: 'hi' }])).toBe('hi')
    })
    it('returns the string directly', () => {
      expect(serializeSummaryPayload('hi')).toBe('hi')
    })
    it('returns generated_text from object payload', () => {
      expect(serializeSummaryPayload({ generated_text: 'hi' })).toBe('hi')
    })
    it('falls back to empty string for unknown shapes', () => {
      expect(serializeSummaryPayload(null)).toBe('')
    })
  })
  ```

- [ ] **Step 1.2: Run test to verify it fails**

  ```bash
  pnpm vitest run app/workers/__tests__/stash-ai-callbacks.test.ts
  ```

  Expected: FAIL — `normalizeTranscript` and `serializeSummaryPayload` not found.

- [ ] **Step 1.3: Create `app/workers/stash.ai.ts`**

  Move `PipelineManager`, `WebGPUDeviceManager`, `SUPPORTED_LANGUAGES`, all language constants, model constants, system prompts, and all AI functions from `stash.worker.ts` into `stash.ai.ts`. Parameterise with explicit callbacks.

  Key signature changes — instead of calling the module-level `progress()` / `partialResult()` globals, accept them as parameters:

  ```ts
  // app/workers/stash.ai.ts
  /// <reference types="@webgpu/types" />
  import { pipeline, env, type SupportedTasks } from '@huggingface/transformers'
  import { extractAudioChunk, makeChunks, toChunk, parseTags } from './stash.worker.helpers'

  export type ProgressData = { status?: string; progress?: number; file?: string }
  export type ProgressCallback = (data: ProgressData) => void
  export type PartialResultCallback = (task: string, payload: unknown) => void

  // ── Two pure helpers exported for testing ────────────────────────────────

  /** Join partial ASR texts into a final transcript string. */
  export function normalizeTranscript(parts: string[]): string {
    return parts.join(', ').trim()
  }

  /** Normalize the many shapes a summarization LLM can return into a plain string. */
  export function serializeSummaryPayload(payload: unknown): string {
    if (Array.isArray(payload)) return (payload[0] as any)?.generated_text ?? ''
    if (typeof payload === 'string') return payload
    if (payload && typeof payload === 'object') {
      const p = payload as any
      return p.generated_text ?? p.summary ?? p.summary_text ?? ''
    }
    return ''
  }

  // ── Copy PipelineManager, WebGPUDeviceManager, constants verbatim ─────────
  // (move the bodies from stash.worker.ts — do not duplicate, delete from there)

  export { PipelineManager, WebGPUDeviceManager }

  // ── AI functions ──────────────────────────────────────────────────────────

  export async function detectLanguage(
    audio: Float32Array
  ): Promise<{ language: string; confidence: number }> {
    // identical logic from stash.worker.ts — no progress callback needed
    // (language detection does not load with progress_callback)
  }

  export async function transcribeAudio(
    params: { audio: Float32Array; sampleRate: number; duration: number; language: string },
    onProgress: ProgressCallback,
    onPartialResult: PartialResultCallback
  ): Promise<string> {
    // identical logic from stash.worker.ts transcribe block
    // replace `progress(data)` → `onProgress(data)`
    // replace `partialResult(task, payload)` → `onPartialResult(task, payload)`
    // return normalizeTranscript(partialTexts) at the end
  }

  export async function summarizeText(
    params: { text: string; language: string },
    onProgress: ProgressCallback
  ): Promise<string> {
    // identical logic from stash.worker.ts summarize block
    // replace `progress(data)` → `onProgress(data)`
    // return serializeSummaryPayload(summarizedChunks.join(' '))
  }

  export async function extractKeywordsFromText(
    text: string,
    onProgress: ProgressCallback
  ): Promise<string[]> {
    // identical logic from stash.worker.ts extract-keywords block
    // replace `progress(data)` → `onProgress(data)`
    // return keywords.map(kw => kw.word)
  }

  export async function generateTagsFromText(
    params: { text: string; language: string },
    onProgress: ProgressCallback
  ): Promise<string[]> {
    // identical logic from stash.worker.ts generate-tags block
    // replace `progress(data)` → `onProgress(data)`
    // return parseTags(output[0].generated_text)
  }
  ```

- [ ] **Step 1.4: Run tests to verify they pass**

  ```bash
  pnpm vitest run app/workers/__tests__/stash-ai-callbacks.test.ts
  ```

  Expected: PASS (2 suites, 7 tests)

- [ ] **Step 1.5: Update `stash.worker.ts` to import from `stash.ai.ts`**

  Delete the moved code from `stash.worker.ts`. Add imports at the top:
  ```ts
  import {
    detectLanguage, transcribeAudio, summarizeText,
    extractKeywordsFromText, generateTagsFromText,
  } from './stash.ai'
  ```

  Keep `self.addEventListener('message', ...)` intact for now — it will be replaced in Task 5.

- [ ] **Step 1.6: Verify typecheck passes for workers**

  ```bash
  pnpm typecheck 2>&1 | grep -E "stash\.(worker|ai)"
  ```

  Expected: no errors in these two files.

- [ ] **Step 1.7: Commit**

  ```bash
  git add app/workers/stash.ai.ts app/workers/stash.worker.ts app/workers/__tests__/stash-ai-callbacks.test.ts
  git commit -m "refactor(worker): extract AI pipeline functions to stash.ai.ts with callback params"
  ```

---

## Task 2 — Replace actors in `pipeline.actors.ts`

**Goal:** Remove `workerBridgeActor` (no more nested worker). Add per-task `fromCallback` actors that invoke the AI functions from `stash.ai.ts` and `sendBack` typed machine events. Keep `detectHardwareActor` using the existing `navigator.gpu` + `adapter.info` implementation — **no `document.*` APIs** (they are unavailable in workers).

**Files:**
- Modify: `app/machines/stash/pipeline.actors.ts`

- [ ] **Step 2.1: Write the failing test**

  Create `app/workers/__tests__/pipeline-actors.test.ts`:

  ```ts
  import { describe, it, expect, vi } from 'vitest'
  import { createActor, createMachine, waitFor } from 'xstate'
  import { detectLanguageActor } from '../../machines/stash/pipeline.actors'

  // Mock stash.ai so no real models load
  vi.mock('../../workers/stash.ai', () => ({
    detectLanguage: vi.fn().mockResolvedValue({ language: 'en', confidence: 0.95 }),
    transcribeAudio: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    summarizeText: vi.fn().mockReturnValue(new Promise(() => {})),
    extractKeywordsFromText: vi.fn().mockReturnValue(new Promise(() => {})),
    generateTagsFromText: vi.fn().mockReturnValue(new Promise(() => {})),
  }))

  describe('detectLanguageActor', () => {
    it('sends WORKER.LANGUAGE_DETECTED to parent machine when language is detected', async () => {
      // Wrap the actor in a parent machine so sendBack works
      const received: unknown[] = []
      const parentMachine = createMachine({
        initial: 'detecting',
        states: {
          detecting: {
            invoke: {
              id: 'lid',
              src: detectLanguageActor,
              input: { audio: new Float32Array([0.1]), sampleRate: 16000, duration: 0.1 },
            },
            on: {
              'WORKER.LANGUAGE_DETECTED': {
                target: 'done',
                actions: ({ event }) => received.push(event),
              },
            },
          },
          done: { type: 'final' },
        },
      })

      const actor = createActor(parentMachine)
      actor.start()
      await waitFor(actor, (s) => s.matches('done'), { timeout: 2000 })

      expect(received).toHaveLength(1)
      expect((received[0] as any).type).toBe('WORKER.LANGUAGE_DETECTED')
      expect((received[0] as any).language).toBe('en')
      expect((received[0] as any).confidence).toBe(0.95)
    })
  })
  ```

- [ ] **Step 2.2: Run test to verify it fails**

  ```bash
  pnpm vitest run app/workers/__tests__/pipeline-actors.test.ts
  ```

  Expected: FAIL — `detectLanguageActor` not found.

- [ ] **Step 2.3: Rewrite `pipeline.actors.ts`**

  ```ts
  // app/machines/stash/pipeline.actors.ts
  import { fromCallback, fromPromise } from 'xstate'
  import type { PipelineEvents } from '@/types/machine.types'
  import {
    detectLanguage,
    transcribeAudio,
    summarizeText,
    extractKeywordsFromText,
    generateTagsFromText,
  } from '@/workers/stash.ai'

  type DetectLanguageInput = { audio: Float32Array; sampleRate: number; duration: number }
  type TranscribeInput = { audio: Float32Array; sampleRate: number; duration: number; language: string }
  type SummarizeInput = { text: string; language: string }
  type KeywordsInput = { text: string }
  type GenerateTagsInput = { text: string; language: string }

  // ── detectLanguageActor ───────────────────────────────────────────────────
  export const detectLanguageActor = fromCallback<PipelineEvents, DetectLanguageInput>(
    ({ sendBack, input }) => {
      let cancelled = false
      detectLanguage(input.audio)
        .then(({ language, confidence }) => {
          if (!cancelled)
            sendBack({ type: 'WORKER.LANGUAGE_DETECTED', language, confidence })
        })
        .catch((e: Error) => {
          if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
        })
      return () => { cancelled = true }
    }
  )

  // ── transcribeActor ───────────────────────────────────────────────────────
  export const transcribeActor = fromCallback<PipelineEvents, TranscribeInput>(
    ({ sendBack, input }) => {
      let cancelled = false
      transcribeAudio(
        input,
        (data) => { if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data }) },
        (task, payload) => { if (!cancelled) sendBack({ type: 'WORKER.PARTIAL_RESULT', task, payload }) }
      )
        .then((text) => {
          if (!cancelled) sendBack({ type: 'WORKER.RESULT.TRANSCRIPTION', text })
        })
        .catch((e: Error) => {
          if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
        })
      return () => { cancelled = true }
    }
  )

  // ── summarizeActor ────────────────────────────────────────────────────────
  export const summarizeActor = fromCallback<PipelineEvents, SummarizeInput>(
    ({ sendBack, input }) => {
      let cancelled = false
      summarizeText(
        input,
        (data) => { if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data }) }
      )
        .then((text) => {
          if (!cancelled) sendBack({ type: 'WORKER.RESULT.SUMMARIZATION', text })
        })
        .catch((e: Error) => {
          if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
        })
      return () => { cancelled = true }
    }
  )

  // ── extractKeywordsActor ──────────────────────────────────────────────────
  export const extractKeywordsActor = fromCallback<PipelineEvents, KeywordsInput>(
    ({ sendBack, input }) => {
      let cancelled = false
      extractKeywordsFromText(
        input.text,
        (data) => { if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data }) }
      )
        .then((keywords) => {
          if (!cancelled) sendBack({ type: 'WORKER.RESULT.EXTRACT_KEYWORDS', keywords })
        })
        .catch((e: Error) => {
          if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
        })
      return () => { cancelled = true }
    }
  )

  // ── generateTagsActor ─────────────────────────────────────────────────────
  export const generateTagsActor = fromCallback<PipelineEvents, GenerateTagsInput>(
    ({ sendBack, input }) => {
      let cancelled = false
      generateTagsFromText(
        input,
        (data) => { if (!cancelled) sendBack({ type: 'WORKER.PROGRESS', data }) }
      )
        .then((tags) => {
          if (!cancelled) sendBack({ type: 'WORKER.RESULT.GENERATE_TAGS', tags })
        })
        .catch((e: Error) => {
          if (!cancelled) sendBack({ type: 'WORKER.ERROR', message: e.message })
        })
      return () => { cancelled = true }
    }
  )

  // ── detectHardwareActor ───────────────────────────────────────────────────
  // Uses navigator.gpu + adapter.info ONLY — no document.* (unavailable in workers)
  export const detectHardwareActor = fromPromise<{
    executionProvider: 'webgpu' | 'wasm'
    gpuInfo: string | null
  }>(async () => {
    try {
      const nav = navigator as Navigator & { gpu?: GPU }
      if (nav.gpu) {
        const adapter = await nav.gpu.requestAdapter()
        if (adapter) {
          let gpuInfo: string | null = null
          try {
            const info = (adapter as any).info as { description?: string; vendor?: string } | undefined
            gpuInfo = info?.description ?? info?.vendor ?? null
          } catch { /* requestAdapterInfo not universally available */ }
          return { executionProvider: 'webgpu', gpuInfo }
        }
      }
    } catch { /* WebGPU not available */ }
    return { executionProvider: 'wasm', gpuInfo: null }
  })
  ```

- [ ] **Step 2.4: Run test**

  ```bash
  pnpm vitest run app/workers/__tests__/pipeline-actors.test.ts
  ```

  Expected: PASS

- [ ] **Step 2.5: Commit**

  ```bash
  git add app/machines/stash/pipeline.actors.ts app/workers/__tests__/pipeline-actors.test.ts
  git commit -m "refactor(machine): replace workerBridgeActor with direct AI task actors"
  ```

---

## Task 3 — Rewrite `pipeline.machine.ts` to use `invoke`

**Goal:** Remove `workerRef` from context. Replace `sendTo(workerRef, ...)` actions with `invoke` on each AI state. Each AI state now invokes its actor directly with `input` derived from context. `audioDuration` is assigned directly from the `AUDIO_UPLOAD` event (was previously sent by the worker as a separate message).

**Files:**
- Modify: `app/machines/stash/pipeline.machine.ts`

- [ ] **Step 3.1: Write failing machine transition tests**

  Add to `app/workers/__tests__/pipeline-actors.test.ts` (the `stash.ai` mock from Task 2 already covers these):

  ```ts
  import { pipelineMachine } from '../../machines/stash/pipeline.machine'

  // Ensure transcribeAudio returns a never-resolving Promise so 'transcribing' state is stable
  // (already set in mock above: vi.fn().mockReturnValue(new Promise(() => {})))

  describe('pipelineMachine', () => {
    it('starts in checking_hardware', () => {
      const actor = createActor(pipelineMachine)
      actor.start()
      expect(actor.getSnapshot().value).toBe('checking_hardware')
      actor.stop()
    })

    it('transitions to idle after hardware detection completes', async () => {
      const actor = createActor(pipelineMachine)
      actor.start()
      await waitFor(actor, (s) => s.matches('idle'), { timeout: 2000 })
      actor.stop()
    })

    it('transitions idle → detecting_language on AUDIO_UPLOAD', async () => {
      const actor = createActor(pipelineMachine)
      actor.start()
      await waitFor(actor, (s) => s.matches('idle'), { timeout: 2000 })

      actor.send({
        type: 'AUDIO_UPLOAD',
        audio: new Float32Array([0.1]),
        sampleRate: 16000,
        duration: 0.1,
        fileName: 'test.mp3',
        fileType: 'audio/mpeg',
        fileSize: 1024,
      })
      await waitFor(actor, (s) => s.matches('detecting_language'), { timeout: 500 })
      expect(actor.getSnapshot().context.fileInfo?.name).toBe('test.mp3')
      actor.stop()
    })

    it('transitions detecting_language → transcribing on WORKER.LANGUAGE_DETECTED', async () => {
      // detectLanguage mock resolves to { language: 'en', confidence: 0.95 }
      const actor = createActor(pipelineMachine)
      actor.start()
      await waitFor(actor, (s) => s.matches('idle'), { timeout: 2000 })

      actor.send({
        type: 'AUDIO_UPLOAD',
        audio: new Float32Array([0.1]),
        sampleRate: 16000,
        duration: 0.1,
        fileName: 'test.mp3',
        fileType: 'audio/mpeg',
        fileSize: 1024,
      })
      await waitFor(actor, (s) => s.matches('transcribing'), { timeout: 2000 })
      expect(actor.getSnapshot().context.detectedLanguage?.language).toBe('en')
      actor.stop()
    })

    it('CANCEL from transcribing returns to idle', async () => {
      const actor = createActor(pipelineMachine)
      actor.start()
      await waitFor(actor, (s) => s.matches('idle'), { timeout: 2000 })

      actor.send({
        type: 'AUDIO_UPLOAD',
        audio: new Float32Array([0.1]),
        sampleRate: 16000,
        duration: 0.1,
        fileName: 'test.mp3',
        fileType: 'audio/mpeg',
        fileSize: 1024,
      })
      await waitFor(actor, (s) => s.matches('transcribing'), { timeout: 2000 })
      actor.send({ type: 'CANCEL' })
      await waitFor(actor, (s) => s.matches('idle'), { timeout: 1000 })
      actor.stop()
    })
  })
  ```

- [ ] **Step 3.2: Run tests to verify they fail**

  ```bash
  pnpm vitest run app/workers/__tests__/pipeline-actors.test.ts
  ```

  Expected: FAIL — machine still uses old `sendTo`/`workerRef` pattern and `file: File` in event.

- [ ] **Step 3.3: Rewrite `pipeline.machine.ts`**

  **Context initial value** — remove `workerRef`:
  ```ts
  context: {
    executionProvider: 'unknown',
    gpuInfo: null,
    fileInfo: null,
    pendingAudio: null,   // Float32Array kept internally, never serialized to main thread
    modelName: null,
    loadingPhases: [],
    progress: null,
    detectedLanguage: null,
    audioDuration: 0,
    transcriptProgress: null,
    transcript: '',
    summary: '',
    keywords: [],
    generatedTags: [],
    error: null,
  }
  ```

  **`setup` actors block**:
  ```ts
  actors: {
    detectHardware: detectHardwareActor,
    detectLanguage: detectLanguageActor,
    transcribe: transcribeActor,
    summarize: summarizeActor,
    extractKeywords: extractKeywordsActor,
    generateTags: generateTagsActor,
  },
  ```

  **Actions** — remove `spawnWorkerBridge`, `assignLanguageAndSendTranscribe`, `sendSummarize`, `sendExtractKeywords`, `sendGenerateTags`. Replace `assignFileAndSendDetectLanguage` with a pure assign that also captures `audioDuration`:
  ```ts
  assignFileAndAudio: assign(({ event }) => {
    assertEvent(event, 'AUDIO_UPLOAD')
    return {
      fileInfo: {
        name: event.fileName,
        type: event.fileType,
        size: formatFileSize(event.fileSize),
        duration: event.duration,
      },
      pendingAudio: {
        audio: event.audio,
        sampleRate: event.sampleRate,
        duration: event.duration,
      },
      audioDuration: event.duration,   // no longer sourced from worker message
      transcript: '',
      summary: '',
      keywords: [],
      generatedTags: [],
      detectedLanguage: null,
      transcriptProgress: null,
      progress: null,
      loadingPhases: [],
      modelName: null,
      error: null,
    }
  }),

  assignLanguage: assign(({ event }) => {
    assertEvent(event, 'WORKER.LANGUAGE_DETECTED')
    return { detectedLanguage: { language: event.language, confidence: event.confidence } }
  }),
  ```

  **States** — add `invoke` to each AI state:

  ```ts
  detecting_language: {
    invoke: {
      id: 'detect-language',
      src: 'detectLanguage',
      input: ({ context }) => ({
        audio: context.pendingAudio!.audio,
        sampleRate: context.pendingAudio!.sampleRate,
        duration: context.pendingAudio!.duration,
      }),
    },
    on: {
      'WORKER.LANGUAGE_DETECTED': { target: 'transcribing', actions: 'assignLanguage' },
      'WORKER.ERROR': { target: 'error', actions: 'assignError' },
    },
  },

  transcribing: {
    invoke: {
      id: 'transcribe',
      src: 'transcribe',
      input: ({ context }) => ({
        audio: context.pendingAudio!.audio,
        sampleRate: context.pendingAudio!.sampleRate,
        duration: context.pendingAudio!.duration,
        language: context.detectedLanguage?.language ?? 'en',
      }),
    },
    on: {
      'WORKER.RESULT.TRANSCRIPTION': { target: 'ready', actions: 'assignTranscript' },
      'WORKER.PARTIAL_RESULT': { actions: 'assignTranscriptProgress' },
      'WORKER.ERROR': { target: 'error', actions: 'assignError' },
    },
  },

  summarizing: {
    invoke: {
      id: 'summarize',
      src: 'summarize',
      input: ({ context }) => ({
        text: context.transcript,
        language: context.detectedLanguage?.language ?? 'en',
      }),
    },
    on: {
      'WORKER.RESULT.SUMMARIZATION': { target: 'ready', actions: 'assignSummary' },
      'WORKER.ERROR': { target: 'error', actions: 'assignError' },
    },
  },

  extracting_keywords: {
    invoke: {
      id: 'extract-keywords',
      src: 'extractKeywords',
      input: ({ context }) => ({ text: context.summary || context.transcript }),
    },
    on: {
      'WORKER.RESULT.EXTRACT_KEYWORDS': { target: 'ready', actions: 'assignKeywords' },
      'WORKER.ERROR': { target: 'error', actions: 'assignError' },
    },
  },

  generating_tags: {
    invoke: {
      id: 'generate-tags',
      src: 'generateTags',
      input: ({ context }) => ({
        text: context.summary || context.transcript,
        language: context.detectedLanguage?.language ?? 'en',
      }),
    },
    on: {
      'WORKER.RESULT.GENERATE_TAGS': { target: 'ready', actions: 'assignTags' },
      'WORKER.ERROR': { target: 'error', actions: 'assignError' },
    },
  },
  ```

  **`ready` state** — no text in events (machine uses context):
  ```ts
  ready: {
    on: {
      AUDIO_UPLOAD:      { target: 'detecting_language', actions: 'assignFileAndAudio' },
      SUMMARIZE:         { target: 'summarizing' },
      EXTRACT_KEYWORDS:  { target: 'extracting_keywords' },
      GENERATE_TAGS:     { target: 'generating_tags' },
    },
  },
  ```

  **Global `on` block** — remove `WORKER.AUDIO_DURATION` (now in `assignFileAndAudio`):
  ```ts
  on: {
    CANCEL: { target: '.idle', actions: assign({ pendingAudio: null }) },
    'WORKER.PROGRESS': { actions: 'updateProgress' },
    'WORKER.STATUS':   { actions: 'updateModelName' },
  },
  ```

- [ ] **Step 3.4: Run tests**

  ```bash
  pnpm vitest run app/workers/__tests__/pipeline-actors.test.ts
  ```

  Expected: PASS (all machine transition tests)

- [ ] **Step 3.5: Typecheck**

  ```bash
  pnpm typecheck 2>&1 | grep -E "pipeline\.(machine|actors)"
  ```

  Expected: no errors

- [ ] **Step 3.6: Commit**

  ```bash
  git add app/machines/stash/pipeline.machine.ts
  git commit -m "refactor(machine): replace sendTo pattern with invoke for all AI states"
  ```

---

## Task 4 — Update schemas, types, and `demo.tsx` atomically

**Goal:** These three changes must land in a single commit because they are interdependent — updating the `AUDIO_UPLOAD` schema (no `file: File`) would break `demo.tsx` until it is also updated.

Changes:
1. `machine.schemas.ts` — replace `file: File` with flat metadata; remove `workerRef`; simplify `SUMMARIZE`/`EXTRACT_KEYWORDS`
2. `machine.types.ts` — add `WorkerSnapshot` + `initialWorkerSnapshot`; remove `workerRef` from `PipelineContext`
3. `demo.tsx` — replace `useMachine` with `Worker` + `useState<WorkerSnapshot>`; send flat metadata in `AUDIO_UPLOAD`

**Files:**
- Modify: `app/schemas/machine.schemas.ts`
- Modify: `app/types/machine.types.ts`
- Modify: `app/routes/stash/demo.tsx`

- [ ] **Step 4.1: Update `machine.schemas.ts`**

  Replace `pipelineAudioUpload` — swap `file: File` for flat metadata (File is not cloneable across worker boundaries):
  ```ts
  const pipelineAudioUpload = z.object({
    type: z.literal('AUDIO_UPLOAD'),
    audio: z.instanceof(Float32Array),
    sampleRate: z.number(),
    duration: z.number(),
    fileName: z.string(),
    fileType: z.string(),
    fileSize: z.number(),
  })
  ```

  Simplify `SUMMARIZE` and `EXTRACT_KEYWORDS` — machine derives text from context, no payload needed:
  ```ts
  const pipelineSummarize = z.object({ type: z.literal('SUMMARIZE') })
  const pipelineExtractKeywords = z.object({ type: z.literal('EXTRACT_KEYWORDS') })
  ```

  Remove `workerRef` from `pipelineContextSchema`:
  ```ts
  export const pipelineContextSchema = z.object({
    // workerRef removed — machine now lives inside the worker
    executionProvider: z.enum(['webgpu', 'wasm', 'unknown']),
    // ... rest unchanged
  })
  ```

  Remove `WORKER.AUDIO_DURATION` from `pipelineEvents` — no longer emitted:
  ```ts
  // Remove: workerAudioDuration from the discriminated union
  ```

- [ ] **Step 4.2: Update `machine.types.ts`**

  Remove `workerRef` from `PipelineContext` (follows automatically from schema change).

  Add `WorkerSnapshot` and its initial value constant:
  ```ts
  /** Serializable state snapshot posted from the worker to the main thread on every transition. */
  export type WorkerSnapshot = {
    value: string
    context: Omit<PipelineContext, 'pendingAudio'>
  }

  export const initialWorkerSnapshot: WorkerSnapshot = {
    value: 'checking_hardware',
    context: {
      executionProvider: 'unknown',
      gpuInfo: null,
      fileInfo: null,
      modelName: null,
      loadingPhases: [],
      progress: null,
      detectedLanguage: null,
      audioDuration: 0,
      transcriptProgress: null,
      transcript: '',
      summary: '',
      keywords: [],
      generatedTags: [],
      error: null,
    },
  }
  ```

- [ ] **Step 4.3: Rewrite `App` component in `demo.tsx`**

  Remove:
  ```ts
  import { useMachine } from '@xstate/react'
  import { pipelineMachine } from '@/machines/stash/pipeline.machine'
  ```

  Add:
  ```ts
  import { useEffect, useRef, useState, useCallback } from 'react'
  import type { WorkerSnapshot } from '@/types/machine.types'
  import { initialWorkerSnapshot } from '@/types/machine.types'
  ```

  Replace the `App` component body:

  ```tsx
  export default function App() {
    const workerRef = useRef<Worker | null>(null)
    const [snapshot, setSnapshot] = useState<WorkerSnapshot>(initialWorkerSnapshot)

    useEffect(() => {
      const worker = new Worker(
        new URL('../../workers/stash.worker.ts', import.meta.url),
        { type: 'module' }
      )
      worker.onmessage = (e: MessageEvent<WorkerSnapshot>) => setSnapshot(e.data)
      worker.onerror = (e) => console.error('Worker error:', e)
      workerRef.current = worker
      return () => worker.terminate()
    }, [])

    const send = useCallback((event: object, transferables?: Transferable[]) => {
      workerRef.current?.postMessage(event, transferables ?? [])
    }, [])

    const { value: stateValue, context } = snapshot
    const isProcessing = !IDLE_STATES.includes(stateValue)

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const ctx = new window.AudioContext({ sampleRate: 16000 })
        const arrayBuffer = await file.arrayBuffer()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        const audio = audioBuffer.getChannelData(0)
        // Send flat metadata — File objects are NOT cloneable across worker boundaries
        send(
          {
            type: 'AUDIO_UPLOAD',
            audio,
            sampleRate: audioBuffer.sampleRate,
            duration: audioBuffer.duration,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          },
          [audio.buffer]  // transfer the ArrayBuffer — zero-copy
        )
      } catch (err) {
        console.error('Audio decode error:', err)
      }
    }

    const handleCopy = (text: string) => {
      if (!text) return
      navigator.clipboard.writeText(text).catch(console.error)
    }

    // Machine derives text from its own context — no payload needed
    const runSummary = () => { if (context.transcript) send({ type: 'SUMMARIZE' }) }
    const runKeywords = () => { if (context.summary || context.transcript) send({ type: 'EXTRACT_KEYWORDS' }) }
    const runGenerateTags = () => { send({ type: 'GENERATE_TAGS' }) }

    return (
      // JSX unchanged — already reads context.* and stateValue
      // Remove React import's useState/useEffect/useRef if now unused at top of file
    )
  }
  ```

- [ ] **Step 4.4: Typecheck everything**

  ```bash
  pnpm typecheck 2>&1 | grep -E "demo\.tsx|machine\.(schemas|types)|pipeline\."
  ```

  Expected: no errors in any of these files.

- [ ] **Step 4.5: Commit (all three files together)**

  ```bash
  git add app/schemas/machine.schemas.ts app/types/machine.types.ts app/routes/stash/demo.tsx
  git commit -m "feat(pipeline): migrate demo to worker consumer, flatten AUDIO_UPLOAD event, add WorkerSnapshot"
  ```

---

## Task 5 — Bootstrap machine inside `stash.worker.ts`

**Goal:** Replace `self.addEventListener('message', ...)` with `createActor(pipelineMachine)`. Worker posts serialized `WorkerSnapshot` on every state transition. `self.onmessage` is set **before** `actor.start()` to avoid a race window where early main-thread events would be dropped.

**Files:**
- Modify: `app/workers/stash.worker.ts`

- [ ] **Step 5.1: Rewrite `stash.worker.ts`**

  ```ts
  // app/workers/stash.worker.ts
  /// <reference types="@webgpu/types" />
  import { createActor } from 'xstate'
  import { pipelineMachine } from '../machines/stash/pipeline.machine'
  import type { WorkerSnapshot } from '../types/machine.types'

  // ── Boot the pipeline machine ────────────────────────────────────────────

  const actor = createActor(pipelineMachine)

  // Serialize state after every transition and post to the main thread.
  // pendingAudio is intentionally excluded — it holds a large Float32Array
  // that the main thread never needs.
  actor.subscribe((snapshot) => {
    const { value, context } = snapshot
    const msg: WorkerSnapshot = {
      value: value as string,
      context: {
        executionProvider: context.executionProvider,
        gpuInfo: context.gpuInfo,
        fileInfo: context.fileInfo,
        modelName: context.modelName,
        loadingPhases: context.loadingPhases,
        progress: context.progress,
        detectedLanguage: context.detectedLanguage,
        audioDuration: context.audioDuration,
        transcriptProgress: context.transcriptProgress,
        transcript: context.transcript,
        summary: context.summary,
        keywords: context.keywords,
        generatedTags: context.generatedTags,
        error: context.error,
      },
    }
    self.postMessage(msg)
  })

  // Set onmessage BEFORE actor.start() to avoid dropping events sent immediately
  // after the worker is created.
  self.onmessage = (e: MessageEvent) => {
    actor.send(e.data)
  }

  actor.start()
  ```

- [ ] **Step 5.2: Typecheck**

  ```bash
  pnpm typecheck 2>&1 | grep "stash.worker"
  ```

  Expected: no errors.

- [ ] **Step 5.3: Bundle check — confirm `@huggingface/transformers` is NOT in the main client bundle**

  ```bash
  pnpm build 2>&1 | grep -i "transformers\|huggingface"
  ```

  Expected: transformers appears only in a worker chunk (filename containing `worker`), not in `index-*.js`. If it appears in the main bundle, check for any remaining imports of `pipeline.actors.ts` or `pipeline.machine.ts` from non-worker code and remove them.

- [ ] **Step 5.4: Commit**

  ```bash
  git add app/workers/stash.worker.ts
  git commit -m "feat(worker): run XState pipeline machine inside Web Worker"
  ```

---

## Task 6 — Smoke test in browser

**Goal:** Verify end-to-end flow with a real audio file. Confirm main thread stays responsive during transcription.

- [ ] **Step 6.1: Start dev server**

  ```bash
  pnpm dev
  ```

  Navigate to `http://localhost:5173/<user>/stash/demo`

- [ ] **Step 6.2: Verify pipeline flow**

  Upload a short audio file (< 30s). Confirm in order:
  1. UploadZone shows detecting → transcribing animations
  2. Transcript appears in full
  3. Summarize / Keywords / Tags each complete to `ready` state
  4. MetadataStrip shows file name, size, duration, and language

- [ ] **Step 6.3: Verify main-thread responsiveness**

  While transcribing a file longer than 1 minute:
  1. Open DevTools → Performance → record during transcription
  2. Confirm main thread has no long tasks (> 50ms) attributable to the pipeline
  3. Scroll the page / hover buttons while transcribing — confirm no jank

- [ ] **Step 6.4: Verify cancel works**

  Upload a long file. While transcribing, upload a new file. Confirm:
  - Previous transcription result does not appear
  - New pipeline run starts cleanly (re-runs detect → transcribe)

- [ ] **Step 6.5: Final commit**

  ```bash
  git add -A
  git commit -m "feat(pipeline): machine-in-worker architecture complete — zero main-thread AI work"
  ```

---

## Appendix — Design decisions

**Why `fromCallback` for all AI actors?**
`fromPromise` resolves once and cannot emit intermediate events (progress, partial transcription results). `fromCallback` allows the actor to `sendBack` many events during its lifetime — this is why `transcribeActor` sends one `WORKER.PARTIAL_RESULT` per audio chunk. For consistency and uniform error handling, all AI actors use `fromCallback`.

**Why the `cancelled` flag?**
If the machine transitions away (e.g. CANCEL) while an AI operation is in flight, XState calls the actor's cleanup function. Setting `cancelled = true` ensures inflight `.then()` / `.catch()` callbacks silently discard their results instead of sending stale events to the now-inactive machine.

**Why flat metadata instead of `File` in `AUDIO_UPLOAD`?**
`File` objects are not structurally cloneable and cannot be sent via `postMessage` to a Web Worker — doing so throws a `DataCloneError`. Audio decoding (`AudioContext.decodeAudioData`) must stay on the main thread because `AudioContext` is unavailable in workers; the decoded `Float32Array` is transferred (zero-copy) and the file metadata is sent as plain strings/numbers.

**Why `self.onmessage` before `actor.start()`?**
`actor.start()` synchronously enters `checking_hardware` and fires async `detectHardwareActor`. Any events the main thread posts before `self.onmessage` is assigned would be queued by the browser's message port but processed synchronously once the handler is set — so the race window is tiny. Setting it first eliminates the window entirely.
