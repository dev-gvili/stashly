# Suggestions View - Usage Examples

## Basic Usage

### In a Route Loader
```typescript
import { getSuggestedItems } from '@/utils/suggestions.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await auth.api.getSession(request)
  if (!session?.user) {
    throw redirect('/auth/signin')
  }

  // userId, driveId, rootId are already in session.user
  const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
    userId: session.user.id,
    driveId: session.user.driveId,      // From session
    rootId: session.user.rootId,         // From session
    maxFolders: 6,
    maxFiles: 50,
  })

  return { suggestedFolders, suggestedFiles }
}
```

**Note:** This loader runs on the server (React Router v7 Framework Mode), so all filtering happens server-side before data is sent to the client.

### In a Component
```typescript
import { SuggestionsView } from '@/components/views/suggestions-view'

export default function HomePage({ loaderData }) {
  const { suggestedFolders, suggestedFiles } = loaderData

  return (
    <SuggestionsView 
      suggestedFolders={suggestedFolders}
      suggestedFiles={suggestedFiles}
    />
  )
}
```

## Advanced Examples

### Filter by Workspace
```typescript
const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
  userId: session.user.id,
  driveId: userDrive.id,
  workspaceId: 'workspace-123', // Only items in this workspace
  maxFolders: 6,
  maxFiles: 50,
})
```

### Custom Limits
```typescript
const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
  userId: session.user.id,
  driveId: userDrive.id,
  maxFolders: 12,  // Show more folders
  maxFiles: 100,   // Show more files
})
```

### Using with Custom Styling
```typescript
<SuggestionsView 
  suggestedFolders={suggestedFolders}
  suggestedFiles={suggestedFiles}
  className="p-6 bg-slate-50 dark:bg-slate-900"
/>
```

## Component Composition

### Complete Example with Layout
```typescript
import { SuggestionsView } from '@/components/views/suggestions-view'
import { AppHeader } from '@/components/app-header'
import { AppSidebar } from '@/components/app-sidebar'

export default function HomePage({ loaderData }) {
  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <AppHeader />
        <main className="flex-1 overflow-auto">
          <SuggestionsView {...loaderData} />
        </main>
      </div>
    </div>
  )
}
```

### Conditional Rendering
```typescript
export default function HomePage({ loaderData }) {
  const { suggestedFolders, suggestedFiles } = loaderData
  const hasSuggestions = suggestedFolders.length > 0 || suggestedFiles.length > 0

  if (!hasSuggestions) {
    return <EmptyOnboardingScreen />
  }

  return (
    <SuggestionsView 
      suggestedFolders={suggestedFolders}
      suggestedFiles={suggestedFiles}
    />
  )
}
```

## Customizing Item Display

### Adding Custom Card Actions
```typescript
const { suggestedFolders } = loaderData

return (
  <SuggestionsGridLayout>
    {suggestedFolders.map((folder) => (
      <ItemCard key={folder.id} {...folder}>
        <ItemCard.Header>
          <ItemCard.Favorite />
          <ItemCard.Actions />
          {/* Add custom action */}
          <button onClick={() => handleShare(folder.id)}>
            Share
          </button>
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
)
```

## Handling Edge Cases

### Empty Folders Section
```typescript
const { suggestedFolders, suggestedFiles } = loaderData

return (
  <div className="space-y-8">
    {suggestedFolders.length > 0 && (
      <section>
        <h2>Suggested Folders</h2>
        <GridLayout items={suggestedFolders} />
      </section>
    )}
    <section>
      <h2>Suggested Files</h2>
      <GridLayout items={suggestedFiles} />
    </section>
  </div>
)
```

### Loading State
```typescript
export default function HomePage({ loaderData, isTransitioning }) {
  if (isTransitioning) {
    return <SkeletonGrid />
  }

  return (
    <SuggestionsView {...loaderData} />
  )
}
```

## Working with Recent Activity Data

### Getting Recently Modified Items
The items are already sorted by `updatedAt`, so the first items are most recently modified:

```typescript
const { suggestedFolders } = await getSuggestedItems({
  userId: session.user.id,
  driveId: userDrive.id,
})

// suggestedFolders[0] is the most recently modified folder
console.log('Most recently modified:', suggestedFolders[0])
```

### Filtering Modified vs Created
You can post-process the results if needed:

