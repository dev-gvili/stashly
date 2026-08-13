# Routing & UI Patterns

This document covers React Router route handles, multi-sidebar support, and pagination helpers.

---

## Table of Contents

1. [Using Route Handles](#1-using-route-handles)
2. [Two Sidebars with a Single Provider](#2-two-sidebars-with-a-single-provider)
3. [Pagination Helpers](#3-pagination-helpers)

---

## 1. Using Route Handles

Route handles are optional metadata objects exported from route modules. In Stashly they use a typed `Stashly.RouteHandle` interface (declared in `app/stashly.d.ts`) to declare how a route interacts with layout features like navigation, sidebars, or dashboards.

### Defining Handles

```typescript
// app/routes/stash/favorites.tsx
export const handle: Stashly.RouteHandle = {
  dashboardHandle: true,
  favoritesHandle: true,
}
```

The flag names are not free-form — `Stashly.RouteHandle` (and its narrower
descendants `DashboardHandle`, `WorkspaceHandle`, `GalleryHandle`, …) enumerate
them explicitly in `app/stashly.d.ts`. Adding a flag means adding it there first.

### Consuming Handles in Layout Components

Use `react-router`'s `useMatches` to access handles for the currently matched routes:

```tsx
import { useMatches } from 'react-router'

function useIsDashboardMatch() {
  const matches = useMatches()
  return matches.some(
    (m) => (m.handle as Stashly.RouteHandle | undefined)?.dashboardHandle
  )
}

function Layout() {
  const isDashboard = useIsDashboardMatch()
  return <div>{isDashboard ? <DashboardSidebar /> : <MainSidebar />}</div>
}
```

### Best Practices

- Use explicit flags for clear intent (e.g., `dashboardHandle: true` rather than matching on route path)
- Use `handle` only for metadata and UI hints — avoid business logic in handles
- Document any custom flags in `app/stashly.d.ts` and in this file

### Troubleshooting

If `HydrateFunction` or `StructuredDataFunction` types are missing, ensure the appropriate types from React Router are available globally or imported and re-declared in TypeScript type declarations.

**Status:** the type surface is in place, but nothing uses it yet — no route
under `app/routes/` currently exports a `handle`, and no layout component calls
`useMatches()` to read one. `app/components/app-sidebar.tsx` and
`app/routes/layout.tsx` branch on `useParams()` / `useLocation()` instead. Treat
the above as the intended pattern for new layout-feature flags, not as a
description of shipped wiring.

---

## 2. Two Sidebars with a Single Provider

The `SidebarProvider` holds per-sidebar state keyed by `id`. Components like `SidebarTrigger` and `SidebarRail` can target a specific sidebar using the `sidebarId` prop, or resolve it implicitly from their closest `Sidebar` scope.

### Example 1: Two Independent Sidebars (Minimal)

```tsx
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarTrigger,
} from '@/components/ui/sidebar'

export default function Page() {
  return (
    <SidebarProvider>
      <Sidebar id="left" side="left">
        <SidebarContent>Left content</SidebarContent>
      </Sidebar>

      <Sidebar id="right" side="right" width="24rem">
        <SidebarContent>Right content</SidebarContent>
      </Sidebar>

      <div className="controls">
        <SidebarTrigger sidebarId="left">Toggle left</SidebarTrigger>
        <SidebarTrigger sidebarId="right">Toggle right</SidebarTrigger>
      </div>
    </SidebarProvider>
  )
}
```

### Example 2: Triggers Inside a Sidebar (Implicit Scoping)

A `SidebarTrigger` placed inside a `Sidebar` automatically targets that sidebar's `id`:

```tsx
<SidebarProvider>
  <Sidebar id="left" side="left" width="18rem">
    <SidebarContent>
      <SidebarTrigger /> {/* toggles "left" by scope — no sidebarId needed */}
    </SidebarContent>
  </Sidebar>
</SidebarProvider>
```

### Example 3: Mixed — Scoped Triggers Plus External Controls

Useful when the UI shows both global controls and inline controls:

```tsx
<SidebarProvider>
  <Sidebar id="left" side="left">
    <SidebarContent>Left content</SidebarContent>
  </Sidebar>

  <Sidebar id="right" side="right">
    <SidebarContent>
      <SidebarTrigger /> {/* toggles the right sidebar (implicit scope) */}
    </SidebarContent>
  </Sidebar>

  <div className="global-controls">
    <SidebarTrigger sidebarId="left">Open left</SidebarTrigger>
    <SidebarTrigger sidebarId="right">Open right</SidebarTrigger>
  </div>
</SidebarProvider>
```

### Example 4: Using SidebarRail

`SidebarRail` also accepts `sidebarId`:

```tsx
<SidebarProvider>
  <Sidebar id="left" side="left">...</Sidebar>
  <SidebarRail sidebarId="left" />
</SidebarProvider>
```

### Notes & Tips

**Backwards compatibility:** Any existing code using a single provider with no `id` continues to work — `default` is the implicit id.

**Persistence:** The provider keeps open state in a `Record<id, boolean>` map and, on `useBeforeUnload`, submits `{ id, state }` for every entry to `POST /api/sidebar` with a `useFetcher({ key: 'sidebar' })`. That route sets one cookie per sidebar, named `stashly-sidebar-<id>` (e.g. `stashly-sidebar-left`). For full SSR consistency, read those cookies in your loader and hydrate the provider's initial state.

---

## 3. Pagination Helpers

### `getFolderContents` — Existing Helper

```typescript
import { getFolderContents } from '@/utils/pagination'
import { prisma } from '@/services/db'

// Cursor strategy example
const res = await getFolderContents({
  client: prisma,
  strategy: 'cursor',
  take: 10,
  where: { parentId: 'folder_abc' },
  include: { file: true, folder: true },
})
// res → PaginationCursorData | PaginationOffsetData | PaginationStreamData (depends on strategy)
```

### `getCollectionContents` — Generic Model Helper

```typescript
import { getCollectionContents } from '@/utils/pagination'
import { prisma } from '@/services/db'

const data = await getCollectionContents({
  client: prisma,
  model: 'item',
  strategy: 'cursor',
  take: 25,
  where: { workspaceId: 'ws_123' },
  include: { file: true },
})
// data → PaginationCursorData<Prisma.ItemGetPayload<{ include: TInclude }>>
// (the `model: 'item'` overloads map strategy → concrete result type; the
//  implementation signature falls back to PaginationData<TModel> for other models)
```

### `paginateWithOffset` — Mock Delegate for Unit Tests

```typescript
const mockDelegate = {
  findMany: async (args) => [{ id: '1' }, { id: '2' }],
  count: async () => 2,
}

const result = await paginateWithOffset(mockDelegate, {
  strategy: 'offset',
  page: 1,
  take: 10,
  where: {},
})
// result.metadata.count === 2
```

### `paginate` — Overloaded Generic Pagination Function

The helper both `getFolderContents` and `getCollectionContents` delegate to.
Three strategies, with the return type inferred per overload from the
`strategy` discriminant:

```typescript
// Offset → PaginationOffsetData<TModel>
const result = await paginate(prisma.item, {
  strategy: 'offset',
  where, orderBy,
  page: 1,
  take: 20,
})
// result.data, result.metadata.{count, pages, page, take, isComplete, strategy}

// Cursor → PaginationCursorData<TModel>
const result = await paginate(prisma.item, {
  strategy: 'cursor',
  where, orderBy,
  cursor: 'last-seen-id',
  take: 20,
})
// result.data, result.metadata.{count, nextCursor, previousCursor, take, isComplete, strategy}

// Stream → PaginationStreamData<TModel> (AsyncGenerator)
const stream = await paginate(prisma.item, {
  strategy: 'stream',
  where, orderBy,
  batchSize: 100,
})
for await (const { data, metadata } of stream) { ... }
```

The three strategy-specific entry points — `paginateWithOffset`,
`paginateWithCursor`, `paginateWithStream` — are also exported directly; the
`paginate` implementation is just a `switch` over `options.strategy` onto them.

**Key design decisions:**
- `PaginationOptions` is a **discriminated union** on `strategy` (not merged interfaces) — required for correct overload resolution
- `TModel extends { id: string }` constraint — cursor-based and streaming require an `.id` field
- Narrowing is by the `strategy` literal, not by `'cursor' in options`-style key probes
- `DbDelegate<TModel, ...>` abstracts the Prisma model delegate for testability

### Pagination Result Types

Every strategy returns `{ data, metadata }` — the metadata shape is what differs.

```typescript
type PaginationOffsetData<TModel> = {
  data: TModel[]
  metadata: {
    count: number
    pages: number
    page: number
    take: number
    isComplete: boolean
    strategy: 'offset'
  }
}

type PaginationCursorData<TModel> = {
  data: TModel[]
  metadata: {
    count: number
    previousCursor?: string
    nextCursor?: string
    take: number
    isComplete: boolean
    strategy: 'cursor'
  }
}

type PaginationStreamData<TModel> = AsyncGenerator<
  { data: TModel[]; metadata: { take: number; count: number; nextCursor?: string; previousCursor?: string; isComplete: boolean; strategy: 'stream' } },
  void,
  unknown
>

type PaginationData<TModel> =
  | PaginationOffsetData<TModel>
  | PaginationCursorData<TModel>
  | PaginationStreamData<TModel>
```
