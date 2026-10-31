# Stashly Tech Debt Register

*Whole-repo audit · 24 Sep 2026 · scored as Priority = (Impact + Risk) × (6 − Effort), each 1–5*

## Summary

**At the audit (24 Sep):** Stashly already had good habits: subsystem docs and skills, bugs root-caused in TASKS.md, and a type baseline. Most of the debt sat around the code rather than in it. Nothing ran automatically (no CI, lint or error tracking), the deploy path didn't build, and thumbnails of private files were publicly readable.

**Now (30 Oct):** the safety net is mostly in place.
- **CI:** every push to `main` applies the migrations to a real Postgres and runs the typecheck, all 1022 unit tests in 87 files with none excluded, and the build. Green on `d7592ff` (30 Oct). The 8 Playwright specs are not part of it (item 20). It also migrates and boots the production image against that database, and checks that it answers `/api/health` 200 with a database and 503 without one. The type baseline is down from 249 errors to 11, and CI won't let it loosen.
- **Deploy:** the image builds on Node 24 with pnpm, and `fly.toml` runs migrations before each release.
- **Thumbnails:** reads are signed and uploads are private.
- **Errors and analytics:** Vinktar on server and browser since 10 Oct (item 4, partly done).
- **Still missing:** structured logging and a linter. Both need a new package, which needs the owner's decision.

