# 🎨 Suggestions View - Visual Component Diagram

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Home Route                               │
│                  (app/routes/home.tsx)                      │
│                                                             │
│  • Authenticates user (better-auth)                        │
│  • Fetches user's drive                                    │
│  • Calls getSuggestedItems()                               │
│  • Renders SuggestionsView                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─────────────────────┐
                 ▼                     ▼
    ┌─────────────────────┐   ┌──────────────────────┐
    │ getSuggestedItems() │   │  SuggestionsView     │
    │ (optimized SQL)     │   │  (React component)   │
    │                     │   │                      │
    │ Single Query:       │   │ • Split layout       │
    │ • JOINs all tables  │   │ • Folder grid (top)  │
    │ • json_agg() for    │   │ • File grid (bottom) │
    │   relations         │   │ • Animations         │
    │ • Includes all data │   │ • Empty state        │
    │   in one trip       │   │                      │
    └─────────────────────┘   └──────────────────────┘
                 │                     │
                 │                     ▼
                 │          ┌────────────────────┐
                 │          │   ItemCard         │
                 │          │ (existing component)│
                 │          │                    │
                 │          │ • Thumbnail        │
                 │          │ • Name             │
                 │          │ • Size/Count       │
                 │          │ • Favorite button  │
                 │          │ • Action menu      │
                 │          └────────────────────┘
                 │                     │
                 ▼                     ▼
            ┌──────────┐          ┌──────────┐
            │PostgreSQL│          │ TailwindCSS
            │ Database │          │ + Framer Motion
            └──────────┘          └──────────┘
```

## Data Flow Diagram

```
                User logs in → /<userId>/stash
                User visits /<userId>/stash/home
                          │
                          ▼
         ┌─────────────────────────────────┐
         │  Home Route Loader (Server)     │
         │  (React Router v7 Framework)    │
         │                                 │
         │ 1. Get userId, driveId,        │
         │    rootId from session.user    │
         │ 2. Call getSuggestedItems()    │
         └──────────┬──────────────────────┘
                           │
                           ▼
     ┌───────────────────────────────────────────────┐
     │   getSuggestedItems() - Single SQL Query     │
     │   (Runs on Server - Loader context)         │
     │                                               │
     │   SELECT i.*, f.*, fo.*, u.*, t.*            │
     │   FROM Item i                                 │
     │   LEFT JOIN File f ON i.id = f.itemId        │
     │   LEFT JOIN Folder fo ON i.id = fo.itemId    │
     │   LEFT JOIN Favorite fav ON i.id = fav.itemId│
     │   LEFT JOIN User u ON fav.favoritedById = u.id
     │   LEFT JOIN Thumbnail t ON i.id = t.itemId   │
     │   WHERE userId, driveId, rootId, status      │
     │   GROUP BY i.id, f.id, fo.id                 │
     │   ORDER BY updatedAt DESC, openedAt DESC     │
     │                                               │
     │   Using json_agg() to aggregate:             │
     │   - favorites (with user details)            │
     │   - thumbnails                               │
     │                                               │
     │   Returns all data in ONE database trip      │
     └──────────┬───────────────────────────────────┘
                │
         (Server-side filtering)
                │
                ├─── Filter folders (type='folder') ─┐
                │                                    │
                └─── Filter files (type='file') ────┐
                │                                   │
                ▼                                   ▼
          ┌──────────────┐                  ┌──────────────┐
          │ Suggested    │                  │ Suggested    │
          │ Folders[]    │                  │ Files[]      │
          │ (max 6)      │                  │ (max 50)     │
          └──────────┬───┘                  └──────────┬───┘
                     │                                 │
                     └─────────────────┬───────────────┘
                                       │
                        ┌──────────────────────────────┐
                        │  Filtered Data Sent to       │
                        │  Client (Already filtered)   │
                        │  - suggestedFolders[]        │
                        │  - suggestedFiles[]          │
                        └──────────┬───────────────────┘
                                   │
                                   ▼
                         ┌──────────────────────────┐
                         │  SuggestionsView         │
                         │  (React Component)       │
                         │                          │
                         │  Renders both grids      │
                         │  with ItemCard components│
                         └──────────────────────────┘
```
        ┌──────────────┴──────────────┐
        ▼                             ▼
    [Folders]                    [Files]
    • Max 6                       • Max 50
    • Sorted                      • Sorted
    • With relations              • With relations
        │                             │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌───────────────────────────────┐
        │  Home Component               │
        │  { suggestedFolders,          │
        │    suggestedFiles }           │
        └──────────────┬────────────────┘
                       │
                       ▼
        ┌───────────────────────────────┐
        │   SuggestionsView             │
        │                               │
        │  Section 1: Folders           │
        │  ┌─────────────────────────┐  │
        │  │ SuggestionsGridLayout    │  │
        │  │ ┌─────┬─────┬─────────┐ │  │
        │  │ │Item │Item │Item Item│ │  │
        │  │ │Card │Card │Card Card│ │  │
        │  │ └─────┴─────┴─────────┘ │  │
        │  └─────────────────────────┘  │
        │                               │
        │  Section 2: Files             │
        │  ┌─────────────────────────┐  │
        │  │ SuggestionsGridLayout    │  │
        │  │ ┌───┬───┬───┬───┬───┐   │  │
        │  │ │I  │I  │I  │I  │I  │...  │  │
        │  │ │C  │C  │C  │C  │C  │   │  │
        │  │ └───┴───┴───┴───┴───┘   │  │
        │  └─────────────────────────┘  │
        └───────────────────────────────┘
```

