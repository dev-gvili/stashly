# Cross-file types in the code viewer — 2026-08-26

## Shipped

- `4d15316` `fix(code-viewer): resolve exports-only npm packages with bundler resolution` — Monaco's `NodeJs` is node10 and reads only `main`/`types`/`typings`; react-router 8 ships neither, so ATA's correctly-downloaded `.d.ts` was discarded by the resolver.
- `86a73aa` `feat(code-viewer): resolve cross-file types without a tsconfig` — suffix search + prefix learning on the server, alias-correction into `compilerOptions.paths` on the client. Carries the `.js`→`.ts` specifier rewrite as a rider (unsplittable: same file).
- `2403904` `docs(code-viewer): record bundler resolution and tsconfig-less aliases`
- `93fb74a` `chore(skills): add a handoff skill for session close-out`
- `4cba298` `docs(claude): anchor scope to the named file and correct verification facts`

## Not done

- **Single-import ambiguity.** A file whose *only* renamed-prefix import is an ambiguous filename (`@/services/auth` and nothing else from `@/services/*`) still resolves to nothing — four `auth.ts` exist under the root and the second pass has no sibling to learn from. By design: declining beats guessing. Fixing it would mean caching learned prefixes per-root across requests, which adds server state and staleness for a narrow case.
- **`./+types/*` route types.** Dropped at the user's direction — `.react-router/` is gitignored and was never uploaded, so there is nothing to fetch. If it is ever uploaded, it additionally needs `rootDirs` plumbed through `parseTsconfig` → `SourceContext` → `mapSpecifiers`; the repo's `rootDirs` lives in `tsconfig.vite.json`, which the server never reads (it only looks at the root `tsconfig.json` and does not follow `references`).
- **No unit tests** for `resolveByNameSuffix` / `learnPrefix` / `candidatesFor`. Verified by direct dev-DB probes instead. They are pure enough to test cheaply if this area is touched again.
- **`pnpm test` not run** this session — the suite's state is **unverified** here.

## You must run

Nothing. No migration, no dev-server restart, no re-index. The one manual step — hard-reload the viewer — was done and confirmed.

## Known-broken

Pre-existing only; this session added nothing red.

- `pnpm typecheck`: **202** errors, none in any touched file (measured four times today; CLAUDE.md updated from the stale 209).
- `pnpm test`: 11 pre-existing failures per CLAUDE.md — **not re-verified this session**, so treat that count as inherited, not confirmed.

## Context worth keeping

- **Fetching a file and resolving an import are two different failures**, and this bug was both. The server found `.server/db.ts` while the compiler still resolved `@/services/db` through the guessed `paths` and landed nowhere. Fixing either half alone changes nothing observable — worth remembering before declaring a resolution bug fixed.
- **A dead end that cost real time:** the first hypothesis was that switching to `Bundler` had broken alias resolution. It hadn't. A 5-case matrix (full vs. minimal host, with/without a project `package.json`, both modes) showed aliases resolving identically everywhere. Do not re-litigate this — the compiler was never at fault.
- **The offline harness is the fastest oracle here.** `require()` the repo's own `typescript` and drive `ts.resolveModuleName` over a `Map`-backed host mirroring the extra-lib layout. It answered every resolution question in seconds and needs no browser, no session, no dev server. Rebuild it rather than reasoning about resolution from memory.
- **The stash under test is not a repo.** Only `app/` was uploaded, dropped at the drive root beside unrelated PDFs, with no `tsconfig.json` anywhere — which is *why* the synthesized alias map exists at all. Probing ids: drive root `item_j6M7Z1qiSiwinRow7FF_iQ`, `app` folder `item_zdywu4sSMV66qriHYAkEng`.
- Uploading `tsconfig.json` beside `app/` still supersedes every heuristic here and is the cheapest fix if the guessing ever misfires.
