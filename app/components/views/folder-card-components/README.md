# Folder Card Components

Production TSX ports of the "Folder Card Concepts" prototype — drop-in replacements for `CardItem` (folder items).

## Files
- `folder-card-poster.tsx` — Variant A: 16:9 light card, folder tab on the right holding the cover image.
- `folder-card-poster-solid.tsx` — Variant A2: same silhouette, solid Tailwind color block instead of an image; `dark` prop for dark body; `color` prop to override the auto-picked color.
- `folder-card-tab.tsx` — Variant B: square dark card, cover header, edge-to-edge dark folder body, category icon, size + item count footer.
- `cover.tsx`, `folder-shape.ts`, `use-lift.ts`, `icons.tsx`, `types.ts`, `index.ts` — shared pieces.

## Usage
```tsx
import { FolderCardPoster, FolderCardTab, FolderCardPosterSolid, type FolderCardData } from '@/components/folder-card'

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
<FolderCardPosterSolid folder={folder} dark onOpen={open} />
<FolderCardTab folder={folder} onOpen={open} />
```

## Notes
- Fonts: cards assume Space Grotesk (or your app sans) is inherited; meta text uses JetBrains Mono via inline `fontFamily`.
- Grid: Poster variants want wider cells, e.g. `repeat(auto-fill, minmax(360px, 1fr))`; Tab works at `minmax(280px, 1fr)`.
- Icons are ported from Stashly `icons.tsx`; swap the imports to your real file if you already have these.
- Styling is inline (no Tailwind dependency) so they drop into any setup; feel free to convert to Tailwind classes.