## Grid Responsive Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Mobile (1 column)                                               │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ItemCard                                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ItemCard                                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ItemCard                                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Tablet (2-3 columns)                                            │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│ │ ItemCard         │ │ ItemCard         │ │ ItemCard         │ │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│ ┌──────────────────┐ ┌──────────────────┐                       │
│ │ ItemCard         │ │ ItemCard         │                       │
│ └──────────────────┘ └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Desktop (4-6 columns)                                           │
├─────────────────────────────────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                     │
│ │I.C │ │I.C │ │I.C │ │I.C │ │I.C │ │I.C │                     │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                     │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                             │
│ │I.C │ │I.C │ │I.C │ │I.C │ │I.C │                             │
│ └────┘ └────┘ └────┘ └────┘ └────┘                             │
│ ┌────┐ ┌────┐                                                   │
│ │I.C │ │I.C │                                                   │
│ └────┘ └────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Item Card Layout

```
┌──────────────────────────┐
│      ItemCard Header      │  ← Favorite + Actions
├──────────────────────────┤
│                          │
│      THUMBNAIL/ICON      │
│                          │
│      Item Name.ext       │
├──────────────────────────┤
│   Size: 2.5 MB    Count: 5│  ← Footer info
└──────────────────────────┘
```

## Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│                     Stashly Home                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Suggested Folders                                          │
│  Recently accessed and modified folders                     │
│                                                             │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │    │ │    │ │    │ │    │ │    │ │    │               │
│  │    │ │    │ │    │ │    │ │    │ │    │               │
│  │    │ │    │ │    │ │    │ │    │ │    │               │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘               │
│  (Max 6 folders)                                           │
│                                                             │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  Suggested Files                                            │
│  Recently accessed and modified files                       │
│                                                             │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│  │    │ │    │ │    │ │    │ │    │ │    │ │    │       │
│  │    │ │    │ │    │ │    │ │    │ │    │ │    │       │
│  │    │ │    │ │    │ │    │ │    │ │    │ │    │       │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                     │
│  │    │ │    │ │    │ │    │ │    │                     │
│  │    │ │    │ │    │ │    │ │    │                     │
│  │    │ │    │ │    │ │    │ │    │                     │
│  └────┘ └────┘ └────┘ └────┘ └────┘                     │
│  ... (up to 50 files)                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Type Relationships

```
ItemCardProps
├── id: string
├── name: string
├── type: 'file' | 'folder'
├── category: ItemCategory enum
├── status: ItemStatus enum
├── size: bigint
├── inclusiveSize: bigint
├── createdAt: Date
├── updatedAt: Date
├── ownerId: string
├── workspaceId: string | null
├── parentId: string | null
├── file: File | null
├── folder: Folder | null
├── favorites: Favorite[]
├── thumbnails: Thumbnail[]
└── tags: string[]

SuggestedItemsParams
├── userId: string
├── driveId: string
├── workspaceId?: string
├── maxFolders?: number (default: 6)
└── maxFiles?: number (default: 50)

SuggestionsViewProps
├── suggestedFolders: Item[]
├── suggestedFiles: Item[]
└── className?: string
```

## Database Query Structure

```
Folder Query:
  ├─ WHERE
  │  ├─ type = 'folder'
  │  ├─ status = 'normal'
  │  ├─ ownerId = userId
  │  └─ driveId = driveId
  ├─ ORDER BY
  │  ├─ updatedAt DESC (primary)
  │  └─ createdAt DESC (secondary)
  ├─ TAKE 6 (configurable)
  └─ INCLUDE
     ├─ favorites { favoritedBy }
     ├─ file
     ├─ folder
     └─ thumbnails

File Query:
  ├─ WHERE
  │  ├─ type = 'file'
  │  ├─ status = 'normal'
  │  ├─ ownerId = userId
  │  └─ driveId = driveId
  ├─ ORDER BY
  │  ├─ updatedAt DESC (primary)
  │  └─ createdAt DESC (secondary)
  ├─ TAKE 50 (configurable)
  └─ INCLUDE
     ├─ favorites { favoritedBy }
     ├─ file
     ├─ folder
     └─ thumbnails
```

## Sorting Logic

```
Recently Modified Items (updated today):
  └─ updatedAt = 2026-01-11 15:30:00
     ↓
Items with recent edits, locks, or favorites

Fallback: Recently Created Items:
  └─ createdAt = 2026-01-10 10:00:00
     ↓
New items that haven't been modified yet
```

## File Relationships

```
home.tsx (route)
    │
    ├─ imports ─→ getSuggestedItems()
    │                  │
    │                  └─ queries Prisma
    │
    └─ renders ─→ SuggestionsView
                       │
                       ├─ uses ─→ ItemCard
                       │
                       └─ imports ─→ itemVariants (animations)
```

## Error Handling Flow

```
User visits /home
    │
    ├─ Auth check
    │  ├─ ✓ Pass → Continue
    │  └─ ✗ Fail → Redirect to signin
    │
    ├─ Fetch user drive
    │  ├─ ✓ Success → Continue
    │  └─ ✗ Fail → Error page
    │
    ├─ Get suggestions
    │  ├─ ✓ Success → Render view
    │  └─ ✗ Fail → Return empty arrays
    │
    └─ Render component
       ├─ ✓ Data present → Show grids
       └─ ✗ No data → Show empty state
```

---

**Visual Guide Complete!**
Use these diagrams to understand the component architecture, data flow, and visual layout.
