---
name: stashly-prisma-data
description: Stashly Prisma and data-layer conventions — schema location, DB-level triggers (size/child-count rollups, collection size, notification pg_notify), migrate vs db push, orderBy rules, relation filtering and count sorts, sort URL convention, ItemCard select shapes, the Favorite no-unique-constraint rule, Zod conventions, and SQL simplicity. Load when writing Prisma queries, migrations, schema changes, or Zod schemas in the Stashly repo.
---

# Stashly Prisma & Data Layer

## Prisma Schema

Models are split across `prisma/models/*.prisma` files and merged. Generated client outputs to `app/prisma/`. Core models: `User`, `Workspace`, `Item`, `CollectionMember`, `Permission`, `Comment`. There is no `Collection` model — a collection **is** an `Item` with `type='collection'`, and membership is a self-M:N through `CollectionMember`.

**Collection size is DB-managed**: Three Postgres triggers (`collection_size_trigger` on `CollectionMember`, `item_size_collection_sync_trigger` and `item_delete_collection_sync_trigger` on `Item`) automatically maintain `Item.size` for collections. Never add manual size arithmetic back to `collection-actions.ts` — `addItemToCollection`, `removeItemFromCollection`, etc. do NOT need to update size.

**Other DB-level triggers** — assume these fire and never duplicate their work in app code:

| Trigger(s) | Table | Maintains |
| --- | --- | --- |
| `item_size_update` / `item_size_update_on_update` / `item_size_decrement` | `Item` | `Item.size` + `Item.inclusiveSize` on the parent |
| `item_child_count_insert` / `_update` / `_delete` | `Item` | `Folder.childCount` + `Folder.inclusiveChildCount` on the parent |
| `notification_change_notify` | `Notification` | `pg_notify('notifications', …)` on every INSERT/UPDATE/DELETE — this is what drives the live SSE feed, so a plain `prisma.notification.create()` already pushes to connected clients |

**Uploaded files skip the cascade while the database is busy** (`20261030140000_upload_size_delta_log`, `20261030160000_upload_size_inline_when_idle`): on INSERT of a row with an `uploadId`, `update_size()` logs it in `ItemSizeDelta` when deltas are pending or the rollup's advisory lock is taken, and otherwise takes the lock and cascades at once. Pending deltas are checked **before** the lock is tried: the other order let busy uploads hold the lock and starved the rollup (measured). `apply_item_size_deltas()` writes each affected folder once per run, one run at a time database-wide, every 250 ms (`app/.server/size-rollup.ts`). A test that reads a folder's size after an upload calls `flushItemSizes()`, and one that needs the logged path uploads inside `withSizeRollupPaused()` (both in `app/.server/__tests__/helpers/flush-item-sizes.ts`); no loop runs under Vitest. `recount_folder_sizes(root)` repairs a tree. Don't add trigger `WHEN` clauses to save calls: on 2026-10-30 they cut calls 60% and made the triggers 9.5% slower (tech-debt 42).

The size/collection functions are guarded by `stashly_is_wiping_user()`, so a full user wipe (`emptyUserBucket()`) must set both `stashly.delete_all_data_for_user` and `stashly.delete_all_data_for_user_consent` session flags. Full reference: `docs/data_profile_stashly _prisma_schema.md` → *Custom PostgreSQL Functions & Triggers*.

**Nullable relation filtering**: To filter on fields inside a nullable relation, use `relation: { is: { field: value } }` — **not** `relation: { isNot: null, field: value }`. Prisma's TS types reject field filters alongside `isNot`.

**`orderBy` one-field-per-object rule**: `ItemOrderByWithRelationInput` allows exactly one relation field per object. Never merge two relation sorts into one object — Prisma throws at runtime. Use an array: `[{ folder: { childCount: 'asc' } }, { members: { _count: 'asc' } }]`.

**Relation count sort**: To sort by a relation's count, use `{ relation: { _count: 'asc' } }` (underscore required — `count` without it throws `Unknown argument`). Example: `{ members: { _count: 'desc' } }`.

**Sort URL convention**: `?orderBy[col]=dir` → qs parses to `{ orderBy: { col: dir } }`. For nested fields: `?orderBy[folder][childCount]=asc`. For multi-field array orderBy: indexed notation `?orderBy[0][folder][childCount]=asc&orderBy[1][members][_count]=asc` → qs produces `[{ folder: {...} }, { members: {...} }]`. `getFolderContent` defensively splits any merged multi-key objects before passing to Prisma.

