# Stashly Tech Debt Register

*Whole-repo audit · 24 Sep 2026 · scored as Priority = (Impact + Risk) × (6 − Effort), each 1–5*

## Summary

Stashly already has good habits: subsystem docs and skills, bugs root-caused in TASKS.md, and a type baseline. Most of the debt sits around the code rather than in it. Nothing runs automatically (no CI, lint or error tracking), the deploy path doesn't build, and thumbnails of private files are publicly readable. Adding CI, fixing the deploy and adding error tracking takes two to four days, and it keeps every later fix from regressing.

**17 items** · 6 high priority · categories: Code 7, Architecture 4, Infrastructure 3, Dependency 1, Documentation 1, Test 1

Items marked *TASKS.md* are already root-caused in your backlog; this register scores them alongside new findings so they can be sequenced together.

## Prioritized register

| # | Item | Type | I | R | E | Priority | Effort |
|---|------|------|---|---|---|----------|--------|
| 1 | No CI: nothing runs typecheck, tests or build automatically | Infrastructure | 4 | 4 | 2 | **32** (High) | 0.5–1 day |
| 2 | Deploy path is broken and runs an end-of-life Node | Infrastructure | 3 | 5 | 2 | **32** (High) | 1–2 days |
| 3 | Two known 500s on ordinary requests | Code | 3 | 3 | 1 | **30** (High) | 0.5 day |
| 4 | No error tracking or structured logging | Infrastructure | 3 | 4 | 2 | **28** (High) | 1 day |
| 5 | Thumbnails of private files are publicly readable | Architecture | 4 | 5 | 3 | **27** (High) | 3–5 days |
| 6 | Unused, unpinned and unmaintained dependencies | Dependency | 2 | 3 | 1 | **25** (High) | 0.5 day |
| 7 | The type baseline is stale, and escape hatches are growing | Code | 3 | 3 | 2 | **24** (Medium) | 1–2 days |
| 8 | Data-integrity gaps in loaders and deletes | Code | 2 | 4 | 2 | **24** (Medium) | 1–2 days |
| 9 | Failed uploads leave S3 bytes and charged quota with no Item | Architecture | 3 | 4 | 3 | **21** (Medium) | 2–3 days |
| 10 | UI accessibility and responsive debt | Code | 4 | 3 | 3 | **21** (Medium) | 5–8 days |
| 11 | ~~Generated and personal files in git~~ — resolved 2026-09-26 | Documentation | 2 | 2 | 1 | **20** (Medium) | 0.5 day |
| 12 | No linter | Code | 2 | 2 | 2 | **16** (Medium) | 1 day + fixes |
| 13 | Tests are missing where the risk is | Test | 4 | 4 | 4 | **16** (Medium) | ongoing, ~2 weeks |
| 14 | Two thumbnail orchestrators | Architecture | 3 | 2 | 3 | **15** (Low) | 2–3 days |
| 15 | `item-actions.ts` god module | Code | 3 | 2 | 3 | **15** (Low) | 3–5 days, incremental |
| 16 | Overlapping UI primitives | Code | 2 | 1 | 2 | **12** (Low) | 2–3 days |
| 17 | Unfinished migrations left in place | Architecture | 2 | 2 | 3 | **12** (Low) | 2–4 days |

## Details

### 1. No CI: nothing runs typecheck, tests or build automatically

*Infrastructure debt · Impact 4 · Risk 4 · Effort 2 → **32** · est. 0.5–1 day · source: new*

- **Evidence:** `.github/` holds only Copilot instructions and prompts, with no `workflows/`. The only guard is `.claude/hooks/check-staged-types.mjs`, which fires on `git commit` only when the commit goes through Claude Code. A commit from a terminal or the IDE skips it. 2 of 305 commits since June are `test:` commits.
- **Fix:** Add one GitHub Actions workflow on push/PR: `pnpm install --frozen-lockfile`, `pnpm typecheck` (against the tsc baseline), `pnpm test`, `pnpm build`. Add Playwright e2e later as a separate job.
- **Why it matters:** Every other fix on this list is only as durable as the check that stops it regressing. This one is cheap and protects all the others.

### 2. Deploy path is broken and runs an end-of-life Node

*Infrastructure debt · Impact 3 · Risk 5 · Effort 2 → **32** · est. 1–2 days · source: new*

