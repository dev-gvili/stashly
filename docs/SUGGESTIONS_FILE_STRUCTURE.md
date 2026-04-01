# Suggestions View - File Structure

## Created Files Overview

```
p:/Projects/stashly/
├── app/
│   ├── components/
│   │   └── views/
│   │       ├── grid-view.tsx (existing)
│   │       ├── list-view.tsx (existing)
│   │       ├── variants.ts (existing)
│   │       └── suggestions-view.tsx ✨ NEW
│   │           - SuggestionsView component
│   │           - SuggestionsGridLayout component
│   │           - Responsive grid (1-6 columns)
│   │           - Sections for folders and files
│   │           - Item cards with animations
│   │
│   ├── routes/
│   │   └── stash/
│   │       ├── home.tsx (existing for other content)
│   │       └── home.tsx ✨ UPDATED
│   │           - Home page route in stash folder
│   │           - Authenticates via session.user
│   │           - Loads suggestions
│   │           - Renders SuggestionsView
│   │
│   └── utils/
│       ├── item-actions.server.ts (existing)
│       └── suggestions.server.ts ✨ NEW
│           - getSuggestedItems() function
│           - Fetches folders and files
│           - Smart sorting
│           - Type definitions
│
├── docs/
│   ├── suggestions-view-documentation.md ✨ NEW
│   │   - Complete API reference
│   │   - Component specifications
│   │   - Server utility docs
│   │   - Type information
│   │
│   └── suggestions-usage-examples.md ✨ NEW
│       - Practical code examples
│       - Advanced configurations
│       - Integration patterns
│       - Error handling examples
│
└── Root Files/
    ├── README_SUGGESTIONS_VIEW.md ✨ NEW
    │   - Quick overview
    │   - Feature summary
    │   - Implementation status
    │
    ├── SUGGESTIONS_VIEW_SETUP.md ✨ NEW
    │   - Quick start guide
    │   - Configuration options
    │   - Feature overview
    │
    └── SUGGESTIONS_IMPLEMENTATION_COMPLETE.md ✨ NEW
        - Detailed implementation guide
        - Technical architecture
        - Data flow explanation
        - Customization guide
```

## File Purposes

### `app/components/views/suggestions-view.tsx` (160 lines)
**Purpose:** React component for displaying suggestions

**Exports:**
- `SuggestionsView` - Main component (props: suggestedFolders, suggestedFiles, className)
- `SuggestionsGridLayout` - Helper for responsive grid layout

**Dependencies:**
- React Router (useRouteLoaderData, etc.)
- Framer Motion (animations)
- ItemCard component
- TailwindCSS utilities

**Features:**
- Split layout with two sections
- Responsive grid (1-6 columns)
- Section headers and descriptions
- Empty state handling
- Item animations

---

### `app/utils/suggestions.server.ts` (70 lines)
**Purpose:** Server-side utility for fetching suggestions using optimized SQL

**Exports:**
- `getSuggestedItems(params)` - Main function
- `SuggestedItemsParams` - Type definition (userId, driveId, rootId, workspaceId?, maxFolders?, maxFiles?)
- `SuggestedItemsResult` - Return type (suggestedFolders[], suggestedFiles[])

**Query Method:**
- Uses `prisma.$queryRaw` for single optimized PostgreSQL query
- Implements JSON aggregation with `json_agg()` and `jsonb_build_object()`
- JOINs Item, File, Folder, Favorite, User, and Thumbnail tables
- Groups by item ID to aggregate relations
- No N+1 query problems - all data in one database round-trip
- `userId: string` - User to fetch suggestions for
- `driveId: string` - Drive scope
- `workspaceId?: string` - Optional workspace filter
- `maxFolders?: number` - Max folders (default 6)
- `maxFiles?: number` - Max files (default 50)

**Returns:**
```typescript
{
  suggestedFolders: Item[],
  suggestedFiles: Item[]
}
```

**Database Queries:**
- Fetches folders with `type = 'folder'`
- Fetches files with `type = 'file'`
- Sorts by `updatedAt DESC, createdAt DESC`
- Includes all required relations

---

### `app/routes/home.tsx` (65 lines)
**Purpose:** Home page route

**Exports:**
- `loader()` - Async function to load suggestions
- `meta()` - Page metadata
- default component - HomePage

**Loader Flow:**
1. Check authentication (better-auth)
2. Fetch user's drive
3. Call `getSuggestedItems()`
4. Return suggestions + user data

**Component:**
- Renders `SuggestionsView` with loader data
- Error boundary via ErrorBoundary export
- Full width container

---

### Documentation Files

#### `docs/suggestions-view-documentation.md` (280+ lines)
**Sections:**
- Overview and features
- Component API (SuggestionsView, SuggestionsGridLayout)
- Server utility documentation (getSuggestedItems)
- Route integration details
- Type definitions
- Styling information
- Performance notes
- Future enhancement ideas

