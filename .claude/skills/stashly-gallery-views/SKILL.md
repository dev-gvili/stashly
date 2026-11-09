---
name: stashly-gallery-views
description: Stashly gallery views — the Images page (native CSS grid/columns/flex layouts with id-based tile shapes), the shared gallery prefs cookie, date groups, per-tile view transitions into the file page, and the legacy gallery still used by Videos and workspaces. Load when editing gallery, Images, river, waterfall, grid, or view-transition code in the Stashly repo.
---

# Stashly Gallery Views

## Where things live

- **Images route** `app/routes/stash/gallery.tsx` (`/:me/stash/images`): forces `category: 'image'`, strips `query`/`searchMode` from the loader (search runs client-side via `useItemSearch`), returns `crumbs` `[{id:'images',name:'Images'}]` and `prefs`. Its `shouldRevalidate` skips `layout`, `query`, `searchMode` and `selectedItems`.
- **Gallery body** `app/components/Gallery.tsx` (`Gallery`), `app/components/gallery/gallery-section.tsx` (date-group sections), `app/components/gallery/gallery-tile.tsx` (`GalleryTile`, memoised), `app/components/gallery/gallery-view-controls.tsx` (`GalleryHeaderTools`, `GalleryViewControls`).
- **Pure helpers** `app/utils/gallery-layout.ts`: `buildJustifiedRows`, `groupByDate`, `aspectOf`, `tileAspectFromId`, `aspectClassFromId`, `GALLERY_ZOOM_SIZES`, `DEFAULT_GALLERY_PREFS`, `parseGalleryPrefs` / `serializeGalleryPrefs`. Put new gallery math here and test it as a function.
- **Prefs** cookie `stashly-gallery` = `zoom.gap.byDate` (zoom 1–5, gap 0–20 step 2, byDate). Read in the loader; shared client store `app/hooks/useGalleryPrefs.ts`, because the header controls and the page live in different routes. Defaults: waterfall layout, zoom 3, gap 16, byDate on.
- **CSS** `app/styles/globals.css`: utilities `gallery-grid`, `gallery-columns`, `gallery-river`, `content-auto`; tokens `--ease-gallery`, `--container-gallery-label`, `--container-gallery-header`.
- **Header** `app/components/app-header.tsx` hosts the view controls, the layout toggle (`LayoutToggle`, List hidden on images; `LayoutMenu` `defaultLayout` is `waterfall` on `/images`, `grid` elsewhere) and the main search (`HeaderSearch` in `app/components/filters/filters.tsx`). Gallery search does not get its own bar.
- **Legacy gallery** `LegacyGallery` in `Gallery.tsx` still renders Videos and the workspace gallery through `app/components/views/{river,waterfall,grid}-view.tsx`. Do not delete those files without the owner's approval.

## Layouts (Images page)

The browser lays tiles out. No per-frame JavaScript position engine exists; the old `layoutRiver/Waterfall/Grid` engines were deleted.

- **Grid** — CSS grid `repeat(auto-fill, minmax(var(--gallery-col), 1fr))`, `gap: var(--gallery-gap)`. Tile shape is 4:3 (`tileAspectFromId` for grid).
- **Waterfall** — CSS `column-width: var(--gallery-col)` masonry. Tile shapes come from the id hash, cycle `[0.8, 1, 0.4, 1.2]` (`aspectClassFromId` order). Default layout.
- **River** — one wrapping flex container. Each tile is `flex: var(--aspect) var(--aspect) calc(var(--aspect) * var(--row-h))` with `aspect-ratio`; a `::after` with `flex: 10000 1 0` keeps the last line at target height. Tile shapes come from `RIVER_ASPECT_CYCLE`.
- `--gallery-col` and `--gallery-gap` are set on the gallery body in px. `GALLERY_ZOOM_SIZES`: river row height `[110,150,190,240,300]`; waterfall column `[150,190,240,300,380]`; grid column `[130,170,210,260,320]`.

