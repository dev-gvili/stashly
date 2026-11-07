---
name: stashly-item-lifecycle
description: Stashly item lifecycle — trash, restore, permanent delete and the quota, size triggers, S3 objects and activity each one touches. TRASH_ROOTS and the TrashItem row, the trashed-folder view inside Trash, permission levels per action, UTC stamps in raw SQL, and the orphan sweep. Load when working on trash/restore/delete, the Trash page, quota deltas from those actions, or cleaning up stored objects in the Stashly repo.
---

# Stashly Item Lifecycle

`normal` → **trash** → **restore** (back to `normal`) or **permanent delete** (gone, bytes and all). All three live in `app/.server/item-actions.ts`; each is **one statement** (a data-modifying CTE) that walks the subtree, changes only the rows not already in the target state, and sums the bytes it moved. Keep it that way: on 50 items this took round-trips from 406 / 405 / 60 to 4 / 4 / 3 (trash / restore / delete), constant in the batch size (`e04d07d`). The size and child-count writes a status change causes come from the statement-level `item_status_change` trigger, once per affected folder: per-row triggers rewrote every ancestor once per file, which made restore quadratic (20,000 files 122 s → about 3 s, item 51). Restore's `Orphaned` step pairs rows with `GROUP BY` and an array, never a join with `"Changed"`: with statistics taken while nothing was in trash, a nested loop there compared 5,000 files 12.5 million times.

| Action | Function | Needs | Quota |
|---|---|---|---|
| Trash | `trashItems(ids, userId)` | `write` on every item | `used` → `deleted`, files only |
| Restore | `restoreItems(ids, userId)` | `write` on every item | `deleted` → `used`, files only |
| Permanent delete | `deleteItems` / `deleteItem` → `deleteFromTrash` | `owner` on every item, **and** every item already in trash | `deleted` drops |

Permissions go through `assertItemsAccess` (`permission-actions.ts`): one query that also checks workspace membership **read from each item's own `workspaceId`**, so a caller can't skip it by leaving the workspace out. One refusal refuses the whole batch and changes nothing. Routes answer the real status through `toErrorInfo`, never a 200 carrying `{ success: false }`.

## Trash entries are stored, not derived

