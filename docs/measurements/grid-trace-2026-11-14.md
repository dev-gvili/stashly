# Grid page and its workers: clean trace, production build (14 Nov 2026)

Measurement only. No product code changed. Two probes were added for the runs and removed afterwards (see Method). Every number below comes from a run listed here. Where a number is a bound or an estimate, the text says so.

## Why this exists

The owner's DevTools AI export of `/stash/?layout=grid` couldn't be used. It was recorded on the `:80` dev server (unbundled modules, HMR, React dev build: its `createTask` 292 ms and "Run console task" 365 ms are React 19 dev owner stacks), with extensions on (Jam took 344 ms of main thread), in one cold run, and it never opened the worker threads.

## Method

- **Build:** `pnpm build` then `pnpm start` from the `stashly-frontend-dev` worktree at `def9cdd` on `:8081`. Production React, bundled.
- **Browser:** Chromium 1.63 bundled with the repo's test runner, launched headed with a fresh persistent profile and no extensions. Viewport 1440×900, `--enable-unsafe-webgpu`.
- **Account:** the dev test account `usr_1ChRcO-xAFDC9VIUtglS7g` (`collab-test@test.local`), not the owner's. Its session row was renewed for two days with the owner's approval. Its stash held only what these runs uploaded: the 37 PDFs of `X:\pdfs` (295 MB), uploaded twice. No photos.
- **Trace:** CDP `Tracing` on the page with `devtools.timeline`, `disabled-by-default-devtools.timeline`, `toplevel`, `v8.execute`, `loading` and related categories. That records every renderer thread, so each dedicated worker is profiled on its own thread.
- **Per-thread numbers:** "busy" is the sum of top-level `ThreadControllerImpl::RunTask` slices on that thread, non-overlapping. "Long" means a task over 50 ms. The buckets are self-time grouped by event name and are approximate.
- **In-page counters (init script):** `window.Worker` patched to count boots and messages in each direction per worker; `PerformanceObserver` for LCP, `longtask` and `long-animation-frame`; resource buffer raised to 10,000.
- **Temporary probes, removed afterwards and never committed:**
  1. A marker on `FileCardDetail`, plus a stub React DevTools hook (React reports every commit to it, in production too), to count, per commit, the cards present, re-rendered or untouched (fiber identity), and the passive effects that ran inside them (fibers with React's `Passive` flag, effects tagged `HasEffect`). Probe runs are separate from traced runs, so the walk doesn't show up in the traces.
  2. An XState `inspect` on the `uploadManager` actor that records every inspection event.
- **Runs:** first a cold warm-up (not counted). Then two upload runs started from Home, three plain loads of Home (`/stash?layout=grid`, the URL in the export), three plain loads of the folder grid (`/stash/folders/item_M3ROPvfDtv-ZJlEHu8B9GQ?layout=grid`, 74 PDFs, 50 cards on the first page), and eight probe runs (one Home, one of a mistyped URL caused by a shell path rewrite, six of the folder grid). Each plain run traces 12 s after `load`.

Note: for this account, Home shows "Your stash is empty" and no file cards, because the uploads went into a `pdfs` folder. Home therefore can't exercise `FileCardDetail`; the folder grid is the page that does.

## Plain load, no upload

| Run | LCP | Main tasks | Main busy | Longest main task | Tasks > 50 ms | Workers booted |
|---|---|---|---|---|---|---|
| Home 1 | 588 ms (H1) | 4,922 | 545.1 ms | 66.9 ms | 2 | embedding (3 to / 3,879 from) |
| Home 2 | 540 ms (H1) | 2,966 | 486.4 ms | 80.5 ms | 3 | embedding (3 to / 1,976 from) |
| Home 3 | 552 ms (H1) | 882 | 333.6 ms | 61.1 ms | 2 | none |
| Folder 1 | 1,680 ms (IMG) | 1,218 | 1,023.1 ms | 143.2 ms | 5 | none |
| Folder 2 | 1,272 ms (IMG) | 1,132 | 575.2 ms | 82.5 ms | 3 | none |
| Folder 3 | 1,144 ms (IMG) | 1,283 | 731.1 ms | 82.9 ms | 3 | none |

Main thread by activity (self time, ms), plain loads:

| Run | Scripting | Style + layout | Parse + load | Paint + decode | GC | Other |
|---|---|---|---|---|---|---|
| Home 1 | 294.8 | 83.3 | 22.3 | 3.3 | 12.1 | 22.7 |
| Home 2 | 211.4 | 71.6 | 20.7 | 2.9 | 9.9 | 16.9 |
| Home 3 | 165.0 | 77.4 | 18.6 | 3.0 | 6.4 | 15.6 |
| Folder 1 | 543.0 | 235.1 | 44.7 | 19.8 | 23.7 | 23.2 |
| Folder 2 | 283.1 | 135.7 | 38.5 | 13.9 | 17.7 | 21.3 |
| Folder 3 | 318.2 | 220.2 | 40.3 | 21.6 | 20.8 | 30.4 |

What the long tasks hold, on every plain load:

- A **layout** task of 55–103 ms (`Layout` 41–65 ms plus `UpdateLayoutTree`) right after the first paint.
- **Module evaluation** (`v8.evaluateModule`) of 45–92 ms: the client entry.
- On the folder grid, a **React scheduler task** (`MessagePort.onmessage` in `entry.client`, by long-animation-frame attribution) of 79–143 ms: the render and commit of the 50 cards. A document-script task of 64–104 ms precedes it (the streamed route data).

No plain load had a main-thread task near the dev trace's 500 ms / 306 ms `performWorkOnRoot`. Those were dev-build costs.

## During a folder upload (37 PDFs, 295 MB, started from Home)

| | Upload 1 | Upload 2 |
|---|---|---|
| Window traced | 52.7 s | 185.0 s (hit the 180 s cap, see note) |
| Main tasks / busy | 14,537 / 3,234.5 ms | 13,307 / 3,917.6 ms |
| Longest main task | 195.3 ms at T+4.0 s (FunctionCall 123, microtasks 59) | 315.3 ms at T+4.2 s (FunctionCall 201, microtasks 93) |
| Main tasks > 50 ms | 4 | 5 |

Each worker on its own thread:

| Worker | Run | Boot at | Messages to / from | Tasks | Busy | Longest task | > 50 ms |
|---|---|---|---|---|---|---|---|
| hash.worker | 1 | 3.9 s | 37 / 37 | 4,925 | 1,449.9 ms | 40.4 ms | 0 |
| hash.worker | 2 | 4.0 s | 37 / 37 | 4,363 | 1,676.3 ms | 44.1 ms | 0 |
| thumbnail.compute.worker | 1 | 5.7 s | 74 / 75 | 9,553 | 3,550.1 ms | 1,468.7 ms | 11 |
| thumbnail.compute.worker | 2 | 5.6 s | 159 / 160 | 26,725 | 39,180.5 ms | 1,481.3 ms | 99 |
| embedding.worker | 1 | 38.0 s | 1 / 3,565 | 5,294 | 2,762.4 ms | 1,186.3 ms | 4 |
| embedding.worker | 2 | 0.8 s | 15 / 2,330 | 2,420 | 3,563.8 ms | 1,235.9 ms | 9 |
| paddle-ocr worker | 2 | 54.3 s | 91 / 90 | 17,829 | 37,545.7 ms | 450.1 ms | 260 |

The workers' long tasks are mostly `RunMicrotasks` (PDF.js and model code) plus `DecompressionStream Inflate` in the compute worker. They run off the main thread, so they don't block input. Run 2 spent far longer in the compute and OCR workers because its 180 s window covered indexing of the second copy: the OCR lane started at T+54 s.

Note on the upload window: the runner stopped 15 s after the last `POST /api/items`. That counter also counts indexing intents to the same route, so run 2 never went quiet and stopped at the 180 s cap. These runs measure thread load during an upload; they are not end-to-end upload timings (for those, see `upload-pdfs-2026-11-14.md`).

## FileCardDetail

Probe runs on the folder grid (50 cards). The counts below come from the five runs made after the probe's fixes (`probe-folder-1` to `-5`); all five gave identical counts. The flush column comes from runs 4 and 5, the only ones that timed it. An earlier probe run, made while the cards' thumbnails were still being generated, saw 21 commits instead of 3 (live thumbnail repaints); its effect counts came from the first, stale-flag version of the probe and are not used.

| Commit | Cards re-rendered | Card fibers that did work | Passive effects inside cards | Passive effects, whole tree | Commit → passive effects flushed |
|---|---|---|---|---|---|
| 1 (mount) | 50 | 2,800 | 600 (12 per card) | 836 | 13.3–15.6 ms |
| 2 | 50 | 2,700 | 150 (3 per card) | 160 | 1.4–2.0 ms |
| 3 | 0 (subtrees only) | 2,200 | 50 (1 per card) | 51 | not reported |

Three commits touch the cards on a plain load, with 800 passive effects in the cards in total. The flush timing is an upper bound: it runs from the end of React's commit to React's post-passive-effects callback, so it includes everything else in between. By share of effects, the cards account for at most about 11 ms of the 13.3–15.6 ms mount flush, inside a React task of 79–143 ms that is mostly render, commit and the layout that follows.

**Not a hotspot.** Debouncing `requestThumbnail` (the export's suggestion) would not move these numbers. On a warm load no thumbnail worker even boots, because every card already has its thumbnail.

## The upload machine on a plain load

On every run without an upload (15 runs: the warm-up, three Home, three folder-grid traced runs, and eight probe runs), the `uploadManager` actor logged exactly **6 inspection events**: its creation, `xstate.init` (event and snapshot), one `upload.config` event (sent by `useUpload`, `app/hooks/useUpload.ts:509`, once on mount), its microstep, and its snapshot. The last of the 6 came 47–249 ms after the first. After that, nothing for the rest of the 12 s. No child actors are spawned and there are no further transitions. **The upload machine is idle on a plain load.** During an upload it logged 2,626–2,627 events (260 child actors, 84 part-progress events per run, 148 promise resolutions).

## Hotspot found: embedding worker progress messages

When the embedding worker boots (the search-embedding backfill, or indexing after an upload), it sends **1,976–3,879 messages** to the main thread for 1–15 requests: transformers.js `progress_callback` events, forwarded one by one as `{ type: 'progress' }` (`app/workers/embedding.worker.ts:49`). Each arrives as a main-thread task. **No caller uses them.** All four callers of `embedTexts` / `embedText` (`useItemSearch.ts:254` and `:303`, `useEmbeddingBackfill.ts:236`, `indexing.actors.ts:80`) pass no `onProgress`, so `embedding.ai.ts:88` drops every one.

Evidence, Home plain loads: with the worker booted, 4,922 and 2,966 main tasks and 545.1 / 486.4 ms busy; without it, 882 tasks and 333.6 ms. That is about 2,100–4,000 extra tasks and 150–210 ms of main-thread time per boot. (Home 1 and 2 also ran the backfill's embedding work, so not all of the difference is the messages. The task count difference is.)

**Fix (owner approved, 15 Nov):** the request carries `wantsProgress`, set only when the caller passes `onProgress`, and the worker gives transformers.js a `progress_callback` only then. Without a listener, the messages are never produced in the first place, rather than dropped on arrival.

**After the fix:** same build procedure, same runner, same account, same pages:

| Run | Embedding messages to / from worker | Main tasks | Main busy |
|---|---|---|---|
| Home before 1 | 3 / 3,879 | 4,922 | 545.1 ms |
| Home before 2 | 3 / 1,976 | 2,966 | 486.4 ms |
| Home, no worker booted | n/a | 882 | 333.6 ms |
| Home after 1 | 10 / 9 | 1,095 | 409.5 ms |
| Home after 2 | 3 / 3 | 992 | 455.8 ms |
| Upload before 1 | 1 / 3,565 | 14,537 | 3,234.5 ms |
| Upload before 2 | 15 / 2,330 | 13,307 | 3,917.6 ms |
| Upload after 1 | 14 / 14 | 12,651 | 3,454.0 ms |

The worker now sends one reply per request. On Home, main-thread tasks with the worker booted fell to within 110–213 of a load with no worker at all. The busy-time change is smaller and noisy, because those loads also run the backfill's real embedding work and its writes. In "Home after 1", one of the 10 requests had not been answered when the 12 s window closed.

## Not measured, and why

- **The owner's own account and photos:** excluded on purpose (owner, 14 Nov). Home with real file cards was therefore not measured; the folder grid stands in for it.
- **Per-component render time inside the React task:** production React has no Profiler timings. Counts and the flush bound above are what a production build can give without a profiling build.
- **GPU process time:** the trace covered the renderer only.