**Tile shapes are id-based, not real image dimensions.** `tileAspectFromId(layout, id)` hashes the item id, so a tile keeps the same shape across reloads. Real photo dimensions (26 of 39 test photos are portrait 3:4) looked uniform, and the owner chose the id-based shapes. Do not switch to real dimensions without asking. The 512×512 thumbnail size is not an image aspect; reading it as one made every tile square.

**Measured parity.** Sidebar expand/collapse at 60 Hz, 4 cycles, 39 images: old code 57–59 fps (waterfall), 59 fps (river), 59 fps (grid); new code 58–59 fps across the same set. Before the fix, River dropped to 37–39 fps. Keep this check when touching layout CSS. Script: `window.__measure({cycles:4, settle:900})`. Check every zoom size, not only a large one (the smallest slider size is the risky one).

## Date groups

`groupByDate` builds the sections. `GallerySection` renders a group header with a native tri-state checkbox (`SelectAllCheckbox`) that selects the whole group. Tiles use the ItemCard checkbox styling (`itemCheckboxClassName`).

## Selection and actions

Images use the existing stash selection (`SelectionProvider`, `useSelection`). The header shows `StashPageToolbar variant="actions"` only while items are selected, with `actionSet=['addToCollection','share','download','trash','clear']` and `confirmTrash`. Do not add a floating bar or a second toolbar row. Handlers live in `app/components/views/stash-page-toolbar.tsx`, drawn by `PathRailSelectionActions` in `page-toolbar-path-rail.tsx`.

- **Share** — existing `ShareDialog`, one item only. Disabled for more than one item ("Share one item at a time").
- **Add to collection** — `AddToCollectionMenu` (loads the collections page loader via `fetcher.load`) plus `useCollectionMutations().addItems`.
- **Download** — one file: fetch-to-blob (cross-origin `<a download>` is ignored). Several: a stored ZIP built by `app/utils/zip.ts` (`createZip`, `crc32`, `uniqueZipNames`), no dependency. Data comes from `getDownloadUrls` in `app/.server/item-actions.ts` (read access, all-or-nothing 404) through the `download_urls` intent on `/api/items`, and `useDownloadItems`.

## View transitions

Can't call hooks inside `.map()`, so each tile resolves its destination with `useFileHref(item) ?? '.'`, passes it to `useViewTransitionState`, and sets the transition name only while transitioning:
```tsx
const to = useFileHref(item) ?? '.'
const isTransitioning = useViewTransitionState(to)
style={isTransitioning ? { viewTransitionName: `img-${item.id}` } : undefined}
```
Links are `<Link to={to} viewTransition prefetch="intent">` (`Gallery.tsx`, `gallery-tile.tsx`). The receiving end, `img-${item.id}`, lives in `item-page/image-stage.tsx` and `item-page/video-stage.tsx`. Opening an item is a normal navigation to the file page (`routes/stash/file.tsx`); there is no lightbox and no overlay route. The gallery's scroll position is restored through `useScrollRestoration` on the enclosing `[data-slot="scroll-area-viewport"]`.

**`backdrop-blur` on named view-transition elements**: never apply `backdrop-filter: blur` to an element with a `view-transition-name`. The blur bakes into the snapshot and ripples as it fades. Put the blur on an unnamed parent and use `bg-black/75` on the named element.

**Image elements in the waterfall keep `width` and `height` attributes.** Without `height`, lazy loading breaks, because CSS columns render 0-height boxes that never enter the viewport.

## Known open items

- `LayoutToggle` icon buttons have no `aria-label` (Images header).
- The phone search field is cramped (about 135 px with two mode buttons at 390 px).
- No gap or size controls when the header is under 60rem (e.g. 1024 px with the sidebar open).

## Theme structure

`app/styles/globals.css` has **four** theme blocks that must all be updated together: `[data-theme='light']`, `[data-theme='dark']`, and two `[data-theme='system']` blocks (one per `prefers-color-scheme` media query).
