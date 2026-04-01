## Data Profile: Stashly Prisma Schema

### Overview
- **Models:** 42
- **Enums:** 17
- **Indexes:** 60+ (including Gin, SpGist, composite)
- **PostgreSQL Extensions:** `vector` (pgvector), `pg_trgm` (trigram search)

### Column Classification

| Type | Count | Examples |
|------|-------|---------|
| **Identifiers** | ~50 | `id`, `userId`, `itemId`, `driveId`, `workspaceId` |
| **Dimensions** | ~25 | `type`, `status`, `role`, `category`, `scope` |
| **Metrics** | ~8 | `size`, `inclusiveSize`, `used`, `total`, `deleted`, `priceCents` |
| **Temporal** | ~35 | `createdAt`, `updatedAt`, `expiresAt`, `openedAt`, `deletedAt` |
| **Text** | ~15 | `name`, `description`, `content`, `message`, `email` |
| **Boolean** | ~5 | `emailVerified`, `downloadable`, `default`, `hasDrm` |
| **Structural** | ~3 | `metadata (Json)`, `vector (vector(768))`, `content (ByteA)` |

### Core Entity Relationships

```
User (central node)
 ├── Drive (1:1) ──── Quota (1:1)
 ├── Subscription (1:1) ──── StoragePlan
 ├── Account[] (OAuth providers)
 ├── Session[]
 ├── Item[] (owned files/folders)
 │    ├── Item[] (self-relation: parent/child tree)
 │    ├── File / Folder / Image / Video / Audio (1:1 facets)
 │    ├── Collection (1:1) ──── CollectionItem[] ──── Item
 │    ├── Permission[]
 │    ├── Thumbnail[]
 │    ├── ItemVersion[]
 │    ├── Comment[]
 │    ├── Favorite[]
 │    ├── TrashItem (1:1) ──── Trash
 │    ├── LockedItem (1:1)
 │    ├── Activity[] ──── ItemAction / AccessAction
 │    ├── AuditLog[]
 │    └── Search (1:1, vector embeddings)
 ├── WorkspaceMember[] ──── Workspace
 │    ├── Item[] (workspace-scoped)
 │    ├── Invitation[]
 │    └── StoragePlan (optional)
 ├── Permission[] (many-to-many)
 ├── Favorite[]
 ├── Comment[]
 ├── Notification[]
 └── Invitation[]

ShareLink ──── Permission[] (link-based access)
```

### Key Design Patterns

| Pattern | Implementation |
|---------|---------------|
| **Faceted items** | Item has 1:1 optional relations to File, Folder, Image, Video, Audio — polymorphic by `type` enum |
| **Self-referencing tree** | Item.parentId → Item (folder hierarchy) |
| **Soft delete** | TrashItem joins Item to Trash with `deletedAt`/`restoredAt` timestamps |
| **Optimistic locking** | LockedItem with `expiresAt` for edit locks |
| **Action log (event sourcing)** | Activity → ItemAction → specific action types (Create, Delete, Move, Rename, etc.) |
| **Storage quotas** | Quota tracks `used`/`total`/`deleted` as BigInt bytes with status enum |
| **Vector search** | Search model with `vector(768)` column indexed for cosine similarity |
| **Trigram search** | Item.name indexed with `gin_trgm_ops` for fuzzy matching |

### Data Quality Observations

| Severity | Issue | Detail | Status |
|----------|-------|--------|--------|
| **Info** | Heavy optionality on facets | Image has 14/16 optional fields — most metadata is sparse by nature (EXIF data) | By design |
| **Info** | BigInt for sizes | `size`, `used`, `total`, `deleted` use BigInt — supports files >2GB correctly | By design |
| ~~Warn~~ | ~~Typo in field name~~ | ~~`copyActionIdId` in ItemAction (double "Id")~~ | **Fixed** — renamed to `copyActionId` |
| ~~Info~~ | ~~Duplicate unique on Item.id~~ | ~~Item has both `@id` and `@unique` on `id` — redundant~~ | **Fixed** — removed redundant `@unique` |
| **Info** | Comment unique constraint | `@@unique([itemId, ownerId])` limits one comment per user per item — intentional design choice | By design |
| ~~Warn~~ | ~~Metadata model is orphaned~~ | ~~No relations to any other model — standalone key/value store, not referenced in app code~~ | **Fixed** — model and table removed |
| ~~Info~~ | ~~Tag model is orphaned~~ | ~~No relations; items use `tags String[]` array directly on Item, not referenced in app code~~ | **Fixed** — model and table removed |

