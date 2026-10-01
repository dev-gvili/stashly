# Stashly Tech Debt Register

*Whole-repo audit · 24 Sep 2026 · scored as Priority = (Impact + Risk) × (6 − Effort), each 1–5*

## Summary

**At the audit (24 Sep):** Stashly already had good habits: subsystem docs and skills, bugs root-caused in TASKS.md, and a type baseline. Most of the debt sat around the code rather than in it. Nothing ran automatically (no CI, lint or error tracking), the deploy path didn't build, and thumbnails of private files were publicly readable.

**Now (1 Oct):** the safety net is mostly in place.
- **CI:** every push to `main` applies the migrations to a real Postgres and runs the typecheck, all 607 unit tests with none excluded, and the build. It also migrates and boots the production image against that database, and checks that it answers `/api/health` 200 with a database and 503 without one. The type baseline is down from 249 errors to 11, and CI won't let it loosen.
- **Deploy:** the image builds on Node 24 with pnpm, and `fly.toml` runs migrations before each release.
- **Thumbnails:** reads are signed and uploads are private.
- **Still missing:** error tracking and a linter. Both need a new package, which needs the owner's decision.

**17 items** · 6 high priority · categories: Code 7, Architecture 4, Infrastructure 3, Dependency 1, Documentation 1, Test 1

**Status at 1 Oct 2026:** 8 resolved · 1 resolved in code, rollout step unconfirmed · 2 partly done · 1 declined · 5 open. Each item's details end with a dated **Status** line naming the commits; [Changes since the audit](#changes-since-the-audit) lists them by date.

### What's left, in priority order

| # | Item | What remains | Blocked on |
|---|------|--------------|------------|
| 4 | Error tracking and logging | All of it | Owner's choice of package (Sentry, pino or both) |
| 2 | Deploy path | The first real `fly deploy` and its release migration | Creating the Fly app and setting secrets |
| 10 | Accessibility and responsive UI | All of it | — |
| 12 | Linter | All of it, plus the `as any` ban moved here from item 7 | Owner's OK on new packages |
| 13 | Tests where the risk is | `item-actions`, quota and permission tests; a Postgres service in CI for the DB tests | — |
| 14 | Two thumbnail orchestrators | Move the upload runner off `useThumbnail` | The owner's visual sign-off on the XState pipeline |
| 16 | Overlapping UI primitives | 5 `@radix-ui/*` importers, 3 global stylesheets | — |
| 17 | Unfinished migrations | Workspace stubs, unregistered `workspaces/create.tsx`, duplicate flat/nested API routes | — |

Items marked *TASKS.md* are already root-caused in your backlog; this register scores them alongside new findings so they can be sequenced together.

## Prioritized register

| # | Item | Type | I | R | E | Priority | Effort | Status |
|---|------|------|---|---|---|----------|--------|--------|
| 1 | ~~No CI: nothing runs typecheck, tests or build automatically~~ | Infrastructure | 4 | 4 | 2 | **32** (High) | 0.5–1 day | Resolved |
| 2 | Deploy path is broken and runs an end-of-life Node | Infrastructure | 3 | 5 | 2 | **32** (High) | 1–2 days | Resolved in code; first `fly deploy` unconfirmed |
| 3 | ~~Two known 500s on ordinary requests~~ | Code | 3 | 3 | 1 | **30** (High) | 0.5 day | Resolved |
| 4 | No error tracking or structured logging | Infrastructure | 3 | 4 | 2 | **28** (High) | 1 day | Open |
| 5 | ~~Thumbnails of private files are publicly readable~~ | Architecture | 4 | 5 | 3 | **27** (High) | 3–5 days | Resolved |
| 6 | ~~Unused, unpinned and unmaintained dependencies~~ | Dependency | 2 | 3 | 1 | **25** (High) | 0.5 day | Resolved |
| 7 | ~~The type baseline is stale, and escape hatches are growing~~ | Code | 3 | 3 | 2 | **24** (Medium) | 1–2 days | Resolved |
| 8 | ~~Data-integrity gaps in loaders and deletes~~ | Code | 2 | 4 | 2 | **24** (Medium) | 1–2 days | Resolved |
| 9 | ~~Failed uploads leave S3 bytes and charged quota with no Item~~ | Architecture | 3 | 4 | 3 | **21** (Medium) | 2–3 days | Resolved |
| 10 | UI accessibility and responsive debt | Code | 4 | 3 | 3 | **21** (Medium) | 5–8 days | Open |
| 11 | ~~Generated and personal files in git~~ | Documentation | 2 | 2 | 1 | **20** (Medium) | 0.5 day | Resolved |
| 12 | No linter | Code | 2 | 2 | 2 | **16** (Medium) | 1 day + fixes | Open |
| 13 | Tests are missing where the risk is | Test | 4 | 4 | 4 | **16** (Medium) | ongoing, ~2 weeks | Open |
| 14 | Two thumbnail orchestrators | Architecture | 3 | 2 | 3 | **15** (Low) | 2–3 days | Open |
| 15 | `item-actions.ts` god module | Code | 3 | 2 | 3 | **15** (Low) | 3–5 days, incremental | Declined |
| 16 | Overlapping UI primitives | Code | 2 | 1 | 2 | **12** (Low) | 2–3 days | Partly done |
| 17 | Unfinished migrations left in place | Architecture | 2 | 2 | 3 | **12** (Low) | 2–4 days | Partly done |

## Details

### 1. No CI: nothing runs typecheck, tests or build automatically

*Infrastructure debt · Impact 4 · Risk 4 · Effort 2 → **32** · est. 0.5–1 day · source: new*

