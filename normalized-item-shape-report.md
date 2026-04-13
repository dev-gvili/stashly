# Normalized Item Shape — Analysis Report

## 1. Current State: What Shapes Exist

There are currently **4 distinct item shapes** spread across the codebase with no shared base:

---

### Shape A — Full Prisma Item (`ItemCardProps`)

Used by: `ListLayout`, `SuggestionsView`, `ItemCard`, folder/all/trash/suggestions routes

```typescript
{
  id: string
  name: string
  type: ItemType                  // 'file' | 'folder' | 'collection'
  category: ItemCategory
  status: ItemStatus
  size: bigint
  inclusiveSize: bigint
  createdAt: Date | string | null
  updatedAt: Date | string | null
  parentId: string | null
  ownerId: string
  workspaceId: string | null
  driveId: string
  tags: string[]
  thumbnails: Array<{             // RAW ARRAY — view-specific picking done by consumer
    id: string
    url: string | null
    width: number | null
    height: number | null
    size: ThumbnailSize
    view: ViewType
  }>
  favorites: Array<{
    id: string
    favoritedBy: { id, name, displayName, image }
  }>
  file: File | null               // { mimeType, extension, hash, bucket, key, etag, itemId }
  folder: Folder | null           // { id, childCount, inclusiveChildCount, itemId }
}
```

---

### Shape B — Image Media (`ImageData`)

Used by: `RiverView`, `WaterfallLayout`, gallery route (after transform)

```typescript
{
  id: string
  src: string       // pre-resolved thumbnail URL
  alt: string | null
  width: number
  height: number
  srcSet: string    // computed responsive srcSet
  sizes: string     // computed CSS sizes attribute
}
```

---

### Shape C — Collection With Relations (`CollectionWithRelations`)

Used by: `CollectionsView`, `CollectionCard`, collections route

```typescript
Prisma.CollectionGetPayload<{ include: { item: true; items: true } }>
// Resolves to:
{
  id: string
  name: string
  size: bigint
  item: Item                    // full Item Prisma record (NEVER accessed in JSX)
  items: CollectionItem[]       // junction records — only .length is used
}
```

---

### Shape D — Lightweight Picker (`AddToCollectionItem`)

Used by: `AddToCollectionDialog`, collection route (availableItems)

```typescript
Pick<Item, 'id' | 'name' | 'type' | 'category' | 'size' | 'createdAt'> & {
  thumbnailUrl?: string | null    // PRE-COMPUTED — unlike Shape A which passes thumbnails[]
}
```

---

## 2. The Problems

| # | Problem | Impact |
|---|---------|--------|
| **1** | **Thumbnail inconsistency** | Shape A passes `thumbnails[]` (raw, consumer picks by view). Shape C has none. Shape D has `thumbnailUrl` (pre-computed). Gallery route transforms into `src + srcSet + sizes`. 3+ representations of the same data. |
| **2** | **CollectionCard is over-specified** | Receives `CollectionWithRelations` (full Collection + nested `item: Item` + `items: CollectionItem[]`) but only uses `id`, `name`, `size`, `items.length`. The `item: Item` relation is **never touched** in JSX. |
| **3** | **`ListLayout` uses a UI type as a data constraint** | `ListLayout<T extends ItemCardProps>` — a component props type is being used as the type constraint for data. The two concerns are entangled. |
| **4** | **No single source of truth type** | Types live scattered: inside component files (`ItemCardProps` in item-card.tsx), inlined as Prisma payloads (`SuggestionsViewProps`), and as ad-hoc `Pick<>` in the collection route. |
| **5** | **Routes are inconsistent** | `folder.tsx` returns `thumbnails[]`. `collection.tsx` computes `thumbnailUrl`. `gallery.tsx` transforms to `src/srcSet/sizes`. No agreement on what the view layer should receive. |
| **6** | **`driveId` / `ownerId` travel to every component** | These are infrastructure fields needed for permissions, not display. They're in `ItemCardProps` and required, meaning every component that receives an item carries them even if unused. |

---

## 3. What Components Actually Use (vs what they receive)

| Component | Receives | Actually Uses |
|-----------|----------|---------------|
| `ItemCard` | 18+ fields | `id`, `name`, `type`, `category`, `status`, `size`, `file.extension`, `folder.childCount`, `favorites`, `parentId` |
| `CollectionCard` | Full `CollectionWithRelations` | `id`, `name`, `size`, `items.length` only |
| `AddToCollectionDialog` | `AddToCollectionItem` (6 fields + thumbnailUrl) | `id`, `name`, `type`, `category`, `size`, `createdAt`, `thumbnailUrl` |
| `RiverView` / `WaterfallLayout` | `ImageData` | `src`, `srcSet`, `sizes`, `alt`, `width`, `height`, `id` |
| `CollectionsView` | `CollectionWithRelations[]` | passes to `CollectionCard` as-is |
| `SuggestionsView` | Full Prisma payload (inline type) | passes to `ItemCard` + `ListLayout` as-is |

---

## 4. Proposed Normalized Shape

### Core types (all live in `app/types/stash.types.ts`)