```typescript
const { suggestedFiles } = await getSuggestedItems({
  userId: session.user.id,
  driveId: userDrive.id,
})

// Separate by modification type
const recentlyModified = suggestedFiles.filter(
  file => file.updatedAt.getTime() - file.createdAt.getTime() > 3600000 // > 1 hour
)

const recentlyCreated = suggestedFiles.filter(
  file => file.updatedAt.getTime() - file.createdAt.getTime() <= 3600000
)
```

## Integration with Search

### Combining Suggestions with Search
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await auth.api.getSession(request)
  const url = new URL(request.url)
  const searchQuery = url.searchParams.get('q')

  // Show suggestions if no search, search results if query
  if (!searchQuery) {
    return await getSuggestedItems({
      userId: session.user.id,
      driveId: userDrive.id,
    })
  }

  return await performSearch(searchQuery)
}
```

## Performance Optimization

### Caching Suggestions
```typescript
const CACHE_KEY = `suggestions-${userId}`

export async function loader({ request }: LoaderFunctionArgs) {
  const cached = await cache.get(CACHE_KEY)
  if (cached) return cached

  const suggestions = await getSuggestedItems({
    userId: session.user.id,
    driveId: userDrive.id,
  })

  // Cache for 5 minutes
  await cache.set(CACHE_KEY, suggestions, 300)

  return suggestions
}
```

### Preloading
```typescript
// In your route config
{
  path: '/home',
  element: <HomePage />,
  loader: homeLoader,
  shouldRevalidate: ({ nextUrl, currentUrl }) => {
    // Only revalidate if user changes, not on every render
    return nextUrl.pathname !== currentUrl.pathname
  }
}
```

## Responsive Behavior

### Mobile-First Grid
The grid automatically adapts:
- **Mobile:** 1 column
- **Tablet:** 2-3 columns
- **Desktop:** 4-6 columns

No additional code needed - it's built into `SuggestionsGridLayout`.

### Testing Responsiveness
```typescript
// Desktop view
<SuggestionsView {...loaderData} />

// Mobile emulation in dev tools will show 1 column
// Resize browser to see grid adapt
```

## Error Handling

### Handling Missing Drive
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await auth.api.getSession(request)
  const userDrive = await getUserDrive(session.user.id)

  if (!userDrive) {
    return redirect('/setup')
  }

  return await getSuggestedItems({
    userId: session.user.id,
    driveId: userDrive.id,
  })
}
```

### Graceful Degradation
```typescript
try {
  const suggestions = await getSuggestedItems({
    userId: session.user.id,
    driveId: userDrive.id,
  })
  return suggestions
} catch (error) {
  console.error('Failed to load suggestions:', error)
  return {
    suggestedFolders: [],
    suggestedFiles: [],
  }
}
```

## Complete Working Example

```typescript
// app/routes/home.tsx
import { getSuggestedItems } from '@/utils/suggestions.server'
import { SuggestionsView } from '@/components/views/suggestions-view'
import { auth } from '@/.server/auth'
import { redirect } from 'react-router'
import type { LoaderFunctionArgs } from 'react-router'

export function meta() {
  return [{ title: 'Stashly - Home' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) {
    throw redirect('/auth/signin')
  }

  const userDrive = await getUserDrive(session.user.id)
  if (!userDrive?.id) {
    throw redirect('/setup')
  }

  try {
    const { suggestedFolders, suggestedFiles } = await getSuggestedItems({
      userId: session.user.id,
      driveId: userDrive.id,
      maxFolders: 6,
      maxFiles: 50,
    })

    return {
      suggestedFolders,
      suggestedFiles,
      user: session.user,
    }
  } catch (error) {
    console.error('Error loading suggestions:', error)
    return {
      suggestedFolders: [],
      suggestedFiles: [],
      user: session.user,
      error: 'Failed to load suggestions',
    }
  }
}

export default function HomePage({ loaderData }) {
  const { suggestedFolders, suggestedFiles, error } = loaderData

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <SuggestionsView
        suggestedFolders={suggestedFolders}
        suggestedFiles={suggestedFiles}
      />
    </div>
  )
}
```

This example demonstrates:
- ✅ Authentication check
- ✅ Error handling
- ✅ Custom limits
- ✅ Graceful degradation
- ✅ User context