- **Evidence:** `.github/` holds only Copilot instructions and prompts, with no `workflows/`. The only guard is `.claude/hooks/check-staged-types.mjs`, which fires on `git commit` only when the commit goes through Claude Code. A commit from a terminal or the IDE skips it. 2 of 305 commits since June are `test:` commits.
- **Fix:** Add one GitHub Actions workflow on push/PR: `pnpm install --frozen-lockfile`, `pnpm typecheck` (against the tsc baseline), `pnpm test`, `pnpm build`. Add Playwright e2e later as a separate job.
- **Why it matters:** Every other fix on this list is only as durable as the check that stops it regressing. This one is cheap and protects all the others.
- **Resolved 2026-09-30** (`b95cdd5`). `.github/workflows/ci.yml` runs on every push to `main` and every PR. It installs with `--frozen-lockfile`, then runs the typecheck, the unit tests and `pnpm build`. The first run passed on GitHub in 1m53s.
  - **Typecheck:** reuses `check-staged-types.mjs` with a new `--all` flag, which checks every file against `.claude/tsc-baseline.json` rather than only the staged ones. It also fails if tsc dies without reporting any errors, so an empty result can't pass as clean.
  - **The first version was dishonest, reworked 2026-10-01** (`e6ac762`..`e506455`). The owner pointed out that its green results proved less than claimed:
    - The docker job passed on an `/api/health` that was a `// TODO` stub returning 200, against a `DATABASE_URL` that didn't exist.
    - The check job excluded three test files. Their failures were real: two wording strings a refactor had changed silently (one reversing a deliberate fix), and three stale collection tests.
    - `filters.test.ts` passed by asserting a bug: invalid filter values were dropped, which widened queries.
    - Vitest's agent-mode `minimal` reporter hid console output and errors from passing tests in Claude Code sessions.
  - **Now:**
    - Both jobs use a `pgvector/pgvector:pg17` service.
    - `/api/health` runs `SELECT 1`.
    - The release command migrates from the image.
    - A container with no database must answer 503.
    - Every test runs, and all server logs print, pass or fail.
    - The reporter is pinned to `default`.
    - Invalid filter values throw a 400.
  - **What turning it on found:** before the first push, it caught two regressions already on `main`. One was a type error from the dead `/recent` link, fixed in `1f030cf`; the commit hook missed it because the file wasn't staged. The other was a page-size test left at 25 after `3798c2c` raised the default to 50, fixed in `14f2ca9`.
  - **Actions:** bumped to `checkout@v7`, `setup-node@v7` and `cache@v6` to clear GitHub's warning that Node 20 is deprecated.

### 2. Deploy path is broken and runs an end-of-life Node

*Infrastructure debt · Impact 3 · Risk 5 · Effort 2 → **32** · est. 1–2 days · source: new*

- **Evidence:** `Dockerfile` runs `npm ci` and copies `package-lock.json`, but the repo uses pnpm and has no `package-lock.json`, so the image can't build. The base image is `node:20-alpine`, and Node 20 reached end of life on 30 Apr 2026. `.dockerignore` excludes only `.react-router`, `build`, `node_modules` and `README.md`, so `COPY . /app` sends `.env`, `.git` and `.chat-history` into the build context. There's no `fly.toml` for the app, even though `deploy/README.md` says step 3 is "repo root", and no step runs `prisma migrate deploy`.
- **Fix:** Rewrite the Dockerfile for pnpm (`corepack enable`, `pnpm fetch` / `install --frozen-lockfile --prod`) on Node 22 or 24 LTS. Add `.env*`, `.git`, `.chat-history`, `copilot_exports`, `tests`, `playwright-report` and `models` to `.dockerignore`. Commit a `fly.toml` with `release_command = "pnpm prisma migrate deploy"`. Pin Node via `engines` and `packageManager`.
- **Why it matters:** Today a deploy would fail, or would run on a runtime that gets no security patches. Secrets in a build context get uploaded to remote builders.
- **Status 2026-09-30: resolved in code** (`e8a61eb`, `326c317`, `eda8fc7`).
  - **`Dockerfile`:** builds with pnpm 12.4.1 on `node:24-bookworm-slim`. It uses Debian because `onnxruntime-node` ships one Linux build per architecture linked against glibc, needing GLIBC_2.28 with no musl variant, so it can't load on Alpine. This was checked in the shipped binaries on 2026-10-01. The earlier reason also named `webgpu`, which item 6 has since removed. It runs as the non-root `node` user on port 8080.
  - **`fly.toml`:** app `stashly` in `iad`, with `release_command = prisma migrate deploy`, a health check on `/api/health`, one machine always running for the notification streams, a higher request limit, and a shared-CPU 1 GB VM. The VM size is a guess.
  - **`.dockerignore`:** now excludes `.env*`, `.git`, chat history and tooling.
  - **Dependencies:** `prisma` moved to dependencies, because the release command runs it and `postinstall` needs it.
  - **CI `docker` job:** builds the image, runs `prisma validate` in it, and boots it until `/api/health` answers 200. The first run found two bugs that would have broken the deployed app:
    - `clsx` and `tailwind-merge` were devDependencies the server loads at runtime, so every request returned 500. They're now dependencies (`326c317`).
    - `app/.server/stripe.ts` throws when the module loads if `STRIPE_SECRET_KEY` is unset, which also broke every request. CI now sets a placeholder, and the deploy README flags the secret as required.
  - **`deploy/README.md` step 3:** lists the 22 secrets (20 required, plus 2 optional pool settings). `BETTER_AUTH_URL` isn't in our code's `process.env` reads; it was found through Better Auth's boot warning.
  - **Not verified:** a real `fly deploy`, and whether the release command works against prod.
  - **Not done:** pinning Node with `engines` and pnpm with `packageManager` in `package.json`.

