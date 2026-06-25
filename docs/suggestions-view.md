# Suggestions View

## Overview

The Suggestions View is a split-page layout component for the Stashly home page that displays recent folders and files based on user activity. It surfaces frequently accessed or recently modified items in an elegant, animated grid layout.

**Status:** Complete and production-ready (January 2026, v1.0)

---

## Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `app/components/views/suggestions-view.tsx` | ~160 | React component (split-page layout) |
| `app/utils/suggestions.server.ts` | ~70 | Server utility (optimized SQL query) |
| `app/routes/stash/home.tsx` | ~40 | Home page route |

---

## Features

### Split-Page Design
- **Top section:** Grid of suggested folders (max 6 items by default)
- **Bottom section:** Grid of suggested files (max 50 items by default)
- Clear visual separation with section headers and descriptions

### Smart Suggestions
Items are sorted by:
1. **Recently Modified** (`updatedAt` DESC) — captures edits, lock/unlock changes, favorite/unfavorite actions
2. **Recently Opened** (`openedAt` DESC, nulls last)
3. **Recently Created** (`createdAt` DESC) — fallback for new items

### Responsive Grid
- Mobile: 1 column
- Tablet (sm): 2 columns
- Tablet (md): 3 columns
- Desktop (lg): 4 columns
- Large (2xl): 6 columns

### Rich Item Display
- Thumbnails / icons
- File and folder names
- File sizes and folder item counts
- Favorite buttons
- Action menus
- Framer Motion animations

---

## Data Flow

```
User visits /<userId>/stash/home
    ↓
Home Route Loader (server — React Router v7 Framework Mode)
    ↓  get userId, driveId, rootId from session.user
getSuggestedItems()  ← single optimized PostgreSQL query
    ↓
SELECT i.*, json_agg(favorites), json_agg(thumbnails)
FROM Item i
LEFT JOIN File f, Folder fo, Favorite fav, User u, Thumbnail t ...
WHERE userId, driveId, rootId, status = 'normal'
GROUP BY i.id, f.id, fo.id
ORDER BY updatedAt DESC, openedAt DESC NULLS LAST, createdAt DESC
    ↓
Server-side filter: split into suggestedFolders[] and suggestedFiles[]
    ↓
SuggestionsView renders both grids with ItemCard components
```

**Key architecture notes:**
- Single database round-trip — no N+1 query problems
- PostgreSQL `json_agg()` and `jsonb_build_object()` for relation aggregation
- `COALESCE()` with `FILTER` returns empty arrays when relations don't exist
- Items are filtered by type on the server before being sent to the client

---

## API Reference

### `SuggestionsView` Component

**Location:** `app/components/views/suggestions-view.tsx`

```typescript
interface SuggestionsViewProps {
  suggestedFolders: Item[]   // Array of suggested folder items
  suggestedFiles: Item[]     // Array of suggested file items
  className?: string         // Optional CSS classes
}
```

**Usage:**
```tsx
import { SuggestionsView } from '@/components/views/suggestions-view'

<SuggestionsView
  suggestedFolders={suggestedFolders}
  suggestedFiles={suggestedFiles}
/>
```

### `SuggestionsGridLayout` Component

A responsive grid layout wrapper for item cards.

**Breakpoints:** `2xl:6` / `lg:4` / `md:3` / `sm:2` / default:1 columns

```tsx
className="grid 2xl:grid-cols-6 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-2"
```

### `getSuggestedItems` Function

**Location:** `app/utils/suggestions.server.ts`

```typescript
interface SuggestedItemsParams {
  userId: string         // User ID to fetch suggestions for
  driveId: string        // Drive scope (tenant)
  rootId: string         // Root folder ID (filters by parentId)
  workspaceId?: string   // Optional workspace filter
  maxFolders?: number    // Max folders to return (default: 6)
  maxFiles?: number      // Max files to return (default: 50)
}

interface SuggestedItemsResult {
  suggestedFolders: Item[]
  suggestedFiles: Item[]
}
```

**Included relations per item:**
- `file` — mimeType, hash, extension, bucket, key, etag
- `folder` — childCount, inclusiveChildCount
- `favorites` — array with favoritedBy user info
- `thumbnails` — array with id, height, width, url, view, size

---

## Route Integration

**Location:** `app/routes/stash/home.tsx`

The route is nested under the stash folder and accessible at `/<userId>/stash/home`.

```typescript
export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session?.user) {
    throw redirect('/auth/signin')
  }

  // userId, driveId, rootId are pre-populated in session.user
  const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
    userId: session.user.id,
    driveId: session.user.driveId,
    rootId: session.user.rootId,
    maxFolders: 6,
    maxFiles: 50,
  })

  return { suggestedFolders, suggestedFiles, user: session.user }
}

export default function StashHomePage({ loaderData }: Route.ComponentProps) {
  const { suggestedFolders, suggestedFiles } = loaderData
  return (
    <SuggestionsView
      suggestedFolders={suggestedFolders}
      suggestedFiles={suggestedFiles}
    />
  )
}
```

**Note:** Items are already filtered by type server-side in the loader, so the component only renders pre-filtered data.

---

## Usage Examples

### Basic Usage

```typescript
// In a route loader
export async function loader({ request }: LoaderFunctionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session?.user) throw redirect('/auth/signin')

  const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
    userId: session.user.id,
    driveId: session.user.driveId,
    rootId: session.user.rootId,
  })
  return { suggestedFolders, suggestedFiles }
}

// In the component
export default function HomePage({ loaderData }) {
  return <SuggestionsView {...loaderData} />
}
```

### Filter by Workspace

