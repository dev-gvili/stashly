# Pipeline Machine Extraction Design

**Date:** 2026-03-21
**Status:** Approved
**File:** `app/machines/pipeline/pipeline.machine.ts`

## Goal

Extract the six processing steps embedded in `pipelineMachine` into dedicated, independently exportable XState 5 machines. `pipelineMachine` becomes a pure orchestrator that invokes these machines instead of raw callback actors. Everything stays in `pipeline.machine.ts`.

Note: the reference pattern is `ai.machine.ts` in style only (multiple exports, one per concern). The new machines use `type: 'final'` states — unlike `ai.machine.ts` machines which use `always → idle` cycles and are designed for `useMachine`. These machines are designed to be invoked by `pipelineMachine` via `invoke + onDone`.

## XState 5 invocation chain

`pipelineMachine` invokes `languageDetectionMachine` (a machine) — not `detectLanguageActor` (a fromCallback). When `detectLanguageActor`'s `sendBack` delivers `WORKER.LANGUAGE_DETECTED`, `languageDetectionMachine` handles it in its `working` state and transitions to `done (final)`. This causes `pipelineMachine`'s `invoke.onDone` to fire. The `fromCallback` actor's `sendBack` does not need to complete; it only sends events to the machine that invoked it (`languageDetectionMachine`).

## The 6 Dedicated Machines

| Machine | Actor wrapped | Result event | Input | Output |
|---|---|---|---|---|
| `languageDetectionMachine` | `detectLanguageActor` | `WORKER.LANGUAGE_DETECTED` | `{ audio, sampleRate, duration }` | `{ language, confidence }` |
| `transcriptionMachine` | `transcribeActor` | `WORKER.RESULT.TRANSCRIPTION` | `{ audio, sampleRate, duration, language }` | `{ text }` |
| `textCorrectionMachine` | `correctTranscriptActor` | `WORKER.RESULT.CORRECTION` | `{ text, language }` | `{ correctedTranscript }` |
| `summarizationMachine` | `summarizeActor` | `WORKER.RESULT.SUMMARIZATION` | `{ text, language }` | `{ summary }` |
| `keywordExtractionMachine` | `extractKeywordsActor` | `WORKER.RESULT.EXTRACT_KEYWORDS` | `{ text }` | `{ keywords }` |
| `tagGenerationMachine` | `generateTagsActor` | `WORKER.RESULT.GENERATE_TAGS` | `{ text, language }` | `{ tags }` |

### State shape (identical for all 6)

```
idle ──[always, guard: hasInput]──► working ──[result event]──► done (final)
     ◄──[START event]────────────────────┘
working ──[WORKER.PROGRESS / STATUS]──► sendParent
working ──[WORKER.ERROR]──────────────► target: failed, actions: [sendParent, clearInput]
failed ──[always]────────────────────► idle   ← safe: clearInput already fired, hasInput is now false
```

### Dual-mode startup

- `context: ({ input }) => ...` initialises context from `input` when invoked by `pipelineMachine`
- The `hasInput` guard in `idle.always` auto-starts immediately when context has a non-null/non-empty primary field — no `START` event needed from the invoking parent
- For standalone use (`useMachine`), send `START` with the same payload as `input`

### Guard predicate

- Audio machines (`languageDetectionMachine`, `transcriptionMachine`): `hasInput = ({ context }) => context.audio !== null`
- Text machines (`textCorrectionMachine`, `summarizationMachine`, `tagGenerationMachine`, `keywordExtractionMachine`): `hasInput = ({ context }) => context.text !== null && context.text.length > 0`

The `keywordExtractionMachine` text guard explicitly handles the empty-string case that arises when `context.summary || context.transcript` is `''` in `PipelineContext`.

### Error flow

1. `fromCallback` actor sends `WORKER.ERROR` to the child machine (its direct parent)
2. Child machine's `working` state handles `WORKER.ERROR`:
   - Transitions to `failed`
   - Runs `sendParent(({ event }) => event)` — forwards the `WORKER.ERROR` event to `pipelineMachine`
   - Runs `clearInput` action — sets `context.audio` (or `context.text`) to `null`, ensuring `hasInput` returns false