#### `docs/suggestions-usage-examples.md` (450+ lines)
**Sections:**
- Basic usage in routes and components
- Advanced examples (filtering, custom limits)
- Component composition patterns
- Custom card actions
- Edge case handling
- Activity data usage
- Search integration
- Performance optimization
- Responsive behavior
- Error handling
- Complete working example

#### `SUGGESTIONS_VIEW_SETUP.md` (100+ lines)
**Sections:**
- What was created (quick overview)
- Key features checklist
- Usage instructions
- Configuration options
- Database query explanation
- Notes and status

#### `SUGGESTIONS_IMPLEMENTATION_COMPLETE.md` (350+ lines)
**Sections:**
- Files created summary
- How it works (data flow)
- Sorting logic
- Data selection
- Key features
- Technical details
- Integration points
- Customization guide
- Testing recommendations
- Future enhancements
- Complete notes

#### `README_SUGGESTIONS_VIEW.md` (200+ lines)
**Sections:**
- Overview and status
- Files created
- Features checklist
- How to use (basic and advanced)
- Data flow diagram
- Technical stack
- Performance notes
- Styling info
- Testing recommendations
- Future enhancements
- Documentation structure
- Next steps

---

## File Relationships

```
home.tsx (route)
    ↓ imports
suggestions.server.ts (utility)
    ↓ returns
SuggestionsView (component)
    ↓ uses
ItemCard (existing component)
    ↓ styled with
TailwindCSS + Framer Motion

Documentation files provide:
    ├── suggestions-view-documentation.md (API Reference)
    ├── suggestions-usage-examples.md (How-to Guide)
    ├── SUGGESTIONS_VIEW_SETUP.md (Quick Start)
    ├── SUGGESTIONS_IMPLEMENTATION_COMPLETE.md (Deep Dive)
    └── README_SUGGESTIONS_VIEW.md (Overview)
```

## Type Relationships

```
SuggestedItemsParams
├── userId: string
├── workspaceId?: string
├── driveId: string
├── maxFolders?: number
└── maxFiles?: number

    ↓ passed to

getSuggestedItems(params)

    ↓ returns

SuggestedItemsResult
├── suggestedFolders: Item[]
└── suggestedFiles: Item[]

    ↓ passed to

SuggestionsViewProps
├── suggestedFolders: Item[]
├── suggestedFiles: Item[]
└── className?: string

    ↓ used in

SuggestionsView component
└── Renders both grids with ItemCard
```

## File Statistics

| File | Lines | Type | Status |
|------|-------|------|--------|
| suggestions-view.tsx | ~160 | TSX Component | ✅ Complete |
| suggestions.server.ts | ~70 | TS Utility | ✅ Complete |
| home.tsx | ~65 | TSX Route | ✅ Complete |
| suggestions-view-documentation.md | ~280 | Markdown | ✅ Complete |
| suggestions-usage-examples.md | ~450 | Markdown | ✅ Complete |
| SUGGESTIONS_VIEW_SETUP.md | ~100 | Markdown | ✅ Complete |
| SUGGESTIONS_IMPLEMENTATION_COMPLETE.md | ~350 | Markdown | ✅ Complete |
| README_SUGGESTIONS_VIEW.md | ~200 | Markdown | ✅ Complete |

**Total New Code:** ~295 lines
**Total Documentation:** ~1,380 lines

---

## Import Dependencies

### In `suggestions-view.tsx`:
```typescript
import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/styles'
import { ItemCard } from '@/components/stash/item-card'
import { itemVariants } from '@/components/views/variants'
import type { Prisma } from '@/prisma/client'
```

### In `suggestions.server.ts`:
```typescript
import { prisma } from '@/services/db'
import { Prisma } from '@/prisma/client'
```

### In `home.tsx`:
```typescript
import { auth } from '@/.server/auth'
import { redirect } from 'react-router'
import { getSuggestedItems } from '@/utils/suggestions.server'
import { SuggestionsView } from '@/components/views/suggestions-view'
import { ErrorBoundary } from '@/components/error-boundary'
```

---

## Configuration Points

### In `home.tsx` Loader:
```typescript
// Adjust these values to customize behavior
maxFolders: 6,      // Change to show more/fewer folders
maxFiles: 50,       // Change to show more/fewer files
workspaceId: ...,   // Add for workspace filtering
```

### In `suggestions.server.ts`:
```typescript
// Sorting criteria (currently: recently modified, then created)
orderBy: [
  { updatedAt: 'desc' },
  { createdAt: 'desc' },
]
```

### In `suggestions-view.tsx`:
```typescript
// Grid breakpoints (currently: 1-6 columns responsive)
className={cn(
  'grid 2xl:grid-cols-6 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-2',
)}
```

---

## No Breaking Changes

✅ Existing components unmodified
✅ New route doesn't conflict with `/stash/home`
✅ Uses existing ItemCard component
✅ Uses existing database models
✅ Compatible with existing auth system

Ready for integration!
