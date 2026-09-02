# Code-file search indexing — 2026-09-02

## Shipped
- `6c389d9` `feat(search): index source, config and data files` — only PDFs and markdown
  ever produced `documentText`, so every other text format got no `Search` row and was
  findable by name alone. Extracts `app/utils/text-files.ts` from `text-thumbnail.ts`
  (re-exported, callers untouched) so the server can reuse the predicate, adds the
  extraction branch, and widens `reindexTextItem` to repair already-uploaded files.
- `bfb2e2e` `fix(collections): keep the parent folder on collection item cards` — user's
  work; `parentId: null` collapsed the file URL to `/…/folders/files/:fileId`.
- `207c444` `style(cards): ring card surfaces with accent instead of borders` — user's.
- `24cb736` `refactor(thumbnails): move toS3PublicUrl into converters` — user's.
- `9a1ba26` `refactor(api): use path aliases in the collections route` — user's.

All five on `origin/main`. Tree clean, nothing unpushed.

## Not done
- **`pnpm build` never run.** `24cb736` puts `import type { AuthSession } from
  '@/.server/auth.types'` into `app/utils/converters.ts`, which the client imports
  broadly. Type-only imports are erased before the dot-server plugin walks the graph, so
  it *should* pass — but dev never attempts the split and this is exactly the class of
  break only `pnpm build` catches. User chose to push without it. Run it before deploy.
- **`app/utils/converters.ts:1016`** reads `}export function toS3PublicUrl(` on one line.
  Legal TS, unformatted. Offered a one-line `style:` commit; user hasn't asked.
- **The write half of `reindexTextItem` was never executed.** CLAUDE.md forbids
  unrequested DB mutations, so verification stopped at a dry run: ranged S3 read → decode
  → `chunkText`, no upserts. The two upserts are the same calls the markdown path already
  makes, but nothing has actually written a code file's index yet.
- **No E2E coverage** for the new branch. Unit tests cover the predicate only.
- **`documentText` has no server-side cap.** The client truncates at 512 KB before
  posting; `api.schemas.ts` still accepts an unbounded string. Pre-existing for PDFs too.
- **Stale docstring** at `search-actions.ts` `LiteralHit.lineNum` claims bodies pass
  through `cleanText`. They don't (see below). Left as-is — correcting it wasn't asked.

## You must run
```bash
# 1. backfill the index for code files already in the drive (25/batch)
#    → the ReindexStatus control in the UI; it POSTs intent=reindex_text
# 2. then let the browser embedding backfill fill the new chunks' NULL vectors
#    → semantic stays dark until it does; keyword/fuzzy works immediately
pnpm build   # the unrun check above
```
No migration, no schema change, no dev-server restart needed.

## Known-broken
- `pnpm test`: **459 passed / 11 failed (470 in 29 files)**. The 11 are pre-existing and
  unrelated — `activity.test.ts` ×4, `collection-actions.test.ts` ×7 (needs a live DB).
  This session added 10 passing tests and caused none of the failures.
- `pnpm typecheck`: **204 errors**, the documented baseline exactly. None in touched files.

## Context worth keeping
- **`cleanText` is not applied to stored bodies.** It runs when building *embedding* text,
  not in `upsertSearchContent`, which only trims. So newlines survive and code hits get
  real `lineNum` locators — verified: `Item.ts` → 408,064 chars, 8,176 lines, 331 chunks.
  I predicted the opposite from the docstring and was wrong; check the code, not the doc.
- **Two staleness checks were latent infinite loops** once non-markdown entered the queue,
  both the same shape: a repair signal the repair cannot clear. `length*10 < size` vs a
  512 KB cap, and "no newline ⇒ old parser" vs a legitimately single-line `.json`. Any new
  type added to that queue needs the same audit — every selecting predicate must be
  falsifiable by doing the work.
- **The noise exclusion is duplicated in SQL on purpose.** A candidate `reindexTextItem`
  refuses never leaves the queue; a batch of lockfiles would starve the real backlog.
- A `Range: bytes=0-N` past end-of-object is not an S3 error, which is what makes the
  ranged `getObjectHead` read safe for small files.