3. `failed.always` fires synchronously — child transitions to `idle`
4. `idle.always` guard: `hasInput` is now false (input was cleared) — does not fire; child stays in `idle`
5. `pipelineMachine`'s global `on['WORKER.ERROR']` handler receives the forwarded event, runs `assignError`, transitions to `error` state
6. `pipelineMachine` exits the invoking state — XState stops the child machine; `fromCallback` actor cleanup (`cancelled = true`) runs via invoke teardown

**Note on `escalate`:** XState 5 does not export `escalate`. Do not use it. The pattern above (`sendParent` + `clearInput` + `failed → idle`) is the correct XState 5 alternative.

**Note on `failed → idle` safety:** `clearInput` runs *before* `failed → idle` because XState processes transition actions before entering the new state. By the time `idle.always` evaluates `hasInput`, the input is already null — the child cannot accidentally re-enter `working`.

### `WORKER.PARTIAL_RESULT` (transcriptionMachine only)

`transcriptionMachine`'s `working` state has an explicit `on['WORKER.PARTIAL_RESULT']` handler that runs `sendParent(({ event }) => event)`. This is an XState machine action (`import { sendParent } from 'xstate'`) defined in the machine's state, not logic inside the `fromCallback` actor. The actor sends `WORKER.PARTIAL_RESULT` to `transcriptionMachine`; the machine then forwards it to `pipelineMachine`, which handles it with the existing `assignTranscriptProgress` action. This preserves the exact event shape.

### `textCorrectionMachine` fallback behaviour

`correctTranscriptActor` catches its own internal errors and sends `WORKER.RESULT.CORRECTION` with the original `input.text` as `correctedTranscript`. `textCorrectionMachine` always transitions to `done` via `WORKER.RESULT.CORRECTION` — it never receives `WORKER.ERROR` in normal operation. The parent always receives `event.output.correctedTranscript`, which may equal the original uncorrected text if the underlying model failed internally.

### Event types

Each machine declares a **narrowed** `events` type. Do not use the full `PipelineEvents` union (which includes `AUDIO_UPLOAD`, `CANCEL`, etc. these machines never receive). Example for `languageDetectionMachine`:

```typescript
type LanguageDetectionEvent =
  | { type: 'START'; audio: Float32Array; sampleRate: number; duration: number }
  | { type: 'WORKER.LANGUAGE_DETECTED'; language: string; confidence: number }
  | { type: 'WORKER.PROGRESS'; data: unknown }
  | { type: 'WORKER.STATUS'; status: string }
  | { type: 'WORKER.ERROR'; message: string }
```

Each machine's events type covers: its `START` event, its specific result event, `WORKER.PROGRESS`, `WORKER.STATUS`, and `WORKER.ERROR`.

### Output

Machine-level `output: ({ context }) => ...` runs when `done (final)` is reached. `failed` transitions to `idle` (not a final state), so `output` is never called in the error path.

## Updated `pipelineMachine`

### Actors section

```typescript
actors: {
  detectHardware:    detectHardwareActor,       // unchanged (fromPromise)
  detectLanguage:    languageDetectionMachine,
  transcribe:        transcriptionMachine,
  correctTranscript: textCorrectionMachine,
  summarize:         summarizationMachine,
  extractKeywords:   keywordExtractionMachine,
  generateTags:      tagGenerationMachine,
}
```

### State changes

Each processing state switches to `invoke: { src, input, onDone }`. **The local `on[result event]` and `on['WORKER.ERROR']` handlers in each state are removed** and replaced by `onDone` (for results) and the global `WORKER.ERROR` handler (for errors).

| State | `input` expression | `onDone` assigns |
|---|---|---|
| `detecting_language` | `{ audio, sampleRate, duration }` from `context.pendingAudio` | `detectedLanguage: { language: event.output.language, confidence: event.output.confidence }` |
| `transcribing` | `{ audio, sampleRate, duration, language }` | `pendingTranscript: event.output.text`; clear `transcriptProgress`, `progress`, `loadingPhases` |
| `correcting_text` | `{ text: context.pendingTranscript ?? '', language }` | `transcript: context.pendingTranscript ?? ''` (from parent context); `correctedTranscript: event.output.correctedTranscript`; clear `pendingTranscript`, `progress`, `loadingPhases` |
| `summarizing` | `{ text: context.transcript, language }` | `summary: event.output.summary`; clear `progress`, `loadingPhases` |
| `extracting_keywords` | `{ text: context.summary \|\| context.transcript }` | `keywords: event.output.keywords`; clear `progress`, `loadingPhases` |
| `generating_tags` | `{ text: context.summary \|\| context.transcript, language }` | `generatedTags: event.output.tags`; clear `progress`, `loadingPhases` |

