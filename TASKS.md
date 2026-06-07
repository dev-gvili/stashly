# Tasks

## Active

- [ ] Decide search infra: integrate the built-but-unwired `search.repository.ts`, `search.ts`, `filters.ts` — or delete them to reduce dead code.
- [ ] Migrate flat item API routes — callers of `/api/items/comments` etc. should move to nested `/api/items/:itemId/comments`; remove flat registrations after

## Someday / Low Priority

- [ ] Orphaned file cleanup — tackle `app/components/` (~30 orphans remaining; `item-card-actions.tsx` + `item-card-checkbox.tsx` deleted 2026-04-29). See `orphaned.md` for full list. *(demoted 2026-06-02 — 5 weeks stale, not blocking; re-scan before next pass since the codebase has changed substantially)*

- [ ] **URL model** — central `Url` table for short-link routing, analytics, and expiry. Approach settled: Url owns nullable FKs to each resource (facet pattern, matching `Item`). 1:1 per resource with `@unique` FK cols for now; workspace slug aliasing (1:many) deferred. Path prefixes from `StashlyPrefixMap` (`/ws/:slug`, `/sl/:slug`, `/inv/:slug`). Each resource type gets its own redirect route. Brainstormed 2026-05-16.

- [ ] Fix `app/routes/api/shares.ts` — replace `@/services/share-actions` import with relative `../../.server/share-actions` to resolve dot-server plugin build failure *(deferred)*
- [ ] Review and clean 7 stale git stashes (2 have alarming names: "after im fucked…", "fuck")
- [ ] Delete leftover worktree branches: `copilot-worktree-*` × 4, `elderly-monkey`, `tasteless-muskox`, `main1`; plus shipped branches not yet deleted: `feat/pinned-items`, `feature/sharing-items`, `feat/concurrent-multipart-upload`, `fix/concurrent-upload-hardening`, `feature/invitations`, `e2e-tests`, `blue`, `list`, `split-language-detection`, `refactor/collection-self-relation`

## Done

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