- **Evidence:** `Dockerfile` runs `npm ci` and copies `package-lock.json`, but the repo uses pnpm and has no `package-lock.json`, so the image can't build. The base image is `node:20-alpine`, and Node 20 reached end of life on 30 Apr 2026. `.dockerignore` excludes only `.react-router`, `build`, `node_modules` and `README.md`, so `COPY . /app` sends `.env`, `.git` and `.chat-history` into the build context. There's no `fly.toml` for the app, even though `deploy/README.md` says step 3 is "repo root", and no step runs `prisma migrate deploy`.
- **Fix:** Rewrite the Dockerfile for pnpm (`corepack enable`, `pnpm fetch` / `install --frozen-lockfile --prod`) on Node 22 or 24 LTS. Add `.env*`, `.git`, `.chat-history`, `copilot_exports`, `tests`, `playwright-report` and `models` to `.dockerignore`. Commit a `fly.toml` with `release_command = "pnpm prisma migrate deploy"`. Pin Node via `engines` and `packageManager`.
- **Why it matters:** Today a deploy would fail, or would run on a runtime that gets no security patches. Secrets in a build context get uploaded to remote builders.

### 3. Two known 500s on ordinary requests

*Code debt · Impact 3 · Risk 3 · Effort 1 → **30** · est. 0.5 day · source: TASKS.md*

- **Evidence:** Both are already root-caused in TASKS.md. A denied item returns 500 instead of 403, because `StashlyError` isn't a `Response` and React Router's `sanitizeError` rewrites it. `/:me/stash/trash` without `?layout=` returns 500 because `null` goes into a non-nullable `Thumbnail.view` filter (`trash.tsx:93,142,175`).
- **Fix:** Throw `data(…, { status: 403 })` from `assertItemAccess`. Default `layout` to `'grid'` in `trash.tsx`, and use the same parser every route uses.
- **Why it matters:** A clean trash link is the kind of URL people bookmark and share, and it fails today. Returning 500 for a permission denial pollutes error metrics once they exist (see Observability).

### 4. No error tracking or structured logging

*Infrastructure debt · Impact 3 · Risk 4 · Effort 2 → **28** · est. 1 day · source: new*

- **Evidence:** `server.js` has `morgan` access logs only. There's no Sentry, OpenTelemetry, pino or equivalent anywhere in `app/.server` or `server.js`, and there are 40 `console.log` calls in app code. The thumbnail-signing revert (`4d84ea9`) found silent upload loss (16 of 16 files missing an `Item` row) only because someone reported it.
- **Fix:** Add an error tracker to the server entry and the root `ErrorBoundary`, and a JSON logger with a request id. Replace `console.log` in `.server` code with the logger.
- **Why it matters:** Upload loss, quota drift and 500s are all currently invisible until a user complains.

### 5. Thumbnails of private files are publicly readable

*Architecture debt · Impact 4 · Risk 5 · Effort 3 → **27** · est. 3–5 days · source: new + git log*

- **Evidence:** `4d84ea9` reverted signed thumbnail URLs "until signing can be made cheap". `docs/thumbnail-pipeline.md` documents `x-amz-acl: public-read` on every thumbnail PUT. Loaders return the raw public Tigris URL. Anyone who has a URL can see a preview of a private image, PDF page or video frame, and the URL doesn't expire.
- **Fix:** Keep signing off the loader hot path. Options: (a) an authenticated `/api/thumbnails/:id` redirect/stream route behind a CDN cache key; (b) sign once per key and cache the URL server-side until shortly before it expires; (c) sign in batches that yield with `setImmediate` between chunks. Then turn `public-read` off and backfill the ACLs.
- **Why it matters:** A privacy gap in a product whose pitch is "your files". It's also the item most likely to become urgent overnight.

### 6. Unused, unpinned and unmaintained dependencies

*Dependency debt · Impact 2 · Risk 3 · Effort 1 → **25** · est. 0.5 day · source: new*

- **Evidence:** No import found in `app/`, `server*`, `scripts/` or `vite.config.ts` for: `node-llama-cpp`, `node-av`, `webgpu`, `tesseract.js`, `@statelyai/inspect`, `@prisma/studio-core`, `@aws-sdk/client-sts`, `@aws-sdk/s3-presigned-post`, `@huggingface/inference`, `@huggingface/tokenizers`, `@alexanderolsen/libsamplerate-js`, `@hookform/resolvers`, `@stripe/stripe-js`, `@radix-ui/react-tooltip`, `@better-auth/infra`, `@fontsource-variable/geist(-mono)`. `radix-ui` is pinned to `latest`. `crypto-js`, which is no longer maintained, is used in two files for MD5 and random bytes.
- **Fix:** Remove them one at a time and check that `pnpm build` and `pnpm test` still pass after each (some load through a string or `vite` config). Pin `radix-ui` to an exact range. Replace `crypto-js` with Web Crypto (`crypto.getRandomValues`, `crypto.subtle.digest`). Also rename `toBase64`, which actually returns an MD5 hash.
- **Why it matters:** Native packages like `node-llama-cpp` and `node-av` make installs and images heavier and slower. `latest` can ship a breaking change on any install.