### Index Analysis

**Well-indexed models:**
- **Item** — 15 composite indexes covering parent-based queries, workspace queries, drive queries, and text search (Gin trigram)
- **Permission** — 6 indexes on temporal, role, and FK columns
- **Notification** — 4 indexes including SpGist on message trigram
- **Subscription** — 5 indexes with unique constraints on Stripe IDs

**Under-indexed models:**
- **Account** — no indexes beyond PK (queries by `userId` or `providerId` would benefit)
- **Thumbnail** — no indexes (queries by `itemId` or `view` would benefit)
- **ItemVersion** — no indexes (queries by `itemId` would benefit)
- **File** — no indexes beyond `@unique` on `itemId`

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
| `InvitationStatus` | pending, accepted, rejected, expired | Invitation.status |
| `NotificationType` | info, warning, error, success | Notification.type |
| `NotificationStatus` | read, unread | Notification.status |
| `SortBy` | id, name, date, size, type | View.sortBy |
| `ObjectType` | file, folder | DeleteAction.itemType |

### Custom PostgreSQL Functions & Triggers

Two custom PL/pgSQL functions maintain denormalized counters on parent items. Both are `CREATE OR REPLACE` (latest versions from migration `20251214024737_update_triggers_for_inclusive_counts`).

#### `update_child_count()` — Folder child count maintenance

Keeps `Folder.childCount` (active items only) and `Folder.inclusiveChildCount` (all items including trashed) in sync.

| Operation | Behaviour |
|-----------|-----------|
| **INSERT** | +1 `inclusiveChildCount`; +1 `childCount` if status ≠ `trashed` |
| **DELETE** | −1 `inclusiveChildCount`; −1 `childCount` if status ≠ `trashed` |
| **UPDATE (move)** | Decrements old parent, increments new parent (both counters) |
| **UPDATE (trash/restore)** | `inclusiveChildCount` unchanged; `childCount` ±1 based on status transition |

**Triggers** (on `"Item"` table, all `AFTER … FOR EACH ROW`):
- `item_child_count_insert` — after INSERT
- `item_child_count_update` — after UPDATE
- `item_child_count_delete` — after DELETE

#### `update_size()` — Parent item size maintenance

Keeps `Item.size` (active items only) and `Item.inclusiveSize` (all items including trashed) in sync on the parent item.

| Operation | Behaviour |
|-----------|-----------|
| **INSERT** | +size to parent `inclusiveSize`; +size to parent `size` if status ≠ `trashed` |
| **DELETE** | −size from parent `inclusiveSize`; −size from parent `size` if status ≠ `trashed` |
| **UPDATE (move)** | Decrements old parent, increments new parent (both size columns) |
| **UPDATE (size/status change)** | Computes delta for both `inclusiveSize` and `size` based on old/new status and size values |

**Triggers** (on `"Item"` table, all `AFTER … FOR EACH ROW`):
- `item_size_update` — after INSERT
- `item_size_update_on_update` — after UPDATE
- `item_size_decrement` — after DELETE

#### Version History

| Migration | Changes |
|-----------|---------|
| `20250714054805_test` | Initial `update_parent_folder_size_on_update()` + `update_size()` with size triggers |
| `20250714225523_add_update_size_function_and_drop_the_old_one` | Replaced `update_parent_folder_size()` with cleaner `update_size()`; recreated size triggers |
| `20250919131158_add_child_count_function` | Added `update_child_count()` + child count triggers |
| `20251214024737_update_triggers_for_inclusive_counts` | **Current** — rewrote both functions to maintain `inclusiveSize` and `inclusiveChildCount` alongside the active-only columns |

### Recommended Explorations

1. **Live row counts** — Connect to the database and profile actual data volume per table to identify which tables are most active
2. **Null rate analysis on facets** — Check how populated Image/Video/Audio metadata fields are in practice (EXIF data is often sparse)
3. **Item tree depth analysis** — Query max nesting depth of the parent-child hierarchy to evaluate query performance
4. **Quota distribution** — Analyze `used/total` ratios across users to understand storage utilization patterns
5. **Activity audit coverage** — Check if the Activity/ItemAction system captures all item mutations or has gaps