# Folder Card Components

Production TSX port of the "Folder Card Concepts" prototype — a drop-in replacement for `CardItem` on folder items.

Three variants were ported originally. **Variant B (`FolderCardTab`) is the only one that reached production**, and the other two were deleted on 19 Aug 2026 along with their shared pieces (`cover.tsx`, `use-lift.ts`, `types.ts`, `index.ts`). They had no consumers — every live call site imports `./folder-card-components/folder-card-tab` directly rather than going through the barrel. Recover them from git history if a future page wants the poster silhouette.

## Files

- `folder-card-tab.tsx` — Variant B: square (`aspect-square`) `bg-card` card, accent cover strip above the folder body, tab notch top-left carrying the name + created date, size + item count footer. Takes `ItemCardProps`; `children` render inside `ItemCard.Actions`.

The SVG path math lives in [`@/utils/folder-shape`](../../../utils/folder-shape.ts), which exports `folderPathLeft` / `folderPathRight`.

## Usage

Spread the stash item, exactly like any other `ItemCard`:

```tsx
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'

<FolderCardTab key={item.id} {...item}>
  {/* optional dropdown content — lands in ItemCard.Actions */}
</FolderCardTab>
```

It wraps `<ItemCard>`, so it inherits navigation, drag-and-drop and selection, and pulls its display fields from `useItemCard()`.

In production use by `collection-view`, `overview-view`, `evidence-card`, and the `all` / `folder` / `favorites` / `pinned` / `shares` / `trash` routes.

## Notes

- Fonts: cards assume Space Grotesk (or your app sans) is inherited; meta text uses `font-stashly`.
- Grid: works at `minmax(280px, 1fr)`.
- Styling is Tailwind + theme tokens (`bg-card`, `bg-primary`, `stroke-input`), so it follows the app theme in both light and dark.
- Item count prefers `folder.inclusiveChildCount`, falling back to `folder.childCount`.