### 7. The type baseline is stale, and escape hatches are growing

*Code debt · Impact 3 · Risk 3 · Effort 2 → **24** · est. 1–2 days · source: new*

- **Evidence:** `.claude/tsc-baseline.json` accepts 249 errors across 30 files. 15 of those entries (46 errors) point at files that no longer exist, such as `Gemini3DashboardFiles.tsx`, `queue.machine.1.ts` and `dropbox ui/file-list-item.tsx`. 184 of the live errors are in two test files. App code has 72 `as any`, 34 `: any`, 39 `as unknown as` and 7 `@ts-ignore`/`@ts-expect-error`.
- **Fix:** Prune the stale entries and make the hook fail when a count *drops* without the baseline being rewritten, so it only ratchets down. Fix the two test files (they share helpers), which takes the live errors from 203 to 19. Ban new `as any` in the ESLint config.
- **Why it matters:** A baseline that never shrinks turns into permission to add more errors. Most of the remaining debt is concentrated in two files.

### 8. Data-integrity gaps in loaders and deletes

*Code debt · Impact 2 · Risk 4 · Effort 2 → **24** · est. 1–2 days · source: TASKS.md*

- **Evidence:** All from TASKS.md. `openedAt` is written inside three loaders, two of them awaited on the response path, which breaks the rule in CLAUDE.md. `retrieveUserUsageMetrics` reads quota outside its transaction client. Permanent delete leaves orphan `Permission` rows (`ON DELETE SET NULL`); 19 appeared in one minute on 2026-09-14. Two filter files have unreachable keys.
- **Fix:** Move `openedAt` to a fire-and-forget action or `clientLoader` ping. Thread `client` through `findQuotaByUserId`. Change the FK to `ON DELETE CASCADE`, or delete permissions explicitly, and add a cleanup migration. Fix the two filter maps.
- **Why it matters:** Wrong quota numbers and stale permission rows are the kind of bug that surfaces as a billing or access dispute.

### 9. Failed uploads leave S3 bytes and charged quota with no Item

*Architecture debt · Impact 3 · Risk 4 · Effort 3 → **21** · est. 2–3 days · source: new + git log*

- **Evidence:** The `4d84ea9` commit message records 16 of 16 uploads with bytes in S3 and quota charged, but no `Item` row. `storage-actions.ts:471` notes that leftover S3 objects "are orphans that no metadata" references. There's no reconciliation job or bucket lifecycle rule for abandoned multipart uploads.
- **Fix:** Add a scheduled job that lists S3 keys with no matching `Item`/`Thumbnail` older than N hours and deletes them, then recomputes quota per user. Add an `AbortIncompleteMultipartUpload` lifecycle rule on the bucket.
- **Why it matters:** Users pay quota for files they can't see, and you pay storage for the same bytes.

### 10. UI accessibility and responsive debt

*Code debt · Impact 4 · Risk 3 · Effort 3 → **21** · est. 5–8 days · source: design critiques*

- **Evidence:** From the two design critiques in `docs/design-critique/`. Cards and rows are `div`/`tr onClick` and can't be reached by keyboard. About 20 icon buttons have no name. The Filter trigger nests buttons inside a button, which causes a hydration error on every load. The toolbar overflows below 840px and there's no navigation on phones. The item panel covers the file and the audio seek bar is mouse-only.
- **Fix:** Use real `<a href>` links on cards and rows, `aria-label` on every icon button, and un-nest the Filter toggles. Make the toolbar and grid responsive and add a mobile nav sheet. Dock the item panel on wide screens.
- **Why it matters:** Keyboard users can't open a file at all, and phone users can't reach most sections. Both limit who can use the product.

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

### 13. Tests are missing where the risk is

*Test debt · Impact 4 · Risk 4 · Effort 4 → **16** · est. ongoing, ~2 weeks · source: new*

- **Evidence:** 39 unit test files, 25 of them in `app/utils`. There are 0 tests for 74 route modules and 184 components. `app/.server` has 5 test files for 38 modules, and `item-actions.ts` (3,544 lines, 52 exported functions) has none. There are 8 Playwright specs.
- **Fix:** Don't aim for coverage numbers. Add an integration test per loader/action as you touch it, against the dev DB helpers that already exist in `.server/__tests__/helpers`. Start with create/move/delete/restore in `item-actions`, quota, and permission checks.
- **Why it matters:** The costly regressions in the git log (upload loss, access 500s, trash 500) are all in untested server paths.

### 14. Two thumbnail orchestrators

*Architecture debt · Impact 3 · Risk 2 · Effort 3 → **15** · est. 2–3 days · source: new*

