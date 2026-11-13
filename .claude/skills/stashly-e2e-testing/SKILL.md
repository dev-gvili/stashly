---
name: stashly-e2e-testing
description: Stashly E2E testing with Playwright — the tests/e2e structure, global-setup auth session seeding, fixtures, page object models, and prerequisites. Load when writing, running, or debugging E2E tests in the Stashly repo.
---

# Stashly E2E Tests (Playwright)

Tests live in `tests/e2e/`. Run against `http://localhost` — **port 80, not 3000** (`baseURL` in `playwright.config.ts`). The dev server is auto-started via `webServer`, which runs `pnpm dev` with `reuseExistingServer: true`, so an already-running dev server is reused rather than replaced.

**One seeded user per worker, one worker by default** (`E2E_WORKERS`, default 1, read by `playwright.config.ts` and `constants.ts`). `constants.ts` derives every id from the worker index (`e2eIds(i)`: worker 0 keeps the original ids, worker `i` swaps the last character for the digit `i`, 9 workers at most), and the named exports (`TEST_USER_ID`, `E2E_ITEM_A_ID`, ...) are the ids of the worker that imports them — Playwright sets `TEST_PARALLEL_INDEX` before it loads a spec, so specs keep importing constants and need no change. `global-setup.ts` seeds one user, drive, quota, session (`session.json` for worker 0, `session-<i>.json` otherwise), bucket and item set per worker, plus the one shared "other" user whose three items per worker are shared with that worker's user only; `fixtures.ts` signs in with `testInfo.parallelIndex`; the teardown deletes all nine possible users and their buckets. **A new spec must take its ids from `constants.ts` and never hardcode one**, and a test title must not contain an id (the runner process lists tests with index 0). Playwright hands whole spec *files* to workers, so a spec file is the unit of parallelism.

**CI runs two workers; the runner size decides.** The private repo got a 2-vCPU `ubuntu-latest`, where two workers plus the dev server saturated it (run 43349413318: 7.3 min test step against 5.4–8.6 on one worker, every test 2–3x slower, five `navigation.spec.ts` tests failed on the 5 s hydration timeout). The public repo gets 4 vCPU / 16 GB (the job logs `nproc`): with `E2E_WORKERS=2` two runs of 93 tests passed in 2.3 and 3.8 min against 4.1–5.4 on one worker (run 43361536353, 13 Nov). Don't raise the count without checking `nproc` and a few runs. Locally `E2E_WORKERS=2` ran all 93 in 3.2 min. Older measurement with one *shared* user: 8 workers → 37 passed, 9 failed (2026-10-23).

**Caching the search-indexing model downloads was tried and reverted** (13 Nov). Each test's fresh context downloads the 149 MB embedding model and the onnxruntime wasm, which cost 10–11 s per thumbnail test on a slow home link. Serving them from disk (a 302 to a local file server; `route.fulfill` of 149 MB killed the tab) saved 23 s of 110 s locally, but in CI the e2e step took 4.1 min without it, 4.4 cold and 5.1 warm: the runner downloads fast and run noise (±1 min) hides any gain. Not worth the files and the CI cache step.

Commands: `pnpm test:e2e` (requires dev server) and `pnpm test:e2e:ui` (Playwright UI).

## In CI

The `e2e` job in `.github/workflows/ci.yml` runs every spec on every push (tech-debt item 20): `pnpm dev` on port 80 (the runner allows it with `ip_unprivileged_port_start=80`), its own throwaway pgvector Postgres with `migrate deploy` plus one `free` storage-plan row, Chromium, two workers (`E2E_WORKERS: 2`). Storage is **real Tigris**, with the keys in the repository secrets `AWS_ACCESS_KEY` / `AWS_SECRET_KEY`: `createUserBucket` calls Tigris's own bucket-settings API, so MinIO or another S3 stand-in can't replace it. The HTML report and failed tests' traces are uploaded as the `playwright-report` artifact, pass or fail. 65 passed in 4.1–6.3 min on 1 Nov. A spec that needs a new environment variable needs it in that job too.

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
| `upload.spec.ts` | Upload flow: filing, a row that lands after the reload debounce, server-side quota charge, read-only `/api/quota` |
| `favorites.spec.ts` | Favorites: menu toggle on/off, list, duplicate rows, double favorite, bulk, not-favorited no-op, access control (shared / unshared / revoked / unknown id), 400 on malformed input, signed-out redirect (plus `favorites-debug.spec.ts`, a debugging scratch spec) |
| `pinned.spec.ts` | Pinned items flow |
| `search.spec.ts` | Search flow |
| `thumbnail-machine.spec.ts` | Thumbnail stages for uploaded files (14 pass) |
| `header-responsive.spec.ts` | The app header at 375/768/1024/1280px: no sideways scroll, no header control off screen or overlapping another (clipped controls measured as clipped), the phone "View options" popover. Sets the viewport per test with `page.setViewportSize` |

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
- **With the upload panel open, file names are inside `<main>`.** `dropFiles` opens the panel, and `expectCardInGrid` matches any text in `<main>`, so before a reload it passes on the panel's list alone. It proves a filed row only after a reload (which empties the panel). To assert the grid without one, locate `[data-slot="item-card"]` filtered by the name, as `upload.spec.ts`'s late-rows test does. Its first version passed against the bug it was written for.
- **Hold a request with `page.route`** to reproduce a timing bug: `upload.spec.ts` delays every `create_upload_item` (`request.postData()` carries the intent) past the runner's 700 ms debounce.
- **A metadata save doesn't prove indexing ran.** Since `51ca00d` (tech-debt item 40) a file with nothing to save (a `.bin`, a zip) ends in `indexed` without posting `save_media_metadata`. Read the run's final state from the probe's `indexingLastState` (`helpers/thumbnail-machine.ts`), which follows each run from the queue's `running` map.
- **A page that rewrites its own URL races your click.** `LayoutMenu` writes `?layout=grid` into a clean URL in an effect after hydration, as a navigation of its own. A sidebar click before that is replaced by it, and the page stays on `/stash?layout=grid` (1–3 of `navigation.spec.ts`'s tests failed per full run until 1 Nov; the trace showed no request for the clicked page at all). Wait for the rewrite first: `navigation.spec.ts`'s `gotoStashHome` does `toHaveURL(/[?&]layout=grid/)`, or open the URL with `?layout=grid` already in it.
- **The teardown deletes the E2E user's bucket**, never the placeholder `default-bucket`, retrying up to 5 times: Tigris can answer `BucketNotEmpty` right after the bucket was emptied (CI, 1 Nov: deleted on attempt 2). A failed delete is logged, not thrown.
- **Search has no input of its own.** It searches through the header's search-and-refine dialog (`getByRole('dialog', { name: 'Search' })`, its `searchbox` named "Search"), which writes the `query` URL param, not `q`; open it from the header button named `/^Search/` and retry until it shows (`search.spec.ts`'s `openSearch`). Find the dialog **by name**: on a phone the sidebar sheet is a `dialog` too. Results are `FileCardDetail` cards (`[data-slot="item-card"]`) that open on click; they have no link role, and they paint behind the dialog, so press Escape before clicking one.