**Update (25 Oct, later):** the Upload Call Audit (10 Oct, `docs/upload-call-audit.md`) was never folded into this register, and its source doc and the quota fix it came with sat on an unmerged branch (PR #26). Its findings were re-checked against `main` and added as **items 31–44**. Two are security-relevant. Item 31: uploads can go past the storage total; the fix is written and CI is green on the rebased PR, but it isn't merged (merged later that day as `059d0aa`). Item 32: the three search-index writes (`save_media_metadata`, `save_ocr_page`, `save_search_chunk_embeddings`) never receive the signed-in user, so anyone holding an item id can rewrite another user's search text, vectors or metadata. The rest are cleanup and load: cancelled uploads leave parts in S3 (33), 4xx responses are retried (34), and the per-file call counts behind items 35–44.

**Update (25 Oct):** the git history was re-checked against this register back to 25 Jul, commit by commit. Two items were missing. Item 29: Trash listed every user's trashed items, fixed on 3 Oct (`32d1431`) but never recorded here. Item 30, still open: two signed cookies fall back to the literal secret `'secret'` when `COOKIE_SECRET` is unset, and the local `.env` doesn't set it. Also recorded: a lock on any item made a folder's permanent delete fail (item 8, fixed 24 Oct); the Fly Postgres image gained pgvector (item 2); browser source maps reach Vinktar on deploy (item 4).

**Update (23 Oct):** an E2E pass after pulling found two more bugs, both fixed the same day. Item 27: favorites skipped the access check, so anyone with an item id could favorite another user's file and read its name and thumbnail. Item 28: the form and search decoders mangled typed text (every multi-word search became a fuzzy match, and a rename to "2024" was refused). The E2E suite runs green locally on one worker (item 20).

**Re-audit (8 Oct):** 109 commits since the audit. Item 14 is now resolved: `935a923` deleted the legacy thumbnail hooks (1,389 lines). Item 10 has its first fix: the Filter toggles are no longer nested inside the trigger (`eaf71e4`). The re-scan also found **7 new items (18–24)**. The most urgent is item 18: `/api/quota` lets any signed-in user set their own storage limit. Item 19 is next: the Stripe webhook acknowledges every event and saves nothing.

**54 items** (17 from the audit, 9 added 8 Oct, 2 added 23 Oct, 2 added 25 Oct from git history, 14 added 25 Oct from the upload call audit, 7 added 30 Oct: 45–47 from item 42, 48 from clearing its test folders, 49–51 from an external critique of item 42; 3 added 31 Oct: 52 from item 45's measurements, 53 and 54 from the owner's report of missing metadata) · categories: Code 24, Architecture 20, Infrastructure 4, Test 3, Documentation 2, Dependency 1

**Status at 30 Oct 2026 (latest):** 29 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 3 declined · 2 open from the audit (12, 13) · 4 new and open (19, 20, 22, 37). Item 44 declined, measured: each of the three access checks per file is one statement of about 3 ms and two are deliberate, and merging complete with create would save one request and 0.16–0.39 s per file but not a batch's time, for a 1–2 day rewrite of the upload machines.

**Status at 31 Oct 2026 (item 53 partly done):** an upload's metadata no longer waits behind embeddings and OCR. Metadata, vectors and OCR are three machines, and the GPU work waits until uploads are idle. On the 655-file upload every metadata save landed by 256 s (273 by 399 s before, still running) and every markdown and image facet was saved. It still trails a large upload by about 107 s while the server is busy, so item 53 stays open.

**Status at 31 Oct 2026 (items 53–54 registered):** uploads are fast, but many lose their metadata. Facets are written only by the in-tab indexing queue, where each file waits behind every earlier file's embeddings and OCR. A full reload or a closed tab before the queue drains leaves the rest with none: 0 of 30 camera JPEGs in one batch, and 15 of 16 after a reload in another. Item 53 splits the work into metadata (right after `itemCreated`), embedding and OCR machines, the last two deferred until uploads are idle. Item 54 is a re-survey of OCR models and a speed pass.

**Status at 31 Oct 2026 (item 52 resolved):** the upload panel mounts only the rows in view and the runner has no per-file components (`999b5a1`). The same 650-file upload went 233 → 90 s after `ec4b521`'s 698 → 233 s, with main-thread blocking at 0% of it, from 70% at the start of the day; rows per minute no longer fall as the batch grows. Isolating the per-file subscriptions was measured first and changed nothing, so it was reverted. Item 45 stays open.

**Status at 31 Oct 2026 (item 52 partly done):** the upload panel's rows no longer run framer-motion's layout animation (`ec4b521`). The same 650-file upload took 243 s instead of 698 s, with main-thread blocking at 38% of it instead of 70%, and the folder reloaded 9 times instead of 139 (rows now outrun the 700 ms debounce; item 45's mechanism is unchanged). Blocking still grows as the batch does, so item 52 stays open.

**Status at 31 Oct 2026 (item 45 measured):** item 45 reranked 12 → 28 (High) on measurements. Two runs of the 650-file `app/` upload made 146 and 139 full folder reloads, one per 4.6 files, with a reload in flight 27–28% of the upload, each one sending the folder back to its first page. The 700 ms debounce can't merge rows that arrive 1.1 s apart, and the indexing revalidate adds 33–47 more. The same runs found item 52: the main thread spends 99% of the upload in long animation frames, and rows per minute fall from about 150 to about 35 as the batch grows.

**Status at 30 Oct 2026 (late night, items 49–51):** an external critique of item 42 was checked against the code. Three gaps it pointed at are registered, all open and unmeasured: nothing applies the size log when a server starts (49), no test guards the deferred `Folder_itemId_fkey` (50), and one long row lock stalls the size rollup for every user (51). Its other claims didn't hold. Its fixes for the idle/busy split (log every upload, a statement-level trigger) are the dead ends measured in items 42 and 8. Its rollup fix (merge deltas, write each ancestor once) is what `apply_item_size_deltas()` already does. The log can't drift after a crash: a delta commits in the upload's own statement.

**Status at 30 Oct 2026 (late night, item 48):** item 48 registered and partly done: a malformed `POST /api/items` answered 500, now 400 (measured 3 of 3 intents; 5 new route tests); about 25 more handlers parse before any `try`.

**Status at 30 Oct 2026 (night, after item 42):** 30 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined (44) · 2 open from the audit (12, 13) · 7 new and open (19, 20, 22, 37, 45–47). Item 42 resolved (migrations `20261030140000_upload_size_delta_log`, `20261030160000_upload_size_inline_when_idle`), measured: an upload cascades at once while the database is idle and goes through a size log applied by one rollup at a time while it is busy. 32 uploaders into one shared folder 2,017 → 8,334 files/s, p95 52 → 5.8 ms, lock waiters 20.7 → 0.06, ancestor writes 100,512 → 2,821; one uploader unchanged (0 deltas logged, size work 757 ms vs 615 ms). Items 45–47 are its follow-ups.

**Status at 30 Oct 2026 (after item 43):** 29 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 2 declined · 2 open from the audit (12, 13) · 5 new and open (19, 20, 22, 37, 44). Item 43 resolved (`5155d96`, `0828f99`, `d7592ff`), measured: a file whose row lands after the reload's debounce now shows in the grid without a manual reload (0 → 6 of 6), the layout no longer queries workspaces on every navigation (20 → 0 per 20), and a thumbnail call checks access in one statement (3 → 1).

**Status at 30 Oct 2026 (after item 42):** 28 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 2 declined · 2 open from the audit (12, 13) · 6 new and open (19, 20, 22, 37, 43, 44). Item 42 declined: since `265c9d6` an upload's ancestor and quota locks last one statement, not the whole upload, so the 3–5 day rollup redesign waits for a measured symptom. This was read from the code; lock waits were not measured.

**Status at 26 Oct 2026 (after item 41):** 28 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 7 new and open (19, 20, 22, 37, 42–44). Item 41 resolved (`12e3f74`): the upload manager no longer spawns a quota actor that nothing talked to, and three revalidation checks that could never match are gone.

**Status at 26 Oct 2026 (after item 40):** 27 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 8 new and open (19, 20, 22, 37, 41–44). Item 40 resolved (`51ca00d`): a file with nothing to save sends no metadata request, and each facet write is one statement that concurrent saves can't break.

**Status at 26 Oct 2026 (after item 39):** 26 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 9 new and open (19, 20, 22, 37, 40–44). Item 39 resolved (`3ddbf90`): part URLs are signed 100 at a time and the first 100 arrive with the create answer; a 100 MB upload makes 10 requests to our server instead of 30.

**Status at 26 Oct 2026 (later):** 25 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 10 new and open (19, 20, 22, 37, 39–44). Item 38 resolved (`78a63f3`): the upload limit is 100 in the code as well as in what runs.

**Status at 26 Oct 2026:** 24 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 11 new and open (19, 20, 22, 37–44). Item 36 resolved (`265c9d6`, the folder tree resolved once per upload). Item 30 resolved (`074c06e`): the signed cookies read `SESSION_SECRET`, and production refuses to boot without it.

**Status at 25 Oct 2026 (late night):** 21 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 14 new and open (19, 20, 22, 30, 35–44). Items 33 (`8a79e89`) and 34 (`8ac03d9`) resolved: a cancelled or failed upload aborts its multipart upload, and a 4xx other than 429 fails on the first answer. Item 35 resolved and measured (5-minute encrypted cookie cache; session reads per upload 12 → 0, and 1 when the cookie has expired); item 36 waits on a measured folder upload. Counts: 22 resolved · 1 resolved in code, rollout step unconfirmed (2) · 13 new and open (19, 20, 22, 30, 36–44).

**Status at 25 Oct 2026 (night):** 19 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 16 new and open (19, 20, 22, 30, 33–44). Item 32 resolved (`41f2efe`): the three search-index writes need `write` on the item and a refusal is a 403.

**Status at 25 Oct 2026 (end of day):** 18 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 17 new and open (19, 20, 22, 30, 32–44). Item 31 resolved: PR #26 merged as `059d0aa`, CI green. The upload audit was re-run with real 10 MB and 100 MB files as the baseline for items 32–44 (see items 35 and 39).

**Status at 25 Oct 2026 (later):** 17 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 18 new and open (19, 20, 22, 30, 31–44). Item 31's fix is on PR #26, rebased onto `main` with CI green, not merged.

**Status at 25 Oct 2026:** 17 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 4 new and open (19, 20, 22, 30). Since 23 Oct: item 29 added as resolved (fixed 3 Oct), item 30 added as open.

**Status at 23 Oct 2026:** 16 resolved · 1 resolved in code, rollout step unconfirmed · 5 partly done · 1 declined · 2 open from the audit (12, 13) · 3 new and open (19, 20, 22). Since 8 Oct: items 21 and 24 resolved (9 Oct), item 4 partly done (Vinktar, 10 Oct), items 27 and 28 found and resolved (23 Oct).

**Status at 8 Oct 2026 (end of day):** 14 resolved · 1 resolved in code, rollout step unconfirmed · 4 partly done · 1 declined · 3 open from the audit · 3 new and open. Item 18 was resolved the same day it was found (`2fc9d4d`), with e2e coverage in `9081555`. Item 23 was done for every personal route, which turned up two more: item 25 (share-link actions had no access check, fixed the same day) and item 26 (expired and revoked grants still counted, fixed the same day). (Earlier on 8 Oct: 9 resolved · 7 new and open.) (At 2 Oct: 8 resolved · 1 in code · 2 partly · 1 declined · 5 open.) Item 8 had a follow-up pass on 2 Oct; what it found is fixed, apart from delete waiting on S3. Each item's details end with a dated **Status** line naming the commits; [Changes since the audit](#changes-since-the-audit) lists them by date.

### What's left, in priority order

*Updated 25 Oct (items 31–44 added later that day). Ordered by priority score; new items are marked **new**.*

| # | Item | Score | What remains | Blocked on |
|---|------|-------|--------------|------------|
| 18 | ~~`/api/quota` trusts the client~~ | 50 | Resolved 2026-10-08: route is read-only, upload charged in `createUploadedItem` | — |
| 25 | ~~Share-link actions had no access check~~ | 40 | Resolved 2026-10-08: every action takes the acting user and checks it | — |
| 27 | ~~Favorites skipped the access check~~ | 40 | Resolved 2026-10-23: favoriting and the Favorites list need read access; duplicates handled | — |
| 29 | ~~Trash listed every user's trashed items~~ | 40 | Resolved 2026-10-03 (recorded 25 Oct): the Trash query always filters by the signed-in owner | — |
| 26 | ~~`hasItemPermission` counts revoked and expired grants~~ | 35 | Resolved 2026-10-08: every access check counts only live grants | — |
| 31 | ~~Uploads can go past the storage total~~ | 35 | Resolved 2026-10-25: PR #26 merged as `059d0aa`; a charge past the total is a 507 and rolls back the row | — |
| 2 | Deploy path | 32 | The first real `fly deploy` and its release migration | Creating the Fly app and setting secrets |
| 32 | ~~Search-index writes skip the ownership check~~ | 32 | Resolved 2026-10-25 (`41f2efe`): all three writes check `write` on the item; a refusal is a 403 | — |
| 4 | Error tracking and logging | 28 | Structured logging; error tracking is Vinktar since 10 Oct, with browser source maps uploaded on deploy | Owner's choice of logger |
| 28 | ~~Form and search decoders mangle typed text~~ | 25 | Resolved 2026-10-23: values decoded once, typed text kept as text, bad input is a 400 | — |
| 19 | **new** Stripe webhook is a stub | 24 | All four event handlers | Whether paid plans ship before launch |
| 20 | **new** Playwright specs don't run in CI | 24 | A CI job for the 8 specs; the E2E bucket leaks one per run | — |
| 10 | Accessibility and responsive UI | 21 | Everything except the nested Filter buttons | — |
| 22 | **new** Open decisions in upload and onboarding | 20 | Three decisions already written up in TASKS.md | Owner's decision |
| 30 | ~~Signed cookies fall back to the secret `'secret'`~~ | 20 | Resolved 2026-10-26 (`074c06e`): production refuses to boot without `SESSION_SECRET`; set the Fly secret before the next deploy | — |
| 33 | ~~Cancelled uploads leave parts in S3~~ | 20 | Resolved 2026-10-25 (`8a79e89`, `e4aeb0e`): cancel, retry exhaustion and a failed complete all abort the multipart upload | — |
| 34 | ~~Upload requests retry 4xx answers~~ | 20 | Resolved 2026-10-25 (`8ac03d9`): a 4xx other than 429 fails on the first answer | — |
| 35 | ~~A session lookup on every request~~ | 20 | Resolved 2026-10-25: 5-minute encrypted cookie cache, refreshed by the page and upload routes; session reads per upload 12 → 0–1, measured | — |
| 21 | ~~Embedding backfill runs in every tab~~ | 18 | Resolved 2026-10-09: model in a worker (main-thread blocking 1,279 → 0 ms, measured), one tab via a Web Lock | — |
| 12 | Linter | 16 | All of it, plus the `as any` ban moved here from item 7 | Owner's OK on new packages |
| 13 | Tests where the risk is | 16 | `item-actions` create, move and copy; the rest of `quota-actions`; routes and components | — |
| 23 | **new** Prisma calls in route modules | 16 | `workspaces/workspace.tsx` only | Deferred to after personal-first (TASKS.md, 8 Oct) |
| 24 | ~~Slow first page load~~ | 15 | Resolved 2026-10-09: server dependencies bundled; first page 4–15 s → ~1 s here, first request 1.6 → 0.57 s on Linux (CI) | — |
| 36 | ~~Folder path resolved again for every file~~ | 15 | Resolved 2026-10-26: tree resolved once per batch, each file row one statement; 639-file upload 11,600 → 1,284 statements, 1,824 → 1 locks, measured | — |
| 37 | **new** The `.ts` sniff's result is thrown away | 15 | Persist the verified type or drop the S3 read | — |
| 38 | ~~Which upload concurrency limit applies is unknown~~ | 15 | Resolved 2026-10-26 (`78a63f3`): 100, measured; the code now says 100 too | — |
| 16 | Overlapping UI primitives | 12 | 5 `@radix-ui/*` importers, 3 global stylesheets | — |
| 17 | Unfinished migrations | 12 | Workspace stubs, unregistered `workspaces/create.tsx`, duplicate flat/nested API routes | Deferred to after personal-first (TASKS.md, 4 Oct) |
| 39 | ~~One presign request per part~~ | 12 | Resolved 2026-10-26 (`3ddbf90`): part URLs signed 100 at a time, the first 100 in the create answer; 100 MB upload 30 → 10 requests to our server, measured | — |
| 40 | ~~Media-metadata writes do extra work~~ | 10 | Resolved 2026-10-26 (`51ca00d`): a file with nothing to save sends no POST; one upsert per facet; 2 → 1 statements per save, 7 of 8 racing first saves refused → 0, measured | — |
| 41 | ~~Dead upload branches~~ | 10 | Resolved 2026-10-26 (`12e3f74`): the 3 unreachable `shouldRevalidate` checks deleted, the quota machine no longer spawned (file kept); actors per upload manager 6 → 5, measured | — |
| 42 | ~~Size rollup locks every ancestor row~~ | 10 | Resolved 2026-10-30: busy uploads go through a size log applied by one rollup at a time; 32 uploaders into one shared folder 2,017 → 8,334 files/s, lock waiters 20.7 → 0.06, one uploader unchanged, measured | — |
| 43 | ~~Revalidation and thumbnail query overhead~~ | 9 | Resolved 2026-10-30 (`5155d96`, `0828f99`, `d7592ff`): late rows no longer lost from the grid (0 → 6 of 6), workspace scans per 20 navigations 20 → 0, access statements per uploaded image 9 → 3, measured | — |
| 44 | ~~Separate complete and create requests~~ | 9 | Declined 2026-10-30: each access check is 1 statement (~3 ms) and two of the three are deliberate; merging saves 1 request and 0.16–0.39 s per file, not a batch's time, for a 1–2 day rewrite (measured); reopen if per-file latency becomes a complaint | — |
| 45 | **new** An upload reloads the whole folder every ~5 files | 28 | Measured 31 Oct: 139–146 full reloads per 650-file upload, one in flight 27–28% of the time, each back to the first page; one throttled reload schedule in place of the two debounces | — |
| 46 | **new** Session cookie expiring mid-upload | 15 | Measure the lookup burst at 100 concurrent uploads; refresh the session during long uploads if it matters | — |
| 47 | **new** Per-file shared rows left on the upload path | 12 | The direct parent's `Folder.childCount` and (if a collaborator's upload charges the owner) the `Quota` row; measure with all uploaders in one folder | — |
| 48 | **new** A malformed request answers 500 instead of 400 | 16 | Fixed for `/api/items` (30 Oct). About 25 more handlers call a parser before any `try`; fix them, or make the parsers' error a 400 response everywhere | — |
| 49 | **new** Nothing applies the size log when a server starts | 15 | Reproduce (deltas pending, process restarted, no upload); then start the rollup loop at server start | — |
| 50 | **new** No test guards the deferred `Folder_itemId_fkey` | 20 | A live-DB check that the constraint is still deferred, so a `db push` or a regenerated migration that drops it fails | — |
| 51 | **new** One held row lock stalls the size rollup for every user | 12 | Run item 42's 32-uploader benchmark with a large trash or move in the same tree; if the rollup stalls, batch and lock per owner tree | — |
| 52 | ~~The main thread is saturated for the whole upload~~ | 24 | Resolved 2026-10-31 (`ec4b521`, `999b5a1`): no layout animation, only visible upload rows mounted, no per-file watchers; 650-file upload 698 → 90 s, main-thread blocking 70% → 0%, measured | — |
| 53 | **new** An upload's metadata waits behind its embeddings and is lost on reload | 24 | Split in (31 Oct): all 655 metadata saves by 256 s instead of 273 by 399 s, every md/image facet saved; still lags a large upload by about 107 s while the server is busy (`save_media_metadata` p90 7.7 s) | — |
| 54 | **new** OCR is slow, and its models haven't been re-surveyed | 15 | Measure seconds per page with both engines on one scanned PDF, survey current browser OCR models, benchmark, switch on numbers | — |

Items marked *TASKS.md* are already root-caused in your backlog; this register scores them alongside new findings so they can be sequenced together.

## Prioritized register

| # | Item | Type | I | R | E | Priority | Effort | Status |
|---|------|------|---|---|---|----------|--------|--------|
| 1 | ~~No CI: nothing runs typecheck, tests or build automatically~~ | Infrastructure | 4 | 4 | 2 | **32** (High) | 0.5–1 day | Resolved |
| 2 | Deploy path is broken and runs an end-of-life Node | Infrastructure | 3 | 5 | 2 | **32** (High) | 1–2 days | Resolved in code; first `fly deploy` unconfirmed |
| 3 | ~~Two known 500s on ordinary requests~~ | Code | 3 | 3 | 1 | **30** (High) | 0.5 day | Resolved |
| 4 | No error tracking or structured logging | Infrastructure | 3 | 4 | 2 | **28** (High) | 1 day | Partly done (10 Oct) |
| 5 | ~~Thumbnails of private files are publicly readable~~ | Architecture | 4 | 5 | 3 | **27** (High) | 3–5 days | Resolved |
| 6 | ~~Unused, unpinned and unmaintained dependencies~~ | Dependency | 2 | 3 | 1 | **25** (High) | 0.5 day | Resolved |
| 7 | ~~The type baseline is stale, and escape hatches are growing~~ | Code | 3 | 3 | 2 | **24** (Medium) | 1–2 days | Resolved |
| 8 | ~~Data-integrity gaps in loaders and deletes~~ | Code | 2 | 4 | 2 | **24** (Medium) | 1–2 days | Resolved |
| 9 | ~~Failed uploads leave S3 bytes and charged quota with no Item~~ | Architecture | 3 | 4 | 3 | **21** (Medium) | 2–3 days | Resolved |
| 10 | UI accessibility and responsive debt | Code | 4 | 3 | 3 | **21** (Medium) | 5–8 days | Partly done (8 Oct) |
| 11 | ~~Generated and personal files in git~~ | Documentation | 2 | 2 | 1 | **20** (Medium) | 0.5 day | Resolved |
| 12 | No linter | Code | 2 | 2 | 2 | **16** (Medium) | 1 day + fixes | Open |
| 13 | Tests are missing where the risk is | Test | 4 | 4 | 4 | **16** (Medium) | ongoing, ~2 weeks | Open |
| 14 | ~~Two thumbnail orchestrators~~ | Architecture | 3 | 2 | 3 | **15** (Low) | 2–3 days | Resolved 3 Oct |
| 15 | `item-actions.ts` god module | Code | 3 | 2 | 3 | **15** (Low) | 3–5 days, incremental | Declined |
| 16 | Overlapping UI primitives | Code | 2 | 1 | 2 | **12** (Low) | 2–3 days | Partly done |
| 17 | Unfinished migrations left in place | Architecture | 2 | 2 | 3 | **12** (Low) | 2–4 days | Partly done |
| 18 | ~~`/api/quota` lets a signed-in user change their own quota~~ | Code | 5 | 5 | 1 | **50** (High) | 0.5–1.5 days | Resolved 8 Oct |
| 19 | The Stripe webhook acknowledges events and saves nothing | Code | 3 | 5 | 3 | **24** (Medium) | 1–2 days | New 8 Oct |
| 20 | The Playwright specs don't run in CI | Test | 3 | 3 | 2 | **24** (Medium) | 0.5–1 day | New 8 Oct |
| 21 | ~~Embedding backfill loads a WebGPU model on the main thread of every tab~~ | Architecture | 3 | 3 | 3 | **18** (Medium) | 1–2 days | Resolved 9 Oct |
| 22 | Open decisions in the upload and onboarding paths | Architecture | 2 | 3 | 2 | **20** (Medium) | 1 day once decided | New 8 Oct |
| 23 | Prisma calls made directly from route modules | Code | 2 | 2 | 2 | **16** (Medium) | 0.5–1 day | Partly done (8 Oct): workspace route deferred |
| 24 | ~~Slow first page load (cold document TTFB)~~ | Architecture | 3 | 2 | 3 | **15** (Low) | 1–3 days | Resolved 9 Oct |
| 25 | ~~Share-link actions had no access check~~ | Code | 4 | 4 | 1 | **40** (High) | 0.5 day | Resolved 8 Oct |
| 26 | ~~`hasItemPermission` counts soft-deleted and expired permissions~~ | Code | 4 | 3 | 1 | **35** (High) | 0.5 day | Resolved 8 Oct |
| 27 | ~~Favorites skipped the access check and stacked duplicate rows~~ | Code | 4 | 4 | 1 | **40** (High) | 0.5 day | Resolved 23 Oct |
| 28 | ~~Form and search decoders mangle typed text~~ | Code | 3 | 2 | 1 | **25** (High) | 0.5 day | Resolved 23 Oct |
| 29 | ~~Trash listed every user's trashed items~~ | Code | 4 | 4 | 1 | **40** (High) | 0.5 day | Resolved 3 Oct (recorded 25 Oct) |
| 30 | ~~Signed cookies fall back to the literal secret `'secret'`~~ | Code | 2 | 2 | 1 | **20** (Medium) | 0.5 day | Resolved 26 Oct |
| 31 | ~~Uploads can go past the storage total~~ | Code | 3 | 4 | 1 | **35** (High) | merge | Resolved 25 Oct |
| 32 | ~~Search-index writes skip the ownership check~~ | Code | 3 | 5 | 2 | **32** (High) | 0.5–1 day | Resolved |
| 33 | ~~Cancelled and failed uploads never abort the multipart upload~~ | Infrastructure | 2 | 3 | 2 | **20** (Medium) | 0.5 day | Resolved |
| 34 | ~~Upload requests retry 4xx answers five times~~ | Code | 2 | 2 | 1 | **20** (Medium) | 1–2 h | Resolved |
| 35 | ~~A database session lookup on every request~~ | Architecture | 3 | 2 | 2 | **20** (Medium) | 0.5 day | Resolved |
| 36 | ~~The folder path is resolved again for every file of a folder upload~~ | Architecture | 3 | 2 | 3 | **15** (Low) | 1–2 days | Resolved |
| 37 | The `.ts` sniff reads from S3 and nothing uses the result | Code | 1 | 2 | 1 | **15** (Low) | 1–2 h | New 25 Oct |
| 38 | ~~Which upload concurrency limit applies (10 or 100) is unknown~~ | Documentation | 2 | 1 | 1 | **15** (Low) | 1 h | Resolved 26 Oct |
| 39 | ~~One presign request per 5 MiB part~~ | Architecture | 2 | 1 | 2 | **12** (Low) | 0.5–1 day | Resolved 26 Oct |
| 40 | ~~Media-metadata writes do extra work~~ | Code | 1 | 1 | 1 | **10** (Low) | 2 h | Resolved 26 Oct |
| 41 | ~~Dead upload branches~~ | Code | 1 | 1 | 1 | **10** (Low) | 2 h | Resolved 26 Oct |
| 42 | ~~The size rollup locks every ancestor row~~ | Architecture | 2 | 3 | 4 | **10** (Low) | 3–5 days | Resolved 30 Oct |
| 43 | ~~Revalidation and thumbnail query overhead~~ | Architecture | 2 | 1 | 3 | **9** (Low) | 1–2 days | Resolved 30 Oct |
| 44 | Upload complete and item creation are separate requests | Architecture | 2 | 1 | 3 | **9** (Low) | 1–2 days | Declined 30 Oct |
| 45 | An upload reloads the whole folder about once every 5 files | Architecture | 4 | 3 | 2 | **28** (High) | 0.5–1 day | Measured 31 Oct |
| 46 | A session cookie can expire in the middle of an upload | Architecture | 2 | 1 | 1 | **15** (Low) | 0.5 day | New 30 Oct |
| 47 | Per-file shared rows left on the upload path | Architecture | 2 | 2 | 3 | **12** (Low) | 1–2 days | New 30 Oct |
| 48 | A malformed request answers 500 instead of 400 where the parser runs outside `try` | Code | 2 | 2 | 2 | **16** (Medium) | 0.5–1 day | Partly done (30 Oct) |
| 49 | Nothing applies the size log when a server starts | Code | 2 | 1 | 1 | **15** (Low) | 0.5 day | New 30 Oct |
| 50 | No test guards the deferred `Folder_itemId_fkey` | Test | 2 | 2 | 1 | **20** (Medium) | 0.5 day | New 30 Oct |
| 51 | One held row lock stalls the size rollup for every user | Architecture | 2 | 2 | 3 | **12** (Low) | 1–2 days | New 30 Oct |
| 52 | ~~The main thread is saturated for the whole upload~~ | Architecture | 4 | 4 | 3 | **24** (Medium) | 2–3 days | Resolved 31 Oct |
| 53 | An upload's metadata waits behind its embeddings and is lost on reload | Architecture | 4 | 4 | 3 | **24** (Medium) | 1–2 days | Partly done (31 Oct) |
| 54 | OCR is slow, and its models haven't been re-surveyed | Architecture | 3 | 2 | 3 | **15** (Low) | 2–3 days | New 31 Oct |

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
- **Status 2026-10-10: database side prepared** (`1419e08`, `b237941`). The stock `flyio/postgres-flex` image has no pgvector, so the migrations' `CREATE EXTENSION vector` would fail on a fresh cluster. `deploy/postgres/Dockerfile` installs `postgresql-<major>-pgvector`, taking the major from `PG_FLEX_TAG`, and `deploy/postgres/README.md` swaps the image in with `fly machine update`. The second commit fixed steps that failed when run against the real cluster, so a Fly Postgres cluster exists. **Still unconfirmed (25 Oct):** git records no app `fly deploy` and no run of the release migration against it. `engines` and `packageManager` are still not set.

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
- **Status 2026-10-10: partly done** (`65f3891`). Error tracking is Vinktar: `@vinktarhq/node` in `app/.server/vinktar.ts` with uncaught-error capture, and `vinktarRequest()`/`vinktarErrors()` around the React Router handler in `server/app.ts`; `@vinktarhq/browser` in the client, keyed at runtime by the root loader. It is off under Vitest (`vinktar.test.ts`). It also sends three product events (`signed_up`, `file_uploaded`, `subscription_started`). **Still open:** a JSON logger with a request id, and the `console.log` calls in `.server` code.
- **Status 2026-10-25: partly done, unchanged in scope.** `d78b724` (10 Oct) makes browser stack traces readable: the production client build writes `hidden` source maps, the Dockerfile's build stage uploads them with the `VINKTAR_CLI_KEY` build secret, then deletes every `.map`, so the image never serves source. Without the secret the upload is skipped. `app/.server` (tests excluded) has 18 `console.log` calls. Not counted at the audit: `/api/metrics` (`app/.server/metrics.ts`, Prometheus text, from `8df7efb`, 24 Jul) exposes pool, SSE and notify gauges. It is metrics only, not error tracking or logs.

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
- **Follow-up 2026-10-02: trash, restore and delete.** A second pass over the delete path found gaps the audit missed.
  - **Permission checks.**
    - **Permanent delete** (`c554b8c`) now needs `owner` on every item. The workspace is read from each item, so a caller can't skip the membership check by leaving it out. It answers 403 instead of a 200 carrying `{ success: false }`.
    - **Trash and restore** (`e04d07d`) had no check at all, so any signed-in user could trash or restore another user's items by id. They now need `write`, and `/api/items` answers with the real status.
    - **One query per batch:** both go through `assertItemsAccess` in `permission-actions.ts`, which checks the whole batch at once.
  - **Quota over-count on trash** (`e04d07d`).
    - **Cause:** `trashItems` summed `size` over a folder and its contents. A folder's `size` is a trigger rollup of its active contents, so nested bytes counted once per folder level, and files already in trash counted again. Restore summed only the files.
    - **Measured** on a 640-item upload of `app/`: trash moved 31,195,710 bytes for 8,195,840 bytes of files, and restore left the quota 22,999,870 bytes off.
    - **Now:** both sum the files whose status actually changed, and moved exactly 8,195,840 bytes each way.
  - **Delete only from trash** (`e04d07d`). Permanent delete refused nothing before; it now answers 400 for any item that isn't in trash, and deletes nothing.
  - **Round-trips** (`e04d07d`, `8e41013`).
    - Trash, restore and delete are each one statement, a data-modifying CTE. Their activities go in as one batched insert, and the quota update finds its own row.
    - On the dev DB, at 50 items: 406 / 405 / 60 round-trips on `main` (trash / restore / delete) became 4 / 4 / 3, the same at any batch size.
    - On the 640-item folder, the median of 5 alternating runs was trash 632 ms (main 703) and restore 1,140 ms (main 1,158). The time is dominated by the size trigger firing on every row (`EXPLAIN ANALYZE`, rolled back).
  - **Lost upload activity** (`e04d07d`).
    - **Measured:** 376 of 575 files in one directory upload had no activity.
    - **Cause:** the activity was started inside the item's transaction on the global client. Prisma's nested `connect` looked the item up on another connection before the commit and failed with P2025, swallowed by `.catch(() => {})`.
    - **Fix:** it now runs after the commit, and failures are logged. A re-upload had 576 of 576 files and 64 of 64 folders with exactly one activity.
  - **`inclusiveSize` lost nested bytes: fixed** (`20261002090000_fix_inclusive_size_rollup`).
    - **Measured:** trashing one file two levels below a folder took its bytes off that folder's `inclusiveSize`, although trashed bytes count until permanent delete. A moved folder's trashed contents were never counted under its new parent. Over 15 trash, restore, move, upload and delete steps the old trigger left 13 wrong folder values (rolled-back transactions).
    - **Cause, read from the function:** `update_size()` passed a folder's `size` change, which counts only active bytes, up as an `inclusiveSize` change. It also never reacted to an `inclusiveSize` change. At trash time the bytes left the grandparent; at permanent delete they left nowhere. The two cancelled, so the figure was wrong only while the file sat in trash. An earlier note here blamed parent and child changing in one statement; trashing a single row on its own shows the bug, so that was wrong.
    - **Fix:** a folder now contributes its own `inclusiveSize` to its parent's `inclusiveSize`, and a file its `size`. The update branch also reacts to `inclusiveSize` changes. The migration recounted every folder deepest level first; on the dev DB that corrected the 5 folders that were off, by 3,542,674 bytes in total.
    - **Test:** `item-size-trigger.test.ts` runs the 15 steps on real rows and compares every folder with a recount: 9 steps failed before the migration, 15 of 15 pass after.
    - **Not done: a statement-level trigger.** It rewrote 704 rows to restore the 639-item copy, where the row-level trigger rewrites 2,832. But a one-row insert went from 3.0 to 10.0 ms (medians, rolled-back runs), so it wasn't shipped. A version with a fast path for one-row statements is the open option.
  - **Open: delete waits on S3.** Deleting the 640-item folder took 20.8 s; its database statement takes about 0.65 s (`EXPLAIN ANALYZE` on the other, identically shaped copy). So about 20 s is the S3 removal, which `/api/items` awaits before responding. That split is inferred from those two measurements, not timed directly. Tracked in TASKS.md since 9 Oct (`4d8e7f9`).
- **Follow-up 2026-10-02 and 2026-10-03: uploads and timestamps around trash.** Not recorded at the time.
  - **Uploads into a trashed folder** (`1eac608`). `findOrCreateFolderPath` reused a folder with the right name and parent even if it was in trash. Re-uploading `app/prisma` filed all 64 files inside the trashed `prisma/`: nothing appeared where the user uploaded, and Trash showed the folder at double its size (4.4 → 8.8 MB). The lookup now skips trashed folders. Live-DB test `upload-into-trashed-folder-name`.
  - **Local time stored as UTC** (`32d1431`, `23eb94a`). The raw statements in `trashItems`/`restoreItems` and the batched activity insert wrote a bare `now()`. The DB session time zone is Asia/Jerusalem and the columns have none, so they stored local time that Prisma reads as UTC: `updatedAt` and activity times showed 3 hours ahead, some in the future. All three now write `now() AT TIME ZONE 'UTC'`; tests check the stamp against the clock.
  - The same commit, `32d1431`, fixed item 29.
- **Follow-up 2026-10-24: a lock blocked permanent delete** (`839f933`). `LockedItem.itemId` referenced `Item` with the default `RESTRICT`, so one lock anywhere in a trashed subtree failed the whole delete with `LockedItem_itemId_fkey`, and the rest of the batch with it. The constraint is now `ON DELETE CASCADE`, like the other rows that describe an item (migration and `item.prisma`). `item-delete-objects.test.ts` adds a folder holding a locked file (12 tests).

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
- **Status 2026-10-08: partly done.**
  - **Fixed:** the Filter trigger no longer nests the flag toggles inside its button (`eaf71e4`, 3 Oct), which removes the invalid HTML behind the hydration error.
  - **A cheap path for the biggest finding:** `item-card.tsx` already defines `ItemCard.Link`, a real React Router `<Link>` (it renders a `<span>` for trashed items). No component renders it: a search for `<X.Link` outside `components/ui/` finds nothing. Rendering it as a stretched link over the card would make cards keyboard- and middle-click-reachable without rewriting them. List rows (`data-table.tsx`) still navigate from a `tr onClick`.
  - **Unchanged:** unnamed icon buttons, the toolbar overflow below ~840px, phone navigation, the item panel covering the file, and the audio seek bar. Not re-measured in a browser.

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
- **Status 2026-10-02: open, with `item-actions` coverage started.**
  - **`item-actions.ts` now has tests of its own**, run against a live database:
    - `item-delete-objects` (11): S3 removal, owner access, and only from trash.
    - `item-trash-access` (17): write access, quota amounts on nested and overlapping selections, and batched activities.
    - `upload-activity` (1): no activity write while a transaction is open. It fails on the old code every time.
  - **Counts:** `app/.server/__tests__` has 9 test files. `pnpm test` is 649 passing in 46 files, and CI runs all of them.
  - **Still missing:** create, move and copy in `item-actions`; quota on its own; routes and components. There are still 8 Playwright specs.
- **Status 2026-10-25: open, improving.** CI ran 909 tests in 73 files, all passing, on `bfefbbf` (24 Oct). New since 23 Oct: `remembered-account.test.ts` (3) for the sign-in "Continue as" cookie, and a locked-file case in `item-delete-objects` (item 8). Still missing: create, move and copy in `item-actions`, and components.
- **Status 2026-10-23: open, improving.** `pnpm test` is 905 passing in 72 files (CI green on `82a878e`). New since 8 Oct: `favorite-actions` (16, live DB: access checks, duplicate rows, the usage count) and 26 more `parsers` tests (39 in all: decoding, numeric round-trip, `toUserText`, 400 on bad input), both from items 27 and 28. The favorites e2e spec went from 3 tests to 13, and the search, pinned, navigation and thumbnail specs were brought back in line with the UI (item 20). Still missing: create, move and copy in `item-actions`, and components.
- **Status 2026-10-08 (end of day): open, improving.** Unit test files are at 68 (818 tests, all passing; CI green on `30eeeb4`). `app/.server/__tests__` has 18, adding `upload-quota-charge` (live DB: exact charge, no row without a quota, 10 parallel uploads summed exactly), `share-access` (37), `route-query-actions` (5) and `permission-live-grants` (14). Route tests went from 1 to 3: `app/routes/api/__tests__/quota.test.ts` covers the quota route item 18 named as untested, and `app/routes/__tests__/no-direct-prisma.test.ts` guards item 23. The upload e2e spec went from 1 test to 11 (`9081555`); CI still doesn't run it (item 20). Still missing: create, move and copy in `item-actions`, and components.
- **Status 2026-10-08: open, improving.** Unit test files went from 39 at the audit to 62. `app/.server/__tests__` has 14, including upload safety, trash roots and the size trigger, and `app/machines` has 10. Still 0 component tests, 1 route test, and no test for the quota route (see item 18). The 8 Playwright specs exist but CI doesn't run them (item 20). `bcb227d` fixed the thumbnail spec's setup.

### 14. Two thumbnail orchestrators

*Architecture debt · Impact 3 · Risk 2 · Effort 3 → **15** · est. 2–3 days · source: new*

- **Evidence:** The XState scheduler in `app/machines/thumbnail/` is the documented path, but `components/upload/upload-thumbnail-runner.tsx` still drives the legacy `hooks/useThumbnail.ts` orchestrator. Both have to stay correct through changes like the signing work.
- **Fix:** Move the upload runner onto the scheduler and delete `useThumbnail`. Do this before the signing work so the change happens in one place.
- **Why it matters:** Every thumbnail change costs twice as much, and the two paths can drift apart.
- **Status 2026-10-01: open.**
  - `upload-thumbnail-runner.tsx` still imports `useThumbnail`, and the signing work (`68e5cc9`) landed with both paths still in place.
  - `1a778fd` (2026-09-26) fixed two bugs in the path: an upload job now replaces a queued backfill job for the same item, and the backfill lane no longer stays paused after an upload.
  - The XState pipeline is on trial behind a flag. The legacy hooks stay until the owner signs it off visually.
- **Resolved 2026-10-03** (`935a923`). `useThumbnail.ts`, `useThumbnailBackfill.ts` and `hooks/thumbnail-signal/` are deleted (1,389 lines), and nothing in `app/` imports `useThumbnail` any more. The XState scheduler is the only path. `d11ffae` also makes thumbnails only for cards on screen. `d41dd8e` splits the pipeline by file type.

### 15. `item-actions.ts` god module

*Code debt · Impact 3 · Risk 2 · Effort 3 → **15** · est. 3–5 days, incremental · source: new*

- **Evidence:** `app/.server/item-actions.ts` is 3,544 lines with 58 exports. Next largest: `search-actions.ts` (1,551), `invitation-actions.ts` (1,154), `s3.ts` (1,151).
- **Fix:** Split it by lifecycle (create/upload, move/copy, trash/restore/delete, metadata/metrics) behind the same exports, one slice per PR, with tests added per slice.
- **Why it matters:** Merge conflicts and review effort concentrate in one file, and it has no tests.
- **Status 2026-09-29: declined.** A per-slice plan was drafted, and the owner decided not to split the file. It has grown to 3,668 lines and 59 exports, mostly from `getFolder` in `62ddd1c`. Its tests remain part of item 13. (2026-10-02: 3,665 lines and 59 exports after the trash/restore/delete rewrite.) **8 Oct:** 3,962 lines. TASKS.md now lists "Split `app/.server/item-actions.ts`" under *Someday* with candidate seams (4 Oct), so the decision may be worth revisiting.

### 16. Overlapping UI primitives

*Code debt · Impact 2 · Risk 1 · Effort 2 → **12** · est. 2–3 days · source: new*

- **Evidence:** Radix is imported two ways: the `radix-ui` umbrella (24 imports) and individual `@radix-ui/*` packages (13 imports). Icons come from three sources: `lucide-react` (18 imports), `@remixicon/react` (6) and a 4,309-line `icons.tsx`. There are three global stylesheets (`global.css`, `globals.css`, `theme.css`) plus a `.backup`. Animation uses both `framer-motion` (15 imports) and `@formkit/auto-animate` (1).
- **Fix:** Standardize on the `radix-ui` umbrella, one icon source plus the custom set, and one global stylesheet with a theme layer. Drop `auto-animate`.
- **Why it matters:** Bundle weight and "which one do I use?" friction for every new component.
- **Status 2026-10-01: partly done** (`d8bf186`, 2026-09-25; counts re-checked 2026-10-01).
  - **Done:** `lucide-react`, `@remixicon/react` and `@formkit/auto-animate` are removed, with their icons moved to `icons.tsx` and 0 imports left. 31 files import the `radix-ui` umbrella.
  - **Left:** 5 files still import `@radix-ui/*`: `item-card.tsx` and four under `components/ui/`. There are still three global stylesheets (`global.css`, `globals.css` and `theme.css`), and `framer-motion` is imported in 15 files.
  - **Re-checked 2026-10-25:** still 5 `@radix-ui/*` importers and the same three stylesheets.

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
- **Status 2026-10-08: unchanged, now deferred.** The 4 Oct TASKS.md triage moved the workspace repointing to *Someday* ("workspace-only, so it waits per personal-first"). The stubs and `create.tsx` are still there, and `create.tsx` is still unregistered.

### 18. `/api/quota` lets a signed-in user change their own quota

*Code debt (security) · Impact 5 · Risk 5 · Effort 1 → **50** · est. 0.5–1.5 days · source: new (8 Oct); flagged as unverified in `docs/project-analysis-2026-10-04.md`*

- **Evidence:** `app/routes/api/quota.ts` takes `action` and `dataSize` from the request body (`quotaApiRouteInput`, where `dataSize` is `z.coerce.bigint()` with no sign or range check). It applies them to the caller's own quota:
  - `update-total-quota` calls `updateTotalQuota`, and `applyQuotaDelta` documents `total` as an *absolute replacement*. Any signed-in user can set their own storage limit to any number.
  - `items-trashed`, `items-deleted`, `items-restored` and `items-copied` shift `used` and `deleted` by whatever amount the client sends.
  - `items-uploaded` charges a client-supplied size.
- **Who calls what:** a search of `app/` finds no client caller for `update-total-quota`, `items-trashed`, `items-deleted`, `items-restored` or `items-copied`. Since 2 Oct the server charges trash, restore and delete itself (item 8). Only `find-quota`, `verify-free-quota`, `check-free-quota` (the quota machine) and `items-uploaded` (`db.machine.ts`) are still in use.
- **Fix:**
  1. Delete the five unused intents today, and reject non-positive `dataSize` on the rest.
  2. Move the upload charge to the server: charge `item.size` from the `Item` row in an action keyed by `itemId`, and stop taking a size from the client. This also settles part of item 22.
  3. Add a route test that a forged body can't change `total`.
- **Why it matters:** quota is what paid plans sell, and today it can be changed with one `fetch`. Of everything in this register, this is the cheapest fix for the largest risk.
- **Verified by reading the code only.** The endpoint wasn't called, so no data changed.
- **Status 2026-10-08: resolved in code.**
  - `/api/quota` is read-only: `find-quota`, `verify-free-quota` and `check-free-quota`. Every write action, `items-uploaded` included, answers 400, as does a negative or oversized `dataSize`. The schema is a discriminated union on `action`.
  - The upload charge is back in `createUploadedItem`, as the last statement of the row's transaction. `dbMachine`'s `chargingQuota`/`retryingQuota`, the client `updateQuota` helper and the quota machine's `update` path are deleted.
  - Tests: `app/routes/api/__tests__/quota.test.ts` (13; 9 fail against the old route) and `app/.server/__tests__/upload-quota-charge.test.ts` (4, live DB; 3 fail with the charge removed). 10 parallel uploads by one user charged in 297 ms, sum exact. E2E (`9081555`): from the browser, quota grows by exactly the uploaded size, the page sends only reads, and each former write answers 400 (11/11 locally).
  - **Still open:** the size is the client's. `createUploadedItem` charges `data.size`, which `api/items.ts` takes from the form, so a client can still report a smaller file than it stored. Closing it means reading the object's size from S3 (`HeadObject`) before the row is written.

### 19. The Stripe webhook acknowledges events and saves nothing

*Code debt · Impact 3 · Risk 5 · Effort 3 → **24** · est. 1–2 days · source: `docs/project-analysis-2026-10-04.md`*

- **Evidence:** `app/routes/api/stripe.ts` verifies the signature and then, for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.paid`, runs only `// TODO` comments and commented-out `prisma` calls. It returns 200, so Stripe marks every event delivered and never retries. `docs/project-overview.md:472` says the handler "syncs subscription state to database", which isn't true today.
- **Fix:** implement the four handlers against the `Subscription` model, keyed by `stripeSubscriptionId` and safe to run twice (Stripe redelivers). Call `updateTotalQuota` from here on a plan change, server-side, which is the legitimate caller item 18 should keep. Test with the Stripe CLI (`stripe trigger`). Correct `project-overview.md`.
- **Why it matters:** a renewal, cancellation or failed payment in Stripe never reaches the database. Users keep paid storage after cancelling, or never get it after paying.

### 20. The Playwright specs don't run in CI

*Test debt · Impact 3 · Risk 3 · Effort 2 → **24** · est. 0.5–1 day · source: new (8 Oct)*

- **Evidence:** `.github/workflows/ci.yml` runs the typecheck, `pnpm test` (Vitest), the build and a Docker smoke test. None of its steps runs `test:e2e`, so the 8 specs in `tests/e2e/` run only when someone runs them by hand. `bcb227d` (3 Oct) had to fix the thumbnail spec's setup because it had drifted.
- **Fix:** add a job that reuses the CI Postgres service, builds and starts the app, seeds the auth session (`tests/e2e` global setup), and runs Playwright on Chromium only. If the full suite is too slow for every push, run it nightly. Upload the report as an artifact.
- **Why it matters:** the e2e specs cover upload and thumbnails, the flows with the most costly regressions, and they rot when they don't run.
- **Status 2026-10-08: open, and more is now at stake.** `9081555` rewrote `upload.spec.ts` from 1 test to 11: filing, the exact server-side quota charge, a page that sends only quota reads, and a 400 for every former write on `/api/quota`. 11/11 pass locally (1 worker, 37.2 s); CI still runs none of it. Two things the CI job must handle:
  - **One shared user.** Every spec signs in as the same seeded user, and Playwright runs spec *files* in parallel workers. An upload in `thumbnail-machine.spec.ts` can land inside `upload.spec.ts`'s quota window and break its exact delta. Run with `--workers=1`, or seed a user per worker.
  - **The bucket.** On the 8 Oct run, global setup reported the E2E user back on `default-bucket` and created a new one (`e2e-bucket.ts`). Why it had been reset was not investigated.
- **Status 2026-10-23: open; the suite is green locally.** After the pull the specs had drifted from the UI, and one parallel-worker race was the cause of most failures.
  - **One worker** (`a581626`): `playwright.config.ts` sets `workers: 1`, which settles the shared-user point above. Measured: 8 workers → 37 passed, 9 failed; 1 worker → 51 passed, 1 skipped, 0 failed in 1.9 min. Traces are kept on failure (`'on-first-retry'` never recorded one, because `retries` is 0).
  - **Specs fixed** (`0a1134b`..`b83faa1`): navigation covers the sidebar links that replaced Recent Files; search types into the header `Filters` box after hydration and reads `?query=`; pin and favorite toggles wait for the POST and use exact menu labels; the thumbnail spec asserts stage 3's 512×512 crop, which needs no WebGPU.
  - **The bucket, answered:** `global-teardown.ts` deletes the E2E user, so every run starts with no bucket and `e2e-bucket.ts` creates a new one. Each run leaves one Tigris bucket behind. A stage-2 thumbnail PUT to a just-created bucket failed intermittently on a blocked request, suspected to be its CORS settings not yet applied. Not proven, and not fixed.
  - **Still to do:** the CI job itself.
- **Status 2026-10-30: open; two red tests found running the full suite for item 43, one fixed:**
  - `thumbnail-machine.spec.ts` "a type with no producer publishes nothing rather than inventing a thumbnail" had failed since `51ca00d` (item 40, 26 Oct). It required a metadata save for a `.bin`, and item 40 deliberately stopped sending one for a file with nothing to save. The spec was last changed in `b83faa1` (23 Oct). This is what not running in CI costs: the change shipped green in Vitest and broke a spec nobody ran. **Fixed the same day** (`19f3330`): the probe follows each indexing run to its final state, and the test asserts the `.bin`'s run ends in `indexed` with nothing posted. 3/3 alone, 14/14 for the spec.
  - `navigation.spec.ts`'s sidebar clicks are flaky inside the full suite: 1 to 3 of its 12 tests fail per run, a different link each time, with the page left on the `?layout=grid` URL it rewrites itself to. The spec passes 36 of 36 run alone. It is not from item 43's layout change: a control run with `main`'s `layout.tsx` failed 2 of 36 the same way. Not fixed.

### 21. Embedding backfill loads a WebGPU model on the main thread of every tab

*Architecture debt · Impact 3 · Risk 3 · Effort 3 → **18** · est. 1–2 days · source: TASKS.md (Active)*

- **Evidence:** from TASKS.md. `useEmbeddingBackfill` arms on every new tab and lazy-loads `@/workers/embedding.ai` on the page rather than in a worker. It runs a WebGPU model on the main thread, and it fails on the owner's machine. `c8f3fd1` (2 Oct) embeds in batches of 16 and releases the model when idle, which reduces the cost but doesn't move it off the main thread.
- **Fix:** run the model in a dedicated worker (the repo already has `app/workers/`). Elect one tab with the Web Locks API (`navigator.locks.request('embedding-backfill', …)`) so N open tabs don't each load the model.
- **Why it matters:** jank and GPU memory multiply with every open tab, and a failure here is silent until search quality drops.
- **Status 2026-10-09: resolved, and measured in a browser** (`df68279`).
  - **Worker:** `app/workers/embedding.worker.ts` loads and runs the model. `embedding.ai.ts` keeps its API and became the page-side client, so the search query, re-ranking, indexing and the backfill are unchanged. Each batch is still one `ai-queue` job that awaits the worker's reply, which keeps one GPU job at a time across the page and the worker. Release terminates the worker, freeing its whole GPU device.
  - **One tab:** `runInOneTab` takes the `stashly:embedding-backfill` Web Lock with `ifAvailable`. A tab that finds it held reports `skipped`, "Running in another tab", instead of loading the model and embedding the same chunks.
  - **Build:** `embedding.worker-*.js` is emitted on its own (541.87 kB, with the model library); the page's `embedding.ai-*.js` is 1.37 kB.
  - **Tests:** `runInOneTab` (4, fake lock manager). The batching and idle-release tests now run against a fake worker that speaks the real protocol, with two new failure cases (an error reply keeps the worker; a crash fails the waiting request and the next call starts a new worker). `pnpm test` 824/824 (68 files), type gate clean, `pnpm build` passes.
  - **Measured 2026-10-09** in the owner's Chrome 154 (Intel gen-12lp, WebGPU), dev server, embedding the same two texts with the model already cached:
    - Old code (model on the page): main-thread long tasks of 122, 57, 65 and 1,035 ms, **1,279 ms blocked**; 2,787 ms end to end; no worker.
    - New code (model in the worker): **no long tasks, 0 ms blocked**; 3,261 ms end to end; one `embedding.worker.ts` started. One run each, so the ~0.5 s difference in wall time is indicative only.
    - Vectors: 2 × 768 dimensions, each of norm 1. A first, uncached run took 11,081 ms, also with no long tasks.
    - **Idle release:** one `terminate()` about a minute after the last embedding.
    - **One tab:** with the lock held in another tab, a fresh tab's automatic backfill made 0 `pending_search_embeddings` requests; with it free, 1. (The page loads ~290 resources, past the 250-entry default timeline buffer, so the requests were counted by wrapping `fetch` in an init script.)
    - The D3D failure in TASKS.md did not occur in these runs.
  - **Not verified:** GPU memory while the worker and a page model are both loaded (the worker has its own WebGPU device, so that memory is held twice), and a production build: these runs were against the dev server.

### 22. Open decisions in the upload and onboarding paths

*Architecture debt · Impact 2 · Risk 3 · Effort 2 → **20** · est. 1 day once decided · source: TASKS.md*

- **Evidence:** three questions are written up in TASKS.md and not yet decided:
  1. ~~**Quota when every retry fails:** `dbMachine` charges after the `Item` row exists (`chargingQuota` ⇄ `retryingQuota`). If every retry fails, the item exists uncharged.~~ **Settled 2026-10-08** by item 18: the charge is in the row's transaction, so there is no retry and no unbilled row.
  2. **Failed onboarding:** `onboardNewUser` runs in better-auth's `user.create.after` hook. If bucket, drive or root creation fails, can the user still sign in later with no bucket?
  3. **Workspace uploads:** `createUploadedItem` never sets `workspaceId`, so a file uploaded into a workspace folder is the uploader's personal item.
- **Fix:** decide each one, then write a test that pins the decision. Moving the upload charge to the server (item 18) settles question 1.
- **Why it matters:** each one is a quiet way for quota, ownership or account state to drift from what the UI shows.

### 23. Prisma calls made directly from route modules

*Code debt · Impact 2 · Risk 2 · Effort 2 → **16** · est. 0.5–1 day · source: TASKS.md (Active), confirmed 8 Oct*

- **Evidence:** four route modules import `prisma` from `@/services/db` and query it directly: `routes/api/shares.ts` (`item.findUnique`, `permission.findFirst`, `shareLink.findMany`), `routes/stash/gallery.tsx`, `routes/stash/shares.tsx` and `routes/workspaces/workspace.tsx`. Every other route goes through `app/.server/*-actions.ts`, where access checks live.
- **Fix:** move each query into the matching `*-actions.ts` next to its access check. Then add the `no-restricted-imports` rule for `@/services/db` under `app/routes/` that TASKS.md proposes as the linter's first rule (item 12).
- **Why it matters:** access checks are enforced in the actions layer. A route that queries Prisma directly is a place where one can be forgotten. `api/shares.ts` reads permissions itself.
- **Status 2026-10-08: done for every personal route; `workspace.tsx` deferred** (`bb321a3`, `e9f163b`).
  - `api/shares.ts` lists links through `listShareLinksForItem` (share-actions), with the same rule the route ran inline: owner, or a live `write`/`owner` permission; 404 for a missing item, 403 otherwise.
  - `stash/shares.tsx` calls `getItemsSharedWithUser`, and `stash/gallery.tsx` calls `getGalleryMedia` (thumbnail-actions), which writes `ownerId` after the URL filters.
  - None of the three failed open before the move. Each was already scoped to the session user, and the gallery's URL filters build `{ AND: [...] }`, so `?owner=` could only narrow it.
  - **Guard:** `app/routes/__tests__/no-direct-prisma.test.ts` fails on any `@/services/db` import under `app/routes/`. It stands in for the `no-restricted-imports` rule until item 12. Its one exception is `workspaces/workspace.tsx`, and it also fails if that entry outlives the import.
  - **Deferred:** `workspace.tsx` (six queries) is workspace-only, so it moved to TASKS.md *Someday* per personal-first.
  - Moving `api/shares.ts` turned up items 25 and 26.
  - Tests: `route-query-actions.test.ts` (5, live DB). `pnpm test` 804/804 (67 files), the type gate is clean and `pnpm build` passes.

### 24. Slow first page load (cold document TTFB)

*Architecture debt · Impact 3 · Risk 2 · Effort 3 → **15** · est. 1–3 days · source: TASKS.md (Active)*

- **Evidence:** from TASKS.md, measured 2026-09-25 against the production build. The stash document's first load had a **1,752 ms** TTFB, against 354 ms warm, with 254 KB of HTML and 44 signed thumbnail URLs. The server log showed the same document at 2,997 ms. The `.data` request for the same route is fast.
- **Fix:** profile one cold request before changing anything: route module loading, the signing cache's first window, and the session lookup. Signing is already cached per window (item 5), so 44 cold signatures is the first suspect. Since `d11ffae`, only on-screen cards get thumbnails, so check whether the loader can sign only the first page of thumbnails.
- **Why it matters:** the first load is the first impression, and it's 5× slower than the same page warm.
- **Status 2026-10-09: resolved** (`57f499c`). The suspects above were wrong: neither signing nor the loader was slow.
  - **Cause, measured:** the server build left every dependency external, so its first import (on the first request) loaded **1,697 separate files** from `node_modules`. A module-hook count showed **81% of that import (4,594 of 5,675 ms) was resolving and reading files**, ~2.7 ms each on this Windows machine. A CPU profile of a cold `/api/health` agreed (5.3 s under the deferred build import, mostly file-system calls). Every first request paid it: a page, a redirect, `/api/health`. A static file did not (12 ms).
  - **Fix:** `vite.config.ts` bundles every dependency into the server build (`environments.ssr.resolve.noExternal`, build only; dev unchanged). Only Node built-ins stay external; the import loads **38 files**. Separately, dotenvx was replaced by `process.loadEnvFile` (`app/.server/env.ts`): importing dotenvx ran hardware probes including a shell command, 597–709 ms per process against 0.6–1.1 ms.
  - **Rejected:** loading the build at boot instead. It only moved the same seconds into startup.
  - **Measured (fresh production server, same harness):** first page **4,055–15,119 ms → 761–1,724 ms** in 9 of 10 runs (one run at 5,709 ms, with its warm requests also 2–4× slower); startup 629–2,322 → 522–968 ms; server-build import 4,828–18,440 → 432–659 ms.
  - **Same output:** status codes match on 30 routes; captured back to back, the bodies differ only in request timestamps.
  - **Linux:** CI's production image answered its first `/api/health` in **1,610 ms before and 566 ms after** (server logs of the `docker` job, runs on `9c2e75a` and `f731933`; one run each). The bundled image also passed CI's boot checks: 200 with a database, 503 without.
  - **Left:** the first page is still ~1 s against ~0.1 s warm, roughly half the (now small) build import and half first database/session setup.

### 25. Share-link actions had no access check

*Code debt (security) · Impact 4 · Risk 4 · Effort 1 → **40** · est. 0.5 day · source: found 8 Oct while moving `api/shares.ts` (item 23)*

- **Evidence:** `app/.server/share-actions.ts` had no access check: no `assertItem*` call, and no user passed to any mutation. The `/api/shares` action called `createViewLink`, `createEditLink`, `createEmbedLink`, `createUploadLink`, `updateShareLinkScope`, `updateShareLinkType`, `expireShareLink`, `updateShareLink`, `revokeShareLink` and `revokeAllShareLinksForItem` with only the id from the form. Only the route's *loader* checked access.
- **Impact today:** any signed-in user could create links on any item, and re-scope, retype, re-password, expire or revoke any link whose id they knew. No route resolves a share link yet, and a link's permission row lists no users, so a forged link granted no read access. It would have become a read hole the day a link resolver shipped. Read from the code; the endpoint was not called.
- **Fix:** every action takes the acting user as its first argument and checks it itself, so a new caller cannot skip it. `assertCanManageItemShares` keeps the loader's rule: owner, or a live `write`/`owner` permission (not soft-deleted, not expired). `assertCanManageShareLink` finds the link's item from its permission row first. The three generic `updateShareLink` calls in the route became `updateShareLinkSettings`.
- **Status 2026-10-08: resolved** (`bb321a3`). `share-access.test.ts` (37, live DB): a stranger, a read-only grantee and a grantee whose write permission expired each get 403 on all 11 operations, with the item's links unchanged. The owner and a live writer can manage links. Missing items and links answer 404.

### 26. `hasItemPermission` counts soft-deleted and expired permissions

*Code debt (security) · Impact 4 · Risk 3 · Effort 1 → **35** · est. 0.5 day · source: found 8 Oct while fixing item 25*

- **Evidence:** `hasItemPermission` (`permission-actions.ts:387`) matches any `Permission` that lists the user with a satisfying role. It has no `deletedAt: null` and no `expiresAt` check. `assertItemPermission` and `assertItemAccess` build on it. Canceling an invitation revokes by stamping `deletedAt` (`invitation-actions.ts:1087`, `:1142`), and permissions can carry `expiresAt`.
- **Not verified end to end:** whether a canceled invitee still passes `assertItemAccess`, which depends on whether a pending invitation's permission already lists them.
- **Fix:** confirm in a rolled-back transaction, then add both filters to `hasItemPermission` and run the full suite, since every access check goes through it. Item 25's `assertCanManageItemShares` filters both itself for this reason.
- **Why it matters:** a revoked or expired share that still opens the file is a privacy failure the owner cannot see.
- **Status 2026-10-08: resolved** (`1a8102a`). **Confirmed 2026-10-08** in a rolled-back transaction: an expired grant and a soft-deleted grant both passed `hasItemPermission` and were both listed by the `accessibleBy` filter. **Canceling does not leak**: a pending invitation's permission has no users (`invitation-actions.ts:621`); the invitee is attached only on accept (`:903`), and only pending recipients can be canceled. **Expiry does**: an accepted share with an end date kept working after `expiresAt`.
  - **Fix:** `livePermission()` in `app/utils/permissions.ts` (`deletedAt: null`, and `expiresAt` null or in the future) is ANDed into every access decision: `hasItemPermission` (so `assertItemPermission` and `assertItemAccess`), `hasLinkPermission`, `hasRecipientPermission`, the batch `assertItemsAccess`, and the `accessibleBy` item filter that decides what a user's listings show. Workspace sync and removal queries maintain rows rather than decide access, and are unchanged.
  - **Tests:** `permission-live-grants.test.ts` (14, live DB) fails 8 on the old code: every expired and deleted case. The live-grant and owner cases pass on both. `item-filters-coverage.test.ts` pinned the old `accessibleBy` shape, and now requires the live-grant conditions. `pnpm test` 818/818 (68 files), the type gate is clean and `pnpm build` passes.

### 27. Favorites skipped the access check and stacked duplicate rows

*Code debt (security) · Impact 4 · Risk 4 · Effort 1 → **40** · est. 0.5 day · source: found 23 Oct during the post-pull E2E pass*

- **Evidence:** `addFavorite` and `addFavorites` (`item-actions.ts`) took any item id with no access check, and `getFavoritedItems` listed every favorited row. Anyone holding an item id could favorite another user's file and read its name, size and thumbnail from their own Favorites page. A favorite made while a share was live stayed listed after the owner revoked it. `Favorite` has no unique constraint (by design, see `stashly-prisma-data`), so a double submit stored two rows and `removeFavorite` deleted one: Unfavorite answered 200 and the item stayed. `/api/favorites` parsed its body outside the `try`, so a malformed request was a 500.
- **Fix:** read access through the existing checks, applied in the action so no caller can skip it.
- **Status 2026-10-23: resolved** (`6522ba0`).
  - `addFavorite` runs `assertItemAccess`; `addFavorites` runs `assertItemsAccess` for `read`, all-or-nothing for the batch. An unshared or unknown id is a 403.
  - `getFavoritedItems` and the favorites usage metric filter with `itemAccessWhere(userId, 'read')`, a new export of `permission-actions.ts` (owner, or a live grant, and workspace membership) that `assertItemsAccess` now uses too. A revoked share drops off the list.
  - `addFavorite` checks before inserting; `removeFavorite` deletes every row for the user; the usage metric counts items, not rows.
  - The route parses inside the `try`: bad input is a 400.
  - **Tests:** `favorite-actions.test.ts` (16, live DB); `favorites.spec.ts` (13), with a second seeded user who owns an unshared, a shared and a revoked item.

### 28. Form and search decoders mangle typed text

*Code debt · Impact 3 · Risk 2 · Effort 1 → **25** · est. 0.5 day · source: found 23 Oct during the post-pull E2E pass*

- **Evidence:** `parseSearchParams` and `parseFormData` (`app/utils/parsers.ts`) decoded the whole string with `decodeURIComponent` before `qs` split it. A space (`+`) arrived as a literal `+`, so every multi-word search matched only as a "Similar name", and an encoded `&` or `=` split a value. The form decoder also turned any numeric-looking text into a number (`"007"`, `"1e3"`, `"2024"`) and `"true"`/`"null"` into values, so renaming a file to "2024" or searching for "true" failed `z.string()`. Both parsers threw a plain error on a schema mismatch, which routes answered as 500.
- **Status 2026-10-23: resolved** (`65fe46b`).
  - Both decoders hand decoding to `qs` (its `defaultDecoder`, once per key and value). A value becomes a number only when it writes back as the same text, so `"007"` and `"1.50"` stay strings.
  - `toUserText(...)` (`app/utils/converters.ts`) wraps 20 free-text fields in `api.schemas.ts`, turning a decoded number or boolean back into the text the user typed.
  - Schema and parse failures throw `INVALID_INPUT`, which `toErrorInfo` maps to 400. The rule (parse inside the handler's `try`; wrap free text in `toUserText`) is in CLAUDE.md.
  - **Tests:** `parsers.test.ts`, 13 → 39.

### 29. Trash listed every user's trashed items

*Code debt (security) · Impact 4 · Risk 4 · Effort 1 → **40** · est. 0.5 day · source: found and fixed 3 Oct while building the trashed-folder view; missed by the 8 Oct re-audit, recorded 25 Oct from git history*

- **Evidence, from the commit:** the Trash loader seeded `currentUserId`, which `item.filters.ts` documents as *not* a scoping filter, so its `where` was status and type only. Every signed-in user's Trash page listed every user's trashed items.
- **Status 2026-10-03: resolved** (`32d1431`). The Trash query always includes `ownerId` = the signed-in user, and a loader test pins it. The new trashed-folder route (`/:me/stash/trash/folders/:id`) answers 404 for a folder that isn't the user's, isn't a folder or isn't in trash, so a live folder can't be browsed through it. `pnpm test` 737/737 at the time.
- **Not re-verified on 25 Oct:** read from the commit message and its test, not reproduced.

### 30. Signed cookies fall back to the literal secret `'secret'`

*Code debt (security) · Impact 2 · Risk 2 · Effort 1 → **20** · est. 0.5 day · source: found 24 Oct during the sign-in redesign*

- **Evidence:** `app/.server/theme.ts:10` (`color-scheme`) and `app/.server/remembered-account.ts:16` (`last-account`, added in `e286ffd`) both sign with `process.env.COOKIE_SECRET ?? 'secret'`. The local `.env` has no `COOKIE_SECRET`, so both run on the fallback today. `deploy/README.md` lists `COOKIE_SECRET` as a required Fly secret, but nothing enforces it: a deploy that misses it starts normally.
- **Impact:** small today. Both cookies are display-only. `last-account` picks the name and avatar on the "Continue as" card, and the card re-runs that provider's full OAuth flow, with only github, google and microsoft accepted. Anyone who knows the secret could forge either cookie, but neither grants access. It matters the day a signed cookie carries something the server trusts.
- **Fix:** one helper that reads `COOKIE_SECRET` and throws at module load in production when it is unset. Both cookies use it. Set the variable in the local `.env`. (This line used to say "as `stripe.ts` does for its key", but `stripe.ts` passes the key to `new Stripe` and checks nothing.)
- **Status 2026-10-26: resolved** (`074c06e`). Both cookies call `cookieSecret()` in `app/.server/env.ts`. It reads **`SESSION_SECRET`**, not `COOKIE_SECRET`, because the local `.env` and `app/stashly.d.ts` already declare that name (owner's call). It throws when the module loads under `NODE_ENV=production` if the variable is unset or empty, and falls back to `stashly-dev-only-cookie-secret` elsewhere. Importing it from `env.ts` also loads `.env` first, which neither cookie module did. CI's two `docker run` steps and `deploy/README.md` use the new name. Measured with a probe that loads the module and parses a serialized `color-scheme` cookie (`.claude/evidence/cookie-secret-{before,after}.json`): before the fix, production loaded with no secret and the cookie verified against `'secret'` even with a secret set. After it, production without a secret throws, and with one the cookie verifies against that secret only. 3 new tests in `env.test.ts`; `pnpm test` 972/0 in 81 files, type gate exit 0, build clean. **Before the next `fly deploy`, set the Fly secret `SESSION_SECRET`.** The server no longer boots without it, and a `COOKIE_SECRET` already on Fly is now unused.

Items 31–44 come from the Upload Call Audit (10 Oct, `docs/upload-call-audit.md`): every call one uploaded file causes, traced through the code and checked against one measured 8.46 MB upload. Its per-file counts and "× 100,000 files" totals are traced, not measured. On 25 Oct each finding was re-checked against `main`; where a line below says *per the audit*, it wasn't re-read in code that day.

### 31. Uploads can go past the storage total

*Code debt · Impact 3 · Risk 4 · Effort 1 → **35** · est. merge · source: fixed 10 Oct on a branch that was never merged; recorded 25 Oct*

- **Evidence, from the fix's commit:** the file machine's quota guard was commented out, and its result was stored by a plain action whose return value XState discards, so a "denied" answer still created the multipart upload. The server charge in `createUploadedItem` never compared against the total, so a direct API call was always accepted. Measured on the dev DB at the time: a denied UI upload and a direct-API upload both landed and left the quota at −151,000. `main` still has no `withinTotal` in `quota-actions.ts`.
- **Fix (written):** `onItemsUploaded` puts `used + size <= total` in the row-locked UPDATE's own `WHERE`; a charge that doesn't fit throws 507 and rolls back the whole transaction, Item row included. The client guard reads the done event and a denied file fails before any bytes move.
- **Status 2026-10-25: resolved** (`059d0aa`, PR #26 squash-merged). Before merging, the branch was rebased onto `main`: its code patches were identical to the originals, `pnpm test` 914/0 in 74 files, the type gate exit 0, and CI green on the rebased head. CI is green on `059d0aa` too. Still open from item 18: the charged size comes from the client form, not from S3.

### 32. Search-index writes skip the ownership check

*Code debt (security) · Impact 3 · Risk 5 · Effort 2 → **32** · est. 0.5–1 day · source: Upload Call Audit (flagged "not tested yet"), confirmed in code 25 Oct*

- **Evidence:** in `app/routes/api/items.ts`, `save_media_metadata` (`:338`) calls `upsertImageFacet(itemId, …)` and the other facet writers, `save_ocr_page` (`:505`) calls `appendSearchPage({ itemId, pageNum, text })` and `save_search_chunk_embeddings` (`:518`) calls `setSearchChunkVectors(entries)`. None of the three actions takes a user (`search-actions.ts:119`, `:704`; `item-actions.ts:1489`), so none can check one. Any signed-in user holding an item id can rewrite another user's EXIF and media facets, append search text to their file, or overwrite chunk vectors by chunk id.
- **Impact:** search poisoning and metadata tampering across accounts; no read of the victim's data. The same class as items 25 and 27.
- **Fix:** pass the session user and run `assertItemAccess(userId, itemId, { role: 'write' })` in each action, as CLAUDE.md requires. For vectors, read the distinct `itemId`s behind the chunk ids in one query and check those. A scanned PDF sends up to 30 of these per file, so keep it to one check per request.
- **Status 2026-10-25: resolved** (`41f2efe`). `saveMediaMetadata` (moved out of the route into `search-actions.ts`), `appendSearchPage` and `setSearchChunkVectors` take the session user and assert `write`. The facet and chunk writers they call stay unchecked because `reindexTextItems` shares them and its candidates are already the user's own. Vectors: one `findMany` maps the chunk ids to their distinct items, then one `assertItemsAccess`; a refused chunk refuses the batch. The route answers a refusal with its real status, 403, where it used to send a 200 with `success: false` and an undefined message. Tested with a second user on the dev DB (`search-index-access.test.ts`, 12 tests): no access and `read` are refused with nothing written, owner and `write` grantee succeed, a mixed vector batch is refused whole. `pnpm test` 926/0 in 75 files, type gate exit 0, build clean.

### 33. Cancelled and failed uploads never abort the multipart upload

*Infrastructure debt · Impact 2 · Risk 3 · Effort 2 → **20** · est. 0.5 day · source: Upload Call Audit, confirmed in code 25 Oct*

- **Evidence:** `abortUpload` (`app/machines/multipart/s3.mulipart.utils.ts:240`) has no importers. On a user abort the file machine forwards `@multipart.upload.abort`, which only trips the `AbortController` in `s3.multipart.stream.ts`; when part retries run out, the file is "treated as aborted" (`reviset/file.machine.ts:379`). Neither path calls `abort-multipart-upload`, so the uploaded parts stay billed in S3. The 2 Oct orphan sweep (item 9) aborted 85 stale uploads, which is what this leaves behind.
- **No backstop:** Tigris rejects an `AbortIncompleteMultipartUpload` lifecycle rule (item 9, tested 2 Oct), so the only cleanup is running `scripts/sweep-s3-orphans.ts` by hand.
- **Fix:** invoke `abortUpload` on both paths. Without a lifecycle rule, the client call is the only thing that cleans up on time.
- **Status 2026-10-25: resolved** (`8a79e89`). Both paths now go through an `abortingUpload` state in `reviset/file.machine.ts` that runs the existing `abortUpload` actor with the file's key and upload id, then reaches `aborted` whether or not the call succeeds, so the manager always gets its slot back and a failed abort is left to the sweep. The server side already existed and only aborts in the session user's own bucket. `file-abort-multipart.test.ts` (3): retries exhausted, user cancel, and a failing abort call. Not measured in a browser.
- **Follow-up 2026-10-25** (`e4aeb0e`): a failed `complete-multipart-upload` also aborts now, through `abortingFailedUpload`, and still ends in `error` with the original reason. A refused complete has already been aborted on the server, so the route's `abort-multipart-upload` answers `NoSuchUpload` as done instead of a 500 (Tigris returns `NoSuchUpload`, 404, checked against the dev bucket with a made-up upload id). Tests: 2 more in `file-abort-multipart.test.ts` (5 in all), and `upload-abort.test.ts` (3): aborts in the session's bucket, gone counts as done, any other S3 error still throws. `pnpm test` 953/0 in 79 files.

### 34. Upload requests retry 4xx answers five times

*Code debt · Impact 2 · Risk 2 · Effort 1 → **20** · est. 1–2 h · source: Upload Call Audit, confirmed in code 25 Oct*

- **Evidence:** `retryFetch` (`s3.multipart.stream.ts:10`) handles 429 on its own; any other non-OK answer throws inside its `try`, the `catch` logs it and retries with growing backoff. A 403 (access revoked mid-upload) or a 400 is retried five times; per the audit, the presign backoff adds up to about 5 minutes before the upload fails.
- **Fix:** retry 429, 5xx and network errors; fail at once on any other 4xx.
- **Status 2026-10-25: resolved** (`8ac03d9`). `retryFetch` throws a 4xx other than 429 on the first answer with its status attached; 429, 5xx and network errors still retry. With item 33, a part request refused mid-upload now fails the file at once and aborts its parts. `retry-fetch.test.ts` (8): 400/403/404/413 make one attempt, 503→500→200 and 429→200 retry, five 500s give up, a network error retries.

### 35. A database session lookup on every request

*Architecture debt · Impact 3 · Risk 2 · Effort 2 → **20** · est. 0.5 day · source: Upload Call Audit, confirmed in code 25 Oct*

- **Evidence:** the `session` block in `app/.server/auth.ts:64` has no `cookieCache`, so every request to the server reads the session from the database. Per the audit that is 5–6 lookups per file, and about 205 for a 1 GiB file just to presign its parts.
- **Measured 2026-10-25** (upload audit re-run, `.claude/evidence/upload-audit-before.json`): `session` was scanned exactly once per request to our server, 12 times for a 10 MB upload and 30 times for a 100 MB one. `user` took about one more index lookup per request on top, so a lookup looks like 2 SQL statements (inferred from the counters, not from a query log). A fix should show `session` scans falling toward 0 with the same request counts.
- **Fix:** better-auth `session.cookieCache` with a short `maxAge`. The trade-off is the owner's call: a revoked session stays valid until the cache expires.
- **Status 2026-10-25: open, decided.** The owner chose a 5-minute `maxAge`. Not turned on yet: on sign-up, better-auth caches the session from the user row it just created (`api/routes/callback.mjs`, `setSessionCookie(c, { session, user })`), while `onboardNewUser` writes `bucket`, `rootId` and `driveId` to the database only, and the `user.create.after` hook runs through `queueAfterTransactionHook`. A new user's cached session could therefore carry no bucket for up to 5 minutes. Needs the cache cookie rewritten from the database after a sign-up callback, then a test.
- **Status 2026-10-25 (later): resolved in code** (`c1dc745`), not yet measured.
  - **Cache:** `session.cookieCache` with `maxAge` 5 minutes in `auth.ts`.
  - **Refresh:** nothing in the browser calls `get-session`; every lookup is a server-side `auth.api.getSession`, which puts the refreshed cache cookie in its own returned headers and drops it. `authMiddleware` now asks for those headers and forwards the cookie onto the page or `.data` response (`forwardSetCookies` in `session-user.ts`). Without it the cache would have been written once at sign-in and lapsed for good 5 minutes later. API routes outside the layout (`/api/s3/upload`, `/api/items`) read the cookie but don't refresh it.
  - **Sign-up:** `customSession` runs on every lookup, cache hits included (`custom-session/index.mjs`); it now fills `bucket`, `rootId` and `driveId` from the database when the session lacks them or holds the `default-bucket` placeholder (`withOnboardingFields`). Only a session cached before onboarding finished takes that query.
  - **Tests:** `session-user.test.ts` (11, no DB): the fallback reads nothing for an onboarded user and fills each missing field; the forwarder copies the cookie, keeps a route's own cookies, and leaves an immutable redirect alone. `pnpm test` 948/0 in 78 files, type gate exit 0, build clean.
  - **Encrypted, 25 Oct** (`better-auth-security-best-practices`): `strategy: 'jwe'`. The payload holds the session (token, IP, user agent) and the user (email, bucket, plan ids); the default `compact` is base64 with an HMAC, readable by anyone who sees the cookie. The cookie measured 1,529 characters with no readable id, email or bucket, `HttpOnly; SameSite=Lax; Max-Age=300`, plus `Secure` once served over HTTPS. The secret is 32 characters.
  - **Measured server-side 25 Oct** (a deleted script against the dev DB with a real dev session, calling `getSession` the way `authMiddleware` does): the first lookup returned `session_data` in its headers; with it, 5 lookups did **0** `session` table scans and returned the user with `bucket` and `rootId` 5/5, against **5** scans for 5 lookups with `disableCookieCache`.
  - **Re-measured in the browser 25 Oct** (`.claude/evidence/upload-audit-after.json`, same method as the baseline): request counts unchanged (18 and 54), rows written unchanged; `session` scans **12 → 0** for 10 MB, but **30 → 14** for 100 MB. The cookie had expired about 4.8 s into that upload, and the upload routes, outside the layout, dropped the refreshed cookie just as the middleware had before `c1dc745`, so every API call read the database until the next `.data` load. Inferred from timing; `pg_stat` gives totals only.
  - **API routes, 25 Oct:** `/api/s3/upload`, `/api/items`, `/api/quota` and `/api/thumbnails` now export `middleware = [authMiddleware]` and read the session from context instead of calling `getSession` themselves (owner's OK; CLAUDE.md's rule for `api/` routes updated). `auth-middleware.test.ts` (7): the refreshed cookie is forwarded, none is added while fresh, no session redirects before the route runs, and each of the four routes keeps the middleware. **Measured with an expired cookie** (tab idle 396 s against a 300 s cookie): a 10 MB upload did **1** `session` scan for 12 server requests (the first, `check-free-quota`, refreshed it).
  - **Status 2026-10-25: resolved.** A real new-account sign-up (the `withOnboardingFields` path) was not tried; it has unit tests only.

### 36. The folder path is resolved again for every file of a folder upload

*Architecture debt · Impact 3 · Risk 2 · Effort 3 → **15** · est. 1–2 days · source: Upload Call Audit (per the audit)*

- **Evidence:** `createUploadedItem` resolves each file's folder path in its own transaction: an advisory lock and an `item.findMany` per level, even once the folders exist. Traced: 6 DB calls and 1 transaction per file at 3 levels, about 600,000 calls for a 100,000-file folder.
- **Fix:** resolve the folder tree once per batch and file each upload by the leaf's id. Measure a folder upload before and after.
- **Status 2026-10-25: open.** The owner chose to measure a real folder upload first (calls, transactions and lock waits per file), then decide on a design with the numbers.
- **Measured 2026-10-25** (200 × 1 KB files, 4 levels, `.claude/evidence/folder-upload-before-*`): 20 statements and 2 transactions per file, 10 of them for the folder path (BEGIN, a lock and a lookup per level, COMMIT), 48% of the server time. Lock waits were round trips, not contention: an advisory lock took 6.2 ms at p50, like every other statement.
- **Status 2026-10-26: resolved in code.** `addBatch` sends one `resolve_upload_folders` request before its files start; `resolveFolderTree` finds or creates the whole tree with one query per depth level and one INSERT for every missing folder, under one advisory lock per uploader. Each file posts its leaf folder as `parentId`, which `createUploadedItem` checks for write access, then writes `Item`, `File`, `Permission`, the user link and the quota charge as one statement (no transaction; a refusal writes and charges nothing). Files without a resolved folder resolve their key path the same way, as a batch of one. Proved first in rolled-back transactions against the dev DB (`.claude/evidence/folder-upload-proof.json`: identical rows, sizes, counts and quota to the old path, and the same refusals). Measured with a real browser upload of `app/` (639 files, 71 folders; `app/assets` is empty and a folder input cannot carry it), each run into a fresh empty folder, every file checked in the DB and in S3 (`.claude/evidence/folder-upload-app-*`):

  |  | before | after |
  |---|---|---|
  | DB statements | 11,600 | 1,284 |
  | transactions | 1,278 | 1 |
  | advisory locks | 1,824 | 1 |
  | statements per file | 14–24 (p50 18) | 2 |
  | `createUploadedItem` server time, p50 | 136 ms | 18 ms |
  | upload wall clock | 707 s | 554 s |

  Part of the wall-clock gain is S3 latency: `create-multipart-upload`, which this change does not touch, was also faster (p50 996 → 704 ms). A first version queued all 639 files in one synchronous burst after the resolve; it started 100 uploads at once and took 872 s, so `addBatch` keeps handing files over one at a time. Tests: `upload-folder-tree.test.ts` (9, live DB) plus the existing upload, quota and never-guess tests; `pnpm test` 969/0 in 81 files, type gate exit 0, build clean.

### 37. The `.ts` sniff reads from S3 and nothing uses the result

*Code debt · Impact 1 · Risk 2 · Effort 1 → **15** · est. 1–2 h · source: Upload Call Audit, confirmed in code 25 Oct*

- **Evidence:** `complete-multipart-upload` (`app/routes/api/upload.ts:122`) does a 1 KB ranged `GetObject` for `.ts`/`.tsx` files. Its comment calls this "the trust boundary" and says the verified type is persisted on the Item, but that step is still a `TODO`, and nothing in `app/` reads the returned `verifiedKind`/`verifiedContentType`.
- **Fix:** persist the verified type on the Item, or delete the read and the comment. Today it costs an S3 call whose answer is dropped, under a comment promising it is stored.
- **Status 2026-10-25: open.**

### 38. Which upload concurrency limit applies (10 or 100) is unknown

*Documentation debt · Impact 2 · Risk 1 · Effort 1 → **15** · est. 1 h · source: Upload Call Audit, confirmed in code 25 Oct*

- **Evidence:** `upload.machine.ts:31` sets `maxConcurrentUploads: 10`; the schema default is 100 (`machine.schemas.ts:298`), and the `stashly-upload-xstate` skill says 100. Every throughput and lock-contention estimate depends on which one runs.
- **Fix:** measure files in flight during a large batch, then make the code and the skill agree.
- **Measured 2026-10-26** (item 36's `app/` uploads): when 639 files were queued in one synchronous burst, exactly **100** `/api/s3/upload` requests were in flight at the peak. A file has at most one such request at a time, so 100 files were active: the schema default applies, as the skill says, and `upload.machine.ts:31`'s 10 is overridden. When files are handed over one at a time (`addBatch` as shipped), the peak was 24–25.
- **Status 2026-10-26: resolved** (`78a63f3`). The initial context now says 100, the same as the schema default. `useUpload` sends `upload.config` with no limit, and `updateConfig` parses the default in and writes it over the context, which is why the 10 never ran past configuration. The `stashly-upload-xstate` skill already said 100. `upload-concurrency-limit.test.ts` (3): 100 before configuration, 100 after a config that names no limit, and a named limit is kept. `pnpm test` 975/0 in 82 files, type gate exit 0.

### 39. One presign request per 5 MiB part

*Architecture debt · Impact 2 · Risk 1 · Effort 2 → **12** · est. 0.5–1 day · source: Upload Call Audit, confirmed in code 25 Oct*

- **Evidence:** each part sends its own `get-presigned-url` (`s3.multipart.stream.ts:173`, handled at `upload.ts:90`). Signing is a local HMAC, so each request buys only a session lookup. Measured 2026-10-25: 2 of 18 requests for a 10 MB upload and 20 of 54 for a 100 MB one. The 20 presigns spanned +262 to +6,649 ms, interleaved with the part PUTs.
- **Fix:** return every part URL from `create-multipart-upload`.
- **Status 2026-10-25: open.**
- **Status 2026-10-26: resolved** (`3ddbf90`). Owner's choice: windows of 100, not every URL at once, which for a 10 GB file would be about 1,900 URLs signed long before use. `create-multipart-upload` takes the part count and returns the first 100 URLs (500 MiB); `get-presigned-urls` signs a range. `createPartUrls` in `s3.multipart.stream.ts` asks for the next window 20 parts ahead, and workers waiting on one window share its request. A URL signed ahead can expire (3,600 s) on a long pause or slow link. A throwaway probe against the dev bucket showed Tigris answering an expired part PUT with 403 `AccessDenied` "Request has expired" and a fresh URL with 200, so a part that gets a 403 is signed again once; a second 403 fails the file as before. The per-part `get-presigned-url` action stays for its other callers. Measured with `/verify` (`.claude/evidence/presign-p39-{before,after}.json`: same page, `upload-audit-init.js`, byte-identical files):

  |  | 10 MB before | after | 100 MB before | after |
  |---|---|---|---|---|
  | requests to our server | 12 | 10 | 30 | 10 |
  | presign requests | 2 | 0 | 20 | 0 |
  | all browser requests | 18 | 16 | 54 | 34 |
  | create answer on the wire | 351 B | 1.4 KB | 351 B | 10.8 KB |
  | item row created at | +2,885 ms | +2,669 ms | +11,803 ms | +11,524 ms |

  The times are one run each. A 4–7% change is within S3's run-to-run variance, so no speed-up is claimed. Signing 100 URLs took 58.6 ms on the server. Tests: `part-urls.test.ts` (9), `upload-presign.test.ts` (6), `file-part-urls.test.ts` (1); the shared `streamParts` contract test now counts PUTs instead of presigns. `pnpm test` 991/0 in 85 files, type gate exit 0, build clean.

### 40. Media-metadata writes do extra work

*Code debt · Impact 1 · Risk 1 · Effort 1 → **10** · est. 2 h · source: Upload Call Audit, confirmed in code 25 Oct*

- **Evidence:** `save_media_metadata` is posted for every file type, including a zip with nothing to save. `upsertImageFacet` (`item-actions.ts:1489`) is a `findFirst` then an `update` or `create` (two round-trips, and two concurrent saves can both create).
- **Fix:** skip the POST when there is nothing to save; one Prisma `upsert` on the unique `itemId`.
- **Status 2026-10-25: open.**
- **Status 2026-10-26: resolved** (`51ca00d`). A file with nothing to save no longer sends `save_media_metadata`: the indexing machine's `nothingToSave` guard (`hasMetadataToSave`, which applies the form builder's own rule) takes a zip or an unknown binary straight to `indexed`. The five facet writers (`upsertImageFacet` and the others) are each one `upsert` on the unique `itemId`, in place of `findFirst` and then `update` or `create`. Tests: `facet-upsert.test.ts` (16, against a live database) counts the statements pg sends per save, one each, and races eight first saves on one item; `media-metadata-save.test.ts` (9) holds `hasMetadataToSave` to the form builder; `indexing-item.machine.test.ts` gains 3. `pnpm test` 1019/0 in 87 files; type gate exit 0. Measured with `/verify` (`.claude/evidence/facet-upsert-p40-{before,after}.json`): the same three test files, 5 runs each, with `main`'s `item-actions.ts` and `indexing-item.machine.ts` swapped back in for "before". Statements are counted by patching `pg.Client.prototype.query`, which every pool connection goes through. For the race, 8 pool connections are opened first and each INSERT is held 50 ms, so all the reads answer before any write. Without that, the old code passed in some runs: on a cold pool the saves queued behind connects and never overlapped.

  |  | before | after |
  |---|---|---|
  | statements per facet save, row missing | 2 | 1 |
  | statements per facet save, row present | 2 | 1 |
  | 8 first saves racing on one item: refused | 7 of 8, every run, all 5 facets (P2002 on `itemId`) | 0 |
  | `save_media_metadata` requests for a zip | 1 | 0 |

  No timing was measured, so no speed-up is claimed.

### 41. Dead upload branches

*Code debt · Impact 1 · Risk 1 · Effort 1 → **10** · est. 2 h · source: Upload Call Audit, confirmed in code 25 Oct*

- **Evidence:** `stash/all.tsx:83`, `stash/folder.tsx:123` and `stash/home.tsx:64` check for `create_upload_item` in `shouldRevalidate`. The check can't match, because the upload POST is a plain `fetch`, which React Router never sees. The quota machine is spawned into `quotaActor` (`upload.machine.ts:123`) and nothing sends it an event, although the `stashly-upload-xstate` skill describes it as tracking and enforcing quota.
- **Fix:** delete the branches and the idle actor, or wire them up; correct the skill either way. Confirm with the owner first: no current callers doesn't always mean dead.
- **Status 2026-10-25: open.**
- **Status 2026-10-26: resolved** (`12e3f74`). The owner chose to stop spawning the quota machine and keep its file. The three `create_upload_item` checks are deleted: the only sender is `postItem` (`db.actors.ts`), which uses `fetch`. The upload manager no longer registers or spawns `quotaMachine`, and `quotaActor` is gone from its context and schema. `quota/quota.machine.ts` stays on disk, unimported, in case quota reads move into one shared actor. `reviset/file.machine.ts` keeps invoking `checkQuota` from `quota.actors.ts` as its pre-check. The `stashly-upload-xstate` skill and `app/machines/README.md` no longer say the machine tracks or enforces quota. `pnpm test` 1019/0 in 87 files (two test stubs for the quota actor removed, no tests lost); type gate exit 0. Measured with `/verify` (`.claude/evidence/p41-dead-upload-{before,after}.json`) by a temporary probe that drove `HEAD`'s and the new upload manager through the same sequence (config with a limit of 1, one file whose create is refused, one that waits), using XState's `inspect` to record every actor created and every event delivered:

  |  | before | after |
  |---|---|---|
  | actors created | 6 | 5 |
  | quota actor in the system | yes | no |
  | events the quota actor received | 0 | — |
  | events the manager received | 6 | 6 |
  | refused file / next file | `failed` / `pending` | `failed` / `pending` |

  No timing was measured, so no speed-up is claimed. Five more docs described the quota machine as spawned; they were corrected on 30 Oct: `docs/upload-multipart.md`, `docs/quota-and-machines.md`, `docs/project-overview.md`, `docs/roadmap.md`, `.github/copilot-instructions.md`.

### 42. The size rollup locks every ancestor row

*Architecture debt · Impact 2 · Risk 3 · Effort 4 → **10** · est. 3–5 days · source: Upload Call Audit (per the audit)*

- **Evidence:** `update_size()` runs one `UPDATE "Item"` per ancestor, and each row stays locked until the upload's transaction commits. With several files in flight, all of them queue on the same root and parent rows, and on the user's `Quota` row. Lock waits were not measured.
- **Fix:** only if contention is measured. Options include batching the rollup per transaction or deferring it.
- **Status 2026-10-25: open.**
- **Status 2026-10-30: declined.** The evidence describes the code before `265c9d6`. The mechanism still holds: `update_size()` is a per-row trigger, each parent's update fires it again, and so a file insert locks every ancestor up to the root. What changed is how long the locks last. `insertUploadedItem` (`item-actions.ts`) writes the row, the `File` facet, the permission and the quota charge as one statement with no transaction around it, so the ancestor rows and the `Quota` row are released when that statement commits, not when the upload ends. The folder tree is resolved in its own transaction, committed before any file row is written, and `update_size()` skips a change of zero (migration `20261002090000_fix_inclusive_size_rollup`), so creating empty folders locks no ancestors. Every file insert takes its locks in the same order, `Quota` first and then the parent up to the root, so concurrent uploads should queue briefly rather than deadlock. All of this is read from the code; lock waits were still not measured. Reopen the redesign (a statement-level trigger, or a deferred rollup) only on a symptom: lock timeouts, or slow item creation in a large upload. The statement-level trigger has already been tried once (item 8, follow-up 2026-10-02): it rewrote 704 rows instead of 2,832 to restore a 639-item copy, but a one-row insert, which is what every upload does, went from 3.0 to 10.0 ms (medians, rolled-back runs). Bulk trash, restore and move still run the trigger inside multi-statement transactions, so a symptom there would also reopen it.
- **Status 2026-10-30 (later): measured; a batched rollup works in a prototype and awaits the owner's decision.** Evidence in `.claude/evidence/p42/` (local).
  - **Cost today**, measured on a 646-file `app/` upload into an empty folder under the stash root (`track_functions = pl`, `pg_waldump`): 3,994 `update_size()` calls and 3,141 ancestor rewrites, 646 of them the stash root. The size cascade took 0.48 s of database time: 0.75 ms per file, 7.4% of the upload's database time and 0.07% of its 700 s. 95% of the updates were HOT, `Item` was never autovacuumed, and the cascade wrote about 1.2% of the WAL. The external critique's "WAL bloat and autovacuum overdrive" did not happen; its call count is real, about 6.2 per file at this depth.
  - **Tried and undone: `WHEN` clauses** on the four `Item` triggers, so they skip calls their function ignores. Calls fell exactly as predicted, 11,129 → 4,504 per upload, with the same state after 14 rolled-back steps. But trigger time rose 462 → 506 ms (+9.5%, in every one of 5 alternated rolled-back runs). The skipped calls were early-return no-ops costing 1.6–4 µs each, and `update_size()` itself got slower with the `WHEN`s on its triggers. Never committed; the dev database was restored. Don't retry it: the cost is the ancestor `UPDATE`s, about 0.13 ms each, not the number of calls.
  - **Prototype that works: a batched rollup.** Inserts append their size to a delta table instead of cascading. Every N files one statement applies the logged deltas with one `UPDATE` per distinct ancestor; the active part stops at a trashed folder, as in `update_size()`. Replaying the same 71 folders and 646 files in their real arrival order, medians of 5 rolled-back runs, identical sizes in all 20 runs:

    |  | today | every file | every 25 files | every 100 files |
    |---|---|---|---|---|
    | ancestor `UPDATE`s | 3,141 | 3,141 | 192 | 102 |
    | database time for sizes (triggers + rollup) | 434 ms | 2,059 ms | 129 ms | 67 ms |
    | 646 inserts, wall clock | 746 ms | 2,287 ms | 396 ms | 328 ms |
    | WAL during the run | 3.5 MB | 3.7 MB | 1.8 MB | 2.1 MB |

    Without batching the mechanism is three times slower; the gain comes entirely from merging deltas.
  - **Measured under concurrency, the case that matters.** Any shared folder has many writers, including a shared folder in a personal stash: every collaborator's file rewrites the owner's ancestors up to the owner's root. Benchmark: W uploaders, one connection each, inserting `Item` rows (no `File`, `Permission` or quota) back to back, each into its own copy of the 71-folder tree under one shared folder of a throwaway user. Today's triggers were measured before and after the prototype. All 27 runs ended with exact sizes in the shared folder, the root and each copy. Evidence: `.claude/evidence/p42/concurrency.json`, `concurrency-2.json`.

    | 32 uploaders, one shared folder | today (4 runs) | rollup every 25 files, by that uploader | same, single-flight (skips if one is running) | single-flight timer, 200 ms | timer, 1 s |
    |---|---|---|---|---|---|
    | files/s | 1,837–2,047 | 2,478–2,599 | 9,603 | 8,981 | 9,321 |
    | insert p95 / p99 | 51–57 / 84–100 ms | 1.5–2.0 / 3.6–4.3 ms | 4.9 / 6.7 ms | 5.5 / 13.7 ms | 4.8 / 19.2 ms |
    | uploaders waiting on a lock (mean of 32) | 20.5–21.4 | 23.7–23.9 (the rollups) | 0 | 0 | 0 |
    | ancestor updates | 100,512 (32 × 3,141) | 12,871 | 5,659 | 3,644 | 2,471 |
    | oldest unapplied size change, max | none | 618 ms | 150 ms | 342 ms | 1.2 s |

    Today, adding uploaders lowers throughput (8 uploaders: 2,548–2,807 files/s; 32: about 2,000) and p95 rises tenfold, because every insert passes the same ancestor rows one at a time. A delta log alone only moved that queue into the rollups, each started by an uploader and queueing on the same rows (826 rollups, median 258 ms). One rollup at a time removes it: uploaders never wait on a lock, and at 32 uploaders the database takes about 4.5× the files per second, limited by CPU rather than locks.
  - **Design the numbers point to:** inserts append to a delta log, and a single-flight rollup (`pg_try_advisory_xact_lock`, skip if busy) applies it on a short timer. A timer bounds how stale folder sizes get at any arrival rate; a rollup every N files would leave a slow upload (about 1 file/s, as measured) up to N seconds stale. Bulk trash, restore, move and delete keep today's per-row cascade.
  - **Open decisions before building it:** the interval, and whether the timer polls or is woken by `NOTIFY` (the notification feed already runs `LISTEN`); whether every insert is deferred (then tests and code that read a folder size right after an insert need a flush); keying the single-flight lock per owner tree or globally. It is a schema change (the delta table), a trigger change and a new rollup path, so it starts with a plan for the owner's approval.
- **Status 2026-10-30 (night): resolved.** Plan `docs/superpowers/plans/2026-10-30-size-rollup-delta-log.md`; migrations `20261030140000_upload_size_delta_log` (the `ItemSizeDelta` table, `apply_item_size_deltas()`, `recount_folder_sizes()`) and `20261030160000_upload_size_inline_when_idle` (the decision in `update_size()`); `app/.server/size-rollup.ts` (a 250 ms loop per server process, started by the first `createUploadedItem`, with `stashly_size_rollup_*` metrics); `recursiveCopy` clears `uploadId`. Evidence `.claude/evidence/p42/` (local).
  - **Design:** on INSERT of a row with an `uploadId`, `update_size()` logs it when deltas are pending or the rollup's advisory lock is taken (busy), and otherwise takes the lock and cascades at once (idle). One rollup at a time, database-wide, writes each affected folder once and gives way after 100 ms to a row lock held by a user's trash, move or delete. Every other path keeps the per-row cascade; deltas are additive, so the two compose. Proved in rolled-back transactions (23/23 and 12/12 checks, rollbacks rehearsed) and by 16 new cases in `item-size-trigger.test.ts` and `size-rollup.test.ts`.
  - **Measured**, same harnesses as the baseline (live: the 646/650-file `app/` upload with `track_functions = pl`; concurrency: W uploaders, one connection each, `Item` rows only, one shared folder; exact sizes in every run):

    |  | before | logging every upload | **shipped (log only while busy)** |
    |---|---|---|---|
    | one uploader: size work (sum of trigger and rollup self time) | 615 ms | 2,125 ms (580 rollups, 1.1 deltas each) | **757 ms** (0 logged) |
    | one uploader: `Item` updates | 3,277 | 2,868 | 3,290 |
    | 8 uploaders, one shared folder | 2,682 files/s, 4.5 waiting | 5,638 | **5,942**, 0 waiting |
    | 32 uploaders | 2,017 files/s, p95 52 ms, p99 86 ms, 20.7 waiting | 8,419, p95 6.3 ms | **8,334, p95 5.8 ms, p99 7.2 ms, 0.06 waiting** |
    | 32 uploaders: ancestor writes | 100,512 | 3,630 | **2,821** |
    | 32 uploaders: oldest unapplied size change | none | 401 ms | **410 ms** |

  - **Two dead ends on the way, kept so they aren't retried:** logging every upload made one uploader 3.5× costlier, because each 250 ms rollup found about one delta and its fixed cost (~3 ms) replaced a 0.75 ms cascade. The first version of the idle/busy decision tried the lock before checking for pending deltas, so busy uploads held it until they committed and the rollup never got it (32 uploaders: 0 of 10 rollups ran, 15,670 deltas left for the end); checking pending deltas first fixed it (8 of 9 ran).
  - **Known limits:** sizes trail uploads by up to ~0.4 s under load, and an upload deleted, moved or trashed before its delta is applied briefly leaves its old folders short, even negative. The benchmark didn't include the `File`, `Permission` and quota writes. Follow-ups are items 45–47.

### 43. Revalidation and thumbnail query overhead

*Architecture debt · Impact 2 · Risk 1 · Effort 3 → **9** · est. 1–2 days · source: Upload Call Audit (per the audit)*

- **Evidence:** each batch triggers two full page revalidations (700 ms after the finished count settles, and after the indexing queue drains); the first can land before the row exists. Each `.data` request runs the workspace middleware's `workspaceMember.findMany`, whose only consumer doesn't re-run. A visible image's thumbnail costs 9 permission and bucket queries, and stage 3 re-uploads and re-patches the same key. Measured once: 61,568 rows returned around one upload, most likely the two revalidations, not isolated.
- **Fix:** one revalidation per batch after rows exist; skip the middleware query on `.data` requests; one permission check per thumbnail request.
- **Status 2026-10-25: open.**
- **Status 2026-10-30: resolved** (`5155d96`, `0828f99`, `d7592ff`). Re-read on `main` at `1f38ad2`: all three findings were still in the code. Measured with `/rootcause` and `/verify` before any edit and again after (`.claude/evidence/p43/{before,after}-summary.json`), against the dev server, uploading six 470-byte PNGs into a fresh empty folder per run, with a 30 s idle baseline that showed no background table activity:

  |  | before | after |
  |---|---|---|
  | `WorkspaceMember` scans for 20 client navigations (20 `.data` requests) | 20, each 0 rows | 0 |
  | statements per thumbnail presign / source call (5 runs each, same item) | 3 / 3 | 1 / 1 |
  | access and bucket statements per uploaded image (1 presign + 2 PATCH) | 9 | 3 |
  | rows in the post-upload reload, item creation held 1.5 s | 0 of 6 | 6 of 6 |
  | file cards on screen after that upload, no manual reload | 0 (header said "6 files") | 6 |

  - **Reload** (`d7592ff`): the runner's count included `done`, which a file reaches before its row exists, and the later `itemCreated` left the count unchanged. When a row took longer than the 700 ms debounce, the only reset reload missed it; indexing's `revalidate()` then updated the folder header but not the paginated grid, which stayed empty until a manual reload. The count is now `itemCreated` only, the rule `HoldFileWatcher` in the same file already follows. The 1.5 s hold was injected in the browser to stand in for slow item creation; it wasn't seen happening on its own (without it, both reloads held 6 of 6). New E2E test in `upload.spec.ts` ("files whose rows arrive after the debounce still appear without a reload") holds the same requests with `page.route`: it fails on the old count (no card in 15 s) and passes 3 of 3 on the new one.
  - **Workspace query** (`0828f99`): the layout loader, its only reader, calls `findAllMemberWorkspaces` itself and runs once per document load. `workspaceMiddleware` stays on disk, unregistered, documented as such.
  - **Thumbnail checks** (`5155d96`): `resolveThumbnailBucket` and `getThumbnailSource` read the item through `itemAccessWhere`, the filter `assertItemsAccess` and favorites already use, in place of `hasItemPermission` plus a second read. That filter also requires workspace membership for a workspace item, which `hasItemPermission` didn't check. A missing item answers 403 as before. `permission-live-grants.test.ts` gains 3 cases: a live grant passes, an expired or revoked grant gets 403, the owner is unaffected.
  - **Not done:** a batch still starts two reloads, rows and then facets once indexing drains (for small files the second replaced the first in both after-runs). Stage 3 still re-uploads the same key, which is the design, since the crop is a different image. The 61,568 rows were not re-measured.
  - `pnpm test` 1022/0 in 87 files, type gate exit 0, build clean. Full E2E run: 61 passed, 4 failed. None is from this change: see item 20 for the `.bin` thumbnail test and the navigation clicks.

### 44. Upload complete and item creation are separate requests

*Architecture debt · Impact 2 · Risk 1 · Effort 3 → **9** · est. 1–2 days · source: Upload Call Audit (per the audit)*

- **Evidence:** `complete-multipart-upload` and `create_upload_item` are two requests, and the same `assertCanUploadTo` check runs three times per file (create, complete, item).
- **Fix:** weigh merging them against the db machine's design (it exists so a failed row never stops the batch). The repeated check is partly defence in depth: the one at complete lets a revoke abort the upload. Low value until measured.
- **Status 2026-10-25: open.**
- **Status 2026-10-30: declined, measured** (`.claude/evidence/p44/before-summary.json`: `main` at `aa91fb4`, six 470-byte PNGs into an empty folder on the dev server). Both claims still hold in the code, but they cost less than the item assumed:
  - **The check:** `assertCanUploadTo` has been `assertItemsAccess` since 2 Oct, a single `item.count`: 1 statement per call in 5 of 5 runs, about 3 ms warm, so about 9 ms per file for all three. Two of the three are deliberate. The one at `complete` lets a revoke abort the multipart upload before S3 assembles it (item 33), and the one when the row is written is the authorization CLAUDE.md requires in the action layer. Removing either would save about 3 ms and lose that.
  - **The two requests:** per file, `complete-multipart-upload` took 249–537 ms (S3), then 44–113 ms passed in the browser before `create_upload_item`, which took 120–288 ms. Together they are 12 of the batch's 46 requests to our server. Merging would save one request and 0.16–0.39 s per file between the bytes being stored and the row existing, plus a network round trip in production. Files upload in parallel, though, so a batch's wall time barely moves. The merge would rewrite the boundary between the file machine and the db machine (which keeps a failed row from stopping the batch), the `done` → `itemCreated` flow, the db machine's 29 tests and the upload E2E tests: the estimated 1–2 days.
  - **Reopen** if the time for a new file to appear becomes a real complaint, for example over production round trips.

### 45. An upload reloads the whole folder about once every 5 files

*Architecture debt · Impact 4 · Risk 3 · Effort 2 → **28** · est. 0.5–1 day · source: item 42 measurements, 30 Oct; measured and reranked 31 Oct (was 12)*

- **Evidence:** the post-upload reload (`navigate` to the same URL, 700 ms after the count of created files settles) and the indexing reload together made 148 (25 Oct) and 136 (30 Oct) full folder `.data` loads during a 646-file `app/` upload, and 16 in a 650-file run later the same evening. Each runs 11–14 queries and returns ~34 KB. The 700 ms debounce re-arms whenever files finish about once a second, which explains a high count but not the spread.
- **Fix:** first find why the count varies; then cap reloads during an active upload (at most one every few seconds, plus one at the end) and measure. Patching single rows needs a client data layer the app doesn't have.
- **Status 2026-10-30: open.**
- **Status 2026-10-31: measured; reranked 12 → 28.** Two runs of item 42's harness: the 650-file `app/` upload into a new empty folder, on the dev server, with the tab visible throughout. The browser recorded every request, history write, 700 ms timer and long animation frame (`.claude/evidence/p45/`, local):

  |  | run 1 | run 2 |
  |---|---|---|
  | full folder `.data` loads | 146 | 139 |
  | from the post-upload `navigate` (`state.reset`) | 99 | 106 |
  | from the indexing `revalidate()` | 47 | 33 |
  | share of the upload with a reload navigation in flight | 27% | 28% |
  | reload, request to commit, p50 | 1.86 s | 1.91 s |
  | folder loader response headers, p50 | 1.01 s | 0.97 s |

  - **Why there are so many:** the post-upload reload is a 700 ms trailing debounce on the number of created rows (`upload-thumbnail-runner.tsx`), and a debounce only merges a burst. Here rows arrive one at a time, p50 1.1 s apart, and 70% of the gaps exceed 700 ms (run 1), so it fires after most rows. What caps it is the guard that skips a reload while one is in flight: in run 2, 67 of 173 firings were skipped that way. The indexing hook adds a `revalidate()` each time its queue catches up with the uploads (33 and 47 times). The count therefore follows the rows' rhythm and the loader's latency, not the batch: one full reload per 4.6 files.
  - **Main-thread lag adds to it:** in run 2 the 700 ms timers fired p50 494 ms late (p90 1,078 ms), and a created row reached the debounce p50 407 ms after its response was handled (up to 2.5 s), because the main thread spent 99% of the upload in long animation frames (item 52). A late re-arm leaves a gap that the next row can't close.
  - **What each reload costs:** a full folder loader run (11–14 queries, per the 30 Oct evidence above) and a `navigate` with `state.reset`, which `usePagination` treats as a return to the first page. A user browsing the folder during an upload is therefore sent back to the first page every few seconds (read from the code, not measured). At one reload per 4.6 files, a 10,000-file upload would reload about 2,000 times (extrapolated).
  - **Not explained:** the 16 reloads of the 650-file run on 30 Oct. Both runs here made about 140, and that run recorded neither a timeline nor the tab's visibility.
  - **Fix:** one reload schedule for an upload instead of two debounces: during a batch, at most one reload every few seconds (a throttle, not a debounce); one when the batch's last row is created; one when indexing drains. Measure with this harness before and after.
- **Status 2026-10-31 (later): still open; time-based reloads ruled out.** After item 52's change (`ec4b521`) the same upload made 9 folder loads instead of 139, but only because rows now arrive faster than the 700 ms debounce. The mechanism is unchanged: an upload whose rows arrive more than 700 ms apart (larger files, a slower link) still reloads the whole folder after almost every row. The owner wants a real fix, not a time-based reload: new rows should reach the page without refetching the folder.

### 46. A session cookie can expire in the middle of an upload

*Architecture debt · Impact 2 · Risk 1 · Effort 1 → **15** · est. 0.5 day · source: external critique, 30 Oct*

- **Evidence:** the 5-minute session cache cookie expires mid-upload; every server request already in flight then does one session lookup before the refreshed cookie lands. Part uploads never reach our server (presigned PUTs to Tigris), so the burst is bounded by our own requests in flight (32 at peak in the 25 Oct audit). Not measured at 100 concurrent uploads.
- **Fix:** measure the burst; if it matters, the client calls `get-session` about every 4 minutes while uploads are active. S3 signatures can't replace the session: our create, complete and item calls check access and charge quota.
- **Status 2026-10-30: open.**

### 47. Per-file shared rows left on the upload path

*Architecture debt · Impact 2 · Risk 2 · Effort 3 → **12** · est. 1–2 days · source: item 42, 30 Oct*

- **Evidence:** after item 42 an upload still writes, in its own statement, the direct parent's `Folder` row (`childCount`, via `update_child_count()`) and the uploader's `Quota` row. Many uploaders dropping files into the same folder would queue on that `Folder` row; if a collaborator's upload into a shared folder charges the owner's quota, the owner's `Quota` row is shared too. Item 42's benchmark had each uploader in its own subfolder and wrote no quota, so neither was exercised.
- **Fix:** read whose quota a collaborator's upload charges; measure with all uploaders in one folder; if either queues, the same idle/busy log applies.
- **Status 2026-10-30: open.**

### 48. A malformed request answers 500 instead of 400 where the parser runs outside `try`

*Code debt · Impact 2 · Risk 2 · Effort 2 → **16** · est. 0.5–1 day · source: found while trashing the item 42 test folders, 30 Oct*

- **Evidence:** `parseFormData` and `parseSearchParams` throw a typed `INVALID_INPUT` error (status 400), and CLAUDE.md says to call them inside the handler's `try`. `app/routes/api/items.ts:108` called `parseFormData` before any `try`, so the error escaped the action and React Router answered **500 "Unexpected Server Error"**, its body carrying the raw Zod issue list. Reproduced from the browser (`.claude/evidence/p48-invalid-input-before.json`): `trash_items`, `restore_items` and `delete_items` with `selectedItems` sent as repeated fields (the schema wants one comma-separated string) all answered 500. Every `/api/items` intent shared the path. A pattern search found about 25 more handlers that call a parser before any `try`; each needs checking, since a page loader failing the same way shows the error page: `api/activities.ts:20`, `api/collections.ts:40, :104`, `api/comments.ts:23`, `api/invitations.ts:33, :66`, `api/members.ts:20`, `api/permissions.ts:30, :41`, `api/search.ts:89, :111`, `api/shares.ts:34, :64`, `api/thumbnails.ts:59`, `api/versions.ts:24`, `api/workspaces.ts:25, :49`, `stash/all.tsx:103`, `stash/collection.tsx:34`, `stash/collections.tsx:19`, `stash/duplicates.tsx:54`, `stash/folder.tsx:44`, `stash/gallery.tsx:29`, `stash/search.tsx:52`, `stash/trash.tsx:104`.
- **Fix:** per handler, catch the parser's error and answer with its status, as `/api/items` now does and as `/api/quota` already did (`throw data(..., { status: 400 })`). Or once, centrally: make the parsers throw a `data()` response with the status. That reaches every call site at once, but the `catch` blocks that run `toErrorInfo` on a thrown value would then see a `data()` object, so weigh it with them.
- **Status 2026-10-30: partly done.** `/api/items` catches the parser's error and rethrows it as `data({ success: false, error }, { status })`. Measured the same way before and after (`.claude/evidence/p48-invalid-input-{before,after}.json`): the three intents 500 → 400, and a well-formed request with made-up ids still reaches the access check (403). `app/routes/api/__tests__/items-invalid-input.test.ts`: 5 cases (the three intents, an unknown intent, `rename_item` without its name), 5 failing with 500 before the fix and passing after. The other sites are open.

### 49. Nothing applies the size log when a server starts

*Code debt · Impact 2 · Risk 1 · Effort 1 → **15** · est. 0.5 day · source: external critique of item 42, 30 Oct*

- **Evidence:** the rollup loop is started by the first `createUploadedItem()` in each process (`item-actions.ts:1830`, `size-rollup.ts:17`). Nothing starts it when the server boots. A delta itself survives a crash: `update_size()` writes it in the upload's own statement, and a run claims and applies its rows in one function call, so a run that dies rolls back and leaves them in place. But a process that stops (a crash or a deploy) while deltas are pending leaves them unapplied until the next upload on any instance starts a loop. Until then the folders above those files read short, and go negative if one of the files was trashed, moved or deleted in the meantime. That is the transient item 42 lists, except it lasts until the next upload. While deltas are pending, every new upload is logged rather than cascaded, so the first upload after the restart applies all of them. Read from the code; not reproduced.
- **Fix:** reproduce first: leave deltas pending, start a fresh process, upload nothing, read the folder. Then start the loop at server start, either always or only when `ItemSizeDelta` has rows. Once started, the loop already polls (one `EXISTS` every 250 ms) for the life of the process, so starting it at boot only adds the polling before the first upload.
- **Status 2026-10-30: open.**

### 50. No test guards the deferred `Folder_itemId_fkey`

*Test debt · Impact 2 · Risk 2 · Effort 1 → **20** · est. 0.5 day · source: external critique of item 42, 30 Oct*

- **Evidence:** `Folder_itemId_fkey` is `DEFERRABLE INITIALLY DEFERRED` only because migration `20260826000000_defer_folder_item_fk` made it so. Prisma can't express that, so `prisma db push`, or a migration Prisma generates after the `Folder.item` relation is renamed or its `onDelete` changes, drops the constraint and re-adds it as an immediate check (`docs/data_profile_stashly _prisma_schema.md`, the ⚠️ note under `update_child_count()`; `facet.prisma:21`). That note is the only guard: no file under `app/` mentions the constraint. Losing the flag brings back an intermittent P2003 when one permanent delete holds both a folder and something inside it. Whether it fails depends on the order Postgres visits the rows, so a single test run may not show it.
- **Fix:** a live-DB check, in an existing delete test, that `pg_constraint` still reports `Folder_itemId_fkey` as deferrable and initially deferred. CI applies every migration before the tests, so a migration that drops the flag fails CI, and a local `db push` fails the next local run.
- **Status 2026-10-30: open.**

### 51. One held row lock stalls the size rollup for every user

*Architecture debt · Impact 2 · Risk 2 · Effort 3 → **12** · est. 1–2 days · source: external critique of item 42, 30 Oct*

- **Evidence:** each run of `apply_item_size_deltas()` takes the oldest 5,000 deltas in the whole database (`ORDER BY "id" LIMIT`) and applies them in one `UPDATE`, all or nothing. It gives up after waiting 100 ms for any row lock (`20261030140000_upload_size_delta_log`). Any trash, restore, move or delete in an owner's tree locks every ancestor up to that owner's root until its statement commits. So one such statement that holds an ancestor of any delta in the batch for more than 100 ms rolls the run back for every user, and the retry 250 ms later takes the same oldest rows. While deltas are pending, every new upload is logged rather than cascaded, so the backlog grows. Item 42's concurrency benchmark ran no trash, move or delete alongside the uploads, and how long those statements hold ancestor locks was not measured. The critique's "minutes" is a guess. `size_rollup_lock_timeouts_total` (`metrics.ts`) counts the give-ups.
- **Fix:** measure first. Run item 42's 32-uploader benchmark with a large trash or move in the same owner's tree, and record lock timeouts and the oldest unapplied delta. If the rollup stalls, revisit item 42's open question of keying the rollup per owner tree rather than database-wide: one tree's lock would then hold back only that tree's deltas. The delta table would need the owner, a schema change.
- **Status 2026-10-30: open.**

### 52. The main thread is saturated for the whole upload

*Architecture debt · Impact 4 · Risk 4 · Effort 3 → **24** · est. 2–3 days · source: item 45 measurements, 31 Oct*

- **Evidence:** item 45's run 2 (`.claude/evidence/p45/run2-summary.json`, local): during the 650-file `app/` upload (698 s), the page spent 691 s in long animation frames (2,436 frames; p50 237 ms, p90 574 ms, max 1.07 s), 489 s of it blocking input. Blocking was 41% of the first minute and 73–77% of each minute from the fifth on. Rows created per minute fell from 152 in the first minute to 28–42 later (run 1: 147 to 33–45). Summed over the frames' script attribution: promise continuations in `machines/multipart/s3.mulipart.utils.ts` (after `Response.json`) 287 s, `utils/sniff.ts` 157 s, `machines/db/db.actors.ts` (after `Response.text`) 147 s; React's scheduler 31 s; `machines/indexing/indexing.actors.ts` 10 s. A continuation's time includes everything that runs synchronously after its `await`, so these are the upload machines handling their events, not the parsing. What inside that handling costs the time was not isolated.
- **Why it matters:** the page barely responds while a large upload runs. The falling row rate fits per-event work that grows with the number of files in the batch, which would also make larger uploads slower per file. Not proven.
- **Fix:** profile one upload (a DevTools performance trace) and find the per-event cost before changing anything. Leads from the code, unverified: in `upload-thumbnail-runner.tsx`, the `createdCount`, `uploading` and `fileIds` selectors each scan every file on every upload event, and each file mounts its own `HoldFileWatcher` subscription.
- **Status 2026-10-31: open.**
- **Status 2026-10-31 (later): partly done** (`ec4b521`). The upload panel's rows were `motion.li` with `layout="position"` inside `AnimatePresence mode="popLayout"` (`components/upload/index.tsx`). framer-motion re-measures every layout element when any of them changes, and the panel holds one row per file: 588 were mounted during a traced upload, in a list four rows tall. A DevTools trace taken mid-upload showed framer-motion's animation and measuring code and forced reflows, with most app time under the upload components. The rows are now plain `li`. Measured with item 45's run-2 harness (`.claude/evidence/p52-before.json`, `p52-after.json`, local):

  |  | before | after |
  |---|---|---|
  | upload duration | 698 s | 243 s |
  | rows created per minute (mean) | 56 | 161 |
  | main-thread blocking | 489 s (70% of the upload) | 93 s (38%) |
  | long animation frame p50 / p90 | 237 / 574 ms | 132 / 223 ms |
  | folder `.data` loads | 139 | 9 |

  - **Not done:** blocking still rises as the batch grows (17%, 35%, 48%, 52% of successive minutes), and rows per minute still fall (261, 163, 119, 101), so some per-event cost that grows with the number of files remains. The long frames still sit in the upload actors' promise continuations: `s3.mulipart.utils.ts` 83 s, `sniff.ts` 72 s, `db.actors.ts` 45 s. Next suspects, from the code and not yet measured: one machine subscription per file (each panel row, and a `HoldFileWatcher` per file in `upload-thumbnail-runner.tsx`), plus selectors that scan every file, all re-run on every upload event.
  - The rows lost their 0.2 s enter and exit animation.
- **Status 2026-10-31 (night): resolved** (`999b5a1`). Measured with the same harness throughout (`.claude/evidence/p52b-before.json`, `p52c-after.json`, local):
  - **Dead end, kept so it isn't retried: isolating the subscriptions.** A temporary `inspect` probe counted 3,911 manager snapshots per upload, about six per file and only 651 of them progress ticks. The three per-file hooks were moved onto one subscription that notified only the file that changed. Blocking went 88 → 86 s and the per-minute rise was unchanged, so it was reverted. A selector that returns the same value never reaches React; the cost was the renders that did happen.
  - **The cause: React work per file, redone on almost every status change.** `UploadPanel` re-renders whenever the upload counts change, and the unmemoized `FileList` rebuilt one `<Item>` per file each time, although the list is `h-40` and shows about three rows. With 651 rows in the panel, mounting them took one 1,422 ms frame, and one panel state change with them mounted took 526 ms. `UploadThumbnailRunner` likewise rendered one `HoldFileWatcher` per file and re-rendered on every created row.
  - **Fix:** `FileList` is memoized and mounts only the rows in view plus four either side (fixed 56 px pitch, spacers for the rest; scrolling to row 300 and to the end checked in the browser). The runner hands each created file to indexing and the held-file store from one subscription to the upload actor, with no per-file components. Keyboard focus now reaches only the mounted rows.

  |  | before `ec4b521` | after `ec4b521` | after `999b5a1` |
  |---|---|---|---|
  | upload duration | 698 s | 233 s | 90 s |
  | rows created per minute | 56 | 168 | 434 |
  | main-thread blocking | 489 s (70%) | 88 s (38%) | 0 s (0%) |
  | long animation frames | 2,436 | 1,539 | 23 |
  | long frame p50 / p90 | 237 / 574 ms | 132 / 224 ms | 64 / 71 ms |

  - Rows per minute no longer fall as the batch grows (366 in the first minute, 285 in the remaining 30 s). `pnpm test` 1043/0 in 89 files; `upload.spec.ts` and `thumbnail-machine.spec.ts` 26/26; type gate exit 0. All measured on the dev server; production wasn't measured.

### 53. An upload's metadata waits behind its embeddings and is lost on reload

*Architecture debt · Impact 4 · Risk 4 · Effort 3 → **24** · est. 1–2 days · source: owner report after item 52, 31 Oct*

- **Evidence:** facets (image dimensions and EXIF, markdown facets, page counts) are written only by the in-tab indexing queue (`app/machines/indexing/`). Each file is one `indexing-item` machine that holds one of the queue's two slots (`INDEXING_CONCURRENCY = 2`) through every step: reading metadata, saving it, embedding the chunks on the GPU, saving vectors, and OCR for a scanned PDF. So a file's facets wait behind every earlier file's embeddings and OCR. Nothing in the queue is persisted, and facets have no backfill (embeddings do: `pending_search_embeddings`), so a file still queued when the tab does a full load or closes never gets its facets.
  - **How far behind:** in item 52's last run, all 651 rows existed after 90 s, while metadata saves stood at 40 after 129 s and 271 after 387 s, about 0.75 a second (`.claude/evidence/p52c-after.json`).
  - **Missing facets, counted in the dev DB per 10 minutes** (markdown and image uploads since 30 Oct 18:00 UTC): every harness run that ended with a full navigation got 0 facets on its markdown and image files, including runs before any of that night's commits (21:30–22:40 UTC). The owner's own batch got 33 of 58 markdown files, then 0 of 30 camera JPEGs. 15 of 16 JPEGs uploaded in the MCP tab lost their facets when that tab was reloaded about 5 minutes later. Files that went up alone, or in a batch the tab stayed open for, all got theirs: 1 of 1 PNG, then 30 of 30 PNGs uploaded as one 10 s burst.
  - The same JPEG uploaded on 26 Oct has its full EXIF facet (2736×3648, HUAWEI CLT-L09, f/1.8, ISO 50). Uploaded on 31 Oct it has none.
  - Item 52 made this more likely: an upload now finishes in a fraction of the time, while indexing still takes many minutes after it.
- **Fix (decided 31 Oct):** split the per-file work into three machines.
  - `indexing-item.machine.ts`: metadata only (read, save, retry), run right after `itemCreated`.
  - `embed.machine.ts`: vector embedding only (embed chunks, save vectors, retry).
  - `ocr.machine.ts`: the old `transcribingScannedPdf`, page by page; each page's chunks go to `embed.machine`.
  - `indexing-queue.machine.ts` gets two lanes: metadata, always open; and embed plus OCR, paused while any upload is in flight and resumed after 2 s with none.
  - **Rejected:** a facet backfill that downloads the originals from S3. It costs bandwidth and S3 calls, and it would slow the app with client-side extraction the user can't see a reason for.
  - **Trade-off:** a scanned PDF still waiting for OCR when the tab reloads gets no OCR text. Vectors left unwritten are already healed by the embedding backfill.
- **Status 2026-10-31: open.** Measure with item 52's harness, before and after: how many metadata saves have landed when the last row is created, and when the last one lands.
- **Status 2026-10-31 (night): partly done, measured.** The split is in as decided: the metadata machine, `embed.machine.ts`, `ocr.machine.ts`, the queue's metadata and deferred lanes, and the runner pausing the deferred lane while files are in flight (2 s idle to resume). Same harness, the 655-file `app/` upload (`.claude/evidence/p53-before.json`, `p53-after.json`, local):

  |  | before (`999b5a1`) | after |
  |---|---|---|
  | metadata saves when the last row was created | 2 | 37 |
  | metadata saves within 10 s of the last row | 8 | 90 |
  | last metadata save | still running at 399 s (273 of 651 done) | 256 s: 655 of 655, 0 errors |
  | markdown / PNG facets in the DB | 0 / 0 (every earlier harness run) | 7 of 7 / 1 of 1 |
  | vector saves during the upload | 0 | 0; the deferred lane started about 5 s after the last row |

  - **Not done: metadata still trails a large upload.** While files upload, the server answers `save_media_metadata` slowly (p50 432 ms, p90 7.7 s; 327 / 375 ms once uploads end), so most facets land in the 107 s after the last row, and a reload in that window still loses the rest. What makes the request slow under load wasn't isolated. Options: more metadata concurrency, or saving the facets before the file's text.
  - OCR now embeds nothing itself: each saved page's chunks become an `embed.machine` job. A scanned PDF still waiting for OCR when the tab reloads gets no OCR text, since OCR has no backfill.
  - `pnpm test` 1054/0 in 91 files (18 new cases across the queue, embed and OCR machines); `upload.spec.ts` and `thumbnail-machine.spec.ts` 26/26; type gate exit 0.

### 54. OCR is slow, and its models haven't been re-surveyed

*Architecture debt · Impact 3 · Risk 2 · Effort 3 → **15** · est. 2–3 days · source: owner, 31 Oct*

- **Evidence:** scanned PDFs are transcribed in the browser by GLM-OCR 0.9B (about 623 MB, the default) or Florence-2 base-ft (about 340 MB, English only), up to `OCR_MAX_PAGES = 15` pages. The `stashly-ai-inference` skill records about 28 s a page, about 70% of it before the first token (CPU preprocessing and the vision encoder), both scaling with `OCR_MAX_PIXELS`. Not re-measured; the engines were last compared months ago.
- **Fix:** measure seconds per page and the time before the first token, with both engines, on one fixed scanned PDF. Then survey current browser-capable OCR models (WebGPU or ONNX), benchmark the best candidates on the same PDF, and switch only on numbers.
- **Status 2026-10-31: open.** Item 53 moves OCR into its own machine first.

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
| 2026-09-30 | `0b98234` | 1 | Actions moved to their Node 24 majors (`checkout@v7`, `setup-node@v7`, `cache@v6`). |
| 2026-09-30 | `e8a61eb`, `326c317`, `eda8fc7` | 2 | Dockerfile rebuilt for pnpm and Node 24, `fly.toml` with a migration release command, and a CI docker job that boots the image. |
| 2026-10-01 | `ba437d3`, `fc655be` | 6, 8 | The last four unused packages removed; the quota read in `retrieveUserUsageMetrics` now runs inside its transaction. |
| 2026-10-01 | `76c69a5`, `b955723` | 7, 13 | Test files import their Vitest globals and pass the right arguments; the baseline is down to 11 errors, and CI fails on leftover allowance. |
| 2026-10-01 | `ea4c2a1`, `7e34556` | 17 | The favorites work in progress was finished: `unfavorite` returns data and bulk favorite clears the selection. Both were confirmed in the browser. |
| 2026-10-01 | no commit (operation) | 5 | ACL sweep applied to every bucket: 7 grants made private, one bucket's object-ACL flag turned off. Signing cost re-measured: a concurrent `SELECT 1` peaked at 15 ms, against the 697 ms that forced the revert. |
| 2026-10-01 | `736d6ca` | 8 | Drive and notification filter keys aligned with their schemas, guarded by a new coverage test. |
| 2026-10-01 | `e6ac762`..`e506455` | 1, 13 | Honest CI: real Postgres for both jobs, a health check that queries the database, every test run, output never hidden, invalid filter values rejected with a 400. |
| 2026-10-01 | `6030753`, `5727307` | 1, 13 | The filter 400 is tested on filters the app really has. A `roles` filter of the wrong kind (member roles on a personal stash, or the reverse) was cast and answered 500; each branch now parses its own kind. |
| 2026-10-01 | `6218641`, `3d5e1d7` | 9 | Permanent delete now removes S3 objects; `sweep-s3-orphans.ts` cleans up what was left behind. |
| 2026-10-02 | no commit (operation) | 9 | Orphan sweep applied: 652 objects deleted, 85 stale uploads aborted, 0 failures; every bucket now fully referenced. |
| 2026-10-02 | `c554b8c` | 8 | Permanent delete needs `owner` on every item, with workspace membership read from the item, and answers 403. |
| 2026-10-02 | `8e41013` | 8 | The quota UPDATE locates its own row: one round-trip per quota change instead of two. |
| 2026-10-02 | `e04d07d` | 8, 13 | Trash and restore need `write`. Trash's quota over-count is fixed, and delete works only from trash. Each is one statement with batched activities; upload activity no longer races its transaction. 20 new tests. |
| 2026-10-02 | `1b41e45` | 8 | `onActiveItemsDeleted` removed: permanent delete only takes items from trash, so it had no callers. |
| 2026-10-02 | `4396da6` (migration `20261002090000_fix_inclusive_size_rollup`) | 8 | `update_size()` passes a folder's `inclusiveSize` up and reacts to its changes; every folder recounted (5 corrected on dev, 3,542,674 bytes). 15-step regression test. |
| 2026-10-02 | `1eac608` | 8 | An upload no longer files into a trashed folder of the same name; it creates a fresh one. |
| 2026-10-03 | `935a923`, `d11ffae`, `d41dd8e` | 14 | Legacy thumbnail hooks deleted (1,389 lines); the XState scheduler is the only path; thumbnails only for on-screen cards; pipeline split by file type. |
| 2026-10-03 | `eaf71e4` | 10 | Filter flag toggles no longer nested inside the trigger button. |
| 2026-10-03 | `bcb227d` | 13, 20 | Thumbnail e2e spec passes again, fixed in its setup. |
| 2026-10-03 | `fc8934b`, `1821ca4`, `9422c8b` | 22 | Uploads never guess a destination, check folder access before any bytes, and free a failed file's slot. |
| 2026-10-03 | `32d1431`, `23eb94a` | 29, 8 | Trash lists only the signed-in user's items (it listed everyone's); trashed folders open inside Trash. Raw `now()` stamps in trash, restore and the activity insert are written in UTC (they were 3 h ahead). |
| 2026-10-08 | `2fc9d4d` | 18, 22, 13 | `/api/quota` is read-only; every write action answers 400. Uploads are charged in `createUploadedItem`'s transaction, and the client charge and its retry loop are gone, which settles item 22's first question. 2 new test files: 9 of 13 route tests fail against the old route, 3 of 4 charge tests fail with the server charge removed. |
| 2026-10-08 | `9081555` | 13, 20 | Upload e2e spec: 1 test to 11, covering filing, the exact quota charge and the refused quota writes. Passes locally; not in CI. |
| 2026-10-08 | `bb321a3` | 25, 23 | Every share-link action takes the acting user and checks it (owner, or a live write permission); the `/api/shares` loader no longer queries Prisma. 37 new tests: 403 for a stranger, a read-only and an expired grantee on all 11 operations. |
| 2026-10-08 | `e9f163b` | 23, 13 | The shares and gallery routes call actions instead of Prisma; a test fails on any new `@/services/db` import under `app/routes/` (one listed exception, `workspace.tsx`). |
| 2026-10-08 | `08324f8` | 13 | CI was red on `e9f163b`: the gallery query test signed a real thumbnail URL, which needs an S3 endpoint the check job doesn't set. Signing is now replaced in that test. |
| 2026-10-08 | `1a8102a` | 26, 13 | Every access check counts only live grants (not soft-deleted, not expired), including the `accessibleBy` listing filter. Confirmed first in a rolled-back transaction; 14 new tests, 8 of which fail on the old code. |
| 2026-10-09 | `df68279` | 21, 13 | The embedding model runs in a dedicated worker, and a Web Lock lets one tab drain the backfill. Measured in Chrome: main-thread blocking while embedding went from 1,279 ms to 0 ms. |
| 2026-10-09 | `57f499c` | 24 | Server dependencies bundled into the server build (1,697 files loaded on the first request → 38), and dotenvx replaced by `process.loadEnvFile`. First page after a fresh start: 4,055–15,119 ms → 761–1,724 ms. |
| 2026-10-10 | `65f3891` | 4 | Vinktar error tracking and product analytics on server and browser; off under Vitest. |
| 2026-10-10 | `d78b724` | 4 | Hidden browser source maps uploaded to Vinktar in the Docker build stage, then deleted from the image. |
| 2026-10-10 | `1419e08`, `b237941` | 2 | The Fly Postgres image installs pgvector, so the migrations' `CREATE EXTENSION vector` works on a fresh cluster; steps fixed against the real cluster. |
| 2026-10-23 | `65fe46b` | 28, 13 | Form and search values decoded once by `qs`; numbers only on an exact round-trip; `toUserText` on 20 free-text fields; bad input is a 400. 26 new parser tests. |
| 2026-10-23 | `6522ba0` | 27, 13 | Favoriting and the Favorites list need read access (`itemAccessWhere`); duplicate rows no longer stack or survive Unfavorite; parse inside the `try`. 16 new DB tests and the e2e seed for a second user. |
| 2026-10-23 | `4004b9d` | 21 | The backfill status rendered "unavailable" on the server and "available" in the browser; the hydration mismatch discarded the search view's server HTML. Now `useSyncExternalStore` with a `false` server snapshot. |
| 2026-10-23 | `a581626`..`b83faa1` | 20, 13 | E2E on one worker with traces kept on failure; navigation, search, pinned, favorites and thumbnail specs brought in line with the UI; stage 3 asserted at 512×512. 51 passed, 1 skipped locally. |
| 2026-10-24 | `839f933` | 8, 13 | `LockedItem_itemId_fkey` is `ON DELETE CASCADE`: a locked file no longer fails its folder's permanent delete. One new live-DB test. |
| 2026-10-24 | `e286ffd` | 30 | The new `last-account` cookie signs with the same `COOKIE_SECRET ?? 'secret'` fallback as the theme cookie. |
| 2026-10-25 | `059d0aa` (PR #26) | 31, 13 | The 10 Oct quota fix and the upload call audit, rebased and squash-merged: the server refuses a charge past the total with a 507, and the client pre-check is honoured. 5 new tests; 914/0 in 74 files, CI green. |
| 2026-10-25 | no commit (measurement) | 35, 39 | Upload audit re-run with real 10 MB and 100 MB JPEGs on `059d0aa`: 18 and 54 browser requests, 12 and 30 session lookups, 10 inserts and 4 updates each. Baseline kept in `.claude/evidence/upload-audit-before.json`. |
| 2026-10-25 | `41f2efe` | 32, 13 | The three search-index writes take the session user and check `write`; a refusal is a 403. 12 new tests with a second user; 926/0 in 75 files. |
| 2026-10-25 | `8ac03d9` | 34, 13 | `retryFetch` fails a 4xx other than 429 on the first answer. 8 new tests. |
| 2026-10-25 | `8a79e89` | 33, 13 | A cancelled upload, and one whose part retries ran out, aborts its S3 multipart upload. 3 new tests; 937/0 in 77 files. |
| 2026-10-25 | `c1dc745` | 35, 13 | 5-minute session cookie cache; `authMiddleware` forwards the refreshed cookie, and `customSession` fills onboarding fields a pre-onboarding cache lacks. 11 new tests; 948/0 in 78 files. Not yet measured. |
| 2026-10-25 | `e4aeb0e` | 33, 13 | A failed complete also aborts the multipart upload; the route answers an already-aborted upload as done. 5 new tests; 953/0 in 79 files. |
| 2026-10-25 | `fix(auth): encrypt the session cache cookie` | 35 | The session cache cookie is encrypted (`jwe`). Measured server-side: cached lookups 0 `session` scans, uncached 5 per 5. |
| 2026-10-25 | no commit (measurement) | 32–35 | Upload audit re-run on `fa00eae` (`upload-audit-after.json`): requests 18 and 54 as before, writes unchanged, session scans 12 → 0 (10 MB) and 30 → 14 (100 MB, cookie expired mid-upload). |
| 2026-10-25 | `fd23cad` | 35, 13 | The four upload API routes run `authMiddleware`, so they forward the refreshed cookie. Expired-cookie 10 MB upload: 1 session scan. 7 new tests; 960/0 in 80 files. |
| 2026-10-26 | `265c9d6` | 36, 38, 13 | A folder upload resolves its tree once (`resolve_upload_folders`: one query per depth level, one INSERT for all missing folders, one lock per uploader), and each file row plus its quota charge is one statement. Real `app/` upload (639 files, 71 folders, all checked in DB and S3): 11,600 → 1,284 statements, 1,278 → 1 transactions, 1,824 → 1 locks, 707 → 554 s. 9 new tests; 969/0 in 81 files. |
| 2026-10-26 | `074c06e` | 30 | Both signed cookies call `cookieSecret()` (`env.ts`): `SESSION_SECRET`, required in production at module load. Probe before/after: production with no secret loaded and signed with `'secret'` → throws; with a secret, verifies against `'secret'` → against that secret only. 3 new tests; 972/0 in 81 files. |
| 2026-10-26 | `78a63f3` | 38 | The upload manager's initial `maxConcurrentUploads` is 100, matching the schema default that `upload.config` applies. 3 new tests; 975/0 in 82 files. |
| 2026-10-26 | `3ddbf90` | 39 | Part URLs signed a window of 100 at a time, the first window in the create answer; a part whose URL answers 403 is signed again once. Browser, before → after: 10 MB 12 → 10 requests to our server, 100 MB 30 → 10. 16 new tests; 991/0 in 85 files. |
| 2026-10-26 | `51ca00d` | 40 | An empty file sends no `save_media_metadata` (`hasMetadataToSave`, the indexing machine's `nothingToSave` guard), and each facet write is one `upsert` on `itemId`. 28 new tests; 1019/0 in 87 files. Before → after, 5 runs: 2 → 1 statements per save; 8 racing first saves, 7 refused → 0; a zip's request 1 → 0. |
| 2026-10-26 | `12e3f74` | 41 | The three `shouldRevalidate` checks for `create_upload_item` (sent only by `fetch`) deleted, and the upload manager no longer spawns the quota machine, which never received an event; the file is kept. 1019/0 in 87 files. Probe before → after: actors created 6 → 5, everything else the same. |
| 2026-10-30 | no commit (code read) | 42 | Item 42's evidence re-read on `main` at `26bd89c`. Since `265c9d6` the file row and its quota charge are one statement with no transaction, so the ancestor locks the rollup takes are released when it commits; `update_size()` skips a zero change, so new empty folders lock nothing. Declined; nothing measured. |
| 2026-10-30 | `5155d96` | 43, 13 | The thumbnail presign, PATCH and source calls check read access in the item lookup (`itemAccessWhere`) instead of `hasItemPermission` plus a second read: 3 → 1 statements per call, 9 → 3 per uploaded image. 3 new cases in `permission-live-grants.test.ts`. |
| 2026-10-30 | `0828f99` | 43 | The layout loader reads the sidebar's workspaces; `workspaceMiddleware` is unregistered. 20 client navigations: 20 → 0 `WorkspaceMember` scans. |
| 2026-10-30 | `d7592ff` | 43, 20 | The post-upload reload counts only `itemCreated`. With item creation held 1.5 s: rows in the reload 0 → 6 of 6, cards on screen 0 → 6. New E2E test, red on the old count, 3/3 green. 1022/0 in 87 files. |
| 2026-10-30 | no commit (measurement) | 42 | 646-file `app/` upload on `638f455`: 3,994 `update_size()` calls, 3,141 ancestor rewrites, 0.48 s database time, 95% HOT, no `Item` autovacuum, ~1.2% of WAL. `WHEN` clauses on the `Item` triggers: calls 11,129 → 4,504 but trigger time 462 → 506 ms in rolled-back runs; undone, never committed. Batched-rollup prototype, every 25 files: rewrites 3,141 → 192, size work 434 → 129 ms, identical sizes in 20 runs. Awaits a decision. |
| 2026-10-30 | no commit (measurement) | 42 | Concurrency, one shared folder, prototype session-gated on the dev database and restored after: 32 uploaders, today 1,837–2,047 files/s with 21 of 32 waiting on locks; rollup by each 25th uploader 2,478–2,599; single-flight 9,603; single-flight 200 ms timer 8,981 files/s, 0 waiting, 3,644 ancestor updates instead of 100,512, sizes at most 342 ms stale. Exact sizes in all 27 runs. |
| 2026-10-30 | `92c804e`, `839f435` | 42, 45–47 | Item 42 resolved: migrations `20261030140000_upload_size_delta_log` and `20261030160000_upload_size_inline_when_idle`, `app/.server/size-rollup.ts`, 16 new test cases (1038/0 in 88 files). Measured: one uploader 0 deltas logged and size work 757 ms (615 before); 32 uploaders into one shared folder 2,017 → 8,334 files/s, 0.06 lock waiters, 2,821 ancestor writes instead of 100,512. Logging every upload (3.5× costlier for one uploader) and a lock-first decision that starved the rollup were measured and replaced. Items 45–47 registered. |
| 2026-10-30 | `46b3a2b` | 48 | `/api/items` answers a malformed body with 400, not 500: the three item-list intents 500 → 400 (measured), 5 new route tests red → green. About 25 other handlers with the same pattern recorded. |
| 2026-10-30 | no commit (measurement) | 44 | On `aa91fb4`: `assertCanUploadTo` is 1 statement (~3 ms warm), three per file. Per file, complete 249–537 ms, a 44–113 ms browser gap, create 120–288 ms; 12 of the batch's 46 requests. Declined. |

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

- ~~Two thumbnail orchestrators (2–3 days)~~: resolved 2026-10-03
- ~~Thumbnails of private files are publicly readable (3–5 days)~~: resolved 2026-10-01
- ~~Failed uploads leave S3 bytes and charged quota with no Item (2–3 days)~~: resolved 2026-10-02
- ~~Data-integrity gaps in loaders and deletes (1–2 days)~~: resolved 2026-10-01

*Status 2026-10-08:* Phase 2 is done; the orchestrator merge landed 3 Oct. *Status 2026-10-02:* only the orchestrator merge (item 14) remains. Signing shipped *before* the orchestrators were merged, the reverse of the planned order, so the signing change had to land on both paths.

### Phase 3 · ongoing

*boy-scout rule on every feature PR*

Pay down on each touch: add tests for any loader or action you change, and fix accessibility on components you edit.

- UI accessibility and responsive debt (5–8 days)
- Tests are missing where the risk is (ongoing, ~2 weeks)
- ~~`item-actions.ts` god module (3–5 days, incremental)~~: declined 2026-09-29
- Overlapping UI primitives (2–3 days): partly done
- Unfinished migrations left in place (2–4 days): favorites work in progress finished; workspace stubs and duplicate routes left, deferred 4 Oct

### Phase 4 · added 8 Oct

*item 18 done 8 Oct; item 20 is next; the rest fit the Phase 3 cadence*

New items from the 8 Oct re-scan, in the order to do them:

1. ~~**`/api/quota` trusts the client (item 18, 0.5–1.5 days).**~~ **Done 8 Oct** (`2fc9d4d`, e2e in `9081555`). Still open within it: the charged size comes from the client form, not from S3.
2. **Playwright in CI (item 20, 0.5–1 day).** This puts the upload and thumbnail flows under the safety net that Phase 1 built. Now the next item: the upload spec checks quota from the browser, and the job must run with one worker or a user per worker.
3. **Stripe webhook (item 19, 1–2 days).** Needed before anyone pays. It's also the right server-side home for `updateTotalQuota`.
4. ~~**Prisma out of routes (item 23, 0.5–1 day).**~~ **Done 8 Oct for every personal route**; `workspace.tsx` deferred. A test stands in for the linter rule. It turned up items 25 (fixed) and 26.
5. **The three open decisions (item 22).** These are decisions rather than code. Item 18's server-side charge settles one of them.
6. ~~**Embedding backfill in a worker, one tab (item 21, 1–2 days)**~~ **done 9 Oct, measured: 1,279 → 0 ms of main-thread blocking** and ~~**cold first load (item 24, 1–3 days)**~~ **done 9 Oct: first page 4–15 s → ~1 s, by bundling the server dependencies.**
7. ~~**`hasItemPermission` and revoked grants (item 26, 0.5 day).**~~ **Done 8 Oct**: confirmed, then every access check filtered to live grants.
8. ~~**Favorites access and the text decoders (items 27, 28).**~~ **Found and done 23 Oct** in the post-pull E2E pass. Item 20 is still next: the suite is now green locally on one worker, so the CI job is the only step left, plus deciding how the E2E bucket should outlive a run.
9. ~~**Trash scoped to its owner (item 29).**~~ **Done 3 Oct**, recorded 25 Oct from git history.
10. ~~**Cookie secret fallback (item 30, 0.5 day).**~~ **Done 26 Oct** (`074c06e`): a release missing `SESSION_SECRET` now stops at boot instead of signing with `'secret'`. Set that Fly secret before the first `fly deploy` (item 2).

### Phase 5 · added 25 Oct

*items 31–44, from the upload call audit; the first step is under a day*

1. **Now:** ~~merge PR #26 (item 31)~~ done 25 Oct (`059d0aa`); ~~add the ownership checks to the three search-index writes (item 32)~~ done 25 Oct (`41f2efe`); ~~stop retrying 4xx answers (item 34)~~ done 25 Oct (`8ac03d9`). Two security gaps and a slow failure, each a small diff with a test.
2. **On the next upload task (about 1.5 days):** ~~abort cancelled and failed multipart uploads (33~~ done 25 Oct, `8a79e89`; Tigris offers no lifecycle rule to fall back on); settle the `.ts` sniff (37), ~~the metadata writes (40)~~ done 26 Oct (`51ca00d`) and ~~the dead branches (41)~~ done 26 Oct (`12e3f74`); ~~measure the concurrency limit and correct the skill (38)~~ done 26 Oct (`78a63f3`).
3. **A measured performance pass (3–5 days):** ~~the session cookie cache (35)~~ done 25 Oct, measured; ~~part URLs in bulk (39)~~ done 26 Oct (`3ddbf90`), signed 100 at a time, measured; ~~the folder tree once per batch (36)~~ done 26 Oct (`265c9d6`), measured; ~~the revalidation and thumbnail overhead (43)~~ done 30 Oct (`5155d96`, `0828f99`, `d7592ff`), measured. Repeat the audit's measured upload before and after; the CLAUDE.md debugging rules require the numbers.
4. **Only if contention is measured:** ~~the rollup redesign (42)~~ declined 30 Oct (since `265c9d6` its locks last one statement) and ~~merging the requests (44)~~ declined 30 Oct (measured: about 3 ms per check, one request and 0.16–0.39 s per file). High effort for an unproven payoff.

---

*Method: read-only scan of the working tree on your computer — file and line counts, grep for type escapes and markers, an import scan against `package.json`, the tsc baseline, Dockerfile, `.gitignore`/`.dockerignore`, git history since June, and TASKS.md. The generated Prisma client (`app/prisma/`) is excluded from code metrics. "No import found" for a dependency means none in `app/`, `server*`, `scripts/` or `vite.config.ts`; confirm with a build before removing. 40 files had uncommitted changes at the time; findings reflect the working tree.*

*Re-audit 8 Oct: same read-only method over 109 commits since the audit, TASKS.md (triaged 4 Oct) and `docs/project-analysis-2026-10-04.md`. Item 18 was verified by reading the route, schema and `applyQuotaDelta`, not by calling the endpoint. UI findings in item 10 weren't re-measured in a browser.*

*History check 25 Oct: every non-merge commit since 25 Jul that touches `app/`, `server`, `prisma/`, `deploy/`, the Dockerfile, `fly.toml` or `.github/` was matched against this register; commits it doesn't name were read and either added above or left out as feature work (collections sort and covers, invitations, sign-in redesign, item-card rename, styling). Test counts are from CI's log for `bfefbbf`. Items 29 and 30 were read from the commits and the code; neither was reproduced.*

*Upload audit 25 Oct: items 31–44 were taken from `docs/upload-call-audit.md` (10 Oct, on PR #26) and re-checked with targeted reads of `main` at `6173a8c`. Items 36, 42, 43 and 44 are marked "per the audit" and weren't re-read that day. Item 42 was re-read on 30 Oct and declined; item 43 was re-read, measured and resolved the same day, and item 44 measured and declined. Item 32 was confirmed from the action signatures, not reproduced with a second user. Traced call counts are the audit's; the only measurement behind them is its single 8.46 MB upload.*
