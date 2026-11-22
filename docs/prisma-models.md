# Stashly Prisma Models

Every `model` and `enum` block from `prisma/models/*.prisma`, copied verbatim (fields, attributes, indexes and comments unchanged). Generated 2026-11-22 from 29 schema files.

- Models: 58
- Enums: 24

## Contents

**Models:** [AccessAction](#accessaction) · [Account](#account) · [Activity](#activity) · [ActivityTime](#activitytime) · [Audio](#audio) · [AuditLog](#auditlog) · [BucketAction](#bucketaction) · [CollectionAction](#collectionaction) · [CollectionMember](#collectionmember) · [Comment](#comment) · [CommentAction](#commentaction) · [CopyAction](#copyaction) · [CreateAction](#createaction) · [DeleteAction](#deleteaction) · [Drive](#drive) · [EditAction](#editaction) · [Favorite](#favorite) · [FavoriteAction](#favoriteaction) · [File](#file) · [Folder](#folder) · [Image](#image) · [Invitation](#invitation) · [InvitationRecipient](#invitationrecipient) · [Item](#item) · [ItemAction](#itemaction) · [ItemSizeDelta](#itemsizedelta) · [ItemVersion](#itemversion) · [LockedItem](#lockeditem) · [Markdown](#markdown) · [MoveAction](#moveaction) · [Notification](#notification) · [Pdf](#pdf) · [Permission](#permission) · [PermissionAction](#permissionaction) · [PinAction](#pinaction) · [PinItem](#pinitem) · [Quota](#quota) · [QuotaDelta](#quotadelta) · [RenameAction](#renameaction) · [RestoreAction](#restoreaction) · [Search](#search) · [SearchChunk](#searchchunk) · [Session](#session) · [ShareAction](#shareaction) · [ShareLink](#sharelink) · [StoragePlan](#storageplan) · [Subscription](#subscription) · [Thumbnail](#thumbnail) · [Trash](#trash) · [TrashItem](#trashitem) · [UploadAction](#uploadaction) · [User](#user) · [Verification](#verification) · [VersionAction](#versionaction) · [Video](#video) · [View](#view) · [Workspace](#workspace) · [WorkspaceMember](#workspacemember)

**Enums:** [BucketKind](#bucketkind) · [CollectionActionKind](#collectionactionkind) · [DriveType](#drivetype) · [FavoriteKind](#favoritekind) · [InvitationStatus](#invitationstatus) · [ItemCategory](#itemcategory) · [ItemStatus](#itemstatus) · [ItemType](#itemtype) · [NotificationKind](#notificationkind) · [NotificationStatus](#notificationstatus) · [NotificationType](#notificationtype) · [ObjectType](#objecttype) · [PermissionRole](#permissionrole) · [PinKind](#pinkind) · [QuotaStatus](#quotastatus) · [ShareLinkType](#sharelinktype) · [ShareScope](#sharescope) · [SortBy](#sortby) · [SortOrder](#sortorder) · [StoragePlanType](#storageplantype) · [SubscriptionStatus](#subscriptionstatus) · [ThumbnailSize](#thumbnailsize) · [ViewType](#viewtype) · [WorkspaceMemberRole](#workspacememberrole)

## Models

### AccessAction

Source: `prisma/models/action.prisma`

```prisma
// Track when an item is accessed, such as when a user views or opens a file or folder.
model AccessAction {
  id         String    @id
  activityId String?   @unique
  activity   Activity? @relation(fields: [activityId], references: [id])
}
```

### Account

Source: `prisma/models/account.prisma`

```prisma
model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

### Activity

Source: `prisma/models/activity.prisma`

```prisma
model Activity {
  id     String        @id
  timeId String?       @unique
  time   ActivityTime? @relation(fields: [timeId], references: [id])
  itemId String?
  item   Item?         @relation(fields: [itemId], references: [id], onDelete: Cascade)
  action ItemAction? // what action was taken on the item
  access AccessAction? // represents access to the item

  @@unique([itemId, timeId])
}
```

### ActivityTime

Source: `prisma/models/activity.prisma`

```prisma
model ActivityTime {
  id         String    @id
  observedAt DateTime?
  reportedAt DateTime?
  activity   Activity?
}
```

### Audio

Source: `prisma/models/facet.prisma`

```prisma
model Audio {
  id                String   @id
  album             String?
  albumArtist       String?
  artist            String?
  composer          String?
  bitrate           Int?
  composers         String?
  copyright         String?
  disc              Int?
  discCount         Int?
  duration          Int?
  genre             String?
  hasDrm            Boolean?
  isVariableBitrate Boolean?
  title             String?
  track             Int?
  trackCount        Int?
  year              Int?
  itemId            String   @unique
  item              Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
}
```

### AuditLog

Source: `prisma/models/auditlog.prisma`

```prisma
model AuditLog {
  id        String   @id
  action    String
  timestamp DateTime @default(now()) @db.Timestamp()
  itemId    String?
  item      Item?    @relation(fields: [itemId], references: [id])
  metadata  Json?    @db.JsonB

  @@index([timestamp])
}
```

### BucketAction

Source: `prisma/models/action.prisma`

```prisma
// Track the user-level "empty bucket" wipe (recorded on the user's root Item).
model BucketAction {
  id     String      @id
  kind   BucketKind
  action ItemAction?
}
```

### CollectionAction

Source: `prisma/models/action.prisma`

```prisma
// Track collection-membership operations (adding/removing items, emptying).
// Collection create/rename/trash/delete reuse CreateAction/RenameAction/DeleteAction/RestoreAction.
model CollectionAction {
  id           String               @id
  kind         CollectionActionKind
  collectionId String?
  itemId       String?
  count        Int? // for bulk operations (item_added/item_removed/emptied)
  action       ItemAction?
}
```

### CollectionMember

Source: `prisma/models/collection.prisma`

```prisma
/**
 * Junction table for the many-to-many self-relation on Item that represents
 * collection membership. A Collection is simply an Item with type='collection'.
 * Replaces the old `Collection` facet model and `CollectionItem` junction table.
 * `collectionId` points to an Item whose type='collection'.
 * `itemId` points to any Item that is a member of that collection.
 */
model CollectionMember {
  id           String   @id
  collectionId String
  /// The collection (Item.members on the other side).
  collection   Item     @relation("CollectionMembers", fields: [collectionId], references: [id], onDelete: Cascade)
  itemId       String
  /// The item added to the collection (Item.memberships on the other side).
  item         Item     @relation("ItemMemberships", fields: [itemId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([collectionId, itemId])
  @@index([collectionId])
  @@index([itemId])
  @@index([createdAt(sort: Desc)])
}
```

### Comment

Source: `prisma/models/comment.prisma`

```prisma
model Comment {
  id        String   @id
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  itemId String
  item   Item   @relation(fields: [itemId], references: [id], onDelete: Cascade)

  ownerId String
  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([itemId, ownerId])
  @@index([createdAt])
}
```

### CommentAction

Source: `prisma/models/action.prisma`

```prisma
// Track the comments made on items, such as files or folders.
model CommentAction {
  id           String      @id
  isReply      Boolean     @default(false)
  authorId     String
  participants String[]
  action       ItemAction?
}
```

### CopyAction

Source: `prisma/models/action.prisma`

```prisma
model CopyAction {
  id             String      @id
  fromParentId   String
  fromParentName String
  toParentId     String
  toParentName   String
  action         ItemAction?
}
```

### CreateAction

Source: `prisma/models/action.prisma`

```prisma
// Track the creation of items, such as files or folders.
model CreateAction {
  id     String      @id
  action ItemAction?
}
```

### DeleteAction

Source: `prisma/models/action.prisma`

```prisma
// Track the deletion of items, such as files or folders.
model DeleteAction {
  id       String      @id
  name     String
  itemType ObjectType
  action   ItemAction?
}
```

### Drive

Source: `prisma/models/drive.prisma`

```prisma
model Drive {
  id    String    @id
  name  String    @default("Stashly Drive")
  // personal or business
  type  DriveType @default(personal)
  quota Quota?
  quotaDeltas QuotaDelta[]
  items Item[]
  trash Trash?

  // --- New limit columns ---------------------------------------------
  workspaceLimit Int? // Max workspaces per user
  memberLimit    Int? // Max members per workspace
  storageLimit   BigInt? // 100 GB in bytes
  // -------------------------------------------------------------------

  storage StoragePlan? @relation(fields: [memberLimit, workspaceLimit, storageLimit], references: [memberLimit, workspaceLimit, storageLimit], onDelete: Cascade)

  ownerId String @unique
  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([ownerId, type])
  @@index([name])
  @@index([type])
}
```

### EditAction

Source: `prisma/models/action.prisma`

```prisma
model EditAction {
  id     String      @id
  action ItemAction?
}
```

### Favorite

Source: `prisma/models/favorite.prisma`

```prisma
model Favorite {
  id            String   @id
  favoritedById String
  favoritedBy   User     @relation(fields: [favoritedById], references: [id], onDelete: Cascade)
  itemId        String
  item          Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([favoritedById, id], name: "favoritedById_id_idx")
  @@index([itemId, id], name: "itemId_id_idx")
  @@index([favoritedById, itemId], name: "favoritedById_itemId_idx")
  @@index([createdAt], name: "createdAt_idx")
}
```

### FavoriteAction

Source: `prisma/models/action.prisma`

```prisma
// Track favorite/unfavorite events recorded on the favorited item.
model FavoriteAction {
  id     String       @id
  kind   FavoriteKind
  action ItemAction?
}
```

### File

Source: `prisma/models/facet.prisma`

```prisma
model File {
  id         String  @id
  mimeType   String?
  hash       String?
  extension  String?
  bucket     String
  key        String
  /// Where the upload put it, `<rootId>/<folders>/<name>` as the browser saw it.
  /// A record of the upload, not the file's current place: a move or rename
  /// leaves it as it was. `key` is the object's own (`toObjectKey`).
  uploadPath String
  etag       String?
  itemId     String  @unique
  item       Item    @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@index([bucket, key], map: "file_bucket_key")
}
```

### Folder

Source: `prisma/models/facet.prisma`

```prisma
model Folder {
  id                  String @id
  childCount          Int?   @default(0)
  inclusiveChildCount Int    @default(0)
  view                View?
  itemId              String @unique
  /// DO NOT reshape this relation without re-reading
  /// prisma/migrations/20260826000000_defer_folder_item_fk. That migration makes
  /// Folder_itemId_fkey DEFERRABLE INITIALLY DEFERRED — Prisma cannot express
  /// that here, so any change that makes Prisma DROP and re-ADD this constraint
  /// (renaming the field/model, changing onDelete, `prisma db push`) silently
  /// restores the immediate check and brings back the P2003 bulk-delete failure.
  item                Item   @relation(fields: [itemId], references: [id], onDelete: Cascade)
}
```

### Image

Source: `prisma/models/facet.prisma`

```prisma
model Image {
  id                   String    @id
  height               Int?
  width                Int?
  horizontalResolution Int?
  verticalResolution   Int?
  bitDepth             Int?
  cameraMake           String?
  cameraModel          String?
  exposureTime         Float?
  focalLength          Float?
  fNumber              Float?
  iso                  Int?
  takenDateTime        DateTime?
  latitude             Float?
  longitude            Float?
  itemId               String    @unique
  item                 Item      @relation(fields: [itemId], references: [id], onDelete: Cascade)
}
```

### Invitation

Source: `prisma/models/invitation.prisma`

```prisma
model Invitation {
  id        String    @id
  createdAt DateTime  @default(now()) @db.Timestamp()
  expiresAt DateTime? @db.Timestamp()

  // Optional personal note the sender attaches to the invitation. Surfaced in
  // the invitation detail panel (both received and sent tabs).
  message String?

  // Who sent the invitation
  senderId String
  sender   User   @relation(fields: [senderId], references: [id])

  // For item sharing
  itemId String?
  item   Item?   @relation(fields: [itemId], references: [id])

  // For workspace invitation
  workspaceId String?
  workspace   Workspace? @relation(fields: [workspaceId], references: [id])

  // Recipients
  recipients InvitationRecipient[]

  @@index([senderId])
  @@index([itemId])
  @@index([workspaceId])
}
```

### InvitationRecipient

Source: `prisma/models/invitation.prisma`

```prisma
// Separate model to track per-recipient status and role, since an invitation can be sent to multiple recipients with different roles
model InvitationRecipient {
  id        String   @id
  createdAt DateTime @default(now()) @db.Timestamp()

  // Recipient email
  email String

  // Per-recipient status
  status InvitationStatus @default(pending)

  // Role granted to this recipient
  // For item invitations: PermissionRole (read/write/owner)
  // For workspace invitations: stored as string, maps to WorkspaceMemberRole
  role String @default("read")

  // Parent invitation, either for item sharing or workspace invitation 
  invitationId String
  invitation   Invitation @relation(fields: [invitationId], references: [id], onDelete: Cascade)

  // Permission created for item invitations, null for workspace invitations, since workspace permissions are managed differently. 
  // This allows us to easily query the permission details for item invitations, while keeping workspace invitations simpler.  
  permission Permission?

  @@index([invitationId])
  @@index([email])
  @@index([status])
}
```

### Item

Source: `prisma/models/item.prisma`

```prisma
model Item {
  id            String       @id
  name          String
  size          BigInt       @default(0)
  inclusiveSize BigInt       @default(0)
  type          ItemType     @default(file)
  category      ItemCategory @default(unknown)
  status        ItemStatus   @default(normal)

  // Integration with multipart upload
  uploadId String?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  openedAt  DateTime?

  // Facets (optional, only one may be present per item)
  file   File?
  folder Folder?
  image  Image?
  video  Video?
  audio  Audio?
  pdf    Pdf?
  markdown Markdown?

  ownerId String
  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  workspaceId String?
  workspace   Workspace? @relation(fields: [workspaceId], references: [id])

  driveId String
  drive   Drive  @relation(fields: [driveId], references: [id], onDelete: Cascade)

  // Self relation for parent-child relationship (tree structure)
  parentId String?
  /**
   * `One-to-Many` self-relation to represent hierarchical structure
   * An Item can have multiple children (sub-items) and one parent (container item)
   * On deletion of a parent item, all its children are also deleted (Cascade)
   */
  children Item[]  @relation("ParentChild")
  /**
   * Many-to-One self-relation to represent hierarchical structure
   * An Item can have multiple children (sub-items) and one parent (container item)
   * On deletion of a parent item, all its children are also deleted (Cascade)
   */
  parent   Item?   @relation("ParentChild", fields: [parentId], references: [id], onDelete: Cascade)

  // Location and Storage
  trash               TrashItem?

  // Collections
  // A collection is not its own model: it is an Item with type='collection'.
  // Membership is many-to-many from Item to Item (one item can sit in many
  // collections), so it can't be a single column like `parentId`. It is stored
  // as one CollectionMember row per (collection, member) pair, and every row
  // points at two Items:
  //
  //   CollectionMember.collection -> the Item that IS the collection
  //   CollectionMember.item       -> the Item that was ADDED to it
  //
  // So each Item has two lists of these rows, one per role it can play.
  // Neither list is a database column; Prisma resolves both from
  // CollectionMember's foreign keys (collectionId, itemId).

  /**
   * As a collection: one CollectionMember row per item inside it.
   * Only filled when type='collection'; always empty for files and folders.
   * The member is each row's `itemId` / `item`.
   * e.g. collection.members.map((m) => m.itemId)
   *      _count: { select: { members: true } }   // member count
   */
  members     CollectionMember[] @relation("CollectionMembers")

  /**
   * As a member: one CollectionMember row per collection this item was added to.
   * Any item type can have these, including another collection.
   * The containing collection is each row's `collectionId` / `collection`.
   * e.g. item.memberships.map((m) => m.collection)
   */
  memberships CollectionMember[] @relation("ItemMemberships")

  // Access Control
  locked      LockedItem?
  permissions Permission[]
  invitations Invitation[]

  // previews
  thumbnails Thumbnail[]

  // Additional Information and Filtering
  tags     String[]
  versions ItemVersion[]

  // Monitoring and Auditing
  activities Activity[]
  comments   Comment[]
  logs       AuditLog[]

  // Miscellaneous
  favorites Favorite[]
  pins      PinItem[]

  //  Search Functionality (optional)
  search       Search?
  searchChunks SearchChunk[]

  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin, map: "item_name_trgm_idx")
  @@index([tags], type: Gin, map: "tags_gin_idx")
  @@index([createdAt, name], map: "search_cursor")
  //  parent indexs
  @@index([parentId, name(sort: Asc)], map: "parent_cursor")
  @@index([parentId, createdAt(sort: Desc)], map: "parent_created_at")
  @@index([parentId, updatedAt(sort: Desc)], map: "parent_updated_at")
  @@index([parentId, category, name(sort: Asc)], map: "parent_category_cursor")
  @@index([parentId, status, name(sort: Asc)], map: "parent_status_cursor")
  @@index([parentId, type, name(sort: Asc)], map: "parent_type_name_cursor")
  @@index([parentId, type, createdAt(sort: Desc)], map: "parent_type_created_at_cursor")
  @@index([parentId, status, type, name(sort: Asc)], map: "parent_status_type_name_cursor")
  // workspace indexs
  @@index([workspaceId, name(sort: Asc)], map: "workspace_cursor")
  @@index([workspaceId, createdAt(sort: Desc)], map: "workspace_created_at")
  // tanent indexs
  @@index([driveId, parentId, name(sort: Asc)], map: "drive_parent_name_cursor")
  @@index([driveId, parentId, createdAt(sort: Desc)], map: "drive_parent_created_at")
  @@index([driveId, createdAt(sort: Desc)], map: "drive_created_at")
  // owner index: every "my items" query (overview feed, usage, storage) filters on
  // ownerId; without it each one read the whole table, every user's items included
  @@index([ownerId], map: "owner_items")
}
```

### ItemAction

Source: `prisma/models/action.prisma`

```prisma
model ItemAction {
  id                 String            @id
  comment            CommentAction?    @relation(fields: [commentActionId], references: [id])
  commentActionId    String?           @unique
  create             CreateAction?     @relation(fields: [createActionId], references: [id])
  createActionId     String?           @unique
  delete             DeleteAction?     @relation(fields: [deleteActionId], references: [id])
  deleteActionId     String?           @unique
  edit               EditAction?       @relation(fields: [editActionId], references: [id])
  editActionId       String?           @unique
  move               MoveAction?       @relation(fields: [moveActionId], references: [id])
  moveActionId       String?           @unique
  rename             RenameAction?     @relation(fields: [renameActionId], references: [id])
  renameActionId     String?           @unique
  restore            RestoreAction?    @relation(fields: [restoreActionId], references: [id])
  restoreActionId    String?           @unique
  share              ShareAction?      @relation(fields: [shareActionId], references: [id])
  shareActionId      String?           @unique
  version            VersionAction?    @relation(fields: [versionActionId], references: [id])
  versionActionId    String?           @unique
  activity           Activity?         @relation(fields: [activityId], references: [id])
  activityId         String?           @unique
  copy               CopyAction?       @relation(fields: [copyActionId], references: [id])
  copyActionId       String?           @unique
  permission         PermissionAction? @relation(fields: [permissionActionId], references: [id])
  permissionActionId String?           @unique
  pin                PinAction?        @relation(fields: [pinActionId], references: [id])
  pinActionId        String?           @unique
  upload             UploadAction?     @relation(fields: [uploadActionId], references: [id])
  uploadActionId     String?           @unique
  collection         CollectionAction? @relation(fields: [collectionActionId], references: [id])
  collectionActionId String?           @unique
  favorite           FavoriteAction?   @relation(fields: [favoriteActionId], references: [id])
  favoriteActionId   String?           @unique
  bucket             BucketAction?     @relation(fields: [bucketActionId], references: [id])
  bucketActionId     String?           @unique
}
```

### ItemSizeDelta

Source: `prisma/models/item-size-delta.prisma`

```prisma
/// A pending change to a folder's size or child count from an uploaded file.
///
/// While the database is busy (deltas pending, or the rollup lock taken), an
/// insert of an `Item` with an `uploadId` doesn't rewrite every folder above
/// it: `update_size()` appends its size here instead, `update_child_count()`
/// appends its +1, and
/// `apply_item_size_deltas()` applies all pending rows to each affected folder
/// once, on a short timer (`app/.server/size-rollup.ts`). While it is idle the
/// upload cascades at once, like any insert. Rows live for about one rollup
/// interval.
///
/// No relation to `Item`, on purpose: a delta whose folder was deleted before
/// the rollup must be dropped by it, and no foreign key means no extra lock or
/// check per uploaded file. See migrations `20261030140000_upload_size_delta_log`
/// and `20261030160000_upload_size_inline_when_idle`.
model ItemSizeDelta {
  id        BigInt   @id @default(autoincrement())
  /// The uploaded item's parent when it was inserted.
  parentId  String
  /// Bytes for the parent's `size` (0 for a trashed item).
  active    BigInt
  /// Bytes for the parent's `inclusiveSize`.
  inclusive BigInt
  /// Children to add to the parent's `childCount` and `inclusiveChildCount`.
  children  Int      @default(0)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
}
```

### ItemVersion

Source: `prisma/models/version.prisma`

```prisma
model ItemVersion {
  id        String    @id
  updatedAt DateTime? @updatedAt @db.Timestamp()
  createdAt DateTime? @default(now()) @db.Timestamp()
  size      BigInt?
  content   Bytes?    @db.ByteA
  label     String?
  version   String?
  itemId    String?
  item      Item?     @relation(fields: [itemId], references: [id], onDelete: Cascade)
}
```

### LockedItem

Source: `prisma/models/item.prisma`

```prisma
model LockedItem {
  id         String @id
  itemId     String @unique
  item       Item   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  lockedById String
  lockedBy   User   @relation(fields: [lockedById], references: [id])

  lockedAt  DateTime  @default(now())
  expiresAt DateTime?

  @@unique([itemId, lockedById])
  @@index([expiresAt])
}
```

### Markdown

Source: `prisma/models/facet.prisma`

```prisma
model Markdown {
  id              String    @id
  title           String?
  author          String?
  description     String?
  // Comma-joined frontmatter tags (mirrors Pdf.keywords)
  tags            String?
  wordCount       Int?
  // Estimated reading time in whole minutes
  readingTime     Int?
  headingCount    Int?
  linkCount       Int?
  imageCount      Int?
  codeBlockCount  Int?
  taskCount       Int?
  hasFrontmatter  Boolean?
  docCreatedAt    DateTime?
  docModifiedAt   DateTime?
  itemId          String    @unique
  item            Item      @relation(fields: [itemId], references: [id], onDelete: Cascade)
}
```

### MoveAction

Source: `prisma/models/action.prisma`

```prisma
model MoveAction {
  id             String      @id
  fromParentId   String
  fromParentName String
  toParentId     String
  toParentName   String
  action         ItemAction?
}
```

### Notification

Source: `prisma/models/notification.prisma`

```prisma
model Notification {
  id        String             @id
  message   String
  // `type` carries severity (tile colour); `kind` carries the subject/event
  // that drives the glyph (a share vs. an upload vs. a quota warning).
  type      NotificationType
  kind      NotificationKind   @default(system)
  status    NotificationStatus @default(unread)
  createdAt DateTime           @default(now())
  updatedAt DateTime           @default(now()) @updatedAt

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([createdAt])
  @@index([type])
  @@index([kind])
  @@index([status])
  @@index([message(raw: "gin_trgm_ops")], type: SpGist)
}
```

### Pdf

Source: `prisma/models/facet.prisma`

```prisma
model Pdf {
  id               String    @id
  pageCount        Int?
  title            String?
  author           String?
  subject          String?
  keywords         String?
  creator          String?
  producer         String?
  pdfVersion       String?
  language         String?
  isEncrypted      Boolean?
  hasFormFields    Boolean?
  hasAnnotations   Boolean?
  hasSignatures    Boolean?
  // First-page media box in PDF points (1pt = 1/72in) — drives "Page size"
  pageWidth        Float?
  pageHeight       Float?
  docCreatedAt     DateTime?
  docModifiedAt    DateTime?
  itemId           String    @unique
  item             Item      @relation(fields: [itemId], references: [id], onDelete: Cascade)
}
```

### Permission

Source: `prisma/models/permission.prisma`

```prisma
model Permission {
  id          String               @id
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt @db.Timestamp()
  expiresAt   DateTime?            @db.Timestamp()
  deletedAt   DateTime?            @db.Timestamp()
  roles       PermissionRole       @default(read)
  recipientId String?              @unique
  recipient   InvitationRecipient? @relation(fields: [recipientId], references: [id])
  linkId      String?
  link        ShareLink?           @relation(fields: [linkId], references: [id])
  itemId      String?
  item        Item?                @relation(fields: [itemId], references: [id], onDelete: Cascade)

  users User[]

  @@index([createdAt(sort: Desc)])
  @@index([updatedAt(sort: Desc)])
  @@index([roles])
  @@index([recipientId])
  @@index([linkId])
  @@index([itemId])
}
```

### PermissionAction

Source: `prisma/models/action.prisma`

```prisma
model PermissionAction {
  id     String      @id
  type   String
  userId String
  role   String
  action ItemAction?
}
```

### PinAction

Source: `prisma/models/action.prisma`

```prisma
model PinAction {
  id     String      @id
  kind   PinKind
  action ItemAction?
}
```

### PinItem

Source: `prisma/models/pinItem.prisma`

```prisma
model PinItem {
  id         String   @id
  pinnedById String
  pinnedBy   User     @relation(fields: [pinnedById], references: [id], onDelete: Cascade)
  itemId     String
  item       Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  position   Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([pinnedById, itemId])
  @@index([pinnedById, position])
}
```

### Quota

Source: `prisma/models/quota.prisma`

```prisma
model Quota {
  id        String      @id @unique
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  // Total space consumed by files in the trash.
  deleted   BigInt      @default(0)
  // Total allowed storage space, in bytes.
  // This is based on the value storageLimit in StoragePlan model.
  total     BigInt      @default(0)
  // Total space used, in bytes. Read-only.
  used      BigInt      @default(0)
  status    QuotaStatus @default(normal)

  // Relations
  driveId String @unique
  drive   Drive  @relation(fields: [driveId], references: [id], onDelete: Cascade)

  @@index([driveId])
  @@index([status])
  @@index([createdAt])
}
```

### QuotaDelta

Source: `prisma/models/quota.prisma`

```prisma
/// An upload's charge, waiting to reach its drive's `Quota` row.
///
/// While the database is busy, an upload far from its drive's limit doesn't
/// write the shared `Quota` row: `stashly_charge_upload()` appends its size
/// here, and `apply_item_size_deltas()` adds all pending rows to each `Quota`
/// once per run (`app/.server/size-rollup.ts`). The limit counts these rows, so a
/// logged charge can't be spent twice. Near the limit, or while idle, the charge
/// goes straight to `Quota`. See migration `20261106120000_upload_quota_log`.
model QuotaDelta {
  id        BigInt   @id @default(autoincrement())
  /// Bytes to add to the drive's `used`.
  used      BigInt
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  driveId String
  drive   Drive  @relation(fields: [driveId], references: [id], onDelete: Cascade)

  @@index([driveId])
}
```

### RenameAction

Source: `prisma/models/action.prisma`

```prisma
model RenameAction {
  id      String      @id
  oldName String
  newName String
  action  ItemAction?
}
```

### RestoreAction

Source: `prisma/models/action.prisma`

```prisma
model RestoreAction {
  id     String      @id
  action ItemAction?
}
```

### Search

Source: `prisma/models/search.prisma`

```prisma
model Search {
  id      String  @id
  content String? @db.Text // Combined searchable content (e.g., name, metadata, tags, versions)

  vector    Unsupported("vector(768)")?
  createdAt DateTime                    @default(now())
  updatedAt DateTime                    @updatedAt

  itemId String @unique
  item   Item   @relation(fields: [itemId], references: [id], onDelete: Cascade)

  // Creating an index on the vector field for fast similarity searches.
  @@index([vector], map: "Search_vector_idx")
  /// Sparse half of hybrid retrieval: `rankByKeyword` runs `word_similarity()`
  /// and `ILIKE` against this column, both of which a trigram GIN index can
  /// answer. `Item.name` already has the equivalent (`item_name_trgm_idx`).
  @@index([content(ops: raw("gin_trgm_ops"))], type: Gin, map: "search_content_trgm_idx")
  @@index([createdAt])
  @@index([updatedAt])
}
```

### SearchChunk

Source: `prisma/models/search.prisma`

```prisma
/// Per-passage embedding store. One row per ~300-token chunk extracted from
/// an item's text content. Indexed with a single document-level Search row
/// (parent), and joined back to Item for filtering.
///
/// pageNum / charStart / charEnd let us highlight the matching passage in
/// the UI later — write them at index time so we never have to re-chunk.
model SearchChunk {
  id      String @id
  itemId  String
  ord     Int // position within the item (0-based)
  content String @db.Text

  pageNum   Int? // null for non-paginated formats (.txt, .md)
  /// Nearest preceding heading. Formats with structure but no pagination
  /// (.md) locate a passage by section — "§ Why chunk?" where a PDF says
  /// "page 5". Without it those results had no locator to show at all.
  section   String?
  charStart Int // offset into the cleaned full text
  charEnd   Int

  vector    Unsupported("vector(768)")?
  createdAt DateTime                    @default(now())
  updatedAt DateTime                    @updatedAt

  item Item @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@unique([itemId, ord])
  @@index([itemId])
  @@index([vector], map: "SearchChunk_vector_idx")
}
```

### Session

Source: `prisma/models/session.prisma`

```prisma
model Session {
  id                String   @id
  expiresAt         DateTime
  token             String
  createdAt         DateTime
  updatedAt         DateTime
  ipAddress         String?
  userAgent         String?
  userId            String
  rootId            String?
  driveId           String?
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  impersonatedBy    String?
  activeWorkspaceId String?

  @@unique([token])
  @@map("session")
}
```

### ShareAction

Source: `prisma/models/action.prisma`

```prisma
model ShareAction {
  id         String      @id
  recipients String[]
  action     ItemAction?
}
```

### ShareLink

Source: `prisma/models/share.prisma`

```prisma
model ShareLink {
  id           String        @id
  type         ShareLinkType
  scope        ShareScope
  url          String?
  downloadable Boolean?
  password     String?
  expiresAt    DateTime?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  permission   Permission[]

  @@index([createdAt(sort: Desc)])
  @@index([updatedAt(sort: Desc)])
  @@index([expiresAt])
  @@index([type])
  @@index([scope])
}
```

### StoragePlan

Source: `prisma/models/storage.prisma`

```prisma
model StoragePlan {
  id             String          @id
  name           String // e.g., "Free", "Basic", "Standard", "Premium"
  tag            String          @unique // A short, unique tag for the plan (e.g., "free", "basic")  
  description    String? // A short description of the plan
  type           StoragePlanType @default(free) // Enum for plan type
  storageLimit   BigInt // e.g., 15, 100, 200, 2000
  workspaceLimit Int // 5, 10, …
  memberLimit    Int // 5, 10, …
  features       String[] // List of features included in the plan

  // Pricing
  priceCents    Int? // Price in cents, null for free plan
  currency      String? // e.g., "USD", null for free plan
  stripePriceId String? @unique // Stripe price ID for this plan

  // Relations
  subscriptions Subscription[]
  workspaces    Workspace[]
  drives        Drive[]

  @@unique([memberLimit, workspaceLimit, storageLimit])
  @@index([name])
  @@index([type])
  @@index([stripePriceId]) // Index for quick lookup by Stripe Price ID
}
```

### Subscription

Source: `prisma/models/subscription.prisma`

```prisma
model Subscription {
  id       String             @id
  status   SubscriptionStatus @default(active)
  metadata Json?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  endedAt   DateTime? // End date of the subscription, can be null if ongoing

  // Storage plan details
  storagePlanId String
  storagePlan   StoragePlan @relation(fields: [storagePlanId], references: [id], onDelete: Cascade)

  // Stripe integration
  stripeSubscriptionId String? @unique // Stripe subscription ID

  // Relations
  ownerId String @unique
  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([ownerId, storagePlanId])
  // A user can only have one active Stripe subscription at a time. This unique constraint
  // ensures that a user cannot have multiple active Stripe subscriptions simultaneously.
  @@unique([ownerId, stripeSubscriptionId]) // This constraint is only valid if stripeSubscriptionId is not null      
  @@index([storagePlanId])
  @@index([status])
  @@index([createdAt])
  @@index([endedAt])
}
```

### Thumbnail

Source: `prisma/models/thumbnail.prisma`

```prisma
model Thumbnail {
  id        String        @id
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  width     Int?
  height    Int?
  /// Deprecated: `s3://` locator / legacy public URL / `#hex` placeholder in one
  /// column. Superseded by `bucket` + `stage` + `color`; dropped once reads move.
  url       String?
  /// Bucket holding `thumbnails/{itemId}.webp`. Server-set from the item's file
  /// bucket, never the writer's session. Null until a stage >= 2 is written.
  bucket    String?
  /// Stage-0 placeholder colour (`#hex`), formerly stored in `url`.
  color     String?
  content   Bytes?        @db.ByteA
  view      ViewType      @default(grid)
  size      ThumbnailSize @default(small)
  stage     Int           @default(0)
  itemId    String?
  item      Item?         @relation(fields: [itemId], references: [id], onDelete: Cascade)

  // Restored: added in 20260424160000, dropped as an unintended side effect of
  // 20260526182115. `createThumbnail`/`persistThumbnailStage` rely on it (P2002).
  @@unique([itemId, view, size])
}
```

### Trash

Source: `prisma/models/trash.prisma`

```prisma
/// One trash per drive, created the first time something in the drive is trashed.
model Trash {
  id        String      @id
  driveId   String      @unique
  drive     Drive       @relation(fields: [driveId], references: [id], onDelete: Cascade)
  updatedAt DateTime    @updatedAt @db.Timestamp()
  items     TrashItem[]
}
```

### TrashItem

Source: `prisma/models/trash.prisma`

```prisma
/// An item the user trashed directly. Its descendants only get
/// `Item.status = trashed`: they have no row here, are not listed in Trash,
/// and come back when this item is restored. A restore deletes the row; a
/// permanent delete removes it with the item.
model TrashItem {
  id          String   @id
  itemId      String   @unique
  item        Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  trashId     String
  trash       Trash    @relation(fields: [trashId], references: [id], onDelete: Cascade)
  /// When the user trashed it. Sorts Trash, and dates a future 30-day purge.
  trashedAt   DateTime @default(now()) @db.Timestamp()
  /// Who trashed it: the owner, or someone with write access to it.
  trashedById String?
  trashedBy   User?    @relation(fields: [trashedById], references: [id], onDelete: SetNull)

  @@index([trashId, trashedAt])
}
```

### UploadAction

Source: `prisma/models/action.prisma`

```prisma
// Track the uploading of items, such as files.
model UploadAction {
  id       String      @id
  uploadId String // reference to the uploadId that return from s3 when starting an multuipart upload session. 
  action   ItemAction?
}
```

### User

Source: `prisma/models/user.prisma`

```prisma
model User {
  id               String   @id
  name             String   @db.VarChar(50)
  displayName      String?
  title            String? // Role / job title, shown as the sender's subtitle on invitations
  email            String   @unique
  image            String?
  emailVerified    Boolean
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  bucket           String   @default("default-bucket")
  driveId          String?  @unique // drive ID for the user
  subscriptionId   String?  @unique // Subscription ID for the user
  rootId           String?  @unique // Root folder ID for the user
  storagePlanId    String? // Storage plan ID for the user
  stripeCustomerId String?  @unique // Stripe customer ID

  // Monitoring and Auditing
  notifications Notification[]

  // Authentication and Authorization 
  permissions Permission[]
  accounts    Account[]
  sessions    Session[]

  // Memberships and Invitations
  workspaces    WorkspaceMember[]
  subscriptions Subscription[]

  // collaboration and sharing
  comments    Comment[]
  invitations Invitation[]

  // Data Management
  items       Item[]
  lockedItems LockedItem[]
  drive       Drive?
  favorites   Favorite[]
  pins        PinItem[]
  /// Items this user trashed directly.
  trashedItems TrashItem[]

  @@index([email])
  @@index([name])
  @@map("user")
}
```

### Verification

Source: `prisma/models/verification.prisma`

```prisma
model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?

  @@map("verification")
}
```

### VersionAction

Source: `prisma/models/action.prisma`

```prisma
model VersionAction {
  id         String      @id
  newVersion String
  action     ItemAction?
}
```

### Video

Source: `prisma/models/facet.prisma`

```prisma
model Video {
  id                    String  @id
  bitrate               Int?
  codec                 String?
  container             String?
  duration              Int?
  height                Int?
  width                 Int?
  audioBitsPerSample    Int?
  audioChannels         Int?
  audioFormat           String?
  audioSamplesPerSecond Int?
  frameRate             Float?
  fourCC                String?
  itemId                String  @unique
  item                  Item    @relation(fields: [itemId], references: [id], onDelete: Cascade)
}
```

### View

Source: `prisma/models/view.prisma`

```prisma
model View {
  id        String    @id @default(uuid())
  viewType  ViewType
  // Default is 'name' for sortBy; see ERD for details
  sortBy    SortBy    @default(name)
  sortOrder SortOrder
  folderId  String?   @unique
  folder    Folder?   @relation(fields: [folderId], references: [id], onDelete: Cascade)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@unique([folderId, viewType]) // A folder can only have one view of a specific type
  @@index([viewType])
  @@index([sortBy])
  @@index([folderId])
}
```

### Workspace

Source: `prisma/models/workspace.prisma`

```prisma
model Workspace {
  id          String   @id @unique
  name        String
  slug        String?  @unique
  description String?  @default("")
  default     Boolean? @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Storage plan details are optional because a workspace can exist without a storage plan (e.g., during creation or if the plan is removed).
  storagePlan   StoragePlan? @relation(fields: [storagePlanId], references: [id])
  storagePlanId String?

  items       Item[]
  invitations Invitation[]
  members     WorkspaceMember[]

  @@index([name])
  @@index([default])
  @@index([storagePlanId])
  @@index([slug])
}
```

### WorkspaceMember

Source: `prisma/models/workspace.prisma`

```prisma
model WorkspaceMember {
  id          String              @id
  role        WorkspaceMemberRole @default(member)
  memberId    String
  member      User                @relation(fields: [memberId], references: [id])
  workspaceId String
  workspace   Workspace           @relation(fields: [workspaceId], references: [id])

  @@unique([memberId, workspaceId])
  @@index([role])
}
```

## Enums

### BucketKind

Source: `prisma/models/action.prisma`

```prisma
enum BucketKind {
  emptied
}
```

### CollectionActionKind

Source: `prisma/models/action.prisma`

```prisma
enum CollectionActionKind {
  item_added
  item_removed
  emptied
}
```

### DriveType

Source: `prisma/models/drive.prisma`

```prisma
enum DriveType {
  personal
  business
}
```

### FavoriteKind

Source: `prisma/models/action.prisma`

```prisma
enum FavoriteKind {
  favorited
  unfavorited
}
```

### InvitationStatus

Source: `prisma/models/invitation.prisma`

```prisma
enum InvitationStatus {
  pending
  accepted
  rejected
  canceled
  expired
}
```

### ItemCategory

Source: `prisma/models/item.prisma`

```prisma
enum ItemCategory {
  video // video files (mp4, avi, etc.)
  audio // audio files (mp3, wav, etc.)
  image // image files (jpg, png, etc.)
  document // office documents (doc, docx, etc.)
  spreadsheet // spreadsheets and data files (xls, xlsx, etc.)
  presentation // office documents (ppt, pptx, etc.)
  text // plain text files (txt, md, json, etc.)
  pdf // PDF files (pdf)
  archive // compressed files (zip, tar, etc.)
  code // source code files (js, ts, cs, etc.)
  script // shell scripts (sh, bash, ps1, etc.)
  binaries // compiled files (exe, bin, app, dylib, dll, so, etc.)
  graphic // graphic files and 3D models (svg, obj, 3ds, ps, etc.)
  unknown // unknown or unsupported files
}
```

### ItemStatus

Source: `prisma/models/item.prisma`

```prisma
enum ItemStatus {
  normal
  archived
  trashed
  locked
  shared
}
```

### ItemType

Source: `prisma/models/item.prisma`

```prisma
enum ItemType {
  folder
  file
  collection
}
```

### NotificationKind

Source: `prisma/models/notification.prisma`

```prisma
// Subject/event a notification is about — selects the row's glyph.
enum NotificationKind {
  system
  share
  upload
  file
  storage
  invitation
  member
  workspace
  collection
  favorite
  pin
  comment
  lock
}
```

### NotificationStatus

Source: `prisma/models/notification.prisma`

```prisma
enum NotificationStatus {
  read
  unread
}
```

### NotificationType

Source: `prisma/models/notification.prisma`

```prisma
enum NotificationType {
  info
  warning
  error
  success
}
```

### ObjectType

Source: `prisma/models/action.prisma`

```prisma
enum ObjectType {
  file
  folder
}
```

### PermissionRole

Source: `prisma/models/permission.prisma`

```prisma
enum PermissionRole {
  owner
  read
  write
}
```

### PinKind

Source: `prisma/models/action.prisma`

```prisma
enum PinKind {
  pinned
  unpinned
  reordered
}
```

### QuotaStatus

Source: `prisma/models/quota.prisma`

```prisma
enum QuotaStatus {
  normal // The drive has plenty of remaining quota left.
  warning // Remaining quota is less than 10% of total quota space.
  critical // Remaining quota is less than 1% of total quota space.
  exceeded // The used quota has exceeded the total quota. New files or folders cannot be added to the drive until it is under the total quota amount or more storage space is purchased.
}
```

### ShareLinkType

Source: `prisma/models/share.prisma`

```prisma
// Some how need to represent s3 presign urls permissions ( get-view / downloadable, put - upload,  ?? - edit  ) 
enum ShareLinkType {
  view // can't modify - read only
  edit // can modify content - write ( limited ), e.g ( if associated with folder - can add files / remove only files that was uploaded by him ( owner ), if associated with a file - can update it's content ), can't modify permissions / itm settings, more limits can be applied by ShareLink configuration ( e.g if downloadable = false, can't download the item )  
  embed // currently i don't know what to do with that type...
  upload // folder specific type - files can only be added
}
```

### ShareScope

Source: `prisma/models/share.prisma`

```prisma
enum ShareScope {
  anonymous // public
  organization // workspace, will be rename in the future to workspace, only members in that workspace
  users // specific users
}
```

### SortBy

Source: `prisma/models/view.prisma`

```prisma
enum SortBy {
  id
  name
  date
  size
  type
}
```

### SortOrder

Source: `prisma/models/view.prisma`

```prisma
enum SortOrder {
  ascending
  descending
}
```

### StoragePlanType

Source: `prisma/models/storage.prisma`

```prisma
enum StoragePlanType {
  free // 10 GB storage space.
  basic // 100 GB storage space.
  standard // 200 GB storage space.
  premium // 2 TB storage space.
  custom // For custom plans not fitting predefined types
}
```

### SubscriptionStatus

Source: `prisma/models/subscription.prisma`

```prisma
// Enum for subscription status, map to Stripe's subscription statuses
enum SubscriptionStatus {
  active
  canceled
  incomplete
  incomplete_expired
  past_due
  trialing
  unpaid
}
```

### ThumbnailSize

Source: `prisma/models/thumbnail.prisma`

```prisma
enum ThumbnailSize {
  small // e.g., 256x256
  medium // e.g., 512x512
  large // e.g., 1024x1024
  original // e.g., original size
  custom // The custom size is used when the thumbnail is generated with specific dimensions not matching the predefined sizes.
}
```

### ViewType

Source: `prisma/models/view.prisma`

```prisma
enum ViewType {
  list
  grid // Default, square base image ( e.g aspect ratio 16:9  / 4:3 )
  river // height base image ( e.g row )
  waterfall // width base image ( e.g column )
}
```

### WorkspaceMemberRole

Source: `prisma/models/workspace.prisma`

```prisma
enum WorkspaceMemberRole {
  viewer
  member
  admin
  owner
}
```

## Appendix: generator and datasource

Source: `prisma/models/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../../app/prisma"

  moduleFormat           = "esm"
  generatedFileExtension = "ts"
  previewFeatures        = ["nativeDistinct", "relationJoins", "postgresqlExtensions", "partialIndexes"]
}

datasource db {
  provider   = "postgresql"
  extensions = [vector, pg_trgm]
}
```
