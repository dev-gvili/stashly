---
name: stashly-ui-conventions
description: Stashly UI and component conventions — icons, ItemCard/DataTable, dialogs, dropdowns, cards, filters, pagination, surface/z-index layering, and Tailwind styling. Load before writing or editing any component under app/components in the Stashly repo, or when styling UI.
---

# Stashly UI Conventions

Components use shadcn/ui (source-owned, in `app/components/ui/`) built on Radix UI primitives, styled with TailwindCSS 4. Use `cn()` from `@/utils/styles` for conditional classNames.

## Component placement & primitives

**Icons**: All icons live in `app/components/icons.tsx`. Always grep it before using any icon. **Do NOT use `lucide-react` directly** — if a needed icon is missing from `icons.tsx`, stop and notify the user so they can add it first.

**Custom components**: Reusable UI components go in `app/components/core-components/`. Route-level views go in `app/components/views/`.

**Hooks location**: All hooks go in `app/hooks/` — never co-locate them inside `app/components/` subdirectories, even if tightly coupled to one component family.

**`JSX` namespace**: Always `import type { JSX } from 'react'` when a file uses `JSX.Element` in type annotations — the namespace is not globally available in this project.

## Dialogs, dropdowns, and clickable cards

**Destructive actions**: Use the `useConfirm` hook from `@/hooks/useConfirm` — never inline alert dialogs or `window.confirm`.

**Dialog + Dropdown composition**: To open a dialog from a dropdown item, wrap the item with `DialogTrigger asChild` and call `onSelect={(e) => e.preventDefault()}` to prevent the menu closing before the dialog opens. Don't lift open/close state into the parent as props.

**Dropdowns inside clickable cards**: Always use `modal={false}` on `DropdownMenu` and `e.stopPropagation()` on the trigger to prevent card navigation firing.

**Portal event bubbling in clickable cards**: React portals (dialogs, dropdowns) bubble events through the fiber tree even when not DOM descendants. Do NOT add `stopPropagation` inside `DialogContent`. Instead, guard the card's click handler: `if (!e.currentTarget.contains(e.target as Node)) return` — this silently ignores clicks that originate from any portal overlaying the card.

**Dialog data loading**: For dialogs that load data on-demand (not at route load time), use `fetcher.load('/api/route?param=x')` inside a `useEffect` triggered by the dialog's `open` state. Use **two separate fetchers** when a component both reads and mutates — one for `fetcher.load()`, one for `fetcher.submit()`.

**Clipboard copy**: Always use `useClipboard` from `@/hooks/useClipboard` — never call `navigator.clipboard.writeText` directly. The hook ladders through the Clipboard API then an `execCommand` fallback for iOS Safari < 13.1 and Android WebView.

## Data, navigation & pagination

**`formatSize` signature**: Three args — `formatSize('byte', 'unit', Number(value))`.

**Type-safe navigation**: Use `href()` from `react-router` for route links: `href('/:me/stash/collections/:collectionId', { me, collectionId })`.

**`paginateItems`**: Use this from `@/services/item-actions` in loaders when fetching paginated item lists; supports `include`, `where`, `cursor`, `limit`.

**Pagination**: All paginated routes use `usePagination<T>(limit)` from `@/hooks/usePagination`. The loader returns `{ items, nextCursor, hasMore }`. The hook reads initial data from `useLoaderData` and appends pages via URL search params.

**Multi-select grids**: Wrap item grids with `<SelectionProvider items={items.map(i => i.id)}>` from `@/components/stash/selection` to enable shift-click range selection and `useSelection()` in child checkboxes.

## ItemCard & DataTable

**Header vs Toolbar**: `app-header.tsx` — sticky top bar with upload, filters, layout toggle. `app-toolbar.tsx` — sticky bottom bar with breadcrumbs and bulk-action buttons (restore/trash/delete/favorite). Both use `useParams()` and `useSearchParams()` for conditional rendering.

**`DataTable` styling**: Accepts a `className` prop applied to the `<Table>` element — use it for background/border/rounding (e.g. `className="bg-card rounded-md"`).

**`DataTable` with `ItemCard` actions**: To use `ItemCard.Actions` inside a `DataTable` row, create a wrapper component that provides `ItemCardContext.Provider` (with `useRouteLoaderData` + `useSearchParams`) and pass it to the `actions` prop: `actions={(item) => <ListRowActions item={item} />}`.

**`ItemCard.Thumbnail` is Avatar-style**: Wraps Radix `AvatarPrimitive`. Self-closing `<ItemCard.Thumbnail />` defaults to `ThumbnailImage` + `ThumbnailFallback`. For explicit control compose them: `<ItemCard.Thumbnail><ItemCard.ThumbnailImage /><ItemCard.ThumbnailFallback className="…" /></ItemCard.Thumbnail>`. Real thumbnails have URLs **not** starting with `#` — stage-0 color hashes are placeholders.

**`StashPickerItem` → `ItemCard` adapter**: To render a picker shape through `ItemCard`, fill defaults: `status: 'normal'`, `inclusiveSize: item.size`, `parentId: null`, `ownerId: ''`, `workspaceId: null`, `driveId: ''`, `updatedAt: null`, `tags: []`, `favorites: []`, `file: null`, `folder: null`. Map `thumbnailUrl` → `thumbnails: [{ id, url, width: null, height: null, size: 'medium', view: 'grid' }]`.

