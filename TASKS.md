# Tasks

## Active

- [ ] Orphaned file cleanup — tackle `app/components/` (32 orphans remaining). See `orphaned.md` for full list.
- [ ] Finish package update type errors — `workspaceItem.service.ts` (6 schema mismatches), `stripe.ts` (undefined check), `subscription.ts` (create signature mismatch)
- [ ] Decide search infra: integrate the built-but-unwired `search.repository.ts`, `search.ts`, `filters.ts` — or delete them to reduce dead code. *(deferred — revisit after collections stabilises)*
- [ ] Fix `app/routes/api/shares.ts` — replace `@/services/share-actions` import with relative `../../.server/share-actions` to resolve dot-server plugin build failure (deferred per "skip production build")

## Someday / Low Priority

- [ ] Review and clean 6 stale git stashes (2 have alarming names suggesting past instability)
- [ ] Delete leftover worktree branches: `copilot-worktree-*`, `elderly-monkey`, `tasteless-muskox`, `main1`

## Done

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
