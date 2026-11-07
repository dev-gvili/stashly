## Data Profile: Stashly Prisma Schema

### Overview
- **Models:** 56
- **Enums:** 24
- **Indexes:** 60+ (including Gin, SpGist, composite)
- **PostgreSQL Extensions:** `vector` (pgvector), `pg_trgm` (trigram search)
- **Custom DB logic:** 6 PL/pgSQL functions + 10 triggers (size/count rollups, collection size sync, user-wipe bypass, `Notification` → `pg_notify`)
- **Generator:** `prisma-client` (ESM, `.ts` output → `app/prisma/`), preview features `nativeDistinct`, `relationJoins`, `postgresqlExtensions`
- **Datasource:** PostgreSQL; schema split across `prisma/models/*.prisma`, merged via `prisma.config.ts`

### Model Inventory (57 models)

| Domain | Models |
|--------|--------|
| **Identity / auth** | `User`, `Account`, `Session`, `Verification` |
| **Storage core** | `Item`, `LockedItem`, `Drive`, `Quota`, `Trash`, `TrashItem`, `ItemSizeDelta` (upload size log, see *Upload size log*) |
| **Facets** | `File`, `Folder`, `Image`, `Video`, `Audio`, `Pdf`, `Markdown` |
| **Collections** | `CollectionMember` (collection = `Item` with `type='collection'`) |
| **Views / previews** | `View`, `Thumbnail` |
| **Versioning** | `ItemVersion` |
| **Collaboration** | `Workspace`, `WorkspaceMember`, `Invitation`, `InvitationRecipient`, `Permission`, `ShareLink`, `Comment` |
| **Engagement** | `Favorite`, `PinItem`, `Notification` |
| **Billing** | `Subscription`, `StoragePlan` |
| **Search** | `Search`, `SearchChunk` |
| **Activity / audit** | `Activity`, `ActivityTime`, `AuditLog`, `ItemAction` + 16 action models it links (`Create`, `Upload`, `Delete`, `Edit`, `Move`, `Copy`, `Rename`, `Restore`, `Share`, `Version`, `Comment`, `Permission`, `Pin`, `Collection`, `Favorite`, `Bucket`) + `AccessAction` (hangs off `Activity` directly, not `ItemAction`) |

### Column Classification

| Type | Count | Examples |
|------|-------|---------|
| **Identifiers** | ~55 | `id`, `userId`, `itemId`, `driveId`, `workspaceId`, `collectionId`, `recipientId` |
| **Dimensions** | ~28 | `type`, `status`, `role`, `category`, `scope`, `kind` (Pin/Collection/Favorite/Bucket actions) |
| **Metrics** | ~12 | `size`, `inclusiveSize`, `childCount`, `inclusiveChildCount`, `used`, `total`, `deleted`, `priceCents`, `position` |
| **Temporal** | ~40 | `createdAt`, `updatedAt`, `expiresAt`, `openedAt`, `deletedAt`, `restoredAt`, `takenDateTime`, `docCreatedAt` |
| **Text** | ~18 | `name`, `description`, `content`, `message`, `email`, EXIF/ID3/PDF metadata strings |
| **Boolean** | ~10 | `emailVerified`, `downloadable`, `default`, `hasDrm`, `isVariableBitrate`, `isEncrypted`, `hasFormFields`, `hasAnnotations`, `hasSignatures`, `hasFrontmatter` |
| **Structural** | ~6 | `metadata (Json/JsonB)`, `vector (vector(768))` (Search + SearchChunk), `content (ByteA)` (Thumbnail + ItemVersion), `tags (String[])`, `features/participants/recipients (String[])` |

### Core Entity Relationships

