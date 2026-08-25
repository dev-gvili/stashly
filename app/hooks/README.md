# `app/hooks`

Every custom React hook in Stashly. Each hook is documented in full at its
definition (description, `@param`, worked examples) — this file is the map:
what exists, what it's for, and when to reach for it.

## Importing

Most hooks are re-exported from the barrel:

```ts
import { usePagination, useFilters, useUpload } from '@/hooks'
```

These are **not** in the barrel and must be imported from their own module:

| Hook | Import from | Why |
|---|---|---|
| `useSelection`, `useRegisterSelectionItems`, `useSelectionURLSync` | `@/hooks/useSelection` | The module starts an XState actor at import time. The barrel is imported eagerly, so re-exporting it would start the actor during SSR. **Never add it to `index.ts`.** |
| `useThumbnailPublisher`, `useLiveThumbnail` | `@/hooks/thumbnail-signal` | The barrel picks the active signal implementation; both producer and consumer must go through it so a swap changes both sides atomically. |
| `useThumbnailBackfill` | `@/hooks/useThumbnailBackfill` | Also exports the `pauseBackfill` / `resumeBackfill` controls. |
| `useEmbeddingBackfill`, `useEmbeddingBackfillState`, `useRetryEmbeddingBackfill` | `@/hooks/useEmbeddingBackfill` | |
| `useFavorite`, `useFileHref`, `useIndexStats`, `useItemSearch`, `useRecipientRows` | their own modules | |

---

## Items & actions

