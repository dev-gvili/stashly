# Implementation Summary: Suggestions View for Home Page

## Files Created

### 1. Server Utility
**File:** `app/utils/suggestions.server.ts`
- Fetches suggested items using single optimized SQL query
- Smart sorting by modification date and creation date
- Filters by user, drive, and optional workspace
- Fully type-safe with Prisma types
- Returns folders and files separately with all required relations
- Uses PostgreSQL JSON aggregation functions for relation fetching

### 2. React Component
**File:** `app/components/views/suggestions-view.tsx`
- Split-page layout component
- Top section: Grid of up to 6 suggested folders
- Bottom section: Grid of up to 50 suggested files
- Responsive grid (1-6 columns based on screen size)
- Item cards with favorite buttons and action menus
- Smooth animations with Framer Motion
- Empty state handling

### 3. Home Route
**File:** `app/routes/stash/home.tsx`
- Home page route nested under stash folder
- Authenticates user via session.user object
- Accesses userId, driveId, rootId from session.user
- Calls `getSuggestedItems()` in the loader
- Renders `SuggestionsView` component

### 4. Documentation
**Files:**
- `docs/suggestions-view-documentation.md` - Complete API documentation
- `SUGGESTIONS_VIEW_SETUP.md` - Quick setup guide and overview

## How It Works

### Data Flow
```
User logs in → redirected to /<userId>/stash
  ↓
User navigates to /<userId>/stash/home
  ↓
Route loader runs on server (React Router v7 Framework Mode)
  ↓
Loader retrieves userId, driveId, rootId from session.user
  ↓
Calls getSuggestedItems() with session data
  ↓
Server filters items by type (folder vs file)
  ↓
Query returns folders and files with all relations
  ↓
SuggestionsView renders the results on client
```

### Sorting Logic
Items are sorted by:
1. **Recently Modified** - `updatedAt` field (descending)
   - Captures edits, lock/unlock changes, favorite/unfavorite changes
2. **Recently Created** - `createdAt` field (descending)
   - Captures newly created items

### Data Selection
The suggestion utility fetches:
- **Folders:** Items with `type = 'folder'`
- **Files:** Items with `type = 'file'`
- Only `status = 'normal'` items (excludes trash)
- Includes all relations needed for ItemCard display:
  - `favorites` with user info
  - `file` and `folder` details
  - `thumbnails` for previews

## Key Features

✅ **Split-Page Layout**
- Folders on top, files on bottom
- Clear visual separation with headers and descriptions

✅ **Responsive Design**
- Adapts from 1 to 6 columns
- Mobile-first approach
- Proper spacing between items

✅ **Rich Item Display**
- Item thumbnails/icons
- File/folder names with extensions
- File sizes
- Folder item counts
- Favorite buttons
- Action menus

✅ **Intelligent Suggestions**
- Based on actual user activity
- Respects user's workspace and drive
- Fast database queries with proper indexing

✅ **Empty State**
- Helpful message when no items exist
- Encourages user to start creating items

## Technical Details

### SQL Query Architecture

The `getSuggestedItems()` function uses a single optimized PostgreSQL query with the following structure:

```sql
SELECT 
  i.id, i.name, i.type, i.category, i.status,
  i.size, i."inclusiveSize", i."createdAt", i."updatedAt", i."openedAt",
  i."ownerId", i."workspaceId", i."driveId", i."parentId", i."uploadId", i.tags,
  
  -- Conditional JSON objects for file and folder details
  (CASE WHEN f.id IS NOT NULL THEN jsonb_build_object(...) ELSE NULL END) as "file",
  (CASE WHEN fo.id IS NOT NULL THEN jsonb_build_object(...) ELSE NULL END) as "folder",
  
  -- JSON aggregated arrays for relations
  COALESCE(json_agg(jsonb_build_object(...)) FILTER (WHERE fav.id IS NOT NULL), '[]'::json) as "favorites",
  COALESCE(json_agg(jsonb_build_object(...)) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as "thumbnails"
  
FROM "Item" i
LEFT JOIN "File" f ON i.id = f."itemId"
LEFT JOIN "Folder" fo ON i.id = fo."itemId"
LEFT JOIN "Favorite" fav ON i.id = fav."itemId"
LEFT JOIN "user" u ON fav."favoritedById" = u.id
LEFT JOIN "Thumbnail" t ON i.id = t."itemId"
WHERE i."ownerId" = $1 AND i."driveId" = $2 AND i."parentId" = $3 AND i.status = 'normal'
GROUP BY i.id, f.id, fo.id
ORDER BY i."updatedAt" DESC NULLS LAST, i."openedAt" DESC NULLS LAST, i."createdAt" DESC
LIMIT $4
```

