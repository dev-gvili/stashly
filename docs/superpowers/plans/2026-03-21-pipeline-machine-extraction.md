# Pipeline Machine Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the six processing steps from the monolithic `pipelineMachine` into dedicated XState 5 sub-machines, so `pipelineMachine` becomes a pure orchestrator that invokes them via `invoke + onDone`.

**Architecture:** Six new exported machines (`languageDetectionMachine`, `transcriptionMachine`, `textCorrectionMachine`, `summarizationMachine`, `keywordExtractionMachine`, `tagGenerationMachine`) each wrap one `fromCallback` actor and follow an `idle → working → done(final)` pattern. Errors forward to the parent via `sendParent` and are caught by `pipelineMachine`'s existing global `WORKER.ERROR` handler. Everything lives in `pipeline.machine.ts`.

**Tech Stack:** XState 5.28.0, TypeScript strict mode, `fromCallback` actors, `sendParent` action

---

## File Map

| File | Change |
|---|---|
| `app/machines/pipeline/pipeline.machine.ts` | Modify — add 6 sub-machines before `pipelineMachine`; update `pipelineMachine` actors, states, and action list |

No other files change.

---

## Task 1: Add the 6 sub-machines

**Files:**
- Modify: `app/machines/pipeline/pipeline.machine.ts`

### Background

Each sub-machine follows this identical pattern:
- `idle` — waits for `START` event (standalone use) or auto-transitions via `always` when `input` was provided (invoked use)
- `working` — invokes a `fromCallback` actor; forwards `WORKER.PROGRESS`, `WORKER.STATUS`, `WORKER.ERROR` to parent via `sendParent`; transitions to `done` on the specific result event
- `done` — `type: 'final'`; triggers `onDone` in `pipelineMachine`
- `failed` — clears input so `hasInput` is false, then `always → idle` (prevents re-triggering the guard)

`forwardToParent` action: `sendParent(({ event }) => event as any)` — the `as any` cast is intentional since the parent's event type is not known at sub-machine definition time.

`clearInput` action: sets the primary input field (`audio` or `text`) to `null`, so the `hasInput` guard evaluates to false and the `failed → idle → always` chain does not re-enter `working`.

- [ ] **Step 1.1: Update the xstate import to add `sendParent`**

In `app/machines/pipeline/pipeline.machine.ts`, change line 1:

```typescript
import { setup, assign, assertEvent, sendParent } from 'xstate'
```

- [ ] **Step 1.2: Add `languageDetectionMachine` after the helper functions (before `pipelineMachine`)**

Insert after the last helper function (`formatFileSize`) and before `export const pipelineMachine = setup({`:

```typescript
// ============================================================================
// LANGUAGE DETECTION MACHINE
// ============================================================================

interface LanguageDetectionContext {
  audio: Float32Array | null
  sampleRate: number
  duration: number
  language: string | null
  confidence: number | null
}

type LanguageDetectionEvent =
  | { type: 'START'; audio: Float32Array; sampleRate: number; duration: number }
  | { type: 'WORKER.LANGUAGE_DETECTED'; language: string; confidence: number }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const languageDetectionMachine = setup({
  types: {
    context: {} as LanguageDetectionContext,
    events: {} as LanguageDetectionEvent,
    input: {} as { audio: Float32Array; sampleRate: number; duration: number } | undefined,
    output: {} as { language: string; confidence: number },
  },
  actors: { detectLanguage: detectLanguageActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { audio: event.audio, sampleRate: event.sampleRate, duration: event.duration }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.LANGUAGE_DETECTED')
      return { language: event.language, confidence: event.confidence }
    }),
    clearInput: assign({ audio: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.audio !== null,
  },
}).createMachine({
  id: 'language-detection',
  context: ({ input }) => ({
    audio: input?.audio ?? null,
    sampleRate: input?.sampleRate ?? 0,
    duration: input?.duration ?? 0,
    language: null,
    confidence: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ language: context.language!, confidence: context.confidence! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'detecting' },
      on: { START: { target: 'detecting', actions: 'setInput' } },
    },
    detecting: {
      invoke: {
        src: 'detectLanguage',
        input: ({ context }) => ({
          audio: context.audio!,
          sampleRate: context.sampleRate,
          duration: context.duration,
        }),
      },
      on: {
        'WORKER.LANGUAGE_DETECTED': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})
```