### 3. Two known 500s on ordinary requests

*Code debt · Impact 3 · Risk 3 · Effort 1 → **30** · est. 0.5 day · source: TASKS.md*

- **Evidence:** Both are already root-caused in TASKS.md. A denied item returns 500 instead of 403, because `StashlyError` isn't a `Response` and React Router's `sanitizeError` rewrites it. `/:me/stash/trash` without `?layout=` returns 500 because `null` goes into a non-nullable `Thumbnail.view` filter (`trash.tsx:93,142,175`).
- **Fix:** Throw `data(…, { status: 403 })` from `assertItemAccess`. Default `layout` to `'grid'` in `trash.tsx`, and use the same parser every route uses.
- **Why it matters:** A clean trash link is the kind of URL people bookmark and share, and it fails today. Returning 500 for a permission denial pollutes error metrics once they exist (see Observability).
- **Resolved.**
  - **403 half:** fixed in `8ab1249` on 2026-09-12, which was *before* this audit, so the TASKS.md entry it was taken from was already stale. `toRouteError` throws `data(…, { status })`, which React Router's `sanitizeError` leaves alone, and `assertItemPermission` throws it with `FORBIDDEN`.
  - **Trash half:** fixed in `3e681bc` on 2026-09-24. The loader defaults `layout` to `'grid'`, the same `?? 'grid'` fallback the gallery uses; the commit notes there's no shared server-side layout parser to reuse. `af779ee` pins it with a test. That fix made the page load, but `GridLayout` still rendered nothing without `?layout=grid`, so `8cb73a7` (2026-09-25) writes the parameter into the URL.
  - **Still open:** an unknown value such as `?layout=bogus` reaches Prisma unvalidated, a separate 400-vs-500 gap noted in `3e681bc`.

### 4. No error tracking or structured logging

*Infrastructure debt · Impact 3 · Risk 4 · Effort 2 → **28** · est. 1 day · source: new*

- **Evidence:** `server.js` has `morgan` access logs only. There's no Sentry, OpenTelemetry, pino or equivalent anywhere in `app/.server` or `server.js`, and there are 40 `console.log` calls in app code. The thumbnail-signing revert (`4d84ea9`) found silent upload loss (16 of 16 files missing an `Item` row) only because someone reported it.
- **Fix:** Add an error tracker to the server entry and the root `ErrorBoundary`, and a JSON logger with a request id. Replace `console.log` in `.server` code with the logger.
- **Why it matters:** Upload loss, quota drift and 500s are all currently invisible until a user complains.
- **Status 2026-10-01: open** (re-checked: no Sentry, pino, OpenTelemetry or winston in `package.json`). No error tracker or logger is installed. One partial improvement: the upload panel now reports failed item creation as an `itemFailed` status with the reason (`0235f0e`), so that failure is at least visible to the user.

### 5. Thumbnails of private files are publicly readable

*Architecture debt · Impact 4 · Risk 5 · Effort 3 → **27** · est. 3–5 days · source: new + git log*

- **Evidence:** `4d84ea9` reverted signed thumbnail URLs "until signing can be made cheap". `docs/thumbnail-pipeline.md` documents `x-amz-acl: public-read` on every thumbnail PUT. Loaders return the raw public Tigris URL. Anyone who has a URL can see a preview of a private image, PDF page or video frame, and the URL doesn't expire.
- **Fix:** Keep signing off the loader hot path. Options: (a) an authenticated `/api/thumbnails/:id` redirect/stream route behind a CDN cache key; (b) sign once per key and cache the URL server-side until shortly before it expires; (c) sign in batches that yield with `setImmediate` between chunks. Then turn `public-read` off and backfill the ACLs.
- **Why it matters:** A privacy gap in a product whose pitch is "your files". It's also the item most likely to become urgent overnight.
- **Resolved in code 2026-09-25** (`68e5cc9`). Thumbnails now upload with no ACL. `Thumbnail.url` stores an `s3://` locator, and every read site signs it. Signatures are cached per signing window, so re-renders produce identical URLs the browser can cache. On 2026-09-26, `87bf54d` and `a0f658a` added `bucket` and `color` columns so reads no longer parse the URL.
- **Resolved 2026-10-01.** Both open points were settled without a deploy.
  - **ACL sweep:** `scripts/sweep-thumbnail-acls.ts --apply` ran against all four buckets the DB references.
    - `stashly-alonposhil`: 7 thumbnails had public grants and were made private.
    - `stashly-alongvili` (465 thumbnails, 0 public): the bucket's object-ACL flag was on, and the sweep turned it off.
    - `stashly-devgvili` (88 thumbnails): already clean.
    - `default-bucket`: answered `AccessDenied`. It belongs to two leftover "PinTest" users with 0 items, from the 2026-09-18 pin tests.
    - A second dry run afterwards showed 0 public grants and the flag off on every bucket.
  - **Were the 7 grants live?** No. Before the sweep, an anonymous GET of one returned 403 on both Tigris hosts, because the bucket's flag was off. Tigris ignores object ACLs when that flag is off.
  - **Effect of turning the flag off on `alongvili`:** the flag covers every object in the bucket, not just thumbnails. No app code builds an unsigned URL, since every match is a comment or a test fixture. After the change, signed GETs returned 206 for both a thumbnail and a regular file, and anonymous GETs returned 403 for both.
  - **Signing cost re-measured** on all 267 thumbnail rows, three runs:
    - A cold pass signed them in 10.2–16.1 ms, about 0.04–0.06 ms per URL. A warm pass, using the per-window cache, took 0.5–1.1 ms.
    - A concurrent `SELECT 1` peaked at 1.7–15.2 ms during cold signing, against 1.6–1.8 ms idle. The revert was forced by the same probe climbing to 697 ms.
    - This ran without uploads in flight, unlike the 2026-09-19 measurement. The event-loop delay histogram read 14–18 ms on warm passes too, where signing takes about 1 ms, so it doesn't isolate signing and isn't used here.