```typescript
// ─── Shared primitives ───────────────────────────────────────────────────────

type StashThumbnail = {
  id: string
  url: string | null
  width: number | null
  height: number | null
  size: ThumbnailSize   // 'small' | 'medium' | 'large' | 'original' | 'custom'
  view: ViewType        // 'list' | 'grid' | 'river' | 'waterfall'
}

type StashFavorite = {
  id: string
  favoritedBy: {
    id: string
    name: string
    displayName: string | null
    image: string | null
  }
}

type StashFileInfo = {
  mimeType: string | null
  extension: string | null
  hash: string | null
  bucket: string
  key: string
}

type StashFolderInfo = {
  childCount: number | null
  inclusiveChildCount: number
}

// ─── Base item (replaces ItemCardProps as the data shape) ────────────────────

interface StashItem {
  id: string
  name: string
  type: ItemType            // 'file' | 'folder' | 'collection'
  category: ItemCategory
  status: ItemStatus

  size: bigint
  inclusiveSize: bigint

  createdAt: Date | string | null
  updatedAt: Date | string | null

  parentId: string | null
  ownerId: string
  workspaceId: string | null
  driveId: string

  tags: string[]

  // Thumbnails: raw array for view-specific resolution...
  thumbnails: StashThumbnail[]
  // ...AND pre-computed convenience field for components that don't need to pick
  thumbnailUrl: string | null

  favorites: StashFavorite[]

  file: StashFileInfo | null    // populated when type === 'file'
  folder: StashFolderInfo | null // populated when type === 'folder'
}

// ─── Collection card shape (replaces CollectionWithRelations) ─────────────────

interface StashCollection {
  id: string
  name: string
  size: bigint
  itemCount: number             // replaces items.length — no full array needed
  createdAt: Date | string | null
  thumbnailUrl: string | null   // derived at service layer from collection items
}

// ─── Lightweight picker shape (replaces AddToCollectionItem) ─────────────────

type StashPickerItem = Pick<
  StashItem,
  'id' | 'name' | 'type' | 'category' | 'size' | 'createdAt' | 'thumbnailUrl'
>

// ─── Image media shape (stays as-is — rendering artifact, not data) ───────────

interface StashImageMedia {
  id: string
  src: string
  alt: string | null
  width: number
  height: number
  srcSet: string
  sizes: string
}
```

---

### How component props change

```typescript
// ItemCard — props extend StashItem, add UI-only props
interface ItemCardProps extends StashItem {
  asChild?: boolean
  children?: React.ReactNode
  className?: string
}

// ListLayout — constraint becomes StashItem, not ItemCardProps
type ListViewProps<T extends StashItem> = { items: T[] }

// CollectionCard — receives slim StashCollection, not bloated Prisma payload
interface CollectionCardProps {
  collection: StashCollection
}

// CollectionsView — receives StashCollection[], not CollectionWithRelations[]
interface CollectionsViewProps {
  collections: StashCollection[]
}

// AddToCollectionDialog — items type becomes StashPickerItem[]
interface AddToCollectionDialogProps {
  items: StashPickerItem[]
  // ... rest unchanged
}

// SuggestionsView — both arrays become StashItem[]
interface SuggestionsViewProps {
  suggestedFolders: StashItem[]
  suggestedFiles: StashItem[]
}
```

---

### What routes need to change at the service layer

| Route | Current | After normalization |
|-------|---------|---------------------|
| `folder`, `all`, `trash` | Return `thumbnails[]`, no `thumbnailUrl` | Compute `thumbnailUrl` at service layer based on layout |
| `collections` | Return `CollectionWithRelations[]` | Return `StashCollection[]` (count items, pick thumbnailUrl from items) |
| `collection` | Return `items: Item[]` + `availableItems: AddToCollectionItem[]` | `items: StashItem[]` + `availableItems: StashPickerItem[]` |
| `gallery` | Transform to `GalleryImage` (id, src, srcSet...) | Keep as `StashImageMedia[]` — rename only |
| `suggestions` | Return full Prisma payload inline type | Return `StashItem[]` for both arrays |

---

## 5. What Stays Separate (intentional)

**`StashImageMedia`** (river, waterfall, gallery) stays distinct from `StashItem`. These are rendering artifacts — pre-computed for pixel-perfect layout. The gallery route's transformation logic (`buildSrcSet`, justified row math) is correct and should stay. Only rename `ImageData` → `StashImageMedia` for consistency.

---

## 6. Summary of Gains

| Problem | Fix |
|---------|-----|
| 3 thumbnail representations | `StashItem` carries both `thumbnails[]` and `thumbnailUrl`. Routes compute `thumbnailUrl` once. |
| `CollectionWithRelations` bloat | `StashCollection` has only 5 fields: id, name, size, itemCount, thumbnailUrl |
| UI type used as data constraint | `StashItem` is the data type; `ItemCardProps extends StashItem` adds UI props |
| `AddToCollectionItem` ad-hoc type | `StashPickerItem = Pick<StashItem, ...>` — derived, not invented |
| Types scattered in component files | All in `app/types/stash.types.ts` |
| No shared base | Every component accepts `StashItem` or a type that extends/picks from it |

---

Ready for your review. Once you approve the shape, I can implement it — the order of attack would be: define types → update service layer (add `thumbnailUrl` computation, slim collections) → update component props → update routes.