```
User (central node)
 ├── Drive (1:1) ──── Quota (1:1) ──── StoragePlan (via composite limits FK)
 ├── Subscription[] ──── StoragePlan
 ├── Account[] (OAuth providers)
 ├── Session[]
 ├── Item[] (owned files / folders / collections)
 │    ├── Item[] (self-relation "ParentChild": parent/child tree)
 │    ├── File / Folder / Image / Video / Audio / Pdf / Markdown (1:1 optional facets)
 │    ├── CollectionMember[] (self M:N: "CollectionHost" + "ItemMember")
 │    │      └── a collection IS an Item with type='collection'
 │    ├── Folder (1:1) ──── View (1:1, per viewType)
 │    ├── Permission[]
 │    ├── Thumbnail[]
 │    ├── ItemVersion[]
 │    ├── Comment[]
 │    ├── Favorite[]
 │    ├── PinItem[] (per-user pinned, ordered by position)
 │    ├── TrashItem (1:1) ──── Trash
 │    ├── LockedItem (1:1)
 │    ├── Activity[] ──── ItemAction (1:1 to one of 16 action models) / AccessAction
 │    ├── AuditLog[]
 │    ├── Search (1:1, document vector) ──── SearchChunk[] (per-passage vectors)
 │    └── Invitation[]
 ├── WorkspaceMember[] ──── Workspace
 │    ├── Item[] (workspace-scoped)
 │    ├── Invitation[]
 │    └── StoragePlan (optional)
 ├── Permission[] (many-to-many via User[])
 ├── Favorite[]
 ├── PinItem[]
 ├── Comment[]
 ├── Notification[]
 └── Invitation[] (as sender)

Invitation ──── InvitationRecipient[] ──── Permission (per item-invite recipient)
ShareLink ──── Permission[] (link-based access)
```

### Key Design Patterns

| Pattern | Implementation |
|---------|---------------|
| **Faceted items** | Item has 1:1 optional relations to File, Folder, Image, Video, Audio, **Pdf**, **Markdown** — polymorphic by `type` / `category` enums; only one facet present per item |
| **Self-referencing tree** | `Item.parentId → Item` (relation `"ParentChild"`, `onDelete: Cascade`) for the folder hierarchy |
| **Collections as items** | A collection is an `Item` with `type='collection'`; membership is a self M:N via `CollectionMember` (`"CollectionHost"` ↔ `"ItemMember"`). The old `Collection` facet + `CollectionItem` join were removed |
| **Denormalized rollups** | `Item.size`/`inclusiveSize` and `Folder.childCount`/`inclusiveChildCount` maintained by DB triggers (see Functions & Triggers); collection size synced via `CollectionMember` triggers |
| **Soft delete** | TrashItem joins Item to Trash with `deletedAt`/`restoredAt` timestamps |
| **Optimistic locking** | LockedItem with `expiresAt` for edit locks |
| **Action log (event sourcing)** | Activity → ItemAction → one of 16 specific action models (Create, Upload, Delete, Edit, Move, Copy, Rename, Restore, Share, Version, Comment, Permission, Pin, Collection, Favorite, Bucket) + AccessAction for views |
| **Per-user item state** | `Favorite` and `PinItem` (`@@unique([pinnedById, itemId])`) are per-user join rows; `PinItem.position` gives manual ordering. `Favorite` deliberately has **no** unique constraint (dropped in `20260812030000_sync_favorite_indexes` in favour of four plain lookup indexes) — de-duplication is the app's job |
| **Multi-recipient invites** | `Invitation` (1 sender) → `InvitationRecipient[]` (per-recipient email/status/role); item invites link a `Permission` per recipient |
| **Storage quotas** | Quota tracks `used`/`total`/`deleted` as BigInt bytes with status enum; `StoragePlan` defines limits, linked to Drive via a composite `(memberLimit, workspaceLimit, storageLimit)` FK |
| **Vector search** | `Search` (document-level) + `SearchChunk` (per-passage) each hold a `vector(768)` column indexed for cosine similarity |
| **Trigram search** | `Item.name` and `Item.tags` indexed with `gin_trgm_ops` (Gin); `Notification.message` indexed with SpGist trigram |

### Data Quality Observations