### 6. Unused, unpinned and unmaintained dependencies

*Dependency debt · Impact 2 · Risk 3 · Effort 1 → **25** · est. 0.5 day · source: new*

- **Evidence:** No import found in `app/`, `server*`, `scripts/` or `vite.config.ts` for: `node-llama-cpp`, `node-av`, `webgpu`, `tesseract.js`, `@statelyai/inspect`, `@prisma/studio-core`, `@aws-sdk/client-sts`, `@aws-sdk/s3-presigned-post`, `@huggingface/inference`, `@huggingface/tokenizers`, `@alexanderolsen/libsamplerate-js`, `@hookform/resolvers`, `@stripe/stripe-js`, `@radix-ui/react-tooltip`, `@better-auth/infra`, `@fontsource-variable/geist(-mono)`. `radix-ui` is pinned to `latest`. `crypto-js`, which is no longer maintained, is used in two files for MD5 and random bytes.
- **Fix:** Remove them one at a time and check that `pnpm build` and `pnpm test` still pass after each (some load through a string or `vite` config). Pin `radix-ui` to an exact range. Replace `crypto-js` with Web Crypto (`crypto.getRandomValues`, `crypto.subtle.digest`). Also rename `toBase64`, which actually returns an MD5 hash.
- **Why it matters:** Native packages like `node-llama-cpp` and `node-av` make installs and images heavier and slower. `latest` can ship a breaking change on any install.
- **Resolved 2026-10-01.**
  - **First pass** (`d8bf186`, 2026-09-25): the native packages are gone and `radix-ui` is pinned to `^1.6.7`. `crypto-js` is replaced by Web Crypto, and `toBase64` became `toSHA256`, since Web Crypto has no MD5.
  - **Last four removed 2026-10-01** (`ba437d3`): `webgpu`, `@statelyai/inspect`, `@huggingface/tokenizers` and `@stripe/stripe-js`, plus `webgpu`'s two build-permission entries in `pnpm-workspace.yaml`.
    - A whole-repo search found no imports. `'webgpu'` only appears as a device-name string, and `tsconfig`'s `@webgpu/types` is a different package.
    - `app/types/tokenizers-augment.d.ts` declares its module on its own, and `@huggingface/transformers` still installs `@huggingface/tokenizers` transitively.
    - Verified in a fresh clone: frozen install, the typecheck gate, 525/525 tests and the build all passed, and none of the four was installed.
  - **Gap `d8bf186` introduced, since fixed:** `overview-view.tsx` linked "All files" to the deleted `/:me/stash/recent` route. It now points to `/:me/stash/all` (`1f030cf`, 2026-09-30).

### 7. The type baseline is stale, and escape hatches are growing

*Code debt · Impact 3 · Risk 3 · Effort 2 → **24** · est. 1–2 days · source: new*

- **Evidence:** `.claude/tsc-baseline.json` accepts 249 errors across 30 files. 15 of those entries (46 errors) point at files that no longer exist, such as `Gemini3DashboardFiles.tsx`, `queue.machine.1.ts` and `dropbox ui/file-list-item.tsx`. 184 of the live errors are in two test files. App code has 72 `as any`, 34 `: any`, 39 `as unknown as` and 7 `@ts-ignore`/`@ts-expect-error`.
- **Fix:** Prune the stale entries and make the hook fail when a count *drops* without the baseline being rewritten, so it only ratchets down. Fix the two test files (they share helpers), which takes the live errors from 203 to 19. Ban new `as any` in the ESLint config.
- **Why it matters:** A baseline that never shrinks turns into permission to add more errors. Most of the remaining debt is concentrated in two files.
- **Resolved 2026-10-01** (`76c69a5`, `b955723`). tsc errors fell from **195 to 11**, and the baseline from 30 files and 249 errors to **9 files and 11 errors**.
  - **The two test files:** all 184 of their errors had one cause. They used Vitest's `describe`, `it` and `expect` without importing them, as the other 34 test files do, and the tsconfig doesn't declare those names globally. Adding the import fixed 182. The other 2 were real bugs: the test called `removeItemFromCollection` with three arguments, but it takes one object. Fixing them also fixed 2 runtime failures, so `collection-actions` went from 7 failing tests to 5.
  - **Stale entries:** the baseline was regenerated, which removed the 16 entries for deleted files (51 errors) and lowered 3 live files that had improved.
  - **Ratchet:** in `--all` mode, which is what CI runs, the gate now also fails when the baseline allows more errors than tsc reports, including entries for deleted files. The commit that fixes an error therefore has to lower the baseline too. On the old baseline it blocked 21 entries.
  - **Not done:** banning new `as any` needs a linter, so it moves to item 12.

### 8. Data-integrity gaps in loaders and deletes

*Code debt · Impact 2 · Risk 4 · Effort 2 → **24** · est. 1–2 days · source: TASKS.md*

