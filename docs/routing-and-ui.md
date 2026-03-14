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
// app/routes/examples/handle-example.tsx
export const handle: Stashly.RouteHandle = {
  dashboardHandle: true,
  mainNavigation: true,
}
```

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

**See also:** `app/components/app-sidebar.tsx` and `app/routes/examples/handle-example.tsx` for usage examples.

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

**Persistence:** The provider writes cookies per-id (e.g., `sidebar_state_left`) to preserve open state across page loads. For full SSR consistency, read those cookies in your loader and hydrate the provider's initial state.

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
// data → PaginationData<any> (typed broadly for the generic helper)
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

### `runSearch` — Overloaded Generic Search Function

Supports four pagination strategies with correct return type inference per overload:

```typescript
// Page-based → PageBasedResult<TModel>
const result = await runSearch(prisma.item, {
  where, orderBy,
  page: 1,
  pageSize: 20,
})
// result.data, result.total, result.page, result.pageSize

// Cursor-based → CursorBasedResult<TModel>
const result = await runSearch(prisma.item, {
  where, orderBy,
  cursor: 'last-seen-id',
  limit: 20,
})
// result.data, result.nextCursor

// Streaming → StreamResult<TModel> (AsyncGenerator)
const stream = await runSearch(prisma.item, {
  where, orderBy,
  stream: true,
  batchSize: 100,
})
for await (const { data } of stream) { ... }

// No pagination → AllResults<TModel>
const result = await runSearch(prisma.item, { where, orderBy })
// result.data, result.warning (if close to limit)
```

**Key design decisions:**
- `RunSearchOptions` is a **union type** (not merged interfaces) — required for correct overload resolution
- `TModel extends { id: string }` constraint — cursor-based and streaming require an `.id` field
- Type guard approach: `'cursor' in options`, `'stream' in options`, `'page' in options` for narrowing
- `DbDelegate<TModel, ...>` abstracts the Prisma model delegate for testability

### Pagination Result Types

```typescript
type PageBasedResult<TModel> = {
  data: TModel[]
  total: number
  page: number
  pageSize: number
}

type CursorBasedResult<TModel> = {
  data: TModel[]
  nextCursor?: string
}

type AllResults<TModel> = {
  data: TModel[]
  warning?: string
}

type StreamResult<TModel> = AsyncGenerator<{ data: TModel[] }, void, unknown>
```
