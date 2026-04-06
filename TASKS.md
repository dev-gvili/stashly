# Tasks

## Active

- [ ] Orphaned file cleanup — 15 files deleted (uncommitted); next: commit deletions, then tackle `app/components/` (34 orphans remaining). See `orphaned.md` for full list.
- [ ] Decide search infra: integrate the built-but-unwired `search.repository.ts`, `search.ts`, `filters.ts` — or delete them to reduce dead code.
- [ ] Review `stashly-dashboard.html` — untracked file, decide: commit, move to docs, or delete

## Someday / Low Priority

- [ ] Review and clean 6 stale git stashes (2 have alarming names suggesting past instability)
- [ ] Delete leftover worktree branches: `copilot-worktree-*`, `elderly-monkey`, `tasteless-muskox`, `main1`

## Done

- [x] Concurrent multipart upload shipped (PRs #7, #8) — 5-parallel-part worker-pool with hardening
- [x] Algolia removed — search migrated to pgvector + embeddings
- [x] E2E test foundation — Playwright, auth + navigation tests, fixtures, POMs
- [x] Dev workflow enforcement — CLAUDE.md + Stop hook
- [x] Orphaned file audit — 60 files catalogued in `orphaned.md`
- [x] CLAUDE.md general instructions — added "prefer action over exploration" directive
- [x] dead-code-verification skill — created for safe orphaned file cleanup workflow