- **Evidence:** All from TASKS.md. `openedAt` is written inside three loaders, two of them awaited on the response path, which breaks the rule in CLAUDE.md. `retrieveUserUsageMetrics` reads quota outside its transaction client. Permanent delete leaves orphan `Permission` rows (`ON DELETE SET NULL`); 19 appeared in one minute on 2026-09-14. Two filter files have unreachable keys.
- **Fix:** Move `openedAt` to a fire-and-forget action or `clientLoader` ping. Thread `client` through `findQuotaByUserId`. Change the FK to `ON DELETE CASCADE`, or delete permissions explicitly, and add a cleanup migration. Fix the two filter maps.
- **Why it matters:** Wrong quota numbers and stale permission rows are the kind of bug that surfaces as a billing or access dispute.
- **Resolved 2026-10-01.**
  - **Permission rows: done** (`b7ec938`). `Permission_itemId_fkey` is now `ON DELETE CASCADE`. The first migration also deletes the rows already orphaned: those with no item, no share link and no invitation recipient. The 2026-09-27 diagnosis counted 956 of them on the dev DB. Prod runs that `DELETE` on its next migration.
  - **`openedAt`: resolved** (`62ddd1c`). The three loaders no longer write it themselves. `getFolder`, `getFileItem` and `getCollectionForUser` record it inside the action, next to the access check; the collection's check and write share one transaction. `62ddd1c` first put the permission check *before* the existence check, so a missing collection answered 403; `0c1db6d` (2026-09-30) restored 404. Accepted as the fix: the write still runs during the `GET`, but it's owned by the action rather than the loader, and no fire-and-forget or `clientLoader` ping is planned. The same commit added an access check to the folder loader, which had read the folder straight from `prisma` without one.
  - **Quota client: fixed 2026-10-01** (`fc655be`). `retrieveUserUsageMetrics` now passes its transaction client to `findQuotaByUserId` (`item-actions.ts:3367`). The function already accepted it; the caller just didn't pass it.
  - **Filter maps: fixed 2026-10-01** (`736d6ca`).
    - **Notifications:** the `user` filter never matched its `userId` schema key, and `id` and `type` had no filter. `searchNotifications`' own JSDoc example passes `{ userId }`, so it would have returned every user's notifications. Now `userId`, `id` and `type` all have filters.
    - **Drives:** the `createdAt`/`updatedAt` filters could never run and are deleted, since `date` already covers `createdAt` ranges. The `workspaceId` schema key is removed: `Drive` has no workspace column or relation, so no filter for it could exist.
    - **Test:** `filter-key-coverage.test.ts` runs the item-filters coverage checks over both files. It failed in all five reported ways before the fix.
    - **Impact:** no route calls either search yet, so nothing visible changed.

### 9. Failed uploads leave S3 bytes and charged quota with no Item

*Architecture debt · Impact 3 · Risk 4 · Effort 3 → **21** · est. 2–3 days · source: new + git log*

- **Evidence:** The `4d84ea9` commit message records 16 of 16 uploads with bytes in S3 and quota charged, but no `Item` row. `storage-actions.ts:471` notes that leftover S3 objects "are orphans that no metadata" references. There's no reconciliation job or bucket lifecycle rule for abandoned multipart uploads.
- **Fix:** Add a scheduled job that lists S3 keys with no matching `Item`/`Thumbnail` older than N hours and deletes them, then recomputes quota per user. Add an `AbortIncompleteMultipartUpload` lifecycle rule on the bucket.
- **Why it matters:** Users pay quota for files they can't see, and you pay storage for the same bytes.
- **Resolved 2026-10-02.**
  - **Quota:** `c6751b2` (2026-09-27) found that every upload was charged *twice*, once by the file machine as soon as S3 finished and again inside the Item transaction. The first charge also landed before the row existed. Quota is now charged once, in `dbMachine`, and only after `@db.item.created`. A failed charge retries five times with backoff. What happens after the fifth failure is undecided and tracked in TASKS.md; for now the file is logged as unbilled.
  - **Item creation:** before that, `0235f0e` (2026-09-25) moved item creation into a db machine that never throws. A single failed POST used to stop the whole upload manager.
  - **Root cause found 2026-10-01:** permanent delete never touched S3. `deleteItems`/`deleteItem` removed the rows and returned the quota, but `deleteFile` had no callers, so every permanently deleted file and thumbnail stayed in its bucket.
    - A read-only audit found 652 unreferenced objects (~943 MB) across two buckets, including the files of a folder that no longer exists, plus 85 multipart uploads started more than 24 h earlier and never finished.
    - Matching was checked: 584 objects in the biggest bucket matched a `File` key exactly, and none of the orphans did.
  - **Fixed** (`6218641`): permanent delete collects the subtree's file and thumbnail keys, deletes the rows, then deletes the objects through `deleteObjects`.
    - That helper batches 1,000 keys per call, reads per-key failures from `DeleteObjects`' `Errors`, and logs any keys left behind.
    - 4 tests fail without the fix and pass with it.
    - Verified on real Tigris with two throwaway keys: both deleted, none failed.
  - **Cleanup** (`3d5e1d7`): `scripts/sweep-s3-orphans.ts` deletes unreferenced objects older than 24 h and aborts stale multipart uploads.
    - Dry run by default; `--apply` acts.
    - **Applied 2026-10-02** with the owner's go-ahead: 652 objects deleted (624 + 28) and 85 stale multipart uploads aborted (78 + 1 + 6), with 0 delete or abort failures.
    - A dry run straight afterwards found every object in all three buckets referenced (584, 170 and 27), with 0 orphans and 0 stale uploads.
    - All 534 `File` rows still have their object in S3, with 0 missing.
    - `default-bucket` answers `AccessDenied` and fails each run; it belongs to the leftover PinTest users in TASKS.md.
  - **No lifecycle rule:** Tigris rejects `AbortIncompleteMultipartUpload` with 400 "Lifecycle only supports expiration rule" (tested on the dev bucket, config restored). The sweep aborts stale uploads instead.

### 10. UI accessibility and responsive debt

*Code debt · Impact 4 · Risk 3 · Effort 3 → **21** · est. 5–8 days · source: design critiques*