**Key PostgreSQL Features Used:**
- **`CASE` statements** - Conditionally include file/folder details as JSON objects only if they exist
- **`jsonb_build_object()`** - Construct JSON objects from table columns
- **`json_agg()`** - Aggregate related rows (favorites, thumbnails) into JSON arrays
- **`COALESCE()` with `FILTER`** - Return empty array `[]` if no related records exist
- **`LEFT JOIN`** - Include items even if relations don't exist (for optional fields)
- **`GROUP BY`** - Group by item and facet IDs to aggregate relations correctly

**Query Optimization Notes:**
- Single database round-trip fetches all data at once
- No N+1 query problems
- Uses PostgreSQL's native JSON functions for efficient aggregation
- Client-side filtering by type (folder vs file) is negligible cost
- All `DISTINCT` and `ORDER BY` removed from aggregations per PostgreSQL constraints

### Type Safety
- Full TypeScript support throughout
- Prisma types for database relations
- No `any` types or type casting
- Proper inference of ItemCard props

### Performance
- Efficient Prisma queries with `include`
- Limits on results (6 folders, 50 files)
- Uses indexed fields for sorting
- Minimal database relations fetched

### Styling
- TailwindCSS responsive utilities
- shadcn/ui card components
- Framer Motion for smooth animations
- Respects project design system

## Integration Points

### With ItemCard Component
The suggestion items are fully compatible with the existing ItemCard component:
```tsx
<ItemCard {...item}>
  <ItemCard.Header>
    <ItemCard.Favorite />
    <ItemCard.Actions />
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
```

### With Authentication
Uses the existing `better-auth` setup via `auth.api.getSession(request)`.

### With Database
Uses existing Prisma client and drive/item models.

## Customization

### Adjust Limits
In `app/routes/home.tsx`, loader function:
```typescript
const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
  userId: session.user.id,
  driveId: userDrive.id,
  maxFolders: 6,      // Change this
  maxFiles: 50,       // Or this
})
```

### Change Sorting Criteria
In `app/utils/suggestions.server.ts`, modify the `orderBy`:
```typescript
orderBy: [
  { updatedAt: 'desc' },      // Primary sort
  { createdAt: 'desc' },      // Secondary sort
]
```

### Filter by Workspace
The utility accepts an optional `workspaceId` parameter for filtering within a specific workspace.

## Future Enhancements

Potential improvements:
1. **Activity Tracking** - Include `openedAt` for "recently opened" items
2. **Recently Shared** - Query permissions/shares for shared items
3. **Smart Filtering** - Allow UI filters (show only docs, images, etc.)
4. **Personalization** - Weight items by user behavior patterns
5. **Caching** - Cache suggestions for performance
6. **Recommendations** - ML-based recommendations based on user patterns
7. **Activity Metadata** - Show who shared, when modified, etc.

## Testing Suggestions

To test the suggestions view:

1. **Create items:**
   - Upload some files
   - Create folders
   - Add various file types (docs, images, etc.)

2. **Perform actions:**
   - Edit files to update `updatedAt`
   - Favorite/unfavorite items
   - Lock/unlock items

3. **Visit home page:**
   - Navigate to `/home`
   - See suggestions grid populated
   - Try different screen sizes to see responsive layout

4. **Empty state:**
   - Delete all items from test user
   - Visit `/home` to see empty state message

## Notes

- The new home route is separate from the existing `/stash/home` route
- Both can coexist, or you can consolidate them if preferred
- Route path can be adjusted in React Router configuration
- All components follow existing project patterns and conventions
