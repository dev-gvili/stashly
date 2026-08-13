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
| `pages/*.page.ts` | Page Object Models: `AuthPage`, `LayoutPage`, `StashPage` |
| `constants.ts` | Shared test constants |
| `auth.spec.ts` | Unauthenticated flows (sign-in, redirects) |
| `navigation.spec.ts` | Authenticated navigation flows |
| `upload.spec.ts` | Upload flow |
| `favorites.spec.ts` | Favorites flow (plus `favorites-debug.spec.ts`, a debugging scratch spec) |
| `pinned.spec.ts` | Pinned items flow |

## Prerequisites

- `.env` must have `DATABASE_URL` and `BETTER_AUTH_SECRET`
- A `free` storage plan must exist in the DB (run `pnpm prisma migrate dev` + seed)

## Auth approach

`global-setup.ts` creates a real DB session and writes a signed `better-auth.session_token` cookie to `tests/e2e/.auth/session.json`. Authenticated specs import `test` from `fixtures.ts`; unauthenticated specs import directly from `@playwright/test`.

The `.auth/` directory and Playwright output dirs (`playwright-report/`, `test-results/`) are git-ignored.
