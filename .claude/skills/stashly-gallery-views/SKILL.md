---
name: stashly-gallery-views
description: Stashly gallery views — grid/river/waterfall layouts, per-item view transitions into the item page, seed thumbnail dimensions, and the four theme blocks. Load when editing gallery, waterfall, river, or view-transition code in the Stashly repo.
---

# Stashly Gallery Views

**Gallery route structure**: `routes/stash/gallery.tsx` serves `/images`, `/videos`, and `/workspaces/:workspaceId/gallery`. There is **no child overlay route** anymore (the old `gallery-image.tsx` is gone) — opening an item is a real navigation to the file route (`routes/stash/file.tsx`), so the gallery unmounts. That's why `Gallery.tsx` wires `useScrollRestoration` to the enclosing `[data-slot="scroll-area-viewport"]`: the list position has to be restored on back-navigation.

**Per-item view transition components**: Can't call hooks inside `.map()`, so each gallery layout has its own item component — `GridItem` (`app/components/Gallery.tsx`), `RiverItem` (`river-view.tsx`), `WaterfallItem` (`waterfall-view.tsx`). Each resolves its destination with `useFileHref(item) ?? '.'`, passes that to `useViewTransitionState`, and sets the transition name only when the transition is active — prevents duplicate `viewTransitionName` values across simultaneously-rendered layouts:
```tsx
const to = useFileHref(item) ?? '.'
const isTransitioning = useViewTransitionState(to)
style={isTransitioning ? { viewTransitionName: `img-${item.id}` } : undefined}
```
Links are `<Link to={to} viewTransition prefetch="intent">`. The matching `img-${item.id}` name on the receiving end lives in `item-page/image-stage.tsx` and `item-page/video-stage.tsx` (set unconditionally there). Waterfall additionally passes `mask={`images/${img.id}`}` to keep a gallery-shaped URL in the address bar; grid and river don't mask.

**`backdrop-blur` on named view-transition elements**: NEVER apply `backdrop-filter: blur` to an element that has a `view-transition-name`. The blur bakes into the rasterized snapshot at capture time — as the old snapshot fades out over live content, it produces a visible ripple/blur artifact. Put `backdrop-blur` on an unnamed parent or sibling; use `bg-black/75` opacity on the named element itself.

**Waterfall layout**: CSS `columns-*` masonry (`columns-2 sm:columns-3 md:columns-5 xl:columns-7`) in `app/components/views/waterfall-view.tsx`. Each item uses an id-derived aspect ratio (`aspectFromId`) to vary cell height. The `<img>` element **must keep both `width` and `height` HTML attributes** — removing `height` breaks lazy loading because CSS columns renders items as 0-height boxes that never enter the viewport.

**River layout**: greedy *justified rows* in `app/components/views/river-view.tsx` — items accumulate until they'd overflow, then the row height is solved so the row fills the container edge-to-edge (`TARGET_ROW_HEIGHT = 150`, `MAX_PER_ROW = 7`, `ROW_GAP = 8`). Aspect ratios come from its own id-derived `aspectFromId` over `ASPECT_CYCLE`, so an item always lands on the same shape. Justified rows set `flexGrow: aspect / flexBasis: 0`; the trailing row keeps natural width at the target height. `app/components/views/buildRows.ts` holds the shared `ImageData` type and the older `buildRows`/`calculateImageDimensions` helpers.

**Seed thumbnail dimensions**: `generateThumbnail` in `prisma/seedData/data.ts` stores dimensions differently per view:
- `waterfall` → fixed `width`, variable `height`
- `river` → variable `width`, fixed `height`
- `grid` → square (equal width and height)

**Theme structure**: `app/styles/globals.css` has **four** theme blocks that must all be updated together: `[data-theme='light']`, `[data-theme='dark']`, and two `[data-theme='system']` blocks (one per `prefers-color-scheme` media query).
