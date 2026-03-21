# Pipeline Machine Extraction Design

**Date:** 2026-03-21
**Status:** Approved
**File:** `app/machines/pipeline/pipeline.machine.ts`

## Goal

Extract the six processing steps embedded in `pipelineMachine` into dedicated, independently exportable XState machines — mirroring the pattern in `app/machines/ai/ai.machine.ts`. `pipelineMachine` becomes a pure orchestrator that invokes these machines instead of raw callback actors.

## Approach: Final-state service machines (Option A)

Each dedicated machine wraps one callback actor from `pipeline.actors.ts`. It is:
- **Invokable** by `pipelineMachine` via `invoke + input + onDone`
- **Standalone-usable** via a `START` event (e.g. with `useMachine` in React)

## The 6 Dedicated Machines

| Machine | Actor wrapped | Input | Output |
|---|---|---|---|
| `languageDetectionMachine` | `detectLanguageActor` | `{ audio, sampleRate, duration }` | `{ language, confidence }` |
| `transcriptionMachine` | `transcribeActor` | `{ audio, sampleRate, duration, language }` | `{ text }` |
| `textCorrectionMachine` | `correctTranscriptActor` | `{ text, language }` | `{ correctedTranscript }` |
| `summarizationMachine` | `summarizeActor` | `{ text, language }` | `{ summary }` |
| `keywordExtractionMachine` | `extractKeywordsActor` | `{ text }` | `{ keywords }` |
| `tagGenerationMachine` | `generateTagsActor` | `{ text, language }` | `{ tags }` |

### State shape (identical for all 6)

```
idle ──[always, guard: hasInput]──► working ──[WORKER.RESULT.*]──► done (final)
     ◄──[START event]────────────────────┘
working ──[WORKER.PROGRESS / STATUS]──► sendParent
working ──[WORKER.ERROR]──────────────► sendParent (no local target; parent's global handler fires)
```

**Dual-mode startup:**
- `context: ({ input }) => ...` initialises from `input` when invoked by `pipelineMachine`
- An `always` transition in `idle` fires immediately when `context.audio` (or equivalent) is non-null — auto-starts without a `START` event
- For standalone use, send `START` with the same payload; the machine processes once then stops at `done`

**Error flow:**
`WORKER.ERROR` is forwarded to the parent via `sendParent`. The machine stays in `working` (no local target). The parent's global `on['WORKER.ERROR']` handler transitions `pipelineMachine` to `error`, which stops the invoked child actor. The child's callback actor cleanup (`cancelled = true`) runs via XState's invoke teardown.

**Output:**
Machine-level `output: ({ context }) => ...` runs when `done (final)` is reached. Parent receives typed output via `event.output` in `onDone`.

## Updated `pipelineMachine`

### Actors section

Six callback actors replaced by six machines:

```typescript
actors: {
  detectHardware: detectHardwareActor,   // unchanged (fromPromise)
  detectLanguage: languageDetectionMachine,
  transcribe:     transcriptionMachine,
  correctTranscript: textCorrectionMachine,
  summarize:      summarizationMachine,
  extractKeywords: keywordExtractionMachine,
  generateTags:   tagGenerationMachine,
}
```

### State changes

Each processing state: `invoke: { src, input, onDone }` replaces `invoke: { src } + on[WORKER.*]`:

| State | `input` | `onDone` assigns |
|---|---|---|
| `detecting_language` | `{ audio, sampleRate, duration }` from `pendingAudio` | `detectedLanguage` |
| `transcribing` | `{ audio, sampleRate, duration, language }` | `pendingTranscript`, clears `transcriptProgress/progress/loadingPhases` |
| `correcting_text` | `{ text: pendingTranscript, language }` | `transcript`, `correctedTranscript`, clears `pendingTranscript/progress/loadingPhases` |
| `summarizing` | `{ text: transcript, language }` | `summary`, clears `progress/loadingPhases` |
| `extracting_keywords` | `{ text: summary \|\| transcript }` | `keywords`, clears `progress/loadingPhases` |
| `generating_tags` | `{ text: summary \|\| transcript, language }` | `generatedTags`, clears `progress/loadingPhases` |

`transcribing` retains its local `WORKER.PARTIAL_RESULT` handler — `transcriptionMachine` forwards this via `sendParent` and `pipelineMachine` handles it with `assignTranscriptProgress` as before.

### Removed from `pipelineMachine`

- Named actions: `assignLanguage`, `assignTranscript`, `assignSummary`, `assignCorrectedTranscript`, `assignKeywords`, `assignTags` — replaced by inline `assign` in `onDone`
- All local `WORKER.ERROR` handlers inside individual states — global handler covers all

### Unchanged

- Global `on` handlers: `CANCEL`, `WORKER.ERROR`, `WORKER.PROGRESS`, `WORKER.STATUS`
- `checking_hardware` state (already uses `fromPromise + onDone`)
- `ready`, `idle`, `error` states
- Named actions: `assignHardwareInfo`, `assignFileAndAudio`, `updateProgress`, `updateModelName`, `assignError`, `assignTranscriptProgress`, `clearPendingAudio`, `clearError`
- All helper functions: `modelNameFromFile`, `phaseFromFile`, `modelNameFromStatus`, `formatFileSize`
- All exports: `PipelineMachine`, `PipelineMachineActor`

## File structure

Everything stays in `app/machines/pipeline/pipeline.machine.ts`. New exports added at the top (before `pipelineMachine`):

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
```

## Type notes

- Each machine declares `types: { events: {} as PipelineEvents | { type: 'START'; ... }, input: ..., output: ... }`
- `PipelineEvents` covers all WORKER.* events the callback actors emit; `START` is added for standalone use
- `sendParent` for forwarded events uses `as any` cast since the parent's event type is unknown at definition time — safe at runtime, parent accepts `PipelineEvents`
- Inline `assign` in `onDone` accesses `event.output` which XState 5 types correctly via machine output inference

## Out of scope

- Changes to `pipeline.actors.ts`
- Changes to `machine.schemas.ts` or `machine.types.ts`
- Changes to `PipelineState` union in `machine.types.ts` (state names unchanged)
- Any consumer of `pipelineMachine` (workers, hooks, components)