**Note on `correcting_text` onDone:** The inline `assign` reads from both `event` and `context`:

```typescript
assign(({ context, event }) => ({
  transcript: context.pendingTranscript ?? '',
  correctedTranscript: event.output.correctedTranscript,
  pendingTranscript: null,
  progress: null,
  loadingPhases: [],
}))
```

**`transcribing` retains its local `WORKER.PARTIAL_RESULT` handler.** `transcriptionMachine` forwards the event via `sendParent`; the parent handles it with the existing `assignTranscriptProgress` action (no change needed).

### Explicitly removed from each state in `pipelineMachine`

The following state-level `on` handlers **must be deleted** when adding `onDone` to each state:

| State | Remove these `on` handlers |
|---|---|
| `detecting_language` | `on['WORKER.LANGUAGE_DETECTED']`, `on['WORKER.ERROR']` |
| `transcribing` | `on['WORKER.RESULT.TRANSCRIPTION']`, `on['WORKER.ERROR']` (keep `WORKER.PARTIAL_RESULT`) |
| `correcting_text` | `on['WORKER.RESULT.CORRECTION']` (no WORKER.ERROR existed here) |
| `summarizing` | `on['WORKER.RESULT.SUMMARIZATION']`, `on['WORKER.ERROR']` |
| `extracting_keywords` | `on['WORKER.RESULT.EXTRACT_KEYWORDS']`, `on['WORKER.ERROR']` |
| `generating_tags` | `on['WORKER.RESULT.GENERATE_TAGS']`, `on['WORKER.ERROR']` |

### Removed from `pipelineMachine` setup

- Named actions: `assignLanguage`, `assignTranscript`, `assignSummary`, `assignCorrectedTranscript`, `assignKeywords`, `assignTags` — replaced by inline `assign` in each `onDone`

### Unchanged in `pipelineMachine`

- Global `on` handlers: `CANCEL`, **`WORKER.ERROR`** (retained — sub-machines forward via `sendParent`), `WORKER.PROGRESS`, `WORKER.STATUS`
- `assignError` (unchanged — still reads `event.message` from the forwarded `WORKER.ERROR` event via `assertEvent`)
- `checking_hardware` state
- `ready`, `idle`, `error` states
- Named actions: `assignHardwareInfo`, `assignFileAndAudio`, `updateProgress`, `updateModelName`, `assignTranscriptProgress`, `clearPendingAudio`, `clearError`
- All helper functions: `modelNameFromFile`, `phaseFromFile`, `modelNameFromStatus`, `formatFileSize`
- All exports: `PipelineMachine`, `PipelineMachineActor`

## File structure

```
// helper functions (unchanged)
// ── LANGUAGE DETECTION MACHINE ──────────────────────
export const languageDetectionMachine = ...
// ── TRANSCRIPTION MACHINE ────────────────────────────
export const transcriptionMachine = ...
// ── TEXT CORRECTION MACHINE ──────────────────────────
export const textCorrectionMachine = ...
// ── SUMMARIZATION MACHINE ────────────────────────────
export const summarizationMachine = ...
// ── KEYWORD EXTRACTION MACHINE ───────────────────────
export const keywordExtractionMachine = ...
// ── TAG GENERATION MACHINE ───────────────────────────
export const tagGenerationMachine = ...
// ── MAIN PIPELINE MACHINE (orchestrator) ─────────────
export const pipelineMachine = ...
export type PipelineMachine = ...
export type PipelineMachineActor = ...
```

## Out of scope

- Changes to `pipeline.actors.ts`
- Changes to `machine.schemas.ts` or `machine.types.ts`
- Changes to `PipelineState` union in `machine.types.ts` (state names unchanged)
- Any consumer of `pipelineMachine` (workers, hooks, components)
