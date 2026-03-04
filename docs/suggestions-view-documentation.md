# Suggestions View Documentation

## Overview

The Suggestions View is a split-page layout component designed to display suggested files and folders to users based on recent activity. It provides a visually appealing and organized way to surface frequently accessed or recently modified items.

## Components

### 1. `SuggestionsView` Component
**Location:** `app/components/views/suggestions-view.tsx`

A responsive split-page view that displays:
- **Top Section:** Grid of suggested folders (max 6 items)
- **Bottom Section:** Grid of suggested files (max 50 items)

#### Features
- Responsive grid layout (adapts from 1 to 6 columns based on screen size)
- Framer Motion animations for smooth item transitions
- Section headers with descriptions
- Empty state handling when no suggestions are available
- Favorite and action buttons on each item card

#### Props
```typescript
interface SuggestionsViewProps {
  suggestedFolders: Item[]    // Array of suggested folder items
  suggestedFiles: Item[]       // Array of suggested file items
  className?: string           // Optional CSS classes
}
```

#### Usage
```tsx
import { SuggestionsView } from '@/components/views/suggestions-view'

<SuggestionsView 
  suggestedFolders={folders}
  suggestedFiles={files}
/>
```

### 2. `SuggestionsGridLayout` Component
A responsive grid layout component that wraps children in a responsive grid.

#### Breakpoints
- `2xl`: 6 columns
- `lg`: 4 columns
- `md`: 3 columns
- `sm`: 2 columns
- Default: 1 column

## Server-Side Utilities

### `getSuggestedItems` Function
**Location:** `app/utils/suggestions.server.ts`

Fetches suggested items using a single optimized PostgreSQL query with JSON aggregation.

#### Query Architecture
The function uses `prisma.$queryRaw` to execute a single SQL query that:
- JOINs Item with File, Folder, Favorite, User, and Thumbnail tables
- Uses `CASE` statements to conditionally include file/folder details
- Uses `json_agg()` to aggregate related records (favorites, thumbnails) into JSON arrays
- Groups by item and facet IDs to properly organize relations
- Returns all data in a single database round-trip (no N+1 queries)

**Key PostgreSQL Features:**
- `jsonb_build_object()` - Constructs JSON objects from columns
- `json_agg()` - Aggregates multiple rows into arrays
- `COALESCE()` with `FILTER` - Returns empty arrays when relations don't exist
- `LEFT JOIN` - Includes items even if relations are missing

#### Parameters
```typescript
interface SuggestedItemsParams {
  userId: string              // User ID to fetch suggestions for
  workspaceId?: string        // Optional workspace filter
  driveId: string             // Drive ID (tenant scope)
  rootId: string              // Root folder ID to filter by parentId
  maxFolders?: number         // Max folders to return (default: 6)
  maxFiles?: number           // Max files to return (default: 50)
}
```

#### Return Type
```typescript
interface SuggestedItemsResult {
  suggestedFolders: Item[]    // Array of suggested folders with all relations
  suggestedFiles: Item[]      // Array of suggested files with all relations
}
```

#### Sorting Criteria
Items are sorted by:
1. **Recently Modified** (`updatedAt` descending)
2. **Recently Opened** (`openedAt` descending, nulls last)
3. **Recently Created** (`createdAt` descending)

This captures:
- Recently edited items
- Recently locked/unlocked items
- Recently favorited/unfavorited items
- Recently opened items
- Recently created items

#### Example Usage
```typescript
const suggestions = await getSuggestedItems({
  userId: 'user-123',
  driveId: 'drive-456',
  rootId: 'root-folder-id',
  maxFolders: 6,
  maxFiles: 50,
})
```

#### Included Relations
Each item includes:
- **`file`** - File metadata (mimeType, hash, extension, bucket, key, etag)
- **`folder`** - Folder metadata (childCount, inclusiveChildCount)
- **`favorites`** - Array of favorites with favoritedBy user info
- **`thumbnails`** - Array of thumbnail images (id, height, width, url, view, size)

## Route Integration

### Home Route
**Location:** `app/routes/stash/home.tsx`

The home page route displays suggestions as the primary view. Route runs on server in React Router v7 Framework Mode.

#### Loader
Fetches suggestions using data from authenticated session:
```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session?.user) {
    throw redirect('/auth/signin')
  }
  
  // userId, driveId, rootId are already in session.user
  const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
    userId: session.user.id,
    driveId: session.user.driveId,
    rootId: session.user.rootId,
    maxFolders: 6,
    maxFiles: 50,
  })
  
  return { suggestedFolders, suggestedFiles, user: session.user }
}
```

#### Component
Renders the suggestions view with pre-filtered data from loader:
```tsx
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

**Note:** Items are already filtered by type (folder vs file) on the server in the loader, so the component only renders the pre-filtered data.

## Types and Type Safety

All components and utilities maintain full TypeScript type safety using Prisma's generated types and Zod schemas where applicable.

### ItemCard Props Structure
Items must match the `ItemCardProps` interface and include:
- Basic fields: `id`, `name`, `type`, `category`, `status`, etc.
- Relations: `file`, `folder`, `favorites`, `thumbnails`
- Timestamps: `createdAt`, `updatedAt`, `openedAt`
- Size info: `size`, `inclusiveSize`

## Styling

- Uses **TailwindCSS** for responsive design
- Uses **shadcn/ui** components for card structure
- Uses **Framer Motion** for animations
- Respects the project's design system and color scheme

## Performance Considerations

1. **Database Queries:** Uses single optimized SQL query with PostgreSQL JSON aggregation (no N+1 problems)
2. **Query Efficiency:** All relations fetched in one database round-trip using JOINs and `json_agg()`
3. **Limits:** Folders capped at 6, files at 50 to prevent excessive rendering
4. **Sorting:** Uses indexed fields (`updatedAt`, `openedAt`, `createdAt`) for fast sorting
5. **Animations:** Optimized with Framer Motion's layout animation
6. **Client-Side:** Minimal filtering by type (folder vs file) after query results

## Empty State

When no suggestions are available:
- Shows a centered message: "No suggestions yet"
- Provides helpful guidance: "Start creating and organizing files to see suggestions"

## Future Enhancements

Potential improvements:
1. Add activity tracking (openedAt field) to suggestions
2. Include "Recently Shared" items
3. Add filters for suggestion type (e.g., show only documents)
4. Implement caching for suggestions
5. Add personalized recommendations based on user behavior patterns
6. Include activity metadata (who shared, when edited, etc.)