Trashing a folder marks its whole subtree `trashed`, but only the items the user actually trashed are **Trash entries**: each gets a `TrashItem` row (`trashedAt`, `trashedById`), its descendants get only the status. Query entries with `TRASH_ROOTS` (`status: 'trashed'` + `trash: { isNot: null }`), always together with `ownerId` (the Trash loader once listed every user's trash because `currentUserId` is not a scoping filter).

Why stored: trash four files, then their folder. The four must stay separate entries, and restoring the folder must **not** bring them back, because they were trashed on purpose first. A rule derived from the parent's status can't tell those apart (`5560eb1`). So `restoreItems`:

- stops at descendants that have their own `TrashItem` row (they stay in Trash);
- deletes the rows of what it restores;
- gives the still-trashed contents of a restored ancestor rows of their own, so a partial restore never hides anything.

A permanent delete cascades the `TrashItem` row away.

## Navigation

- A **trashed card never navigates** (keyed on the item's status, not the route), so a trashed folder can't be shown as if it were in place. Restore and delete stay in its menu. Don't add `aria-disabled` to the card: it's inherited by the menu and announces Restore/Delete as disabled.
- A trashed folder opens **inside Trash** at `/:me/stash/trash/folders/:folderId` (a second route on `routes/stash/trash.tsx`). `getTrashFolderTrail` 404s a folder that isn't the user's, isn't a folder, or isn't in trash. Trashed files open nowhere.
- A restore made from that view takes the viewed folder out of Trash, so reloading the same URL would 404. The restore actions redirect through `toTrashRedirectUrl` (`app/utils/trash-urls.ts`): from a trashed-folder view to `/:me/stash/trash` (query kept), otherwise to the same page.

## Sizes and quota

- `size` and `inclusiveSize` are trigger-maintained (`update_size()`), never computed in app code. A folder's `size` counts only active contents; `inclusiveSize` counts trash too, until permanent delete. Trashed folder ⇒ `size` 0. Current trigger behaviour: `docs/data_profile_stashly _prisma_schema.md`; the trigger is `CREATE OR REPLACE`d across migrations, so an old migration shows a stale version.
- **Never sum `size` over a folder and its contents for quota**: a folder's `size` is a rollup, so nested bytes count once per level. That over-counted a real trash by 31.2 MB against 8.2 MB of files and left quota 23 MB off after restore (`e04d07d`). Sum the **files whose status actually changed**.
- Quota changes go through `applyQuotaDelta` (`quota-actions.ts`): one `UPDATE … RETURNING`; an empty result throws `QUOTA_NOT_FOUND`. `/api/quota` is **read-only** — never add a write action there (it once let any user set their own limit, `2fc9d4d`). Uploads are charged server-side in `createUploadedItem`'s one statement, to the folder's drive. **Trash, restore and delete move quota per `Item.driveId`, never the acting user's** (`bytesPerDrive`): trashing a folder takes collaborators' files with it, and each is refunded to the drive that paid. Trash calls `settlePendingCharges` first, so a refund can't clamp `used` at 0 ahead of its own logged charge. Background: `docs/quota-and-machines.md`.

## Raw SQL and time zones

The DB session time zone is Asia/Jerusalem and the timestamp columns have no zone. A bare `now()` in raw SQL stores local time, which Prisma reads back as UTC: 3 h in the future. **Write `(now() AT TIME ZONE 'UTC')`**, as `trashItems`, `restoreItems` and the batched activity insert do (`32d1431`, `23eb94a`). Prisma-generated writes are already UTC.

## Stored objects

- `deleteFromTrash` reads the subtree's S3 keys (files and thumbnails) **in the same statement** that deletes the rows. Every part of a statement sees the rows as they were before it ran, so the keys are read before the cascade removes `File`/`Thumbnail`.
- **An object goes with the last row that names it.** A copy points at its original's object (`copyItem` copies the `File` row, key included) and is charged its size, so the delete leaves out any key a `File` row outside the deleted subtree still uses. Until 2026-11-01 it deleted every key in the subtree, and permanently deleting an original left its copies pointing at nothing. Test: `item-delete-objects.test.ts` ("bytes shared by a copy").
- A refused upload's object is removed by `discardUploadedObject`, only when no `File` row uses it and only in the uploader's own bucket (read from their user row; the schema default `'default-bucket'` counts as no bucket).
- Anything that slipped through is caught by `scripts/sweep-s3-orphans.ts` (unreferenced objects plus stale multipart uploads), run **by hand**. Applied on 2 Oct: 652 objects deleted, 85 uploads aborted, 0 failures.
- A full user wipe is `emptyUserBucket()` (`storage-actions.ts`). Bulk `deleteMany` on related `Item` rows aborts on the rollup triggers; the wipe sets the `stashly_is_wiping_user()` session flags (see `stashly-prisma-data`).

## Gotchas

- **Lookups by name must skip trashed rows.** A trashed item keeps its `parentId`, so a name lookup can land on it: uploads once filed 64 files into a trashed folder of the same name (`1eac608`), and a relative Markdown link opened a trashed file (`451da72`). Match only live items, and treat two live matches as an error (`findOrCreateFolderPath` answers 409), never a `findFirst` guess.
- **Activity after commit.** An activity started inside the item's transaction on the global client failed with P2025 under load (376 of 575 uploads had none). Record activities after the transaction commits, and log failures rather than swallowing them.
- Personal stash first. `routes/workspaces/trash.tsx` exists, but workspace-only questions go to TASKS.md → Someday (memory `personal-first-workspaces-later`).

## Tests

Live-DB tests pin this behaviour: `trash-roots.test.ts` (including the four-files-then-folder scenario), `item-trash-access`, `item-delete-objects`, `item-size-trigger` (every folder recounted after 15 trash, restore, move, upload and delete steps) and `trash-urls.test.ts`. Change behaviour → change or add the test in the same commit.