- **Evidence:** From the two design critiques in `docs/design-critique/`. Cards and rows are `div`/`tr onClick` and can't be reached by keyboard. About 20 icon buttons have no name. The Filter trigger nests buttons inside a button, which causes a hydration error on every load. The toolbar overflows below 840px and there's no navigation on phones. The item panel covers the file and the audio seek bar is mouse-only.
- **Fix:** Use real `<a href>` links on cards and rows, `aria-label` on every icon button, and un-nest the Filter toggles. Make the toolbar and grid responsive and add a mobile nav sheet. Dock the item panel on wide screens.
- **Why it matters:** Keyboard users can't open a file at all, and phone users can't reach most sections. Both limit who can use the product.
- **Status 2026-10-01: open.** No commit since the audit targets these findings: searching the log for a11y, aria, accessibility, keyboard and responsive finds none. The UI hasn't been re-audited.

### 11. Generated and personal files in git

*Documentation debt · Impact 2 · Risk 2 · Effort 1 → **20** · est. 0.5 day · source: new*

- **Evidence:** The generated Prisma client is committed (64 files, ~104k lines under `app/prisma/`). `.chat-history/` (15 files) and `copilot_exports/` are in `.gitignore` but were committed earlier, so they're still tracked. There's no `.gitattributes`, and a Linux view of this Windows checkout shows 579 files modified by line endings alone. Stray files: `app/styles/globals.css.backup`, `app/components/icons-full.pdf`, root `dashboard.html` and `wipe-test-data.ts`.
- **Fix:** `git rm --cached` the chat history and exports. Generate the Prisma client in `postinstall`/build and stop tracking it. Add `.gitattributes` with `* text=auto eol=lf`. Move or delete the stray files.
- **Why it matters:** Tracked chat logs can leak context if the repo is ever shared. Generated code and EOL churn bury real diffs in review.
- **Resolved 2026-09-26** (`d66205a`..`7e2f5a0`): chat history and exports untracked (16 files); `.gitattributes` added — the index was already all LF (808 text files, 0 CRLF), so renormalizing changed nothing and the "579 modified" was `core.autocrlf=true` writing CRLF to the working tree; `globals.css.backup` and `icons-full.pdf` deleted; `wipe-test-data.ts` moved to `scripts/` (a live script, not a stray); `dashboard.html` kept (the `start`/`task-management` skills read it). The Prisma client is generated by `postinstall` and `build` — which needed `prisma.config.ts` to stop using `env()`, or `pnpm install` failed without a `.env`. **Still in history:** the chat logs and the 14.3 MB PDF; removing them would need a history rewrite and force-push.

### 12. No linter

*Code debt · Impact 2 · Risk 2 · Effort 2 → **16** · est. 1 day + fixes · source: new*

- **Evidence:** No ESLint or Biome config and no `lint` script. The 12 `eslint-disable` comments in app code don't do anything. Prettier is configured but not enforced.
- **Fix:** Add ESLint (flat config) with `typescript-eslint`, `react-hooks`, `jsx-a11y` and `no-explicit-any` set to warn. Run it in CI. Enforce Prettier with `--check`.
- **Why it matters:** `jsx-a11y` alone would have flagged most of the UI debt above. `react-hooks` catches stale-closure bugs across the 41 files in `app/hooks`.
- **Status 2026-10-01: open.** There's still no ESLint or Biome config and no `lint` script. Item 7's ban on new `as any` now waits on this.

### 13. Tests are missing where the risk is

*Test debt · Impact 4 · Risk 4 · Effort 4 → **16** · est. ongoing, ~2 weeks · source: new*

- **Evidence:** 39 unit test files, 25 of them in `app/utils`. There are 0 tests for 74 route modules and 184 components. `app/.server` has 5 test files for 38 modules, and `item-actions.ts` (3,544 lines, 52 exported functions) has none. There are 8 Playwright specs.
- **Fix:** Don't aim for coverage numbers. Add an integration test per loader/action as you touch it, against the dev DB helpers that already exist in `.server/__tests__/helpers`. Start with create/move/delete/restore in `item-actions`, quota, and permission checks.
- **Why it matters:** The costly regressions in the git log (upload loss, access 500s, trash 500) are all in untested server paths.
- **Status 2026-10-01: open.**
  - **New tests since the audit:** the trash loader's thumbnail filter (`af779ee`) and the upload db machine (29 tests in `app/machines/db`, 7 of them added in `c6751b2`).
  - **Now run automatically:** since 2026-10-01, CI runs every test file against a real Postgres, with nothing excluded: 607 tests in 42 files.
  - **Fixed in passing:** two `removeItemFromCollection` tests had failed since the function switched to an object argument, and now pass (`76c69a5`). `pnpm test` is 583 passing / 9 failing (2026-10-01).
  - **Unchanged:** `app/.server/__tests__` still has 5 test files, there are still 8 Playwright specs, and `item-actions.ts` still has no tests of its own. `trash-loader.test.ts` only mocks it.

### 14. Two thumbnail orchestrators

*Architecture debt · Impact 3 · Risk 2 · Effort 3 → **15** · est. 2–3 days · source: new*

- **Evidence:** The XState scheduler in `app/machines/thumbnail/` is the documented path, but `components/upload/upload-thumbnail-runner.tsx` still drives the legacy `hooks/useThumbnail.ts` orchestrator. Both have to stay correct through changes like the signing work.
- **Fix:** Move the upload runner onto the scheduler and delete `useThumbnail`. Do this before the signing work so the change happens in one place.
- **Why it matters:** Every thumbnail change costs twice as much, and the two paths can drift apart.
- **Status 2026-10-01: open.**
  - `upload-thumbnail-runner.tsx` still imports `useThumbnail`, and the signing work (`68e5cc9`) landed with both paths still in place.
  - `1a778fd` (2026-09-26) fixed two bugs in the path: an upload job now replaces a queued backfill job for the same item, and the backfill lane no longer stays paused after an upload.
  - The XState pipeline is on trial behind a flag. The legacy hooks stay until the owner signs it off visually.

