# Page header toolbar — bulk operations

The storage page header, built on the app's shadcn/ui primitives in `@/ui/*`,
icons from `@/components/icons`, and `globals.css` design tokens. No inline
styles and no arbitrary Tailwind values — token scale classes only, so
light/dark mode comes free from the `.dark` class on `<html>`.

## What actually ships

**`PageToolbarPathRail` won** (stash UI pass, PR #21). It is wired into the app
through `StashPageToolbar` in
[`@/components/views/stash-page-toolbar.tsx`](../../views/stash-page-toolbar.tsx),
which totals the selected bytes, opens `MoveToFolderDialog`, and connects the
bulk actions to the `/api/items` and `/api/favorites` intents. Routes using it:
`routes/stash/all.tsx` and `routes/stash/folder.tsx` — `app-toolbar.tsx` bails
out on those paths so the two don't stack.

The four losing variants — morph, dock, stacked and command-bar — were
**deleted on 19 Aug 2026**. They had sat unwired since the decision: exported and
compiling, but never rendered by anything in `app/routes/`. The concept set had
served its purpose, so it is gone rather than left to rot. Recover any of them
from git history if a future page wants a different interaction model.

## The variant

| File | Direction | Best for |
| --- | --- | --- |
| `page-toolbar-path-rail.tsx` | **Path-led rail** — breadcrumb is the title; a right-hand rail swaps to bulk mode in place. | Deeply nested browsing where the path matters most. |

`toolbar-stats.tsx` holds the shared display pieces the variants compose —
`SelectAllCheckbox`, `InlineStats`, `StorageMeter`, `StatCard`, `StatCards` —
all re-exported from `index.ts`.

The layout switcher is **not** a toolbar concern. `<LayoutToggle>` lives at
`@/components/layout-toggle` and is rendered once, by `AppHeader`. The toolbars
previously carried a local copy plus `layout` / `onLayoutChange` props; both are
gone, and no route ever passed them.

## Bulk operations covered

select (tri-state all/none/invert) · move · favorite · download · share · trash
· delete forever · restore, plus overflow menu (copy to…, copy link).

Trash context (`context="trash"`) swaps the destructive set for **Restore /
Restore to… / Delete forever**.

Path-rail carries the subset it needs: move · favorite · download · share ·
trash (and restore / delete-forever under `context="trash"`), with a
clear-selection button in place of the tri-state `SelectAllCheckbox` and no
overflow menu. Its non-selection state is currently bare — just a separator; the
neutral search / filter / sort / view rail its JSDoc describes is not rendered.

## Nested folders

The toolbars render the app's existing `<Breadcrumbs />` from
[`breadcrumb-navigation.tsx`](../breadcrumb-navigation.tsx) — no `path` prop.
It reads `useBreadcrumbs()` (route `crumbs` from the loader) and `useParams()`
itself, collapses the middle of a deep path behind a "…" dropdown, and strips
`cursor`/`selectedItems` from the href so navigating up doesn't carry a stale
selection.

Path-rail always shows it; the removed variants swapped their
`<h1>` for it once `useBreadcrumbs()` reports more than one crumb. (Path-rail
inverts the test: with **no** crumbs it falls back to a plain label derived from
`location.state?.name` or the last URL segment, and hides its Back button.) Your
route loader must return `crumbs` for any of this to appear:

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

The removed variants took the whole `stats: LibraryStats`; command-bar took
a pre-rendered `statsLine: string`. **Path-rail takes neither** — its only
counter prop is `itemCount: number`, rendered as an `{n} items` badge, plus an
`onBack` callback for the Back button. `StashPageToolbar` still accepts
`LibraryStats` at the route boundary and passes `stats.files + stats.folders`
down, so loaders don't have to change if a different variant is swapped in.

## Usage

In a route, don't reach for a variant directly — render `StashPageToolbar`,
which already owns the selected-byte total, the move dialog and the fetcher
intents:

```tsx
<SelectionProvider items={items.map((i) => i.id)}>
  <StashPageToolbar stats={loaderData.stats} items={items} parentId={folderId} />
  {/* item grid */}
</SelectionProvider>
```

Wiring a variant by hand looks like this:

```tsx
import { PageToolbarPathRail, type LibraryStats } from '@/components/core-components/page-toolbar'
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
    <PageToolbarPathRail
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

(Historical, for anyone restoring a variant from git.) `PageToolbarDock` had to sit inside a `relative` container — the dock was
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

(Historical.) `PageToolbarStacked`'s **Invert** button was opt-in via `onInvert` — the shared
selection machine only has `SELECT_ALL` / `UNSELECT_ALL` / `TOGGLE`, no invert
event. Omit the prop and the button is hidden; pass one and wire it however the
route prefers (or add an `INVERT` event to `selection.machine.ts`).

## Design-token rules applied

These deviate from the raw design export on purpose — repo conventions win:

- **Surfaces**: headers are chrome, so `bg-sidebar` (not `bg-background`).
- **Structural borders**: `border-input`, never the default `border` token.
- **z-index**: sticky headers cap at `z-10` — anything higher covers tooltip
  portals, which sit at `z-9999`.

The shipped path-rail departs from the first and third of those, in step with
the rest of the main column after PR #21: it sits on `bg-background` (like
`app-header.tsx`, which is `bg-background z-40`) and uses `sticky top-0 z-30`.
Both are still under the tooltip layer. Its groupings are drawn with
`ring-2 ring-accent` over `bg-card` rather than `border-input`, and the bulk
cluster is a real `ButtonGroup` with `ButtonGroupText`/`ButtonGroupSeparator`
holding the "{n} selected" count.
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

The grid/list toggle is not part of these variants — see above. The app-wide
`<LayoutToggle>` in `AppHeader` uses `LayoutMenu`/`LayoutMenuItem` rather than a
hand-styled `ButtonGroup`, and reads/writes `?layout=` on the URL itself, so it
needs no props from a toolbar.

Preview: `Bulk Toolbar Concepts.html` in the Claude Design project — all five original
variants, light + dark, selection / Trash states, and a folder-depth switch
(root → 4 levels deep).
