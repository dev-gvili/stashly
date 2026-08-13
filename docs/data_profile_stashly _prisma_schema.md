## Data Profile: Stashly Prisma Schema

### Overview
- **Models:** 56
- **Enums:** 24
- **Indexes:** 60+ (including Gin, SpGist, composite)
- **PostgreSQL Extensions:** `vector` (pgvector), `pg_trgm` (trigram search)
- **Custom DB logic:** 6 PL/pgSQL functions + 10 triggers (size/count rollups, collection size sync, user-wipe bypass, `Notification` → `pg_notify`)
- **Generator:** `prisma-client` (ESM, `.ts` output → `app/prisma/`), preview features `nativeDistinct`, `relationJoins`, `postgresqlExtensions`
- **Datasource:** PostgreSQL; schema split across `prisma/models/*.prisma`, merged via `prisma.config.ts`

### Model Inventory (56 models)

| Domain | Models |
|--------|--------|
| **Identity / auth** | `User`, `Account`, `Session`, `Verification` |
| **Storage core** | `Item`, `LockedItem`, `Drive`, `Quota`, `Trash`, `TrashItem` |
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

Six PL/pgSQL functions back ten triggers. Five of them maintain denormalized rollups (size, child count) on parent items and on collections, all server-side so application code never recomputes these values; the sixth bridges `Notification` writes to the live SSE feed via `pg_notify`. Every function is `CREATE OR REPLACE`; the table below lists each at its **current** definition.

#### Function inventory

| Function | Current migration | Purpose |
|----------|-------------------|---------|
| `update_size()` | `20260526000000_user_wipe_trigger_bypass` | Maintains `Item.size` / `Item.inclusiveSize` on the **parent** item |
| `update_child_count()` | `20251214024737_update_triggers_for_inclusive_counts` | Maintains `Folder.childCount` / `Folder.inclusiveChildCount` on the **parent** folder |
| `update_collection_size()` | `20260526000000_user_wipe_trigger_bypass` | Maintains a collection `Item.size` when members are added/removed |
| `sync_item_size_to_collections()` | `20260526000000_user_wipe_trigger_bypass` | Propagates a member item's size change to every parent collection |
| `stashly_is_wiping_user(target_user_id TEXT)` | `20260526000000_user_wipe_trigger_bypass` | `STABLE` helper — true when the session is doing a full user wipe (used as a `WHERE` guard inside the three size functions) |
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
| `item_size_collection_sync_trigger` | `Item` | AFTER UPDATE OF `size`, `WHEN (OLD.size IS DISTINCT FROM NEW.size)` | `sync_item_size_to_collections()` |
| `item_delete_collection_sync_trigger` | `Item` | **BEFORE** DELETE | `sync_item_size_to_collections()` |
| `collection_size_trigger` | `CollectionMember` | AFTER INSERT OR DELETE | `update_collection_size()` |
| `notification_change_notify` | `Notification` | AFTER INSERT OR UPDATE OR DELETE | `notify_notification_change()` |

All are `FOR EACH ROW`.

#### `update_size()` — Parent item size maintenance

Keeps `Item.size` (active items only) and `Item.inclusiveSize` (all items including trashed) in sync on the parent item.

| Operation | Behaviour |
|-----------|-----------|
| **INSERT** | +size to parent `inclusiveSize`; +size to parent `size` if status ≠ `trashed` |
| **DELETE** | −size from parent `inclusiveSize`; −size from parent `size` if status ≠ `trashed` |
| **UPDATE (move)** | Decrements old parent, increments new parent (both size columns) |
| **UPDATE (size/status change)** | Computes delta for both `inclusiveSize` and `size` from old/new status and size values |

Every parent UPDATE is additionally guarded by `AND NOT stashly_is_wiping_user("ownerId")` so a full user wipe doesn't deadlock against rows the same statement is deleting (see *User-wipe bypass* below).

#### `update_child_count()` — Folder child count maintenance

Keeps `Folder.childCount` (active items only) and `Folder.inclusiveChildCount` (all items including trashed) in sync.

| Operation | Behaviour |
|-----------|-----------|
| **INSERT** | +1 `inclusiveChildCount`; +1 `childCount` if status ≠ `trashed` |
| **DELETE** | −1 `inclusiveChildCount`; −1 `childCount` if status ≠ `trashed` |
| **UPDATE (move)** | Decrements old parent, increments new parent (both counters) |
| **UPDATE (trash/restore)** | `inclusiveChildCount` unchanged; `childCount` ±1 based on status transition |

> Note: `update_child_count()` does **not** carry the user-wipe bypass guard — only the three size functions were patched in `20260526000000`.

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
| `20260724000000_notification_notify` | **Current** — added `notify_notification_change()` + the `notification_change_notify` trigger on `Notification` |

### Recommended Explorations

1. **Live row counts** — Connect to the database and profile actual data volume per table to identify which tables are most active
2. **Null rate analysis on facets** — Check how populated Image/Video/Audio metadata fields are in practice (EXIF data is often sparse)
3. **Item tree depth analysis** — Query max nesting depth of the parent-child hierarchy to evaluate query performance
4. **Quota distribution** — Analyze `used/total` ratios across users to understand storage utilization patterns
5. **Activity audit coverage** — Check if the Activity/ItemAction system captures all item mutations or has gaps