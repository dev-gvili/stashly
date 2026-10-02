# Thumbnail pipeline — XState track

**Status: parallel track, on trial.** Nothing under `app/hooks/` or `app/utils/`
has been changed or deleted. This folder is a complete alternative
implementation of the thumbnail pipeline's *orchestration*, switchable with one
constant, so it can be compared against the original in a real browser before
anything is removed.

## Why this exists

The pipeline's compute was never the problem. Its **scheduling** was spread
across four limiters that didn't know about each other:

| Gate | Where | Cap |
|---|---|---|
| Upload thumbnails | `upload-thumbnail-runner.tsx` | 4, FIFO, promise semaphore |
| Backfill | `useThumbnailBackfill.ts` | 2, LIFO, `paused` boolean |
| Compute worker | `thumbnail.compute.worker.ts` | 1 (PDF.js fake-worker constraint) |
| WebGPU (stage 3) | `ai-queue.ts` | 1, priority-aware |

Effective concurrency was nobody's decision. On top of that: `waitForIdle()`
polled a React Router fetcher ref every 16 ms because a long-lived async
callback had no other way to await one; there was no cancellation; there was no
retry, so a stage-2 timeout meant waiting for a *full re-download* via backfill
to redo work that had been seconds from done; and the whole indexing leg
(metadata → embeddings → minutes of OCR) ran as a `void` promise nobody held.
(Indexing has since moved to its own machine, `app/machines/indexing/`.)

All of those are scheduler problems, which is exactly what a state machine is
for. The stages themselves are a straight line and gain comparatively little —
they are modelled here mainly so cancellation and retry have somewhere to live.

## Layout

| File | Role |
|---|---|
| `thumbnail.types.ts` | Context, events, emitted events, job shape |
| `thumbnail.actors.ts` | `fromPromise` wrappers around the **existing** helpers in `@/utils/thumbnail-pipeline` — no compute logic lives here |
| `thumbnail-item.machine.ts` | One actor per file: the thumbnail stages, nothing else |
| `thumbnail-manager.machine.ts` | The scheduler: two lanes, spawn/settle, pause as a state |
| `attempt-store.ts` | Attempted-once bookkeeping + `sessionStorage` skip list |
| `client.ts` | The module-scope singleton and its imperative API |
| `hooks.ts` | React surface, signature-compatible with the hooks it replaces |
| `index.ts` | `USE_THUMBNAIL_MACHINE` — the switch. **Temporary.** |

```
thumbnailManager (module scope — outlives every component)
├── uploadLane    cap 4, FIFO
├── backfillLane  cap 2, LIFO · states: active | paused
└── spawn(thumbnailItemMachine, { itemId, mode, file })
     └── stages    acquiring? → stage1 → stage2 → presign → put2 → patch2 → stage3 → put3 → patch3
                    ↳ retrying (after 800 ms, budget 2)
```

Search indexing (metadata → embeddings → OCR) used to be a parallel `indexing`
region of the item machine. It is its own queue and machine now, in
`app/machines/indexing/`, queued by the upload runner for every upload. See that
folder's README.

## Decisions worth knowing before editing

- **Plain `fetch`, not `useFetcher`.** A module-scope actor has no component to
  own a fetcher. This is what deletes `waitForIdle`. It also means these calls
  never reload the page's data; the card repaints from the manager's progress
  map. (The one visible write that does need a reload, `save_media_metadata`,
  belongs to indexing: `useIndexingRevalidation()` reloads once per batch.)
- **The retry budget resets on success, never on state entry.** A retry
  re-enters the state that is failing, so `entry: 'resetAttempts'` would wipe
  the counter guarding it and loop forever. This was a real bug, caught by
  `thumbnail-item.machine.test.ts`.
- **Children report with `emit`, not `sendParent`.** An emitted event needs no
  parent, so the item machine unit-tests as a root actor. The cost is three
  explicit `.on(...)` hookups in the manager's `drainLane`.
- **Pause is a state, not a flag.** `drainBackfillNow` is only handled inside
  `backfillLane.active`, so a paused lane cannot start work even if a caller
  forgets to check something.
- **Cancel drops queued jobs only.** A running job's download is already paid
  for. Because the manager outlives every card, its result still persists when
  the card is gone — which is why there is no equivalent of the old
  `patchDetached`.
- **Only backfill failures reach the skip list.** An upload-time failure is
  often transient, and remembering it would block the very backfill that exists
  to recover from it.
- **`attempt-store.ts` duplicates private bookkeeping from
  `useThumbnailBackfill.ts`** and shares its `sessionStorage` key on purpose, so
  flipping the switch inherits the other's skip list. Collapse the two at
  merge-back.

## Merge-back checklist (only after browser sign-off)

1. Delete `app/hooks/useThumbnail.ts`, `app/hooks/useThumbnailBackfill.ts`, and
   `app/hooks/thumbnail-signal/` including the `ACTIVE_SIGNAL` switch.
2. Delete `index.ts`'s switch; export `hooks.ts` directly.
3. Remove the now-vacuous `MAX_CONCURRENT_THUMBNAILS` semaphore and
   `thumbnailedIds` Set from `upload-thumbnail-runner.tsx` — the manager
   dedupes and caps.
4. Make `attempt-store.ts` the only copy.
5. Fix the duplicated `export * from './useThumbnail'` in `app/hooks/index.ts`.
6. Update `app/hooks/README.md`, `app/machines/README.md`, and the
   `stashly-thumbnail-pipeline` skill.
