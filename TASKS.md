# Tasks

## Active

- [ ] Migrate flat item API routes — `routes.ts` still registers both a flat top-level path and a nested `items/:itemId/...` path for the same resource: `shares`, `favorites`, `versions`, `invitations`, `comments/*`. Move remaining flat callers to nested and remove the flat registrations after. Note: `pins` and `locks` are flat-only (no nested counterpart) — not part of this migration. *(re-confirmed still open 2026-08-13: flat at routes.ts:50-66, nested at routes.ts:111-123. The UI route space is already clean — only the nested `stash/folders/:folderId/files/:fileId` remains there.)*

- [ ] Finish or revert the favorites revalidation WIP — the changes landed on `main` still mid-debug: `app/routes/api/favorites.ts` has a commented-out `return data({ favorited: false })` (line 38), imports `removeQueryParam` without ever calling it (line 6, single occurrence in the file), and `favorite_items` no longer strips `selectedItems` from the redirect (drops the toolbar-selection reset its own comment describes). The `shouldRevalidate` in `favorites.tsx` looks intentional and worth keeping. *(spotted 2026-07-30 while shipping the thumbnail backfill; no longer uncommitted as of 2026-08-13 — the residue is on `main`)*

## Someday / Low Priority

- [ ] Orphaned file cleanup — tackle `app/components/` (~30 orphans remaining; `item-card-actions.tsx` + `item-card-checkbox.tsx` deleted 2026-04-29; the `dropbox ui/` folder is gone). See `docs/orphaned.md` for the full list. *(still open 2026-08-13; the codebase has changed substantially since the inventory was taken — re-scan before the next deletion pass)*
  - Dead XState machines belong in this pass too: `app/machines/upload/file.machine.ts` (superseded by `machines/reviset/file.machine.ts`, which is what `upload.machine.ts` actually spawns) and three unreferenced queue machines — `machines/actors/queue.machine.ts`, `machines/queue/queue.machine.1.ts`, `machines/reviset/queue.machine.ts`.

- [ ] **URL model** — central `Url` table for short-link routing, analytics, and expiry. Approach settled: Url owns nullable FKs to each resource (facet pattern, matching `Item`). 1:1 per resource with `@unique` FK cols for now; workspace slug aliasing (1:many) deferred. Path prefixes from `StashlyPrefixMap` (`/ws/:slug`, `/sl/:slug`, `/inv/:slug`). Each resource type gets its own redirect route. Brainstormed 2026-05-16.

- [ ] Fix `app/routes/api/shares.ts` — replace `@/services/share-actions` import with relative `../../.server/share-actions` to resolve dot-server plugin build failure *(deferred; import still present at shares.ts:17, re-confirmed 2026-08-13. Wider than one file: 42 route files still import via `@/services/*` — 25 in `routes/api/`, 13 in `routes/stash/`, 2 in `routes/workspaces/`, 1 each in `routes/` and `routes/settings/`.)*
- [ ] Delete the 5 leftover remote branches: `origin/blue`, `origin/e2e-tests`, `origin/feat/concurrent-multipart-upload`, `origin/fix/concurrent-upload-hardening`, `origin/tasteless-muskox` *(2026-08-13: all local branches are already gone — `git branch` shows only `main`.)*

## Done

- [x] Item-page stage loading — `text-stage`, `markdown-stage`, `pdf-stage`, and `code-viewer` now share one `StageSkeletonLoader` with a closed 2px frame while the streamed body resolves. Shipped to `main` `166253f` + `dc1da50` (2026-08-13).
- [x] Stash UI pass — path-rail toolbar, `FileCardDetail` card variant, indigo primary. PR #21 (`7a2393b`, 2026-07-31); groundwork in `c5b61a4` (card variants/surfaces) and `19c266d` (sticky toolbar with server-side library stats).
- [x] Code viewer cross-file go-to-definition — resolves types and definitions across the user's other uploaded files. PR #20 (`f78e533`, 2026-07-31); document outline rail landed first as PR #19 (`f053987`, 2026-07-30).
- [x] Directory drops preserve folder hierarchy — `createUploadedItem()` walks/creates intermediate folders via `findOrCreateFolderPath()` (`item-actions.ts`) and returns the resolved `parentId` instead of flattening everything to `rootId`. Hardened by `271aff0` (duplicate-folder race) and `4611702` (path preserved when normalizing ambiguous `.ts` files), both 2026-07-25.
- [x] Live SSE notifications + observability — `/api/notifications/stream` fed by Postgres LISTEN/NOTIFY (`notification-events.ts`), `NotificationsPanel` bell, `useNotificationStream`; plus `app/.server/metrics.ts` at `/api/metrics` instrumenting the pool / SSE / NOTIFY path. PR #18 (`0348f31`, `8df7efb`, docs `abc48ed`, 2026-07-24). Still open: `/settings/notifications` is a 17-line stub.
- [x] On-demand thumbnail backfill — items with an empty `thumbnails` array now regenerate one from the stored original instead of showing a category icon forever. `useThumbnailBackfill` (viewport-gated shared IntersectionObserver, LIFO queue, 2 concurrent, `requestIdleCallback`-started, pauses during uploads, once-per-item with a sessionStorage failure memo), pure predicates in `utils/thumbnail-backfill.ts` (12 unit tests), `GET /api/thumbnails/:itemId/source` → `getThumbnailSource`. Stage 2 only; stage 3 skipped. Also added `mjs/cjs/mts/cts/vue/svelte/astro/prisma` to the text-thumbnail extension list. Shipped to `main` `2662f56` + `3a0a527` (2026-07-30).
- [x] Stale git stashes cleared — all 7 gone, `git stash list` is empty (confirmed 2026-07-30).