| Severity | Issue | Detail | Status |
|----------|-------|--------|--------|
| **Info** | Heavy optionality on facets | Image (~14 optional), Audio (ID3 tags), Pdf (~17 optional), Markdown (~15 optional), Video — metadata is sparse by nature (EXIF/ID3/PDF/frontmatter info often absent) | By design |
| **Info** | BigInt for sizes | `size`, `inclusiveSize`, `used`, `total`, `deleted` use BigInt — supports files >2GB correctly | By design |
| **Info** | `ItemStatus` has no `'active'` | Values are normal / archived / trashed / locked / shared — `'normal'` is the default/active state | By design |
| **Info** | Multiple facet booleans default `NULL` | Pdf/Audio flags (`isEncrypted`, `hasDrm`, …) are nullable tri-state, not `false` | By design |
| ~~Warn~~ | ~~Typo in field name~~ | ~~`copyActionIdId` in ItemAction (double "Id")~~ | **Fixed** — renamed to `copyActionId` |
| ~~Info~~ | ~~Duplicate unique on Item.id~~ | ~~Item has both `@id` and `@unique` on `id` — redundant~~ | **Fixed** — removed redundant `@unique` |
| **Info** | Comment unique constraint | `@@unique([itemId, ownerId])` limits one comment per user per item — intentional design choice | By design |
| **Warn** | Duplicate favorites are possible | `20260812030000_sync_favorite_indexes` dropped `Favorite_favoritedById_itemId_key`; nothing at the DB level stops a double-favorite | Intentional — `addFavorite`/`addFavorites` must check-then-insert |
| **Warn** | Thumbnail unique not mirrored in the model | `Thumbnail_itemId_view_size_key` exists in the database (migration `20260424160000`) but `prisma/models/thumbnail.prisma` declares no `@@unique` | Schema drift — a `prisma db push` could drop the constraint |
| ~~Warn~~ | ~~Metadata model is orphaned~~ | ~~No relations to any other model — standalone key/value store, not referenced in app code~~ | **Fixed** — model and table removed |
| ~~Info~~ | ~~Tag model is orphaned~~ | ~~No relations; items use `tags String[]` array directly on Item, not referenced in app code~~ | **Fixed** — model and table removed |

### Index Analysis

**Well-indexed models:**
- **Item** — 16 indexes: 2 Gin (`item_name_trgm_idx` on name, `tags_gin_idx` on tags) + 14 btree cursor indexes covering parent-based, workspace, and drive queries (e.g. `parent_cursor`, `parent_status_type_name_cursor`, `drive_parent_created_at`)
- **Permission** — 6 indexes on temporal (`createdAt`/`updatedAt`), `roles`, and FK columns (`recipientId`/`linkId`/`itemId`)
- **Notification** — 5 indexes: `createdAt`, `type`, `kind`, `status`, plus SpGist on `message` trigram
- **Subscription** — 4 `@@index` + unique constraints on Stripe IDs and `(ownerId, storagePlanId)` / `(ownerId, stripeSubscriptionId)`
- **CollectionMember** — `@@unique([collectionId, itemId])` + indexes on `collectionId`, `itemId`, `createdAt`
- **InvitationRecipient** — indexes on `invitationId`, `email`, `status`
- **PinItem** — `@@unique([pinnedById, itemId])` + `[pinnedById, position]`
- **Favorite** — 4 plain indexes (`[favoritedById, id]`, `[itemId, id]`, `[favoritedById, itemId]`, `createdAt`) and **no** unique constraint
- **Search / SearchChunk** — `Search_vector_idx` is HNSW with `vector_cosine_ops`; `SearchChunk_vector_idx` is a plain vector index; plus temporal / `itemId` indexes and `@@unique([itemId, ord])` on chunks

**Under-indexed models:**
- **Account** — no indexes beyond PK (queries by `userId` or `providerId` would benefit)
- **Thumbnail** — no `@@index` declared in the model; `itemId` is nullable, so multiple thumbnails hang off one item. The database *does* carry `Thumbnail_itemId_view_size_key` (unique on `(itemId, view, size)`, added by `20260424160000_add_thumbnail_unique_constraint`) — that index is not mirrored back into `prisma/models/thumbnail.prisma`
- **ItemVersion** — no indexes (queries by `itemId` would benefit)
- **File** — no indexes beyond `@unique` on `itemId`
- **Pdf / Markdown / Audio / Image / Video** — facet tables, no indexes beyond `@unique` on `itemId`