| Hook | Description | When to use | Notes |
|---|---|---|---|
| [`useFavorite`](./useFavorite.ts#L37) | Optimistically toggles an item's favorited state via `POST /api/favorites`. | Any favorite button or menu entry. | Derived state priority: in-flight `formData` intent → settled response → the `initiallyFavorited` prop. |
| [`usePinItem`](./usePinItem.ts#L37) | Optimistically toggles an item's pinned state via `POST /api/pins`. | Pin / "Pin to top" controls. | Same optimistic pattern as `useFavorite`. |
| [`useLockItem`](./useLockItem.ts#L34) | Optimistically toggles an item's locked state via `POST /api/locks`. | Lock controls, and gating destructive actions on `locked`. | The only one of the three that surfaces a server `error` string. |
| [`useMoveToFolder`](./useMoveToFolder.ts#L30) | Moves one or more items into a target folder via `POST /api/items`. | Move dialogs, "Move here" menu items. | Picks `move_item` vs `move_items` automatically from the id count; pass the *current* parent so the server can repaginate the source folder. |
| [`useItemDragDrop`](./useItemDragDrop.ts#L38) | Drag-and-drop wiring for stash items — files drag, folders accept drops. | Making a card draggable or a folder a drop target. | Dragging an item that's part of the current `?selectedItems=` selection moves the whole selection. Shares `DRAG_ITEM_KEY` with any custom drop handler. |
| [`useItemCard`](./useItemCard.ts#L48) | Reads the nearest `ItemCardContext` — the item plus `user` and the search params. | Inside any `ItemCard` compound sub-component. | **Throws** outside a provider. To use `ItemCard.*` parts elsewhere (e.g. a DataTable row), wrap them in `ItemCardContext.Provider` yourself. |
| [`useConfirm`](./useConfirm.ts#L28) | Opens the imperative confirm dialog without lifting open/close state. | Any destructive action needing a "are you sure?". | Default export. `open()` is fire-and-forget for event handlers; `openAsync()` resolves to the user's choice. |

## Lists, filters & navigation

| Hook | Description | When to use | Notes |
|---|---|---|---|
| [`usePagination`](./usePagination.ts#L59) | Cursor-based infinite scroll over a loader returning `{ items, nextCursor, hasMore }`. | **Every list route** — this is the project convention. | Resets the accumulated list automatically on folder change, redirect, and filter/sort change. The loader must return that exact shape. |
| [`useFilters`](./useFilters.ts#L98) | URL-driven filter state (category / status / type / flags / query / search mode) plus mutation helpers and derived `chips`. | Any filter UI over the item list. | All state lives in the URL, so it's shareable and survives refresh. Every mutation drops `cursor` to reset pagination. `readState()` is exported separately for reading the same state server-side in a loader. |
| [`useSort`](./useSort.ts#L25) | Low-level `orderBy` / `direction` search-param writer. | Only when building custom sort controls. | Prefer `SortPill` for the standard Stashly sort UI — this is the primitive underneath it. |
| [`useSelection`](./useSelection.ts#L60) | Multi-select state for item lists: `selectedIds`, `isChecked`, `toggleAll`, shift-range support. | Checkboxes on cards/rows and bulk-action toolbars. | Backed by a module-scope actor, so it works from any component with no provider. Falls back to reading the URL param when rendered outside `<SelectionProvider>`. |
| [`useRegisterSelectionItems`](./useSelection.ts#L166) | Registers the current route's item IDs with the selection actor. | Once per route that owns a list. | Without it `selectAll` and shift-range selection have no universe to work against. Memoize the array so the effect doesn't re-fire. |
| [`useSelectionURLSync`](./useSelection.ts#L194) | Two-way sync between `?selectedItems=` and the selection actor. | **Internal** — only `<SelectionProvider>` should call it. | Deliberately never writes the URL mid-navigation; doing so interrupts the pending transition and races `usePagination`'s submit. |
| [`useBreadcrumbs`](./useBreadcrumbs.ts#L50) | Reads `crumbs` from the deepest route match that exposes them. | Rendering the breadcrumb trail in a layout. | Returns `null` when no route in the stack has crumbs. Expose them from a loader as `{ crumbs: [{ id, name }] }`. |
| [`useFileHref`](./useFileHref.ts#L24) | Builds the file-page href for a gallery item. | Linking a gallery tile to its item page. | The gallery route is shared by the personal stash and workspaces; this picks the right target from the `:workspaceId` param. `null` when there's no `:me` or no parent folder. |
| [`useScrollRestoration`](./useScrollRestoration.ts#L29) | Per-history-entry scroll restoration for a custom scroll container. | Lists that scroll inside a Radix `ScrollArea` rather than the window. | React Router's `<ScrollRestoration>` only manages `window`. Positions are keyed by `location.key`, so an overlay resetting the scroll on unmount can't corrupt the list's saved position. Pass a **stable** getter (`useCallback`). |

## Search & AI indexing

| Hook | Description | When to use | Notes |
|---|---|---|---|
| [`useItemSearch`](./useItemSearch.ts#L190) | Drives the search page: debounce → keyword pass → optional semantic upgrade. | The search view, and anywhere querying the user's items. | Two passes because embedding runs in-browser on WebGPU and the first call downloads the model. Pass 2 is best-effort: on failure the keyword results stay and `degradedReason` says why — surface it rather than silently ranking worse. |
| [`useEmbeddingBackfill`](./useEmbeddingBackfill.ts#L380) | Arms the runner that heals `SearchChunk` rows saved without a vector. | Mount **once**, in the authenticated layout. | Once per tab (not per mount), idle-scheduled, batched and capped, queued behind other AI work, silent where WebGPU is missing. Extra mounts are no-ops. |
| [`useEmbeddingBackfillState`](./useEmbeddingBackfill.ts#L339) | Live phase / progress / error view of that runner. | Index-status panels. | SSR-safe (`useSyncExternalStore`); every mounted panel sees the same phase. |
| [`useRetryEmbeddingBackfill`](./useEmbeddingBackfill.ts#L362) | Imperative "Run now" retry. | A retry button in a status panel. | Always forces — it bypasses the once-per-tab latch *and* the idle wait, because a user who clicked retry has already seen the automatic run fail. |
| [`useIndexStats`](./useIndexStats.ts#L27) | Re-reads index coverage from the server while `enabled`. | Beside a "not indexed yet" notice. | The loader's snapshot goes stale the moment the backfill embeds anything. Polling only while the notice is on screen keeps this at zero extra requests normally. |

## Upload & thumbnails

| Hook | Description | When to use | Notes |
|---|---|---|---|
| [`useUpload`](./useUpload.ts#L301) | Main interface to the global XState upload machine: queue actions, drag handlers, config. | Upload buttons, drop zones, the upload panel shell. | Subscribes only to rarely-changing state. It deliberately does **not** subscribe to `mediaFiles` — those objects get a fresh identity per progress event, and doing so once caused a render storm that threw "Maximum update depth exceeded". Use the narrow hooks below for per-file data. |
| [`useUploadFileIds`](./useUpload.ts#L170) | Ids of the non-dismissed queue, newest first. | The list container rendering upload rows. | Stable across progress ticks — subscribe here, not to the file objects. |
| [`useUploadCounts`](./useUpload.ts#L196) | Per-status counts (`total` / `uploading` / `pending` / `done` / `aborted`). | Panel headers and summaries. | Numbers only, so no churn between status transitions. |
| [`useUploadFileMeta`](./useUpload.ts#L140) | One file's identity fields plus `status`. | An upload row's header. | Excludes `progress` on purpose. |
| [`useUploadProgress`](./useUpload.ts#L237) | One file's progress (0–100). | The leaf that draws the bar — **never** a list container. | This is the churny subscription; keep it as deep in the tree as possible. |
| [`useUploadStatus`](./useUpload.ts#L260) | One file's lifecycle status. | A status badge or retry affordance. | |
| [`useUploadFile`](./useUpload.ts#L118) | The whole queued-file record. | Only when you genuinely need every field. | Re-renders on every progress tick — prefer the narrow hooks above. |
| [`useThumbnail`](./useThumbnail.ts#L104) | Runs the 3-stage thumbnail pipeline for one item, from the upload path. | The upload thumbnail runner, where the original `File` is still in memory. | Each stage publishes as it lands, so the card paints instantly and sharpens twice. Metadata, search chunks and OCR run alongside stage 2 for **every** file type, thumbnail or not. |
| [`useThumbnailBackfill`](./useThumbnailBackfill.ts#L452) | Viewport-gated on-the-fly thumbnails for items that never got one. | On a card's thumbnail area, inside an `ItemCard`. | Returns a callback ref. A backfill costs a full download, so the guards *are* the feature: viewport-gated, LIFO, concurrency-capped, idle-scheduled, attempted once, and paused while uploads run (`pauseBackfill` / `resumeBackfill`). Stage 3 is skipped deliberately. |
| [`useThumbnailPublisher`](./thumbnail-signal/index.ts#L24) | Producer side of the thumbnail signal — `publishLocal` (stage 1) and `publishPersisted` (stages 2/3). | Inside the pipeline, not in feature code. | Import from `@/hooks/thumbnail-signal`, never a concrete implementation. |
| [`useLiveThumbnail`](./thumbnail-signal/index.ts#L25) | Consumer side — the latest published stage for one item. | An item card that should show a thumbnail as it's being generated. | Prefer it over the loader's persisted URL while the pipeline runs; `null` means nothing published yet. |

## Media viewers

| Hook | Description | When to use | Notes |
|---|---|---|---|
| [`useVideoPlayer`](./useVideoPlayer.ts#L44) | Binds a `<video>` and its container to drive a fully hand-built player. | The video stage — no native controls. | Handles fullscreen with a pseudo-fullscreen fallback when the browser denies `requestFullscreen`; `fullscreen` covers both modes, `pseudoFs` distinguishes them. |
| [`useAudioPlayer`](./useAudioPlayer.ts#L37) | Same idea for an `<audio>` element. | The audio stage. | Exposes a normalized progress fraction `t` (0–1); `seek` takes a fraction, not seconds. |
| [`useScrubber`](./useScrubber.ts#L36) | Turns any element into a pointer-driven scrub surface. | Timelines and volume bars. | Window-level listeners keep the drag alive when the pointer leaves the element. Pairs with either player's `seek`. |
| [`useAutoHideControls`](./useAutoHideControls.ts#L30) | Visibility flag that hides after an idle delay; `ping()` reveals and re-arms. | Media control overlays. | Call `ping()` on pointer movement. `setActive` forces the state — use it to pin controls open while a menu is open. **The default `delay` is `0`**; pass a real value. |
| [`useZoom`](./useZoom.tsx#L53) | Pan-and-zoom state and handlers for a media element. | The image stage. | Scale is clamped to 1–5; translation resets at scale 1 so the element re-centers. Pan handlers no-op at scale 1. |
| [`usePdfDocument`](./usePdfDocument.ts#L29) | Loads a PDF via pdf.js and measures page 1 for layout. | The top of a PDF viewer. | pdf.js is imported lazily so it stays out of the SSR/initial bundle. Cancellable: changing `src` destroys the loading task and aborts in-flight requests. |
| [`useLazyPageCanvas`](./useLazyPageCanvas.ts#L39) | Renders one PDF page to a canvas once it scrolls near the viewport. | Each page row inside the PDF viewer. | Remembers the painted scale, so scrolling a page out and back never repaints — only a zoom change does. Widen `rootMargin` to pre-render further ahead. |

## Platform & utility

| Hook | Description | When to use | Notes |
|---|---|---|---|
| [`useIsMobile`](./use-mobile.ts#L27) | True when the viewport is narrower than a breakpoint. | Swapping layouts or component variants by viewport. | SSR-safe (returns `fallback` on the server). Uses `matchMedia` where available, with a resize-listener fallback. |
| [`useSlots`](./use-slots.ts#L35) | Extracts named slot components out of `children`. | Compound components that render sub-parts in different DOM positions. | Only inspects **direct** children — nested slots aren't detected. Duplicate slots warn and keep the first. |
| [`useClipboard`](./useClipboard.ts#L49) | Copy-to-clipboard with a transient `copied` flag. | "Copy link" / "Copy path" buttons. | Falls back from `navigator.clipboard` to an offscreen-textarea `execCommand`, which covers iOS's gesture-boundary rejection and non-HTTPS origins. |
| [`useStableCallback`](./useStableCallback.ts#L35) | A callback whose identity never changes but always calls the latest function. | Effects that mount something expensive and take callbacks as dependencies. | Exists for the Monaco viewer: a parent passing an inline arrow would otherwise tear the editor down every render. No-op-safe with an undefined callback. |
| [`useNotificationStream`](./useNotificationStream.ts#L96) | Live notification list fed by the SSE route. | The notification bell / panel in the layout. | Seeded from the layout loader, then kept current by one `EventSource`. Uses the native API rather than remix-utils' `useEventSource`, which keeps only the latest event and would drop bursts (mark-all-read emits one UPDATE per row). Reconciles after reconnect and on tab focus. |
| [`useRecipientRows`](./useRecipientRows.ts#L69) | Recipient row state for the invite forms, plus a payload serializer. | `NewInvitationDialog` and `AddRecipientsDialog`. | Shared so both dialogs agree on row identity and payload shape. Always keeps at least one row. `toPayload()` emits the bracket-notation keys the invitations API expects. |

---

## Related non-hook exports

| Export | Module | Purpose |
|---|---|---|
| `DRAG_ITEM_KEY` | [useItemDragDrop.ts](./useItemDragDrop.ts#L9) | The `dataTransfer` key identifying a dragged stash item. |
| `readState` | [useFilters.ts](./useFilters.ts#L55) | Parses `FilterState` out of any `URLSearchParams` — usable in a loader. |
| `pauseBackfill` / `resumeBackfill` | [useThumbnailBackfill.ts](./useThumbnailBackfill.ts#L242) | Yield the thumbnail pipeline to in-flight uploads. |
| `startEmbeddingBackfill` | [useEmbeddingBackfill.ts](./useEmbeddingBackfill.ts#L279) | Arms the embedding runner by hand; `force` bypasses the once-per-tab latch. |
| `upload` | [useUpload.ts](./useUpload.ts#L9) | The module-level upload actor, for advanced selectors and inspection. |
| `selectionActor` | [useSelection.ts](./useSelection.ts#L14) | The module-level selection actor. Must never be re-exported through the barrel. |
| `ItemCardContext` | [useItemCard.ts](./useItemCard.ts#L12) | Provide it manually to use `ItemCard` sub-components outside an `ItemCard` root. |

## Conventions

- Name hooks `use[Feature][Noun]` (e.g. `useShareLinks`) and place them here — see `CLAUDE.md`.
- Anything touching a subsystem (upload, thumbnails, search, gallery) has a matching
  project skill under `.claude/skills/`; load it before editing.
- Every function in this folder carries full JSDoc with worked examples. Keep it that
  way when adding one.
