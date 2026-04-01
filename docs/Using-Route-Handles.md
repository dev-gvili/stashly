Title: Using Route `handle` Metadata

This document explains how to use the `handle` metadata pattern in Stashly routes and how the codebase can read those flags at runtime.

## What are route handles?

Route handles are a small, optional metadata object that a route module can export. They are typically used to declare how a route interacts with application layout features such as navigation, search, or dashboards. In Stashly we use a typed approach via `Stashly.RouteHandle` (declared in `app/stashly.d.ts`).

## Defining handles (example)

Create or open a route file and export a `handle` variable. Example (from `app/routes/examples/handle-example.tsx`):

```ts
export const handle: Stashly.RouteHandle = {
  dashboardHandle: true,
  mainNavigation: true,
}
```

## Consuming handles in the layout / components

Use `react-router`'s `useMatches` (or the server-side `matches` in loaders) to access handles for the currently matched routes.

Example: reading a handle in a layout or a UI component:

```tsx
import { useMatches } from 'react-router'

function useIsDashboardMatch() {
  const matches = useMatches()
  return matches.some(
    (m) => (m.handle as Stashly.RouteHandle | undefined)?.dashboardHandle
  )
}

// Then conditionally render UI
function Layout() {
  const isDashboard = useIsDashboardMatch()
  return <div>{isDashboard ? <DashboardSidebar /> : <MainSidebar />}</div>
}
```

## Best practices

- Prefer explicit flags for clear intent (e.g., `dashboardHandle` vs. setting a route path).
- Use `handle` only for metadata and UI hints; avoid placing business logic in the handle.
- Document any custom flags or conventions in `app/stashly.d.ts` (already filled in) and in `docs/Using-Route-Handles.md`.

## Troubleshooting

- If `HydrateFunction` or `StructuredDataFunction` are missing, make sure the appropriate types from React Router are available globally or import and re-declare them in TypeScript type declarations.

See also: `app/components/app-sidebar.tsx` and `app/routes/examples/handle-example.tsx` for usage examples.
