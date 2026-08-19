# Folder Card Components

Production TSX ports of the "Folder Card Concepts" prototype — drop-in replacements for `CardItem` (folder items).

Variants A2 and B have since been **migrated onto `ItemCard`**: they take `ItemCardProps` (spread the stash item), wrap `<ItemCard>` so they inherit navigation, drag-and-drop and selection, pull their display fields from `useItemCard()`, and are styled with Tailwind tokens. Variant A is still on the original prototype API. `FolderCardTab` is the one in production use (`collection-view`, `overview-view`, `suggestions-view`, and the `all` / `folder` / `favorites` / `pinned` / `shares` / `trash` routes).

## Files
- `folder-card-poster.tsx` — Variant A: 16:9 light card, folder tab on the right holding the cover image. **Prototype API** — `{ folder, onOpen }` with inline styles.
- `folder-card-poster-solid.tsx` — Variant A2: same 16:9 silhouette, solid `bg-primary` block instead of a cover image. Takes `ItemCardProps`; shows name, item count · size, and `updated <timeAgo>`.
- `folder-card-tab.tsx` — Variant B: square (`aspect-square`) `bg-card` card, accent cover strip above the folder body, tab notch top-left carrying the name + created date, size + item count footer. Takes `ItemCardProps`; `children` render inside `ItemCard.Actions`.
- `cover.tsx`, `use-lift.ts`, `types.ts`, `index.ts` — shared pieces (the SVG path math lives in `@/utils/folder-shape`, which exports `folderPathLeft` / `folderPathRight`; `types.ts` holds `FolderCardData` / `FolderCardProps`, used only by Variant A).

## Usage

Variants A2 and B — spread the stash item, exactly like any other `ItemCard`:

```tsx
import { FolderCardTab, FolderCardPosterSolid } from '@/components/views/folder-card-components'

<FolderCardTab key={item.id} {...item}>
  {/* optional dropdown content — lands in ItemCard.Actions */}
</FolderCardTab>

<FolderCardPosterSolid {...item} />
```

Variant A still takes the prototype view-model:

```tsx
import { FolderCardPoster, type FolderCardData } from '@/components/views/folder-card-components'

const folder: FolderCardData = {
  id: item.id,
  name: item.name,
  category: dominantCategory(item),      // 'text' | 'audio' | 'presentation' | 'image' | 'video' | 'pdf'
  kind: 'Docs',
  childCount: item.childCount,
  inclusiveSize: formatBytes(item.inclusiveSize),
  updatedAt: timeAgo(item.updatedAt),
  createdAt: formatDate(item.createdAt),
  cover: item.thumbnailUrl,
  fallback: 'linear-gradient(120deg,#ff5a1f,#ff2d55 42%,#7a1020)',
}

<FolderCardPoster folder={folder} onOpen={(f) => navigate(`/folder/${f.id}`)} />
```

## Notes
- Fonts: cards assume Space Grotesk (or your app sans) is inherited; the `ItemCard`-based variants use `font-stashly` for meta text, Variant A sets JetBrains Mono via inline `fontFamily`.
- Grid: Poster variants want wider cells, e.g. `repeat(auto-fill, minmax(360px, 1fr))`; Tab works at `minmax(280px, 1fr)`.
- Variant A's styling is inline (no Tailwind dependency) so it drops into any setup. A2 and B are Tailwind + theme tokens (`bg-card`, `bg-primary`, `stroke-input`) so they follow the app theme in both light and dark.
- Item count prefers `folder.inclusiveChildCount`, falling back to `folder.childCount`.
