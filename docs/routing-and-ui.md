# Routing and UI patterns

Route handles, the multi-sidebar provider, and pagination on the server and in
the browser. Routes are declared in `app/routes.ts`; component conventions are
in the `stashly-ui-conventions` skill.

## Route handles

`Stashly.RouteHandle` in `app/stashly.d.ts` (and its narrower forms such as
`DashboardHandle`, `WorkspaceHandle`, `GalleryHandle`) lists the flags a route
may declare:

```typescript
export const handle: Stashly.RouteHandle = { dashboardHandle: true }
```

and a layout would read them with `useMatches()`.

**No route exports a `handle` today.** The layout and `app-sidebar.tsx` branch
on `useParams()` / `useLocation()`. `useMatches()` is used only to read route
ids and loader data (`useBreadcrumbs`, `breadcrumb-navigation.tsx`). Treat the
type as the pattern for a new layout flag; add the flag to `stashly.d.ts` first.

## Several sidebars, one provider

`SidebarProvider` (`app/components/ui/sidebar.tsx`) keeps open state per
sidebar `id`. `SidebarTrigger` and `SidebarRail` take a `sidebarId`, or use the
id of the `Sidebar` they sit in. A provider with one unnamed sidebar uses the
id `default`.

```tsx
<SidebarProvider>
  <Sidebar id="left" side="left">…</Sidebar>
  <Sidebar id="right" side="right" width="24rem">…</Sidebar>
  <SidebarTrigger sidebarId="right" />
</SidebarProvider>
```

On `useBeforeUnload` the provider posts each sidebar's state to `/api/sidebar`
(`useFetcher({ key: 'sidebar' })`), which sets a cookie per sidebar named
`stashly-sidebar-<id>`. A loader reads it back to render the same state on the
server (`sidebarCookie` in `app/.server/sidebar.ts` for the default one).

## Pagination in the browser: `usePagination`

Every list route uses `usePagination<T>(take)` (`app/hooks/usePagination.ts`,
default `take` 100). The route's loader returns `{ items, nextCursor, hasMore }`;
the hook starts from the loader's first page and appends later pages by
submitting a GET with the cursor.

- The list resets when filter or sort params change, when the `folderId` param
  changes, and when the navigation state carries `reset: true`
  (`navigate(url, { replace: true, state: { reset: true } })`).
- `insertItems` places rows created by an upload without a reload, using
  `showCreatedRows` from `app/utils/pagination.ts`, and returns the ids it could
  show for certain. See [upload-multipart.md](upload-multipart.md).

## Pagination on the server

`app/utils/pagination.ts` has the strategy helpers behind `searchFactory`
(`app/utils/search.ts`, see [search.md](search.md)):

- `paginate(delegate, options)`: overloads on `options.strategy`, a
  discriminated union. `offset` returns `PaginationOffsetData`
  (`metadata.count/pages/page/take/isComplete`), `cursor` returns
  `PaginationCursorData` (`metadata.nextCursor/previousCursor`), `stream`
  returns an async generator of batches. Each strategy is also exported as
  `paginateWithOffset` / `paginateWithCursor` / `paginateWithStream`.
- `DbDelegate` stands in for a Prisma model delegate, so the helpers can be
  tested with a mock (`findMany` and `count`).
- Models must have an `id`; cursor and stream page on it.

Action files call `searchFactory`, not `paginate`, directly.
`getFolderContents` and `getCollectionContents` in the same file have no
callers.

The same file also holds the browser-side helpers for created rows
(`showCreatedRows`, `reviveCardItem`, `addCreatedToStats`).
