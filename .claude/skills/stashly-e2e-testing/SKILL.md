---
name: stashly-e2e-testing
description: Stashly E2E testing with Playwright — the tests/e2e structure, global-setup auth session seeding, fixtures, page object models, and prerequisites. Load when writing, running, or debugging E2E tests in the Stashly repo.
---

# Stashly E2E Tests (Playwright)

Tests live in `tests/e2e/`. Run against `http://localhost` — **port 80, not 3000** (`baseURL` in `playwright.config.ts`). The dev server is auto-started via `webServer`, which runs `pnpm dev` with `reuseExistingServer: true`, so an already-running dev server is reused rather than replaced.

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
| `favorites.spec.ts` | Favorites flow (plus `favorites-debug.spec.ts`, a debugging scratch spec) |
| `pinned.spec.ts` | Pinned items flow |
| `search.spec.ts` | Search flow |
| `thumbnail-machine.spec.ts` | Thumbnail stages for uploaded files (13 pass, 1 skip — see Gotchas) |

## Prerequisites

- `.env` must have `DATABASE_URL` and `BETTER_AUTH_SECRET`
- A `free` storage plan must exist in the DB (run `pnpm prisma migrate dev` + seed)

## Auth approach

`global-setup.ts` creates a real DB session and writes a signed `better-auth.session_token` cookie to `tests/e2e/.auth/session.json`. Authenticated specs import `test` from `fixtures.ts`; unauthenticated specs import directly from `@playwright/test`.

The `.auth/` directory and Playwright output dirs (`playwright-report/`, `test-results/`) are git-ignored.

## Gotchas

From `bcb227d`, where `thumbnail-machine.spec.ts` had been red for three reasons, none of them the pipeline. Suspect setup before product code:

- **Uploads failing with `NoSuchBucket` at `createMultipartUpload`** mean the E2E user has no real bucket — the seeded user never goes through onboarding. `e2e-bucket.ts` fixes it; don't reintroduce a hardcoded bucket name.
- **Thumbnails are made only for cards on screen.** Uploading into the stash home page doesn't guarantee the new card is visible, so the thumbnail never starts. Give each upload test its own empty folder.
- **Don't assert `?v=N` suffixes.** Signed thumbnail URLs carry the stage in the signed response filename (`<id>-s2.webp`, `thumbnail-actions.ts`), not a query suffix.
- **Headless Chromium has no WebGPU**, so stage 3 (saliency crop) can't run. Skip with a reason (`test.skip(…)`) rather than asserting a stage that never ran.