### 15. `item-actions.ts` god module

*Code debt · Impact 3 · Risk 2 · Effort 3 → **15** · est. 3–5 days, incremental · source: new*

- **Evidence:** `app/.server/item-actions.ts` is 3,544 lines with 58 exports. Next largest: `search-actions.ts` (1,551), `invitation-actions.ts` (1,154), `s3.ts` (1,151).
- **Fix:** Split it by lifecycle (create/upload, move/copy, trash/restore/delete, metadata/metrics) behind the same exports, one slice per PR, with tests added per slice.
- **Why it matters:** Merge conflicts and review effort concentrate in one file, and it has no tests.
- **Status 2026-09-29: declined.** A per-slice plan was drafted, and the owner decided not to split the file. It has grown to 3,668 lines and 59 exports, mostly from `getFolder` in `62ddd1c`. Its tests remain part of item 13.

### 16. Overlapping UI primitives

*Code debt · Impact 2 · Risk 1 · Effort 2 → **12** · est. 2–3 days · source: new*

- **Evidence:** Radix is imported two ways: the `radix-ui` umbrella (24 imports) and individual `@radix-ui/*` packages (13 imports). Icons come from three sources: `lucide-react` (18 imports), `@remixicon/react` (6) and a 4,309-line `icons.tsx`. There are three global stylesheets (`global.css`, `globals.css`, `theme.css`) plus a `.backup`. Animation uses both `framer-motion` (15 imports) and `@formkit/auto-animate` (1).
- **Fix:** Standardize on the `radix-ui` umbrella, one icon source plus the custom set, and one global stylesheet with a theme layer. Drop `auto-animate`.
- **Why it matters:** Bundle weight and "which one do I use?" friction for every new component.
- **Status 2026-10-01: partly done** (`d8bf186`, 2026-09-25; counts re-checked 2026-10-01).
  - **Done:** `lucide-react`, `@remixicon/react` and `@formkit/auto-animate` are removed, with their icons moved to `icons.tsx` and 0 imports left. 31 files import the `radix-ui` umbrella.
  - **Left:** 5 files still import `@radix-ui/*`: `item-card.tsx` and four under `components/ui/`. There are still three global stylesheets (`global.css`, `globals.css` and `theme.css`), and `framer-motion` is imported in 15 files.

### 17. Unfinished migrations left in place

*Architecture debt · Impact 2 · Risk 2 · Effort 3 → **12** · est. 2–4 days · source: TASKS.md*

- **Evidence:** From TASKS.md. Seven workspace routes still point at stubs whose loaders return `null`. `workspaces/create.tsx` isn't registered. The flat and nested item API routes are both registered for five resources. The favorites revalidation work is half-done on `main` (`api/favorites.ts:39` has a commented-out return).
- **Fix:** Finish or revert each one. Start with the favorites work-in-progress, which is small and already live.
- **Why it matters:** Half-migrations double the surface area to reason about, and stubs look like features that work.
- **Status 2026-10-01: partly done.**
  - **Favorites work in progress: finished** (`ea4c2a1`). `unfavorite` now returns `data({ favorited: false })` like `favorite` does. `useFavorite` settles on `fetcher.data`, which the redirect left empty.
  - **Bulk favorite:** `favorite_items` now strips `selectedItems` from its redirect, as its own comment said it should and as `/api/items` does. That gives the previously unused `removeQueryParam` import its use.
  - **Checks:** the typecheck gate passes, and the browser test on 2026-10-01 confirmed it. `unfavorite` answers 200 with `{"favorited":false}` and no redirect. The item-page toggle settled correctly through favorite, unfavorite and favorite (123–327 ms) without navigating. Bulk favorite redirected to `?layout=grid` with `selectedItems` stripped.
  - **Still open:** the seven workspace stubs, the unregistered `workspaces/create.tsx` (also one of the 11 baseline type errors), and five resources registered under both the flat and the nested item API routes.

## Changes since the audit

These commits touched a register item, oldest first. Commits that don't touch any register item are left out, such as page size, the rename dialog, the search `ZodError`, and the Vite typegen watch.