- [ ] **Step 1.3: Add `transcriptionMachine`**

Insert immediately after `languageDetectionMachine`:

```typescript
// ============================================================================
// TRANSCRIPTION MACHINE
// ============================================================================

interface TranscriptionContext {
  audio: Float32Array | null
  sampleRate: number
  duration: number
  language: string
  text: string | null
}

type TranscriptionEvent =
  | { type: 'START'; audio: Float32Array; sampleRate: number; duration: number; language: string }
  | { type: 'WORKER.RESULT.TRANSCRIPTION'; text: string }
  | { type: 'WORKER.PARTIAL_RESULT'; task: string; payload: unknown }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const transcriptionMachine = setup({
  types: {
    context: {} as TranscriptionContext,
    events: {} as TranscriptionEvent,
    input: {} as { audio: Float32Array; sampleRate: number; duration: number; language: string } | undefined,
    output: {} as { text: string },
  },
  actors: { transcribe: transcribeActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { audio: event.audio, sampleRate: event.sampleRate, duration: event.duration, language: event.language }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.TRANSCRIPTION')
      return { text: event.text }
    }),
    clearInput: assign({ audio: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.audio !== null,
  },
}).createMachine({
  id: 'transcription',
  context: ({ input }) => ({
    audio: input?.audio ?? null,
    sampleRate: input?.sampleRate ?? 0,
    duration: input?.duration ?? 0,
    language: input?.language ?? 'en',
    text: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ text: context.text! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'transcribing' },
      on: { START: { target: 'transcribing', actions: 'setInput' } },
    },
    transcribing: {
      invoke: {
        src: 'transcribe',
        input: ({ context }) => ({
          audio: context.audio!,
          sampleRate: context.sampleRate,
          duration: context.duration,
          language: context.language,
        }),
      },
      on: {
        'WORKER.RESULT.TRANSCRIPTION': { target: 'done', actions: 'assignResult' },
        'WORKER.PARTIAL_RESULT': { actions: 'forwardToParent' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})
```

- [ ] **Step 1.4: Add `textCorrectionMachine`**

Insert immediately after `transcriptionMachine`:

```typescript
// ============================================================================
// TEXT CORRECTION MACHINE
// ============================================================================

interface TextCorrectionContext {
  text: string | null
  language: string
  correctedTranscript: string | null
}

type TextCorrectionEvent =
  | { type: 'START'; text: string; language: string }
  | { type: 'WORKER.RESULT.CORRECTION'; correctedTranscript: string }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const textCorrectionMachine = setup({
  types: {
    context: {} as TextCorrectionContext,
    events: {} as TextCorrectionEvent,
    input: {} as { text: string; language: string } | undefined,
    output: {} as { correctedTranscript: string },
  },
  actors: { correctTranscript: correctTranscriptActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { text: event.text, language: event.language }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.CORRECTION')
      return { correctedTranscript: event.correctedTranscript }
    }),
    clearInput: assign({ text: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.text !== null && context.text.length > 0,
  },
}).createMachine({
  id: 'text-correction',
  context: ({ input }) => ({
    text: input?.text ?? null,
    language: input?.language ?? 'en',
    correctedTranscript: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ correctedTranscript: context.correctedTranscript! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'correcting' },
      on: { START: { target: 'correcting', actions: 'setInput' } },
    },
    correcting: {
      invoke: {
        src: 'correctTranscript',
        input: ({ context }) => ({ text: context.text!, language: context.language }),
      },
      on: {
        'WORKER.RESULT.CORRECTION': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})
```

- [ ] **Step 1.5: Add `summarizationMachine`**

Insert immediately after `textCorrectionMachine`:

```typescript
// ============================================================================
// SUMMARIZATION MACHINE
// ============================================================================

interface SummarizationContext {
  text: string | null
  language: string
  summary: string | null
}

type SummarizationEvent =
  | { type: 'START'; text: string; language: string }
  | { type: 'WORKER.RESULT.SUMMARIZATION'; text: string }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const summarizationMachine = setup({
  types: {
    context: {} as SummarizationContext,
    events: {} as SummarizationEvent,
    input: {} as { text: string; language: string } | undefined,
    output: {} as { summary: string },
  },
  actors: { summarize: summarizeActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { text: event.text, language: event.language }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.SUMMARIZATION')
      return { summary: event.text }
    }),
    clearInput: assign({ text: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.text !== null && context.text.length > 0,
  },
}).createMachine({
  id: 'summarization',
  context: ({ input }) => ({
    text: input?.text ?? null,
    language: input?.language ?? 'en',
    summary: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ summary: context.summary! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'summarizing' },
      on: { START: { target: 'summarizing', actions: 'setInput' } },
    },
    summarizing: {
      invoke: {
        src: 'summarize',
        input: ({ context }) => ({ text: context.text!, language: context.language }),
      },
      on: {
        'WORKER.RESULT.SUMMARIZATION': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})
```

- [ ] **Step 1.6: Add `keywordExtractionMachine`**

Insert immediately after `summarizationMachine`:

```typescript
// ============================================================================
// KEYWORD EXTRACTION MACHINE
// ============================================================================

interface KeywordExtractionContext {
  text: string | null
  keywords: string[] | null
}

type KeywordExtractionEvent =
  | { type: 'START'; text: string }
  | { type: 'WORKER.RESULT.EXTRACT_KEYWORDS'; keywords: string[] }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const keywordExtractionMachine = setup({
  types: {
    context: {} as KeywordExtractionContext,
    events: {} as KeywordExtractionEvent,
    input: {} as { text: string } | undefined,
    output: {} as { keywords: string[] },
  },
  actors: { extractKeywords: extractKeywordsActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { text: event.text }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.EXTRACT_KEYWORDS')
      return { keywords: event.keywords }
    }),
    clearInput: assign({ text: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.text !== null && context.text.length > 0,
  },
}).createMachine({
  id: 'keyword-extraction',
  context: ({ input }) => ({
    text: input?.text ?? null,
    keywords: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ keywords: context.keywords! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'extracting' },
      on: { START: { target: 'extracting', actions: 'setInput' } },
    },
    extracting: {
      invoke: {
        src: 'extractKeywords',
        input: ({ context }) => ({ text: context.text! }),
      },
      on: {
        'WORKER.RESULT.EXTRACT_KEYWORDS': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})
```

- [ ] **Step 1.7: Add `tagGenerationMachine`**

Insert immediately after `keywordExtractionMachine`:

```typescript
// ============================================================================
// TAG GENERATION MACHINE
// ============================================================================

interface TagGenerationContext {
  text: string | null
  language: string
  tags: string[] | null
}

type TagGenerationEvent =
  | { type: 'START'; text: string; language: string }
  | { type: 'WORKER.RESULT.GENERATE_TAGS'; tags: string[] }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }

export const tagGenerationMachine = setup({
  types: {
    context: {} as TagGenerationContext,
    events: {} as TagGenerationEvent,
    input: {} as { text: string; language: string } | undefined,
    output: {} as { tags: string[] },
  },
  actors: { generateTags: generateTagsActor },
  actions: {
    setInput: assign(({ event }) => {
      assertEvent(event, 'START')
      return { text: event.text, language: event.language }
    }),
    assignResult: assign(({ event }) => {
      assertEvent(event, 'WORKER.RESULT.GENERATE_TAGS')
      return { tags: event.tags }
    }),
    clearInput: assign({ text: null }),
    forwardToParent: sendParent(({ event }) => event as any),
  },
  guards: {
    hasInput: ({ context }) => context.text !== null && context.text.length > 0,
  },
}).createMachine({
  id: 'tag-generation',
  context: ({ input }) => ({
    text: input?.text ?? null,
    language: input?.language ?? 'en',
    tags: null,
  }),
  initial: 'idle',
  output: ({ context }) => ({ tags: context.tags! }),
  states: {
    idle: {
      always: { guard: 'hasInput', target: 'generating' },
      on: { START: { target: 'generating', actions: 'setInput' } },
    },
    generating: {
      invoke: {
        src: 'generateTags',
        input: ({ context }) => ({ text: context.text!, language: context.language }),
      },
      on: {
        'WORKER.RESULT.GENERATE_TAGS': { target: 'done', actions: 'assignResult' },
        'WORKER.PROGRESS': { actions: 'forwardToParent' },
        'WORKER.STATUS': { actions: 'forwardToParent' },
        'WORKER.ERROR': { target: 'failed', actions: ['forwardToParent', 'clearInput'] },
      },
    },
    done: { type: 'final' },
    failed: { always: { target: 'idle' } },
  },
})
```