- [x] Server-side Markdown loading — `MarkdownStage` renders from React Router deferred data (`markdownDoc` promise streamed via `<Suspense>`/`<Await>`); added `getObjectText` (s3) + `loadMarkdownDocument` (item-actions); dropped `useMarkdownDocument` hook + `loadMarkdownText`. Shipped to `main` `4695f84` (2026-07-15).
- [x] Enriched invitations feature — received/sent views, status pill, empty state, detail panels; `invitation-actions.ts` + `/api/invitations`; Prisma `invitation.message` + `user.title` (migration `20260712000000`). Shipped to `main` `9ac8714` (2026-07-15).
- [x] Search infra resolved — `search.repository.ts` no longer exists; `utils/search.ts` (searchFactory) is imported by 15+ action files, `utils/filters.ts` (createFilter/buildFiltersFactory) is imported by all 16 per-model `*.filters.ts` files. Both fully wired, nothing to delete. (confirmed 2026-07-02)
- [x] Activity tracking expansion — `CollectionAction` / `FavoriteAction` / `BucketAction` Prisma models with `record*Activity` helpers wired into `collection-actions.ts`, `item-actions.ts` (favorites), `storage-actions.ts` (empty bucket); extended `activity-actions.ts` defaultInclude + `OverviewActivityKind`; UI labels in `app/utils/activity.ts` + `overview-view.tsx`. Shipped in commit `21c1106` (2026-06-02).
- [x] Consolidated Prisma migration — `20260602000000_consolidate_upload_collection_favorite_bucket_actions` captures the `UploadAction` drift + the new action models/columns/FKs. Marked `--applied` (DB was already in sync via prior `db push`). `prisma migrate status` clean. Commit `a60b962` (2026-06-02).
- [x] Pinned items feature — `PinItem` model, `pin-actions.ts`, `/api/pins` route, `usePinItem` hook, optimistic toggle, pinned page at `/:me/stash/pinned`; PR #14 merged (2026-05-15)
- [x] Consolidate temp schemas — `_temp_a/b/c.schemas.ts` merged into `api.schemas.ts` and deleted (2026-05-16)
- [x] CLAUDE.md audit — fixed file.machine active/legacy labels, merged redundant Working Style/Core Rules/General Instructions sections, fixed double-slash typo, removed thin stub section (2026-05-16)
- [x] Item activities feature — fire-and-forget recording in 11 server functions (rename/move/copy/delete/restore/create/comment/version/permission grant+update+revoke), `ActivityFeed` + `ActivityEntry` + `ItemActivityDrawer` components, `/api/activities` route, gallery-image sidebar integration, item card dropdown wired (2026-04-25)
- [x] Sharing items feature — `share-actions.ts`, `/api/shares` route, `ShareDialog`, `ItemCard` wiring, `shares.tsx` shared-with-me view; PR #11 (2026-04-11)
- [x] CLAUDE.md improvements — dot-server plugin gotcha, nullable relation `is` operator, dialog data loading pattern, New Feature Checklist, icon rule hardened (2026-04-11)
- [x] Collection schema refactored — `Collection` model dropped, replaced with `CollectionMember` self-relation on `Item`; `collection-actions.ts` rewritten to use `prisma.item` + `prisma.collectionMember`; all collection intents routed through `/api/collections` (PR #10, 2026-04-10)
- [x] Collection grid view — `CollectionItemCard` + `CollectionItemRow` in `collection-view.tsx`; `CollectionsFillIcon`/`CollectionLineIcon` icons; `GridLayout` on collections list; `CollectionCardItem` slim interface replacing raw Prisma payloads; `remove_item` intent wired end-to-end (2026-04-10)
- [x] Collections UI — `CollectionsView`, `CollectionView`, `CollectionCard`, `RenameDialog`, `AddToCollectionDialog` (full-screen picker with date groups, filter pills, year scrubber); routes wired with loaders/actions
- [x] CLAUDE.md audit — fixed stale architecture sections (layer table, repository/service pattern); added UI conventions (icons, useConfirm, dialog composition, usePagination, SelectionProvider)
- [x] Collection layer refactored — `CollectionRepository` consolidated into `collection-actions.ts`; permission guards, `$queryRaw` optimisations, full JSDoc
- [x] collection-actions.ts integration tests — 54 tests against real DB; caught and fixed 3 bugs (permission hierarchy, dead NOT_FOUND guard, pagination cursor off-by-one)
- [x] Orphaned `.server/repositories` + `.server/services` cleanup — `ItemRepository.ts`, `ItemService.ts`, `CollectionRepository.ts`, `workspace.ts` deleted
- [x] Permission layer consolidated — `permission-actions.ts` is single source of truth; `PermissionRepository.ts` deleted; workspace permission functions moved in
- [x] Concurrent multipart upload shipped (PRs #7, #8) — 5-parallel-part worker-pool with hardening
- [x] Algolia removed — search migrated to pgvector + embeddings
- [x] E2E test foundation — Playwright, auth + navigation tests, fixtures, POMs
- [x] Dev workflow enforcement — CLAUDE.md + Stop hook
- [x] Orphaned file audit — 60 files catalogued in `orphaned.md`
- [x] CLAUDE.md general instructions — added "prefer action over exploration" directive
- [x] dead-code-verification skill — created for safe orphaned file cleanup workflow
