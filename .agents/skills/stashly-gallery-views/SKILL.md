---
name: stashly-gallery-views
description: Stashly gallery views — grid/river/waterfall layouts, per-item view transitions, the gallery-image overlay route, seed thumbnail dimensions, and the four theme blocks. Load when editing gallery, waterfall, river, or view-transition code in the Stashly repo.
---

# Stashly Gallery Views

**Gallery route structure**: `gallery.tsx` is a parent route; `gallery-image.tsx` is the child (fixed overlay, `z-50`). Both render simultaneously — the gallery stays mounted behind the overlay. Child route closes via `navigate(-1)`.

**Per-item view transition components**: Can't call hooks inside `.map()`, so each gallery layout has its own item component (`GridItem`, `RiverItem`, `WaterfallItem`). Each calls `useViewTransitionState(item.id)` and sets the transition name only when the transition is active — prevents duplicate `viewTransitionName` values while the gallery stays mounted:
```tsx
const isTransitioning = useViewTransitionState(item.id)
style={isTransitioning ? { viewTransitionName: `img-${item.id}` } : undefined}
```
Links use `<Link to={item.id} viewTransition unstable_mask=".">` — `unstable_mask="."` keeps the gallery URL in the address bar.

**`backdrop-blur` on named view-transition elements**: NEVER apply `backdrop-filter: blur` to an element that has a `view-transition-name`. The blur bakes into the rasterized snapshot at capture time — as the old snapshot fades out over live content, it produces a visible ripple/blur artifact. Put `backdrop-blur` on an unnamed parent or sibling; use `bg-black/75` opacity on the named element itself.

**Waterfall layout**: CSS `columns-*` masonry in `app/components/views/waterfall-view.tsx`. Each item uses an id-derived aspect ratio (`aspectFromId`) to vary cell height. The `<img>` element **must keep both `width` and `height` HTML attributes** — removing `height` breaks lazy loading because CSS columns renders items as 0-height boxes that never enter the viewport.

**Seed thumbnail dimensions**: `generateThumbnail` in `prisma/seedData/data.ts` stores dimensions differently per view:
- `waterfall` → fixed `width`, variable `height`
- `river` → variable `width`, fixed `height`
- `grid` → square (equal width and height)

**Theme structure**: `app/styles/globals.css` has **four** theme blocks that must all be updated together: `[data-theme='light']`, `[data-theme='dark']`, and two `[data-theme='system']` blocks (one per `prefers-color-scheme` media query).