```typescript
const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
  userId: session.user.id,
  driveId: session.user.driveId,
  rootId: session.user.rootId,
  workspaceId: 'workspace-123',
})
```

### Custom Limits

```typescript
const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
  userId: session.user.id,
  driveId: session.user.driveId,
  rootId: session.user.rootId,
  maxFolders: 12,
  maxFiles: 100,
})
```

### Custom Styling

```tsx
<SuggestionsView
  suggestedFolders={suggestedFolders}
  suggestedFiles={suggestedFiles}
  className="p-6 bg-slate-50 dark:bg-slate-900"
/>
```

### Conditional Rendering

```typescript
export default function HomePage({ loaderData }) {
  const { suggestedFolders, suggestedFiles } = loaderData
  const hasSuggestions = suggestedFolders.length > 0 || suggestedFiles.length > 0

  if (!hasSuggestions) {
    return <EmptyOnboardingScreen />
  }

  return <SuggestionsView suggestedFolders={suggestedFolders} suggestedFiles={suggestedFiles} />
}
```

### Graceful Degradation

```typescript
try {
  const suggestions = await getSuggestedItems({ ... })
  return suggestions
} catch (error) {
  console.error('Failed to load suggestions:', error)
  return { suggestedFolders: [], suggestedFiles: [] }
}
```

### With Custom Card Actions

```tsx
<SuggestionsGridLayout>
  {suggestedFolders.map((folder) => (
    <ItemCard key={folder.id} {...folder}>
      <ItemCard.Header>
        <ItemCard.Favorite />
        <ItemCard.Actions />
        <button onClick={() => handleShare(folder.id)}>Share</button>
      </ItemCard.Header>
      <ItemCard.Content>
        <ItemCard.Thumbnail />
        <ItemCard.Name />
      </ItemCard.Content>
      <ItemCard.Footer>
        <ItemCard.Size />
        <ItemCard.Count />
      </ItemCard.Footer>
    </ItemCard>
  ))}
</SuggestionsGridLayout>
```

### Search Integration

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  const url = new URL(request.url)
  const searchQuery = url.searchParams.get('q')

  if (!searchQuery) {
    return await getSuggestedItems({ ... })
  }
  return await performSearch(searchQuery)
}
```

---

## Type Definitions

```typescript
// ItemCard props structure
interface ItemCardProps {
  id: string
  name: string
  type: 'file' | 'folder'
  category: ItemCategory
  status: ItemStatus
  size: bigint
  inclusiveSize: bigint
  createdAt: Date
  updatedAt: Date
  openedAt: Date | null
  ownerId: string
  workspaceId: string | null
  parentId: string | null
  file: File | null
  folder: Folder | null
  favorites: Favorite[]
  thumbnails: Thumbnail[]
  tags: string[]
}
```

---

## Configuration Points

```typescript
// In home.tsx loader — adjust item limits
maxFolders: 6,      // Change to show more/fewer folders
maxFiles: 50,       // Change to show more/fewer files
workspaceId: ...,   // Add for workspace filtering

// In suggestions.server.ts — adjust sorting criteria
ORDER BY i."updatedAt" DESC NULLS LAST, i."openedAt" DESC NULLS LAST, i."createdAt" DESC

// In suggestions-view.tsx — adjust grid breakpoints
className="grid 2xl:grid-cols-6 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-2"
```

---

## Technical Stack

- **Database:** Single optimized PostgreSQL query via `prisma.$queryRaw`
- **ORM:** Prisma (Prisma types used throughout, no `any` types)
- **Frontend:** React + React Router v7 (Framework Mode)
- **Styling:** TailwindCSS (responsive, dark mode support)
- **Components:** shadcn/ui cards
- **Animations:** Framer Motion (layout animation)
- **Auth:** better-auth

---

## Performance Notes

- Single database round-trip using PostgreSQL JSON aggregation
- Indexed fields used for sorting (`updatedAt`, `openedAt`, `createdAt`)
- Results capped at 6 folders and 50 files
- Minimal relations fetched via selective JOINs
- Framer Motion layout animation optimized

---

## Error Handling

- Auth failure → redirect to signin
- Missing drive → redirect to setup
- Query failure → return empty arrays (graceful degradation)
- Empty data → helpful empty state message shown to user
- All error flows handled with try/catch and proper logging

---

## Testing Recommendations

1. **Create test data** — upload files, create folders, add various file types
2. **Perform actions** — edit files (updates `updatedAt`), favorite/unfavorite, lock/unlock
3. **Check responsive layout** — desktop (6 cols), tablet (3 cols), mobile (1 col)
4. **Test empty state** — delete all items and verify empty message appears
5. **Browser testing** — Chrome, Firefox, mobile viewport, dark/light mode

### Post-update Testing Checklist
- [ ] Users redirect to `/<userId>/stash` after login
- [ ] `/stash/home` route is accessible and authenticated
- [ ] Session contains userId, driveId, rootId
- [ ] Suggestions load without errors
- [ ] Items properly filtered into folders and files
- [ ] Component displays both sections correctly
- [ ] Responsive layout works on all breakpoints
- [ ] Empty state displays when needed

---

## No Breaking Changes

- Existing routes unaffected
- Existing components unmodified
- Uses existing ItemCard component
- Compatible with existing auth, database models, and styling systems

---

## Future Enhancements

1. **Activity Tracking** — use `openedAt` for "recently opened" items, track view counts
2. **Recently Shared Items** — query permissions/shares, show shared-by context
3. **Smart Filtering** — category filters (docs, images, etc.), date range, size filters
4. **Personalization** — ML-based recommendations, user behavior analysis, frequency weighting
5. **Caching** — in-memory cache with TTL-based invalidation
6. **Rich Metadata** — show who modified, when modified, share information