### Enum Summary

| Enum | Values | Used By |
|------|--------|---------|
| `ItemType` | file, folder, collection | Item.type |
| `ItemCategory` | video, audio, image, document, spreadsheet, presentation, text, pdf, archive, code, script, binaries, graphic, unknown (14) | Item.category |
| `ItemStatus` | normal, archived, trashed, locked, shared | Item.status |
| `WorkspaceMemberRole` | viewer, member, admin, owner | WorkspaceMember.role |
| `PermissionRole` | owner, read, write | Permission.roles |
| `QuotaStatus` | normal, warning, critical, exceeded | Quota.status |
| `SubscriptionStatus` | active, canceled, incomplete, incomplete_expired, past_due, trialing, unpaid (7) | Subscription.status |
| `StoragePlanType` | free, basic, standard, premium, custom | StoragePlan.type |
| `ShareLinkType` | view, edit, embed, upload | ShareLink.type |
| `ShareScope` | anonymous, organization, users | ShareLink.scope |
| `DriveType` | personal, business | Drive.type |
| `ViewType` | list, grid, river, waterfall | View.viewType, Thumbnail.view |
| `InvitationStatus` | pending, accepted, rejected, canceled, expired | InvitationRecipient.status |
| `NotificationType` | info, warning, error, success | Notification.type (severity → tile colour) |
| `NotificationKind` | system, share, upload, file, storage, invitation, member, workspace, collection, favorite, pin, comment, lock (13) | Notification.kind (subject → row glyph) |
| `NotificationStatus` | read, unread | Notification.status |
| `SortBy` | id, name, date, size, type | View.sortBy |
| `SortOrder` | ascending, descending | View.sortOrder |
| `ObjectType` | file, folder | DeleteAction.itemType |
| `ThumbnailSize` | small, medium, large, original, custom | Thumbnail.size |
| `PinKind` | pinned, unpinned, reordered | PinAction.kind |
| `CollectionActionKind` | item_added, item_removed, emptied | CollectionAction.kind |
| `FavoriteKind` | favorited, unfavorited | FavoriteAction.kind |
| `BucketKind` | emptied | BucketAction.kind |

> Facets now include `Pdf` and `Markdown` alongside `File`/`Folder`/`Image`/`Video`/`Audio`. Action log gained `PinAction`, `CollectionAction`, `FavoriteAction`, and `BucketAction`. Invitations are multi-recipient via `InvitationRecipient`. Pinned items use the `PinItem` join model. Notifications carry two orthogonal enums: `type` (severity) and `kind` (subject).

### Custom PostgreSQL Functions & Triggers

Eight PL/pgSQL functions back ten triggers and the upload size log. Most maintain denormalized rollups (size, child count) on parent items and on collections, all server-side so application code never recomputes these values; `notify_notification_change()` bridges `Notification` writes to the live SSE feed via `pg_notify`. Every function is `CREATE OR REPLACE`; the table below lists each at its **current** definition.

#### Function inventory

