# Code viewer request waterfall — 2026-08-27

Opening one 27-line file (`app/hooks/index.ts`) cost 1,024 requests and 470MB.
Diagnosed from a browser HAR, fixed, and measured back at 582 requests / 49.5MB.

## Shipped

- `4f41353` `perf(source-types): answer a batch in one query pass instead of one per candidate` — the 84s half. `findFileByPath` walked the tree per segment *per candidate extension*; a batch of 25 was >1,000 sequential queries. Now breadth-first directory placement (one query per tree level), one query for all candidate files, parallel S3 reads behind a per-request text cache.
- `555de50` `perf(code-viewer): stop restarting the TypeScript worker mid-walk` — the 391MB half. Alias corrections went through `setCompilerOptions`, which destroys the TS worker. They now ship as `.d.ts` re-export shims via `addExtraLib`, which patches the live worker. Also dedupes the walk queue at push time.
- `f6a2a64` `fix(code-viewer): dedupe the project-config lookup across the double mount` — the mount effect runs twice; `cancelled` stops the second editor but not the second in-flight fetch.
- `ccb44f2` `fix(billing): drop the dead server import that blocked the build` — **user's edit**, committed here. Unblocked `pnpm build`.
- `e2fbdab` `fix(filters): drop the query default that fails its own min(1)` — inherited from an earlier session today, not authored in this one.
- `788037e` `docs(handoff): record the cross-file types session` — the 2026-08-26 note, previously untracked. It describes the `compilerOptions.paths` mechanism that `555de50` replaced; read it as dated.

Tree clean, nothing unpushed.

## Not done

- **CLAUDE.md's `@/services/` rule is wrong as written** (line 109: *"Never use the `@/services/` alias in a route file"*). `billing.tsx` now uses it in five places and builds clean. The plugin only rejects when an export *other than* `loader`/`action`/`middleware`/`headers` depends on the server module. Diff proposed to the user, not applied — see below.
- **`INEFFECTIVE_DYNAMIC_IMPORT` on `app/utils/thumbnail-pipeline.ts`**, surfaced by the first successful build in a while. Its `await import()` buys nothing because four call sites also import it statically. Untouched — different subsystem.
- **~14s before the browser's first byte** on a cold dev server. Measured (278 requests before Monaco is even requested move 0.77MB total, so it is not module serving) and traced to server-side route work on a just-restarted Vite. Not an app bug; no fix attempted.
- **Multi-target alias fan-out** — `mapSpecifiers` pushes one path *per* `paths` target, and those are distinct strings no Set collapses. Free here only because the synthesized map found no `app`/`src` folder under the root, so every alias has exactly one target. With one present it would be 3× the paths, batches, and worker boots. Only the server can collapse it.
- **Fix 4 from the original analysis** — moving the whole BFS server-side for a one-shot closure. Dropped deliberately: `555de50` already gets worker boots to 1 (the floor), so it would buy latency, not bandwidth.
- **`pnpm test` never run this session.**

## You must run

Nothing. No migration, no dev-server restart, no re-index — all four code changes were verified live in the running dev server after the fact.

## Known-broken

Pre-existing only; this session added nothing red.

- `pnpm typecheck`: **204** errors, none in any file touched here. 184 sit in `collection-actions.test.ts` (150) and `pin-actions.test.ts` (34). CLAUDE.md records 202 from 2026-08-26 — the drift of 2 predates this session's edits.
- `pnpm test`: **not re-verified**. CLAUDE.md's 406/11 is inherited, not confirmed.
- `pnpm build`: passes now (exit 0, 2.98s) — it did **not** before `ccb44f2`.
- The dev server dropped once mid-session with `ERR_CONNECTION_REFUSED` and recovered on its own. Matches the unresolved crash noted earlier today.

## Context worth keeping

- **Monaco has two update channels and only one is destructive.** `onDidChange` (compiler options) → `_stopWorker()`; `onDidExtraLibsChange` → `_updateExtraLibs()` patches the live worker. Any future "make this resolve" fix belongs on the second channel. This single distinction was the entire 391MB.
- **Chrome's disk cache silently refuses very large entries.** `typescriptServices.js` (43.5MB) came back 200-with-full-body nine times despite `Cache-Control: immutable`; `lib.js` (16.4MB, identical headers) cached on first repeat. Don't trust cache headers on a multi-tens-of-MB asset.
- **`performance.getEntriesByType('resource')` caps at 250 entries by default** and drops the rest without warning — the first measurement here reported zero API calls because of it. Set `performance.setResourceTimingBufferSize()` in an `initScript` before measuring anything on this app.
- **To count worker boots, patch `window.Worker` in an `initScript`.** Counting network requests is inference; counting constructions is the fact. Same trick on `window.fetch` produced the stacks that disproved the StrictMode theory for the double mount (there is no `<StrictMode>` in this app).
- **The dot-server plugin reads the import graph, not usage.** `prisma` was imported and never referenced in `billing.tsx` and still failed the build. Dev never shows this class of bug — Vite serves modules per request with no tree-shaking, so server/client splitting is only attempted at build time.
- **A backgrounded shell command's exit code is the *wrapper's*.** `pnpm build > f; echo $?; tail f` reported success while the build had failed. Put the command last, or read the log.
- **The stash under test is `app/` uploaded without a tsconfig**, so the synthesized alias map (`@/* → *`) and the whole `guessing`/suffix-fallback path are live. Uploading `tsconfig.json` beside it would zero out corrections entirely and is still the cheapest fix if resolution ever misfires.
