# Thumbnail pipeline

Makes a card's thumbnail when the card comes on screen, and only then.
Search indexing is not part of this folder; it lives in `app/machines/indexing/`.

## How a thumbnail gets made

```
upload finishes → upload runner → holdUploadedFile(id, File)      nothing starts
card on screen  → useThumbnailWhenVisible → requestThumbnail(id)
                     ├─ File held?  → memoryLane    no download, stages 1-2-3
                     └─ not held    → downloadLane  download, stages 1-2
card leaves     → cancelQueuedThumbnail(id)        drops a queued job only
```

Every job starts the same way: a card was seen without a thumbnail. Nothing is
made for a card nobody has looked at, including fresh uploads and the contents
of a folder trashed mid-batch. Where the bytes come from decides the lane:

| Lane | When | Cap | Order | Paused |
|---|---|---|---|---|
| `memoryLane` | the file was uploaded in this tab and is still held (`held-files.ts`) | 4 | newest first | never |
| `downloadLane` | no file in memory; the original is downloaded (≤ 16 MB) | 2 | newest first | while uploads move bytes |

## Layout

| File | Role |
|---|---|
| `thumbnail.types.ts` | Context, events, emitted events, job shape |
| `thumbnail.actors.ts` | `fromPromise` wrappers around the helpers in `@/utils/thumbnail-pipeline`; no compute here |
| `thumbnail-item.machine.ts` | One actor per job: the thumbnail stages |
| `thumbnail-manager.machine.ts` | The scheduler: the two lanes, start/finish, pause as a state |
| `held-files.ts` | Uploaded files waiting for their card to be seen |
| `attempt-store.ts` | "Already tried" per kind of job, plus the `sessionStorage` skip list for downloads |
| `client.ts` | The tab's manager instance and the functions that drive it |
| `hooks.ts` | `useThumbnailWhenVisible`, `useLiveThumbnail` |
| `index.ts` | Public exports |

## Decisions worth knowing before editing

- **Visibility is the only trigger.** The upload runner never starts thumbnail
  work; it only holds the file. A card already on screen when its file
  arrives re-checks itself (it subscribes to `held-files.ts`), and a queued
  download job for it switches to memory (`fileHeld`).
- **A thumbnail painted in this tab counts as done.** The card's `thumbnails`
  come from the loader and stay empty until the page reloads, so
  `requestThumbnail` and the hook both check the manager's progress map; without
  that a finished card would ask again.
- **"Already tried" is per kind of job.** A failed memory job releases its file
  and leaves one download attempt open. Only download failures reach the
  `sessionStorage` skip list, since only they cost a full download each time.
- **Plain `fetch`, not `useFetcher`.** A module-scope actor has no component to
  own a fetcher, and these writes must not reload the page's data; the card
  repaints from the manager's progress map.
- **The retry budget resets on success, never on state entry.** A retry
  re-enters the failing state, so `entry: 'resetAttempts'` would wipe the
  counter guarding it and loop forever.
- **Children report with `emit`, not `sendParent`**, so the item machine tests
  as a root actor. The cost is the explicit `.on(...)` hookups in `startJobs`.
- **Pause is a state, not a flag.** `startQueuedDownloads` is only handled in
  `downloadLane.active`, so a paused lane cannot start work by construction.
- **Cancel drops queued jobs only.** A running job's work is already paid for,
  and because the manager outlives every card, its result still lands.

## Still to do

The item machine keeps its numbered state names (`stage1`, `putting2`, …) and
has no state descriptions yet; its rewrite, and splitting
`@/utils/thumbnail-pipeline.ts` by file type, are the next refactor phase.