| Function | Current migration | Purpose |
|----------|-------------------|---------|
| `update_size()` | `20261030160000_upload_size_inline_when_idle` | Maintains `Item.size` / `Item.inclusiveSize` on the **parent** item; logs an uploaded row instead while the database is busy (see *Upload size log*) |
| `stashly_charge_upload(drive_id, amount)` | `20261106120000_upload_quota_log` | Charges an upload to a drive inside its statement: charges at once while idle, logs in `QuotaDelta` while busy and far from the limit, and charges strictly, one at a time, near it. Answers whether the file may be filed |
| `stashly_quota_status(used, total)` | `20261106120000_upload_quota_log` | The `QuotaStatus` for a `used` and `total`; mirrors `toQuotaStatus()` |
| `update_child_count()` | `20261106120000_upload_quota_log` | Maintains `Folder.childCount` / `Folder.inclusiveChildCount` on the **parent** folder |
| `update_collection_size()` | `20260526000000_user_wipe_trigger_bypass` | Maintains a collection `Item.size` when members are added/removed |
| `sync_item_size_to_collections()` | `20260526000000_user_wipe_trigger_bypass` | Propagates a member item's size change to every parent collection |
| `stashly_is_wiping_user(target_user_id TEXT)` | `20260526000000_user_wipe_trigger_bypass` | `STABLE` helper — true when the session is doing a full user wipe (used as a `WHERE` guard inside the three size functions) |
| `stashly_apply_folder_deltas(ids, active, inclusive, children, inclusive_children)` | `20261106210000_status_change_rollup` | The walk and writes shared by the rollup and the status trigger: per-parent deltas in, each affected folder written once (rows locked in id order, `FOR NO KEY UPDATE`, `Folder` before `Item`) |
| `stashly_status_change()` | `20261106210000_status_change_rollup` | Statement-level trigger function: sums what a status change did per parent (`new_active - old_active`, folders included) and calls `stashly_apply_folder_deltas()` once |
| `apply_item_size_deltas(max_deltas, wait_for_lock)` | `20261106210000_status_change_rollup` | Applies pending `ItemSizeDelta` and `QuotaDelta` rows: each affected folder written once per run, one run at a time database-wide |
| `recount_folder_sizes(root)` | `20261030140000_upload_size_delta_log` | Recounts a subtree's folder sizes from its files: the test oracle and repair tool |
| `notify_notification_change()` | `20260724000000_notification_notify` | Emits `pg_notify('notifications', payload)` on every `Notification` write so the singleton `LISTEN` client can fan the change out over SSE |

#### Trigger inventory

| Trigger | Table | Timing / Event | Function |
|---------|-------|----------------|----------|
| `item_size_update` | `Item` | AFTER INSERT | `update_size()` |
| `item_size_update_on_update` | `Item` | AFTER UPDATE | `update_size()` |
| `item_size_decrement` | `Item` | AFTER DELETE | `update_size()` |
| `item_child_count_insert` | `Item` | AFTER INSERT | `update_child_count()` |
| `item_child_count_update` | `Item` | AFTER UPDATE | `update_child_count()` |
| `item_child_count_delete` | `Item` | AFTER DELETE | `update_child_count()` |
| `item_status_change` | `Item` | AFTER UPDATE, **FOR EACH STATEMENT**, transition tables `status_old` / `status_new` | `stashly_status_change()` |
| `item_size_collection_sync_trigger` | `Item` | AFTER UPDATE OF `size`, `WHEN (OLD.size IS DISTINCT FROM NEW.size)` | `sync_item_size_to_collections()` |
| `item_delete_collection_sync_trigger` | `Item` | **BEFORE** DELETE | `sync_item_size_to_collections()` |
| `collection_size_trigger` | `CollectionMember` | AFTER INSERT OR DELETE | `update_collection_size()` |
| `notification_change_notify` | `Notification` | AFTER INSERT OR UPDATE OR DELETE | `notify_notification_change()` |

All are `FOR EACH ROW` except `item_status_change`. `update_size()` and `update_child_count()` leave a pure status change (same parent, same sizes) to it.

#### `update_size()` — Parent item size maintenance

Keeps `Item.size` (active items only) and `Item.inclusiveSize` (all items including trashed) in sync on the parent item.

A child contributes to its parent:

| Column on the parent | The child's contribution |
|---|---|
| `size` | the child's `size`, or 0 if the child itself is `trashed` |
| `inclusiveSize` | a **folder** child's own `inclusiveSize`; any other child's `size` (files carry `inclusiveSize` = 0) |

| Operation | Behaviour |
|-----------|-----------|
| **INSERT** | Adds the new row's contributions to its parent |
| **DELETE** | Subtracts the deleted row's contributions from its parent |
| **UPDATE (move)** | Subtracts the old contributions from the old parent, adds the new ones to the new parent |
| **UPDATE (size, status or `inclusiveSize` change)** | Applies the change in both contributions to the parent. The parent's update fires the trigger again, so the change travels up to the root |