- **Evidence:** The XState scheduler in `app/machines/thumbnail/` is the documented path, but `components/upload/upload-thumbnail-runner.tsx` still drives the legacy `hooks/useThumbnail.ts` orchestrator. Both have to stay correct through changes like the signing work.
- **Fix:** Move the upload runner onto the scheduler and delete `useThumbnail`. Do this before the signing work so the change happens in one place.
- **Why it matters:** Every thumbnail change costs twice as much, and the two paths can drift apart.

### 15. `item-actions.ts` god module

*Code debt · Impact 3 · Risk 2 · Effort 3 → **15** · est. 3–5 days, incremental · source: new*

- **Evidence:** `app/.server/item-actions.ts` is 3,544 lines with 58 exports. Next largest: `search-actions.ts` (1,551), `invitation-actions.ts` (1,154), `s3.ts` (1,151).
- **Fix:** Split it by lifecycle (create/upload, move/copy, trash/restore/delete, metadata/metrics) behind the same exports, one slice per PR, with tests added per slice.
- **Why it matters:** Merge conflicts and review effort concentrate in one file, and it has no tests.

### 16. Overlapping UI primitives

*Code debt · Impact 2 · Risk 1 · Effort 2 → **12** · est. 2–3 days · source: new*

- **Evidence:** Radix is imported two ways: the `radix-ui` umbrella (24 imports) and individual `@radix-ui/*` packages (13 imports). Icons come from three sources: `lucide-react` (18 imports), `@remixicon/react` (6) and a 4,309-line `icons.tsx`. There are three global stylesheets (`global.css`, `globals.css`, `theme.css`) plus a `.backup`. Animation uses both `framer-motion` (15 imports) and `@formkit/auto-animate` (1).
- **Fix:** Standardize on the `radix-ui` umbrella, one icon source plus the custom set, and one global stylesheet with a theme layer. Drop `auto-animate`.
- **Why it matters:** Bundle weight and "which one do I use?" friction for every new component.

### 17. Unfinished migrations left in place

*Architecture debt · Impact 2 · Risk 2 · Effort 3 → **12** · est. 2–4 days · source: TASKS.md*

- **Evidence:** From TASKS.md. Seven workspace routes still point at stubs whose loaders return `null`. `workspaces/create.tsx` isn't registered. The flat and nested item API routes are both registered for five resources. The favorites revalidation work is half-done on `main` (`api/favorites.ts:39` has a commented-out return).
- **Fix:** Finish or revert each one. Start with the favorites work-in-progress, which is small and already live.
- **Why it matters:** Half-migrations double the surface area to reason about, and stubs look like features that work.

## Phased remediation plan

### Phase 0 · this week

*about 2 days, alongside feature work*

Quick wins that shrink the surface area before anything else. Also finish or revert the favorites work-in-progress from the last item.

- Two known 500s on ordinary requests (0.5 day)
- Unused, unpinned and unmaintained dependencies (0.5 day)
- Generated and personal files in git (0.5 day)

### Phase 1 · next two weeks

*about 20% of time*

Build the safety net: CI, a deploy that works, error tracking and a linter. Every later fix depends on these to stay fixed.

- No CI: nothing runs typecheck, tests or build automatically (0.5–1 day)
- Deploy path is broken and runs an end-of-life Node (1–2 days)
- No error tracking or structured logging (1 day)
- No linter (1 day + fixes)
- The type baseline is stale, and escape hatches are growing (1–2 days)

### Phase 2 · this month

*one focused slice per week*

Privacy and data correctness. Merge the thumbnail paths first, then make signing cheap and turn off public-read, then reconcile orphaned bytes and quota.

- Two thumbnail orchestrators (2–3 days)
- Thumbnails of private files are publicly readable (3–5 days)
- Failed uploads leave S3 bytes and charged quota with no Item (2–3 days)
- Data-integrity gaps in loaders and deletes (1–2 days)

### Phase 3 · ongoing

*boy-scout rule on every feature PR*

Pay down on each touch: add tests for any loader or action you change, split `item-actions` one slice at a time, and fix accessibility on components you edit.

- UI accessibility and responsive debt (5–8 days)
- Tests are missing where the risk is (ongoing, ~2 weeks)
- `item-actions.ts` god module (3–5 days, incremental)
- Overlapping UI primitives (2–3 days)
- Unfinished migrations left in place (2–4 days)

---

*Method: read-only scan of the working tree on your computer — file and line counts, grep for type escapes and markers, an import scan against `package.json`, the tsc baseline, Dockerfile, `.gitignore`/`.dockerignore`, git history since June, and TASKS.md. The generated Prisma client (`app/prisma/`) is excluded from code metrics. "No import found" for a dependency means none in `app/`, `server*`, `scripts/` or `vite.config.ts`; confirm with a build before removing. 40 files had uncommitted changes at the time; findings reflect the working tree.*