**`ItemStatus` values**: `'normal' | 'archived' | 'trashed' | 'locked' | 'shared'` — there is no `'active'`.

**Item card dropdown**: Actions are a **compound component** in their own file, `app/components/stash/item-card-actions.tsx`, attached to the card as `ItemCard.Actions`. Bare `<ItemCard.Actions />` renders the default menu; to customise, compose the sub-components explicitly:

```tsx
<ItemCard.Actions>
  <ItemCard.Actions.Group label="Quick actions">
    <ItemCard.Actions.Favorite />
    <ItemCard.Actions.Pin />
  </ItemCard.Actions.Group>
</ItemCard.Actions>
```

Available sub-components: `Group`, `Item`, `Preview`, `Download`, `Copy`, `Move`, `Rename`, `Details`, `Favorite`, `Pin`, `Lock`, `Share`, `Invite`, `Activity`, `Trash`, `Restore`, `Delete`, `RemoveFromCollection`. They read the current item from `useItemCard()`, so they only work inside an `ItemCard`. Menu contents render inside a Radix `DropdownMenuContent` (not force-mounted), so a closed menu costs no DOM.

## Layout, surface & z-index

**Surface layering**: chrome (headers, toolbars, dialog top/bottom) uses `bg-sidebar`; canvas (content, item grids) uses `bg-background`. App-header pattern: `h-14`, outline buttons with `bg-card!`. App-toolbar pattern: `h-12 p-2` sticky bottom.

**z-index layering**: Tooltips use `z-9999` (highest). Sticky headers/toolbars use `z-10` max — never `z-40` or higher, or they cover tooltip portals. Dialogs/dropdowns inherit from Radix Portal defaults.

**Border color**: structural separators (`border-b`/`border-t` between regions) always use `border-input` — never the default `border` token.

**`Card` component pattern**: Always override Card defaults — never use a bare `<Card>` without explicit classes. Full pattern: `<Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden">`. `CardHeader`: `flex items-baseline px-4 py-4`. `CardTitle`: `text-sm uppercase font-stashly`. `CardDescription`: `text-sm text-muted-foreground`. `CardContent`: `p-4`.

## Typography, icons & inputs

**Inline icons in tables/lists**: Use `size-5` — matches the standard icon scale used in `DataTable` cells and list rows. Don't override icon color unless intentional (they inherit `text-current`).

**Section/card headers**: Label text uses `text-sm uppercase font-stashly`; secondary descriptor (count, subtitle) uses `text-sm text-muted-foreground` via `CardDescription` or a `<span>`. Keep them on the same baseline row with `flex items-baseline gap-3`.

**`font-stashly`**: Apply to all data-display components (cards, tables, lists, KPI strips). It is the app's monospaced/display font — use it consistently, not just on headings.

**Search inputs use `InputGroup`**: import `InputGroup` + `InputGroupAddon` + `InputGroupInput` from `@/ui/input-group`. Don't roll your own input with an absolutely-positioned search icon — mirror the `filters.tsx` pattern.

**`ButtonGroup` is for related secondary actions only**: never fuse a primary submit button with a secondary action in a `ButtonGroup` — primary actions stand alone.

**Toggle/segmented control styling**: For filter rows or segmented controls, mirror `LayoutMenu`/`LayoutMenuItem` from `app/components/ui/layout-menu.tsx` — container `max-w-max rounded`, items `bg-card text-foreground hover:bg-muted aria-checked:bg-muted! aria-checked:text-accent-foreground first-of-type:rounded-l-md last-of-type:rounded-r-md`. Don't roll your own `ToggleGroup` styling.

**No sub-`text-xs` sizes**: never use arbitrary text sizes like `text-[10px]` / `text-[11px]`. `text-xs` is the smallest allowed scale value.

**AA contrast on fixed-color backgrounds**: when text sits on a fixed gradient or color (e.g. `from-black/90` overlays), use literal `text-white` / `text-white/80` — `text-foreground` and `text-muted-foreground` invert per theme and break contrast in the opposite scheme.

## Filter system layout

`app/components/filters/` contains `filter.types.ts` (all types), `filter.data.ts` (CATEGORIES/STATUSES/TYPES/FLAGS + URL constants), `filter-primitives.tsx` (Chip/Kbd/DashedDiv), `sort-pill.tsx` (SortPill), and `filters.tsx` (Filters + HeaderFilters). `useFilters` hook lives in `app/hooks/useFilters.ts`.

## Styling conventions

- Use Tailwind utility classNames directly. Do NOT use `var(--*)` CSS variables or injected style tokens unless explicitly requested.
- Follow the app's established Card override pattern rather than bare shadcn Card styles.
- Use theme classNames over arbitrary values (e.g., `text-sm` not `text-[14px]`).

**Design exploration files**: `option-*.css` and `options/` directories in `app/styles/` are design experiments — never import them in production code and never commit them.

Use the `/shadcn-ui` skill when building new UI components.