| Date | Commit | Item | Change |
|------|--------|------|--------|
| 2026-09-12 | `8ab1249` | 3 | 4xx errors survive production sanitization via `toRouteError`. This predates the audit; the register missed it. |
| 2026-09-24 | `3e681bc`, `af779ee` | 3 | The trash loader defaults `layout` to grid, with a test. |
| 2026-09-25 | `8cb73a7` | 3 | `layout=grid` is written into the URL when missing, so clean URLs render. |
| 2026-09-25 | `0235f0e` | 9, 4 | Item creation moves into a db machine that never throws; failures show as `itemFailed`. |
| 2026-09-25 | `68e5cc9` | 5 | Signed thumbnail reads re-landed with a per-window cache, uploads have no ACL, and the ACL sweep script was added. |
| 2026-09-25 | `d8bf186` | 6, 16, 17 | Unused and unmaintained dependencies dropped, `radix-ui` pinned, Web Crypto replaces `crypto-js`, icon libraries folded into `icons.tsx`. |
| 2026-09-26 | `87bf54d`, `a0f658a` | 5 | Thumbnail `bucket` and `color` columns added; reads use them instead of the URL locator. |
| 2026-09-26 | `1a778fd` | 14 | Upload thumbnail jobs take priority over queued backfill jobs. |
| 2026-09-26 | `d66205a`..`7e2f5a0` | 11 | Chat history and exports untracked, `.gitattributes` added, stray files removed, Prisma client generated on install. |
| 2026-09-27 | `c6751b2` | 9, 13 | Quota charged once, only after the Item row exists, with 7 new db-machine tests. |
| 2026-09-29 | `b7ec938` | 8 | `Permission_itemId_fkey` changed to `ON DELETE CASCADE`, with a cleanup of orphaned rows. |
| 2026-09-29 | `62ddd1c` | 8 | Folder access check and `openedAt` writes moved from loaders into actions. |
| 2026-09-30 | `0c1db6d` | 8 | `getCollectionForUser` checks existence before permission again, so a missing collection is 404, not 403. |
| 2026-09-30 | `1f030cf`, `14f2ca9` | 6, 13 | The dead `/recent` link now points to `/all`; the page-size test expects the new default of 50. |
| 2026-09-30 | `b95cdd5` | 1 | CI workflow added, plus the hook's `--all` mode. |
| 2026-09-30 | `e8a61eb`, `326c317`, `eda8fc7` | 2 | Dockerfile rebuilt for pnpm and Node 24, `fly.toml` with a migration release command, and a CI docker job that boots the image. |
| 2026-10-01 | `ba437d3`, `fc655be` | 6, 8 | The last four unused packages removed; the quota read in `retrieveUserUsageMetrics` now runs inside its transaction. |
| 2026-10-01 | `76c69a5`, `b955723` | 7, 13 | Test files import their Vitest globals and pass the right arguments; the baseline is down to 11 errors, and CI fails on leftover allowance. |
| 2026-10-01 | `ea4c2a1`, `7e34556` | 17 | The favorites work in progress was finished: `unfavorite` returns data and bulk favorite clears the selection. Both were confirmed in the browser. |
| 2026-10-01 | no commit (operation) | 5 | ACL sweep applied to every bucket: 7 grants made private, one bucket's object-ACL flag turned off. Signing cost re-measured: a concurrent `SELECT 1` peaked at 15 ms, against the 697 ms that forced the revert. |
| 2026-10-01 | `736d6ca` | 8 | Drive and notification filter keys aligned with their schemas, guarded by a new coverage test. |
| 2026-10-01 | `e6ac762`..`e506455` | 1, 13 | Honest CI: real Postgres for both jobs, a health check that queries the database, every test run, output never hidden, invalid filter values rejected with a 400. |
| 2026-10-01 | `6218641`, `3d5e1d7` | 9 | Permanent delete now removes S3 objects; `sweep-s3-orphans.ts` cleans up what was left behind. |
| 2026-10-02 | no commit (operation) | 9 | Orphan sweep applied: 652 objects deleted, 85 stale uploads aborted, 0 failures; every bucket now fully referenced. |

## Phased remediation plan

### Phase 0 · this week

*about 2 days, alongside feature work*

Quick wins that shrink the surface area before anything else. Also finish or revert the favorites work-in-progress from the last item.

- ~~Two known 500s on ordinary requests (0.5 day)~~: resolved
- ~~Unused, unpinned and unmaintained dependencies (0.5 day)~~: resolved 2026-10-01
- ~~Generated and personal files in git (0.5 day)~~: resolved 2026-09-26

*Status 2026-10-01:* Phase 0 is done.

### Phase 1 · next two weeks

*about 20% of time*

Build the safety net: CI, a deploy that works, error tracking and a linter. Every later fix depends on these to stay fixed.

- ~~No CI: nothing runs typecheck, tests or build automatically (0.5–1 day)~~: resolved 2026-09-30
- ~~Deploy path is broken and runs an end-of-life Node (1–2 days)~~: resolved in code 2026-09-30
- No error tracking or structured logging (1 day)
- No linter (1 day + fixes)
- ~~The type baseline is stale, and escape hatches are growing (1–2 days)~~: resolved 2026-10-01

*Status 2026-10-01:* CI, the deploy path and the type baseline are done, though the first `fly deploy` is still to confirm. Error tracking and the linter aren't started.

### Phase 2 · this month

*one focused slice per week*

Privacy and data correctness. Merge the thumbnail paths first, then make signing cheap and turn off public-read, then reconcile orphaned bytes and quota.

- Two thumbnail orchestrators (2–3 days): open
- ~~Thumbnails of private files are publicly readable (3–5 days)~~: resolved 2026-10-01
- ~~Failed uploads leave S3 bytes and charged quota with no Item (2–3 days)~~: resolved 2026-10-02
- ~~Data-integrity gaps in loaders and deletes (1–2 days)~~: resolved 2026-10-01

*Status 2026-10-02:* only the orchestrator merge (item 14) remains. Signing shipped *before* the orchestrators were merged, the reverse of the planned order, so the signing change had to land on both paths.

### Phase 3 · ongoing

*boy-scout rule on every feature PR*

Pay down on each touch: add tests for any loader or action you change, and fix accessibility on components you edit.

- UI accessibility and responsive debt (5–8 days)
- Tests are missing where the risk is (ongoing, ~2 weeks)
- ~~`item-actions.ts` god module (3–5 days, incremental)~~: declined 2026-09-29
- Overlapping UI primitives (2–3 days): partly done
- Unfinished migrations left in place (2–4 days): favorites work in progress finished; workspace stubs and duplicate routes left

---

*Method: read-only scan of the working tree on your computer — file and line counts, grep for type escapes and markers, an import scan against `package.json`, the tsc baseline, Dockerfile, `.gitignore`/`.dockerignore`, git history since June, and TASKS.md. The generated Prisma client (`app/prisma/`) is excluded from code metrics. "No import found" for a dependency means none in `app/`, `server*`, `scripts/` or `vite.config.ts`; confirm with a build before removing. 40 files had uncommitted changes at the time; findings reflect the working tree.*