- [ ] **Step 1.8: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. All 6 machines compile correctly alongside the existing `pipelineMachine` (which still uses the old callback actors at this point — that's fine).

- [ ] **Step 1.9: Commit**

```bash
git add app/machines/pipeline/pipeline.machine.ts
git commit -m "feat: add 6 dedicated pipeline sub-machines"
```

---

## Task 2: Update `pipelineMachine` to use the sub-machines

**Files:**
- Modify: `app/machines/pipeline/pipeline.machine.ts`

### Background

`pipelineMachine` needs three changes:
1. Swap the 6 callback actors in `setup({ actors })` for the 6 sub-machines
2. Replace each processing state's `invoke + on[result event] + on[WORKER.ERROR]` with `invoke + onDone`
3. Remove the 6 named actions that are no longer needed

The global `on['WORKER.ERROR']` handler stays — sub-machines forward errors via `sendParent`.
The global `on['WORKER.PROGRESS']` and `on['WORKER.STATUS']` handlers stay — sub-machines forward these too.

- [ ] **Step 2.1: Replace the `actors` block in `pipelineMachine`'s `setup()`**

Find this block (currently around line 57–65):

```typescript
  actors: {
    detectHardware: detectHardwareActor,
    detectLanguage: detectLanguageActor,
    transcribe: transcribeActor,
    summarize: summarizeActor,
    correctTranscript: correctTranscriptActor,
    extractKeywords: extractKeywordsActor,
    generateTags: generateTagsActor,
  },
```

Replace with:

```typescript
  actors: {
    detectHardware: detectHardwareActor,
    detectLanguage: languageDetectionMachine,
    transcribe: transcriptionMachine,
    correctTranscript: textCorrectionMachine,
    summarize: summarizationMachine,
    extractKeywords: keywordExtractionMachine,
    generateTags: tagGenerationMachine,
  },
```

- [ ] **Step 2.2: Remove the 6 no-longer-needed named actions from `setup()`**

Delete these 6 named actions from the `actions:` block in `setup()` (keep all others):
- `assignLanguage`
- `assignTranscript`
- `assignSummary`
- `assignCorrectedTranscript`
- `assignKeywords`
- `assignTags`

- [ ] **Step 2.3: Replace the `detecting_language` state**

Find the `detecting_language` state and replace it entirely:

```typescript
    detecting_language: {
      invoke: {
        id: 'detect-language',
        src: 'detectLanguage',
        input: ({ context }) => ({
          audio: context.pendingAudio!.audio,
          sampleRate: context.pendingAudio!.sampleRate,
          duration: context.pendingAudio!.duration,
        }),
        onDone: {
          target: 'transcribing',
          actions: assign(({ event }) => ({
            detectedLanguage: { language: event.output.language, confidence: event.output.confidence },
          })),
        },
      },
    },
```

- [ ] **Step 2.4: Replace the `transcribing` state**

Find the `transcribing` state and replace it entirely:

```typescript
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
        onDone: {
          target: 'correcting_text',
          actions: assign(({ event }) => ({
            pendingTranscript: event.output.text,
            transcriptProgress: null,
            progress: null,
            loadingPhases: [],
          })),
        },
      },
      on: {
        'WORKER.PARTIAL_RESULT': { actions: 'assignTranscriptProgress' },
      },
    },
```

- [ ] **Step 2.5: Replace the `correcting_text` state**

Find the `correcting_text` state and replace it entirely:

```typescript
    correcting_text: {
      invoke: {
        id: 'correct-transcript',
        src: 'correctTranscript',
        input: ({ context }) => ({
          text: context.pendingTranscript ?? '',
          language: context.detectedLanguage?.language ?? 'en',
        }),
        onDone: {
          target: 'ready',
          actions: assign(({ context, event }) => ({
            transcript: context.pendingTranscript ?? '',
            correctedTranscript: event.output.correctedTranscript,
            pendingTranscript: null,
            progress: null,
            loadingPhases: [],
          })),
        },
      },
    },
```

- [ ] **Step 2.6: Replace the `summarizing` state**

Find the `summarizing` state and replace it entirely:

```typescript
    summarizing: {
      invoke: {
        id: 'summarize',
        src: 'summarize',
        input: ({ context }) => ({
          text: context.transcript,
          language: context.detectedLanguage?.language ?? 'en',
        }),
        onDone: {
          target: 'ready',
          actions: assign(({ event }) => ({
            summary: event.output.summary,
            progress: null,
            loadingPhases: [],
          })),
        },
      },
    },
```

- [ ] **Step 2.7: Replace the `extracting_keywords` state**

Find the `extracting_keywords` state and replace it entirely:

```typescript
    extracting_keywords: {
      invoke: {
        id: 'extract-keywords',
        src: 'extractKeywords',
        input: ({ context }) => ({ text: context.summary || context.transcript }),
        onDone: {
          target: 'ready',
          actions: assign(({ event }) => ({
            keywords: event.output.keywords,
            progress: null,
            loadingPhases: [],
          })),
        },
      },
    },
```

- [ ] **Step 2.8: Replace the `generating_tags` state**

Find the `generating_tags` state and replace it entirely:

```typescript
    generating_tags: {
      invoke: {
        id: 'generate-tags',
        src: 'generateTags',
        input: ({ context }) => ({
          text: context.summary || context.transcript,
          language: context.detectedLanguage?.language ?? 'en',
        }),
        onDone: {
          target: 'ready',
          actions: assign(({ event }) => ({
            generatedTags: event.output.tags,
            progress: null,
            loadingPhases: [],
          })),
        },
      },
    },
```

- [ ] **Step 2.9: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If you see errors about `event.output` being `unknown`, check that the machine's `output` type is correctly declared in its `types` block. If you see errors about missing actions, verify that the 6 named actions were fully removed in Step 2.2.

- [ ] **Step 2.10: Commit**

```bash
git add app/machines/pipeline/pipeline.machine.ts
git commit -m "refactor: pipelineMachine now invokes dedicated sub-machines"
```

---

## Task 3: Verify the @xstate-layout comment is still valid (optional cleanup)

**Files:**
- Modify: `app/machines/pipeline/pipeline.machine.ts`

The `/** @xstate-layout ... */` comment on `pipelineMachine.createMachine()` encodes the machine's state chart. After the refactoring the machine structure changed, so this comment is stale. It's only used by the Stately visualiser — it doesn't affect runtime behaviour.

- [ ] **Step 3.1: Remove the stale `@xstate-layout` comment**

Delete the entire `/** @xstate-layout N4Igp... */` comment block from `pipelineMachine.createMachine()`. It starts with `/** @xstate-layout` and ends with `*/`. The machine will still work; the visualiser will just show a default layout until regenerated from Stately.

- [ ] **Step 3.2: Run final typecheck and confirm clean**

```bash
pnpm typecheck
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 3.3: Commit**

```bash
git add app/machines/pipeline/pipeline.machine.ts
git commit -m "chore: remove stale xstate-layout comment from pipelineMachine"
```
