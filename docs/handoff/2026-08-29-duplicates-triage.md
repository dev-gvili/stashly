# Duplicates triage + upload content hashing — 2026-08-29

## Shipped

- `9d5ec71` `feat(duplicates): resolve-duplicates triage screen behind the storage RESOLVE action` — the Health panel's disabled RESOLVE button now opens something. Integrated from a design handoff bundle; imports reconciled against the real repo (no `StashItem.thumbnailUrl`/`.extension`, `size` is `bigint`).
- `8d5ae6d` `perf(upload): hash file contents in a worker, off the upload path` — feeds `File.hash` so duplicate groups can prove `exact`.
- `c5aaf4d` `fix(quota): apply deltas atomically in the database` — `{ increment }` instead of read-add-in-JS-write-absolute.
- `676ced3` `fix(code-viewer): scope suffix resolution to the owner and drop stale libs on project switch` — user's own work, committed here.
- `768eba6` `fix(upload): drop onto the folder being viewed, not the drive root` — user's own work.

Working tree clean, nothing unpushed.

## Not done

- **The atomic quota increment is unproven under real concurrency.** Typecheck/build/tests only show it compiles and breaks nothing. The check is two racing transactions on a live quota row: `+1` and `+1` in parallel, assert `used` moved by exactly 2, then `-2` to restore. Not run — it is a genuine write.
- **`hash.worker.ts` and `file-hash.ts` have never been executed.** They typecheck and build; no upload has been run through them. Upload a few files and confirm `File.hash` is non-null before trusting any `exact` verdict.
- **Large batches will still leave some files with `hash = null`.** `takeFileHash` gives up after 1.5s; under a worker backlog the slow ones miss it. Full coverage needs a PATCH-after-the-fact intent, the way thumbnails already work. Not built.
- **No backfill for the ~646 existing files.** They all have `hash = null`, so every duplicate group currently reads `'near'` and `'exact'` is unreachable in practice.
- **`File_itemId_fkey` is `NOT DEFERRABLE` while its sibling `Folder_itemId_fkey` is deferred** (`20260826000000_defer_folder_item_fk`). A P2003 on `File_itemId_fkey` appeared once during the broken-hash burst. Migration not written — the mechanism was never proven, see below.

## You must run

Nothing. No schema change, no migration, no re-index.

## Known-broken

Pre-existing only; this session caused none of it.

- `pnpm test` — **443 passed / 11 failed (454 in 27 files)**: `collection-actions.test.ts` ×7, `activity.test.ts` ×4. (CLAUDE.md still records the older 406/417 figures — see the proposed diff.)
- `pnpm typecheck` — **204 errors**, the documented baseline, none in touched files.
- `pnpm build` — exit 0.

## Context worth keeping

- **Hashing in `toMediaFile` broke uploads outright, and the mechanism is not obvious.** `toMediaFile` was made `async` and awaited before `upload.send({ type: 'upload.add' })`, so no file entered the machine until its whole file had been read and digested. In `addBatch`'s serial loop the entire batch sat in `pending` for the sum of all hash times, then released as one burst — 100 uploads finishing together, 100 `create_upload_item` transactions contending on the same per-user Quota row, and 5s Prisma transaction timeouts. Two `Prisma` errors were chased into the database before the client-side cause was accepted. **`toMediaFile` must stay sync.** The user also dropped `maxConcurrentUploads` 100 → 10.
- **The FK error was never root-caused.** Two live hypotheses: Prisma 7's interpreter parallelising the nested `file: { create }` against an immediate constraint, or a second face of the same timeout. Ruled out: a post-`ROLLBACK` statement returns Postgres `25P02`, not `23503`, which argues for the first. The decisive experiment is one `item.create` with query logging inside a rolled-back transaction, to see the statement order.
- **`parseFormData` loses repeated form keys on the multipart path.** Measured against the real `qs`: the urlencoded branch returns `["a","b"]`, the multipart branch's `entries.reduce` returns `"b"` — first value silently gone. Indexed keys (`itemIds[0]`, `itemIds[1]`) work under both, which is why `create_upload_item`-style array payloads use them.
- **`shouldRevalidate` on the duplicates route must refuse POSTs.** Otherwise each commit re-runs the grouping query, drops the group just resolved, and shifts every index under the cursor the view holds internally — the screen skips a group on every keep.
- **`crypto` inside `app/utils/converters.ts` is the `crypto-js` import**, not the global; `crypto.subtle` typechecks as `CryptoJS.subtle` and fails. Use `globalThis.crypto`.
- **Rejected: `parseSearchParams` for the resolve action.** It only reads `new URL(request.url).searchParams`, never the body, so it would mean putting a 200-id drop list (~6 KB) in the URL.
