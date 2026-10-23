---
name: stashly-e2e-testing
description: Stashly E2E testing with Playwright — the tests/e2e structure, global-setup auth session seeding, fixtures, page object models, and prerequisites. Load when writing, running, or debugging E2E tests in the Stashly repo.
---

# Stashly E2E Tests (Playwright)

Tests live in `tests/e2e/`. Run against `http://localhost` — **port 80, not 3000** (`baseURL` in `playwright.config.ts`). The dev server is auto-started via `webServer`, which runs `pnpm dev` with `reuseExistingServer: true`, so an already-running dev server is reused rather than replaced.

**One worker** (`workers: 1`). Every spec signs in as the same seeded user, so all of them share one quota, one pin/favorite list and one dev server. With parallel workers (Playwright's default is half the CPU cores) an upload in one file lands inside another file's before/after quota reading, and eight browsers running the thumbnail pipeline against one dev server make hover-then-menu steps time out. Measured 2026-10-23: 8 workers → 37 passed, 9 failed; 1 worker → 51 passed, 1 skipped, 0 failed in 1.9 min.

Commands: `pnpm test:e2e` (requires dev server) and `pnpm test:e2e:ui` (Playwright UI).

## Structure

| File | Purpose |
|------|---------|
| `global-setup.ts` | Seeds test user + session into DB, writes `tests/e2e/.auth/session.json` |
| `global-teardown.ts` | Cleanup after all tests |
| `fixtures.ts` | Exports an authenticated `test` fixture (loads session cookie from `.auth/`) |
| `pages/*.page.ts` | Page Object Models: `auth`, `layout`, `stash`, `upload` |
| `helpers/` | Shared spec helpers |
| `e2e-bucket.ts` | Gives the seeded E2E user a real S3 bucket on first run (`createUserBucket`, same as onboarding); later runs just `HeadBucket` it |
| `constants.ts` | Shared test constants |
| `auth.spec.ts` | Unauthenticated flows (sign-in, redirects) |
| `navigation.spec.ts` | Authenticated navigation flows |
| `upload.spec.ts` | Upload flow |
| `favorites.spec.ts` | Favorites: menu toggle on/off, list, duplicate rows, double favorite, bulk, not-favorited no-op, access control (shared / unshared / revoked / unknown id), 400 on malformed input, signed-out redirect (plus `favorites-debug.spec.ts`, a debugging scratch spec) |
| `pinned.spec.ts` | Pinned items flow |
| `search.spec.ts` | Search flow |
| `thumbnail-machine.spec.ts` | Thumbnail stages for uploaded files (14 pass) |

## Prerequisites

- `.env` must have `DATABASE_URL` and `BETTER_AUTH_SECRET`
- A `free` storage plan must exist in the DB (run `pnpm prisma migrate dev` + seed)

## Seeded users

`global-setup.ts` seeds the E2E user and a **second user** (`OTHER_USER_*` in `constants.ts`) who owns three items: one never shared, one shared with the E2E user for reading, and one shared and then revoked (a `Permission` with `deletedAt`). Use them for access-control cases; `global-teardown.ts` deletes both users, which cascades to their items and grants.

## Auth approach

`global-setup.ts` creates a real DB session and writes a signed `better-auth.session_token` cookie to `tests/e2e/.auth/session.json`. Authenticated specs import `test` from `fixtures.ts`; unauthenticated specs import directly from `@playwright/test`.

The `.auth/` directory and Playwright output dirs (`playwright-report/`, `test-results/`) are git-ignored.

## Gotchas

From `bcb227d`, where `thumbnail-machine.spec.ts` had been red for three reasons, none of them the pipeline. Suspect setup before product code:

- **Uploads failing with `NoSuchBucket` at `createMultipartUpload`** mean the E2E user has no real bucket — the seeded user never goes through onboarding. `e2e-bucket.ts` fixes it; don't reintroduce a hardcoded bucket name.
- **Thumbnails are made only for cards on screen.** Uploading into the stash home page doesn't guarantee the new card is visible, so the thumbnail never starts. Give each upload test its own empty folder.
- **Don't assert `?v=N` suffixes.** Signed thumbnail URLs carry the stage in the signed response filename (`<id>-s2.webp`, `thumbnail-actions.ts`), not a query suffix.
- **Stage 3 needs no WebGPU.** It is native face detection, else a geometric centre crop to 512×512 (`app/workers/thumbnail.ai.ts`; the ViT pass is commented out), so it runs for every image in headless Chromium too. Headless Chromium exposes `navigator.gpu` but `requestAdapter()` returns null — don't gate on either.
- **Stage 3 overwrites the stage-2 object under the same key.** Reading `stage === 2` and then fetching the object races it. Call `waitForIdle` before comparing a reported size to the fetched bytes.
- **Seeded state is reset once per run, not per test.** Specs that toggle a seeded item (favorite, pin) need a separate untouched item for their list test (`E2E_ITEM_C`, `E2E_PIN_ITEM_C`), and `--repeat-each` is meaningless for them — repeat with separate runs.
- **Menu lookups need `exact: true`.** `getByRole('menuitem', { name: 'Favorite' })` also matches *Unfavorite* (and `Pin` matches *Unpin*), which silently does the opposite action.
- **Don't type or click before hydration.** `fill()` on a server-rendered controlled input is undone when React hydrates (it resets to the URL's state), and a click on a server-rendered Radix control does nothing. It only bites when the dev server is slow, so it looks flaky. Retry the action until its effect is observable — `search.spec.ts`'s `typeQuery` fills until `?query=` reaches the URL; the semantic toggle clicks until the radio is checked.
- **Search has no input of its own.** It searches through the header `Filters` box (placeholder `Search…`), which writes the `query` URL param, not `q`. Results are `FileCardDetail` cards (`[data-slot="item-card"]`) that open on click; they have no link role.