Before `20261002090000_fix_inclusive_size_rollup` the function passed a folder's `size` change up as an `inclusiveSize` change and ignored `inclusiveSize` changes. As a result, an ancestor more than one level above a trashed item lost that item's bytes from its `inclusiveSize` while the item sat in trash, and a moved folder's trashed contents were never counted under its new parent. That migration also recounts every folder once.

Every parent UPDATE is additionally guarded by `AND NOT stashly_is_wiping_user("ownerId")` so a full user wipe doesn't deadlock against rows the same statement is deleting (see *User-wipe bypass* below).

Since `20261030140000_upload_size_delta_log` the function returns at once while `stashly.rollup` is `on` (the rollup's own writes). Since `20261030160000_upload_size_inline_when_idle` its INSERT branch also decides, for a row with an `uploadId`, whether to cascade now or log it (see *Upload size log*).

#### Upload size log (`ItemSizeDelta`)

An uploaded file used to rewrite every folder above it, one row at a time, inside its own INSERT, so uploaders into a shared folder queued on the owner's ancestor rows (measured: 32 uploaders, ~2,000 files/s, 21 of 32 waiting on a lock). Now:

| Step | What happens |
|------|--------------|
| INSERT with `uploadId` (`insertUploadedItem`), database **busy**: deltas pending, or the rollup's advisory lock taken | `update_size()` appends `(parentId, active, inclusive)` and returns. Pending deltas are checked first, so a busy upload never takes the lock and the rollup can always get it |
| Same INSERT, database **idle**: nothing pending, and the lock is free | `update_size()` takes the lock without waiting, cascades at once like any insert, and holds the lock until the statement commits: one such cascade at a time, never overlapping a rollup |
| Every 250 ms (`app/.server/size-rollup.ts`, one loop per server process) | `apply_item_size_deltas()` claims up to 5,000 rows, walks each parent's **current** ancestors (the active part stops at a trashed folder, as in `update_size()`), and writes each affected row once, with `stashly.rollup` on so the writes don't cascade |
| Single flight | A database-wide advisory lock: a second caller skips. A run that waits over 100 ms for a row lock (a user's trash, move or delete) gives up and leaves its rows for the next run |
| Everything else | Folder creation, copy (`recursiveCopy` clears `uploadId`), trash, restore, move, delete and size changes keep the per-row cascade. Deltas are additive and those paths only cascade what was already applied, so the two compose |

Under load a folder's size trails its uploads by about one interval; idle uploads land at once. An upload deleted, moved or trashed before the next run leaves its old folders short, even negative, until that run (≤ ~250 ms). A delta whose folder was deleted is dropped. Tests call `flushItemSizes()` (`app/.server/__tests__/helpers/flush-item-sizes.ts`) before reading a folder's size; no loop runs under Vitest. `recount_folder_sizes(root)` repairs a tree by hand; it returns the folders it rewrote, which undercounts those put right by the cascade from below. Measured (tech-debt item 42): one uploader, a 650-file upload, 0 deltas logged and size work at today's level (757 ms vs 615 ms for 646 files; logging every upload instead cost 2,125 ms); 32 uploaders into one shared folder 2,017 → 8,334 files/s, p95 52 → 5.8 ms, lock waiters 20.7 → 0.06, oldest unapplied size change ≤ 410 ms. Logging every upload (`20261030140000` alone) made one uploader 3.5× costlier, and a first version that tried the lock before the pending check starved the rollup under load.

#### `update_child_count()` — Folder child count maintenance

Keeps `Folder.childCount` (active items only) and `Folder.inclusiveChildCount` (all items including trashed) in sync.

| Operation | Behaviour |
|-----------|-----------|
| **INSERT** | +1 `inclusiveChildCount`; +1 `childCount` if status ≠ `trashed`. An uploaded row while the database is busy appends its +1 to `ItemSizeDelta.children` instead, for the rollup |
| **DELETE** | −1 `inclusiveChildCount`; −1 `childCount` if status ≠ `trashed` |
| **UPDATE (move)** | Decrements old parent, increments new parent (both counters) |
| **UPDATE (trash/restore)** | `inclusiveChildCount` unchanged; `childCount` ±1 based on status transition |

> Note: `update_child_count()` does **not** carry the user-wipe bypass guard — only the three size functions were patched in `20260526000000`.

> **⚠️ `Folder_itemId_fkey` is `DEFERRABLE INITIALLY DEFERRED` and Prisma cannot express that.** The flag lives *only* in `20260826000000_defer_folder_item_fk`. **Reshaping the `Folder.item` relation — renaming the field or model, changing `onDelete`, or running `prisma db push` — makes Prisma `DROP` and re-`ADD` the constraint as an immediate check, silently deleting this fix.** If you touch that relation, re-apply the `ALTER CONSTRAINT` in the same migration.
>
> **Why it's deferred:** deleting a set of items containing both a folder and something nested inside it raised `23503` / Prisma `P2003` — *"insert or update on table `Folder` violates foreign key constraint"*. The "insert or update" is this trigger: its DELETE branch runs `UPDATE "Folder" … WHERE "itemId" = OLD."parentId"`, which queues an immediate FK check on the parent's facet row, while `ON DELETE CASCADE` has queued the removal of that same row because the parent `Item` is in the delete set. Row order inside one statement is Postgres's choice, so the check could run first and find the `Item` already gone. Deferring to `COMMIT` lets the cascade land first; a check on a row that no longer exists is skipped. The constraint is not weakened — a real orphan still fails, at `COMMIT` instead of at the statement. Same family as the `27000` user-wipe problem below: rollup triggers writing to rows the same outer command is deleting. Revert with `down.sql` in that migration's directory.

#### `update_collection_size()` — Collection membership size sync

Fires on `CollectionMember` INSERT/DELETE (the explicit "add to / remove from collection" path) and adds or subtracts the member item's `size` from the collection `Item.size`.

| Operation | Behaviour |
|-----------|-----------|
| **INSERT** | Reads `Item.size` of the new member; if > 0, adds it to the collection's `size` |
| **DELETE** | Reads `Item.size` of the removed member; if > 0, subtracts it from the collection's `size` |

On a member **hard-delete**, Postgres cascades the `CollectionMember` row away, so the member `SELECT` returns NULL and the guard skips the update — `item_delete_collection_sync_trigger` (a `BEFORE DELETE` on `Item`) has already decremented the collection while `OLD.size` was still valid. Guarded by `stashly_is_wiping_user("ownerId")`.

#### `sync_item_size_to_collections()` — Item-size → collection propagation

One function, two triggers on `Item`:

| Trigger / event | Behaviour |
|-----------------|-----------|
| `item_size_collection_sync_trigger` — AFTER UPDATE OF `size` | Applies `(NEW.size − OLD.size)` to every collection the item belongs to. `pg_trigger_depth() > 1` short-circuits the recursive re-fire that occurs when the function updates a collection's own size row |
| `item_delete_collection_sync_trigger` — **BEFORE** DELETE | Subtracts `OLD.size` from all parent collections *before* the `ON DELETE CASCADE` removes the `CollectionMember` rows (so `OLD.size` is still readable). Returns `OLD` to allow the delete |

Both cross-row UPDATEs are guarded by `AND NOT stashly_is_wiping_user(c."ownerId")`.

#### User-wipe bypass (`stashly_is_wiping_user`)

`emptyUserBucket()` deletes an entire user's `Item` tree in a single statement. The size/collection triggers then try to UPDATE parent/collection rows that the same outer command is also DELETEing, raising Postgres error **27000** ("tuple to be updated was already modified…"). The bypass is a session-flag escape hatch: when the caller sets both

```sql
SET stashly.delete_all_data_for_user          = '<userId>';
SET stashly.delete_all_data_for_user_consent  = '<non-empty, e.g. consent timestamp>';
```

the guarded UPDATEs skip any row owned by that user. Rows owned by **other** users (e.g. another user's collection containing a wipe-user's item) are still maintained correctly. Both flags are required — the consent flag is a safety belt against a stale/accidental `delete_all_data_for_user`.

#### `notify_notification_change()` — Notification → live SSE feed

The only trigger that isn't a rollup. On every `Notification` write it builds a JSON payload and `PERFORM pg_notify('notifications', payload)`; the singleton `LISTEN` client in `app/.server/notification-events.ts` picks it up and fans it out to that user's open `EventSource` connections.

| Operation | Payload |
|-----------|---------|
| **INSERT** | `{ op: 'created', userId, notification: row_to_json(NEW) }` |
| **UPDATE** | `{ op: 'updated', userId, notification: row_to_json(NEW) }` |
| **DELETE** | `{ op: 'deleted', userId, id }` |

Firing at the DB level means *every* writer pushes live — `createNotification()`, the seed script's `createMany`, raw SQL, and other server instances alike. `pg_notify` payloads are capped at 8000 bytes; notification messages are short enough that a serialized row stays well under it.

#### Version History

| Migration | Changes |
|-----------|---------|
| `20250714054805_test` | Initial `update_parent_folder_size_on_update()` + `update_size()` with size triggers |
| `20250714225523_add_update_size_function_and_drop_the_old_one` | Replaced `update_parent_folder_size()` with cleaner `update_size()`; recreated `item_size_update` / `item_size_update_on_update` / `item_size_decrement` |
| `20250919131158_add_child_count_function` | Added `update_child_count()` + `item_child_count_*` triggers |
| `20251128081140_add_default_to_folder_child_count` | Default value added to `Folder.childCount` |
| `20251214024737_update_triggers_for_inclusive_counts` | Rewrote `update_size()` + `update_child_count()` to maintain `inclusiveSize` / `inclusiveChildCount` alongside the active-only columns |
| `20260416000000_add_collection_size_trigger` | Added `update_collection_size()` + `sync_item_size_to_collections()` and their three triggers (`collection_size_trigger`, `item_size_collection_sync_trigger`, `item_delete_collection_sync_trigger`) |
| `20260526000000_user_wipe_trigger_bypass` | Added `stashly_is_wiping_user()`; re-issued `update_size()`, `update_collection_size()`, `sync_item_size_to_collections()` with the wipe-bypass `WHERE` guard |
| `20260724000000_notification_notify` | Added `notify_notification_change()` + the `notification_change_notify` trigger on `Notification` |
| `20260826000000_defer_folder_item_fk` | Made `Folder_itemId_fkey` `DEFERRABLE INITIALLY DEFERRED` so `update_child_count()`'s DELETE branch can't race the `ON DELETE CASCADE` on the same facet row (see the ⚠️ note under `update_child_count()`). No function or trigger changed |
| `20261002090000_fix_inclusive_size_rollup` | Rewrote `update_size()` so `inclusiveSize` follows each child's `inclusiveSize` (folders) or `size` (files) and travels up on its own; recounted every folder's `size` / `inclusiveSize` from the files beneath it, deepest level first |
| `20261030140000_upload_size_delta_log` | `ItemSizeDelta`, `log_upload_size()` + `item_size_log_upload`, `update_size()` guards, `apply_item_size_deltas()`, `recount_folder_sizes()`: uploaded files reach their folders through a rollup instead of a per-row cascade |
| `20261106210000_status_change_rollup` | **Current** — `update_size()` / `update_child_count()` leave a pure status change to the statement-level `item_status_change` trigger, which writes each folder once; `stashly_apply_folder_deltas()` is shared with `apply_item_size_deltas()` (tech-debt item 51) |
| `20261030160000_upload_size_inline_when_idle` | `update_size()` cascades an upload at once while the database is idle and logs it while busy (deltas pending checked first, then the rollup lock tried); `log_upload_size()` and `item_size_log_upload` dropped |

### Recommended Explorations

1. **Live row counts** — Connect to the database and profile actual data volume per table to identify which tables are most active
2. **Null rate analysis on facets** — Check how populated Image/Video/Audio metadata fields are in practice (EXIF data is often sparse)
3. **Item tree depth analysis** — Query max nesting depth of the parent-child hierarchy to evaluate query performance
4. **Quota distribution** — Analyze `used/total` ratios across users to understand storage utilization patterns
5. **Activity audit coverage** — Check if the Activity/ItemAction system captures all item mutations or has gaps