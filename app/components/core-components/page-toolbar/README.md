# Page header toolbar — bulk operations

Five variants of the storage page header, all built on the app's shadcn/ui
primitives in `@/ui/*`, icons from `@/components/icons`, and `globals.css`
design tokens. No inline styles and no arbitrary Tailwind values — token scale
classes only, so light/dark mode comes free from the `.dark` class on `<html>`.

## Variants

| File | Direction | Best for |
| --- | --- | --- |
| `page-toolbar-morph.tsx` | **Morphing single row** — the `h-14` header swaps content in place when a selection exists. No height change, no layout shift. | Default. Matches the current `AppHeader` height and rhythm. |
| `page-toolbar-dock.tsx` | **Persistent header + floating dock** — header never changes; icon-only actions ride a floating pill above the list. | Long scrolling lists; keeps stats always visible. |
| `page-toolbar-stacked.tsx` | **Stacked** — stat cards row + labelled bulk-action row that tints when active, with All / Invert / None. | Data-dense list views, power users. |
| `page-toolbar-path-rail.tsx` | **Path-led rail** — breadcrumb is the title; a right-hand rail of icon actions swaps to bulk mode in place. | Deeply nested browsing where the path matters most. |
| `page-toolbar-command-bar.tsx` | **Slide-over command bar** — permanent path row; an inverted full-width bar slides in beneath it on selection. | Unmistakable bulk mode; touch-friendly labelled targets. |

## Bulk operations covered

select (tri-state all/none/invert) · move · favorite · download · share · trash
· delete forever · restore, plus overflow menu (copy to…, copy link).

Trash context (`context="trash"`) swaps the destructive set for **Restore /
Restore to… / Delete forever**.

## Nested folders

The toolbars render the app's existing `<Breadcrumbs />` from
[`breadcrumb-navigation.tsx`](../breadcrumb-navigation.tsx) — no `path` prop.
It reads `useBreadcrumbs()` (route `crumbs` from the loader) and `useParams()`
itself, collapses the middle of a deep path behind a "…" dropdown, and strips
`cursor`/`selectedItems` from the href so navigating up doesn't carry a stale
selection.

Variants 4 and 5 always show it; variants 1 and 2 swap their `<h1>` for it once
`useBreadcrumbs()` reports more than one crumb. Your route loader must return
`crumbs` for any of this to appear:

```tsx
export async function loader({ params }: Route.LoaderArgs) {
  return { crumbs: await getBreadcrumbs(folderId), items, nextCursor, hasMore }
}
```

## Stats

Folder count, file count, favorites, total size, storage meter against quota,
trashed count, and per-selection summary (count, folders/files split, selected
size). Format sizes with `formatSize('byte', 'unit', bytes)` from
`@/utils/formaters` before passing them in — `LibraryStats.size` is a string.

## Usage

```tsx
import { PageToolbarMorph, type LibraryStats } from '@/components/core-components/page-toolbar'
import { SelectionProvider, useSelection } from '@/components/stash/selection'

const stats: LibraryStats = {
  folders: 34, files: 1286, favorites: 52, trashed: 19,
  size: '18.4 GB', quota: '40 GB', usedPercent: 46,
}

function StoragePage({ items }) {
  return (
    <SelectionProvider items={items.map((i) => i.id)}>
      <div className="relative flex flex-col">
        <StorageToolbar />
        {/* item grid */}
      </div>
    </SelectionProvider>
  )
}

function StorageToolbar() {
  const { selectedIds } = useSelection()
  const fetcher = useFetcher()

  return (
    <PageToolbarMorph
      stats={stats}
      context="files"
      selectedSize={formatSize('byte', 'unit', selectedBytes)}
      onMove={() => setMoveDialogOpen(true)}
      onFavorite={() =>
        fetcher.submit(
          { intent: 'favorite_items', selectedItems: selectedIds },
          { method: 'POST', action: href('/api/favorites') }
        )
      }
      onTrash={() =>
        fetcher.submit(
          { intent: 'trash_items', selectedItems: selectedIds },
          { method: 'POST', action: href('/api/items') }
        )
      }
    />
  )
}
```

`PageToolbarDock` must sit inside a `relative` container — the dock is
absolutely positioned at `bottom-5`.

## Selection

The toolbars read the app-wide selection actor from
[`@/components/stash/selection`](../../stash/selection.tsx) directly — there are
no `selectedCount` / `selectionState` / `onToggleAll` / `onClear` props. That
means the header's checkbox, the item-grid checkboxes, and `?selectedItems` all
stay in lockstep for free, and shift-click range selection keeps working.

The consequence: a toolbar **must** render under a route that mounts
`<SelectionProvider items={…}>`, which registers the route's ids and runs the
URL sync. Outside one, `selectedIds` stays empty and the toolbar never enters
bulk mode.

Two things the toolbar still can't know, so they remain props: `selectedSize`
(and `selectedFolders`/`selectedFiles` on the dock), which need the item records,
not just ids.

`PageToolbarStacked`'s **Invert** button is opt-in via `onInvert` — the shared
selection machine only has `SELECT_ALL` / `UNSELECT_ALL` / `TOGGLE`, no invert
event. Omit the prop and the button is hidden; pass one and wire it however the
route prefers (or add an `INVERT` event to `selection.machine.ts`).

## Design-token rules applied

These deviate from the raw design export on purpose — repo conventions win:

- **Surfaces**: headers are chrome, so `bg-sidebar` (not `bg-background`).
- **Structural borders**: `border-input`, never the default `border` token.
- **z-index**: sticky headers cap at `z-10` — anything higher covers tooltip
  portals, which sit at `z-9999`.
- **Type scale**: `text-xs` is the floor; the export's `text-[11px]`,
  `text-[12.5px]`, `text-[13px]`, `text-[15px]` map to `text-xs` / `text-sm`.
- **Icons**: `size-5` inline (`size-4` for the meter's inline glyph); the
  export's `size-[15px]`/`size-[17px]`/`size-[18px]` are gone.
- **Widths**: `min-w-40` / `max-w-40` / `min-w-48` replace the `[168px]`/`[190px]`
  arbitraries.
- **`font-stashly`** on every data-display run (counts, stats, crumbs, labels).
- **Fixed grounds**: the command bar's inverted row uses the `primary` /
  `primary-foreground` token pair rather than literal colors, so contrast holds
  in both themes.

## Icon substitutions

The design named icons that don't exist in `@/components/icons`; these are the
in-repo equivalents used instead:

| Design | Used |
| --- | --- |
| `ShareItemIcon` | `ShareItemFillIcon` |
| `GridIcon` / `ListIcon` | `GridFillIcon` / `ListFillIcon` |
| `StorageIcon` | `StorageFillIcon` |
| `BackIcon` | `ArrowLeftFillIcon` |
| `CheckSquareIcon` / `CheckboxIcon` / `UncheckIcon` | the `Checkbox` primitive from `@/ui/checkbox`, which already models `'indeterminate'` |

`HomeIcon` and `ChevronRightIcon` are moot — the design's own breadcrumb
component was dropped in favour of the app's `<Breadcrumbs />`.

The grid/list toggle uses `LayoutMenu`/`LayoutMenuItem` (via `layout-toggle.tsx`)
rather than a hand-styled `ButtonGroup`, matching every other layout switcher in
the app — note that it also writes `?layout=` to the URL.

Preview: `Bulk Toolbar Concepts.html` in the Claude Design project — all five
variants, light + dark, selection / Trash states, and a folder-depth switch
(root → 4 levels deep).