**Collection items sort in raw SQL**: `getCollectionItems` is a `$queryRaw` (a Prisma `findMany` version measured ~2× slower — it builds a JSON object per scanned row before the `LIMIT`), so its `orderBy` goes through `app/.server/collection-order.ts`: an allow-list of the sort pill's columns (`name`, `updatedAt`, `createdAt`, `size`, `type`) mapped to fixed SQL, plus a keyset cursor that works for any direction mix. No sort means name ascending, the pill's default. Count is not offered inside a collection (the pill hides it on any `:collectionId` route); anything off the list is a 400 `INVALID_INPUT`. Add a column there, never splice a URL key into SQL. **A collection holds files only**, enforced on the server: `addItemToCollection` / `addItemsToCollection` answer 400 `INVALID_INPUT` (adding nothing) for a folder or collection, and `getCollectionItems` plus both add-to-collection picker queries filter `type = 'file'`.

**`ItemCard`-feeding selects need the full `StashAncestor`/`StashPin` shape**: any loader whose items render through `<ItemCard>` must select `parent` as the full `StashAncestor` shape (all item scalars + `file`/`folder`/`favorites`/`thumbnails`/`locked` + a shallow `parent`), not just `{ id, name }` — and the `pins` select needs `pinnedById` (`StashPin` requires it), not just `pinnedBy`. Mirror `trash.tsx`'s `parent: { include: {...} } }` pattern. A narrow select typechecks fine on its own and only fails where `<ItemCard {...item}>` is spread — easy to miss.

**`Favorite` has no unique constraint**: `@@unique([favoritedById, itemId])` was intentionally removed in favor of four plain indexes (migration `20260812030000_sync_favorite_indexes` drops `Favorite_favoritedById_itemId_key`) — the DB allows duplicate favorite rows. `addFavorite`/`addFavorites` must check-then-insert at the app level; don't rely on a DB constraint to catch double-favoriting. Duplicates may still exist from before `addFavorite` checked (or from a concurrent race), so anything that **removes** or **counts** favorites must handle them: `removeFavorite` deletes every row for the user (`deleteMany`), and the usage metric counts favorited *items*, not rows.

## Prisma Client

- Import Prisma client from `app/prisma/client` — do NOT use the generated client via tsx or any other path. Concretely: the instance is `import { prisma } from '@/services/db'` (it carries the `PrismaPg` adapter — `new PrismaClient()` throws under Prisma 7 without one), and the `Prisma` namespace/types come from `@/prisma/client`, never `@prisma/client` (no app file imports it; it has no `Prisma` export here).
- **No `--schema` flag**: schema lives in `prisma/models/*.prisma` and is wired through `prisma.config.ts`. Passing `--schema=` fails with "file not found".
- **DB drift recovery**: if `prisma migrate dev` reports drift and wants to reset (destructive), prefer `prisma db push --accept-data-loss` for non-destructive changes (new nullable columns). The "data loss" warning on adding a unique constraint to a new nullable column is spurious — existing rows are NULL, no duplicates possible.
- **`db push` does NOT auto-regenerate the client** in this repo (Prisma 7 + `prisma.config.ts`). If TS still shows `Property 'X' does not exist on type 'never'` for a new field after push, run `pnpm prisma generate` explicitly.
- After Prisma schema changes, remind the user to restart the dev server (cached client issues observed).

## Database / SQL

Start with the simplest query that works. Do not use recursive CTEs or over-engineered approaches. Optimize only if there's a demonstrated performance need.

## Gotchas

- **Settle DB failure theories in a rolled-back transaction, not by reasoning.** Reproduce inside `prisma.$transaction(async tx => { …; throw new Error('__ROLLBACK__') })` against the dev DB — nothing persists, and competing theories become PASS/FAIL rows. DDL rolls back too in Postgres. On 2026-08-26 reasoning picked the wrong one of three causes for a `deleteItems` P2003; four rolled-back runs settled it. Script in the **repo root**, no top-level await, `npx tsx --env-file=.env <script>.ts`, delete it after. Read the driver's real message from `err.meta.driverAdapterError.cause` — Prisma's text hides which side of an FK failed.
- **A transaction timeout can surface as an FK violation.** Prisma 7's interactive-transaction timeout rolls back without waiting for the in-flight query, so the remaining statements of a nested create fail as `_PermissionToUser_A_fkey` / `File_itemId_fkey` / `Folder_itemId_fkey` instead of `expired transaction`. Under concurrency, rule out timeouts first: force a low timeout in a rolled-back repro and count the error kinds (2026-09-15: ×11 expired, ×2 FK, one cause — a shared advisory lock held for the whole transaction, fixed in `814ade3`).
- **Bulk `deleteMany` on related `Item` rows aborts on the rollup triggers** (`tuple to be updated was already modified by an operation triggered by the current command`); deleting leaf-first doesn't help. `stashly_is_wiping_user()` (above) is the intended bypass for a full wipe.

## Zod Conventions

- Use `z.url()`, `z.email()`, etc. (not deprecated `z.string().url()` syntax)
- Follow project's existing zod schema patterns in `app/schemas/`
- Keep Zod schemas and derived TypeScript types co-located: define the Zod schema in `app/schemas/`, then infer and export the TS type from the same file or a parallel file in `app/types/`.
