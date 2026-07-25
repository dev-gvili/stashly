# Cross-file type resolution — options comparison

**Goal:** in the code viewer, resolve types across a user's *other uploaded
files* — so `import { StashItemAudio } from '@/types/stash.types'` inside a
viewed `.ts` file hovers with real types instead of `any`, the same way
npm-package imports now do via ATA.

**Status:** npm ATA shipped (`80a23e6`). This doc compares the two ways to add
*cross-file* (uploaded-file) resolution, for a decision.

---

## What both options require (shared cost)

Neither option is free of backend work — there is **no endpoint today** that
returns a source file's text by path (`getMediaSiblings` only lists media for
prev/next nav). Both need:

1. **A backend endpoint** — an action + API route that, given the viewed file,
   returns sibling **source** files as `{ path, text }`. Open scope questions:
   - *Which files?* Current folder only, or the whole project tree walked from
     a `tsconfig.json` root? A real repo is thousands of files — we'd bound it
     (only `.ts/.tsx/.js/.jsx/.d.ts`, and ideally only files reachable through
     imports, fetched transitively/on-demand).
   - *How addressed?* By stash path relative to a project root.
2. **Path-alias config** — `@/* → app/*` comes from the uploaded
   `tsconfig.json` `compilerOptions.paths` (read it if present, else infer).
3. **Fetching** — presigned S3 reads (like `loadTextDocument`), bounded so a
   large project doesn't pull everything at once.

The two options differ in **what consumes those files** once fetched.

---

## Option 1 — `addExtraLib` + `compilerOptions.paths`

Reuse Monaco's existing TypeScript worker (the one already backing our hovers).

**How it works**
- Set `compilerOptions.baseUrl` + `paths` (`{ "@/*": ["app/*"] }`) from the
  uploaded tsconfig.
- For each fetched sibling, `addExtraLib(text, 'file:///stashly/app/types/stash.types.ts')`
  — its real path under the same virtual root the viewed model already uses.
- The existing worker resolves `@/types/stash.types` via `paths` → the extra
  lib. Hovers, diagnostics, and go-to-definition flow through the **same worker
  and the same VS Code-parity formatter we already built** — no new plumbing.
- Resolve transitively and on-demand: parse the viewed file's imports, fetch
  those files, parse *their* imports, repeat — bounded by depth/count. Only
  what's actually referenced gets loaded.

**Pros**
- **Reuses the entire shipped stack** — worker, custom hover, ATA, SQL,
  Format. Cross-file becomes "more extra libs."
- **Small client footprint** — a fetch/register loop + `paths` config.
- **Coexists with npm ATA for free** — both are just extra libs.
- **One TypeScript instance**, already off the main thread (in the worker).
- **Low risk** — this is the canonical Monaco pattern.

**Cons**
- Extra libs are **global to the Monaco instance** — opening many files
  accumulates libs; needs lifecycle management (namespace/clear per viewer).
- Must feed every **transitively referenced** file; a deep import graph means
  many fetches + `addExtraLib` calls (worker memory grows with graph size).
- **Path mapping must match tsconfig exactly**; monorepos / multiple tsconfigs
  get fiddly.
- Project-wide features stay limited to what the model-centric worker offers
  (hover/def across files work; full-project find-refs/rename don't).

**Effort:** Medium (mostly the shared backend + a register loop).
**Risk:** Low–Medium.

---

## Option 2 — `@typescript/vfs` environment

Build a real in-browser TypeScript project and query it directly.

**How it works**
- Assemble an `fsMap`: the `lib.*.d.ts` (Monaco already bundles these, or
  `createDefaultMapFromCDN`), the ATA-acquired `@types`, and **all uploaded
  source files** at their real paths.
- `createSystem(fsMap)` + `createVirtualTypeScriptEnvironment(system, rootFiles,
  ts, compilerOptions)` → a genuine `LanguageService`/`Program` over the whole
  project.
- Re-point our hover provider at **this env's** `getQuickInfoAtPosition`
  (feeding the same formatter), instead of Monaco's worker. Keep it current
  with `env.updateFile` on change.

**Pros**
- **True project-wide resolution** — full, tsc-accurate cross-file types,
  go-to-def, and (if wanted) find-all-refs / rename across the whole project.
- **Honors tsconfig fully** via the real compiler (paths, module resolution,
  etc.) — no re-implementation of resolution rules.
- `@typescript/vfs` is **purpose-built** for exactly this.

**Cons**
- **Large re-architecture, two type systems** — Monaco's worker still
  tokenizes/validates the open model *and* a separate vfs env owns cross-file
  hovers. Must decide who owns hovers/diagnostics/definition and keep them from
  diverging.
- **`typescript` runs on the main thread** (~8.7 MB), building a `Program` over
  many files → real CPU/memory cost and **UI jank risk**. Avoiding that means
  hosting the env in a *custom* worker (postMessage bridge — vfs is not a
  Monaco worker), which is more plumbing.
- Must **re-wire our hover provider** (and possibly diagnostics/def) to the env
  — reimplementing integration the Monaco worker gives us for free.
- More moving parts to keep coherent with ATA (its libs must also populate the
  fsMap) and with Format/SQL.

**Effort:** High.
**Risk:** Higher (perf, dual-system coherence, main-thread TS).

---

## Side-by-side

| | Option 1 — extraLib + paths | Option 2 — @typescript/vfs env |
|---|---|---|
| Reuses shipped worker/hover | ✅ fully | ❌ re-wires hover to the env |
| New client code | Small | Large |
| TypeScript instances | 1 (worker) | 2 (worker + vfs) |
| Main-thread TS cost | None (worker) | High (unless a custom worker is built) |
| Cross-file **hover/go-to-def** | ✅ | ✅ |
| Project-wide **find-refs / rename** | ❌ | ✅ |
| tsconfig fidelity | Good (paths/baseUrl) | Full (real compiler) |
| Uses `@typescript/vfs` | No | Yes |
| Coexists with npm ATA | ✅ automatic | Needs fsMap wiring |
| Backend endpoint needed | ✅ (shared) | ✅ (shared) |
| Effort / Risk | Medium / Low–Med | High / Higher |

---

## Recommendation

**Option 1**, unless you specifically want project-wide tooling (find-all-refs,
rename across files) inside a *read-only viewer*.

The stated goal — "imports from other uploaded files resolve on hover" — is met
by Option 1 at a fraction of the cost and risk, and it reuses everything already
shipped (worker, hover formatter, ATA, SQL, Format). Option 2's headline
advantages (whole-project refactors) are beyond what a read-only viewer needs,
and its main draw for us — a CDN lib map via vfs — is already covered by
Monaco's bundled libs, so `@typescript/vfs` would add a parallel type system and
main-thread TS cost without proportional benefit here.

If project-wide navigation later becomes a real goal (e.g. an editable
workspace, not just a viewer), Option 2 is the right foundation — and the
backend endpoint built for Option 1 carries straight over.

*(Either way, the backend sibling-source endpoint is the first build step and is
identical for both.)*
