# Stashly Design System

Nov 14, 2026 · @alon gvili

## Overview

Stashly looks like a calm, grey, monospaced instrument panel. It has one accent colour (indigo), squarish corners, and every token is defined twice: once for light mode and once for dark.

The system is built on source-owned shadcn/ui components in `app/components/ui/`. Those sit on Radix UI primitives and are styled with Tailwind CSS 4. All tokens live in `app/styles/globals.css`. Conditional classes go through `cn()` from `@/utils/styles`.

Core principles:

- **Neutral first.** Surfaces, text and charts are achromatic greys. Colour is used only for the primary action and for status.
- **One typeface.** `font-stashly` (Share Tech Mono) is applied to every element by the base layer.
- **Squarish.** Nothing becomes a pill. Only things the design itself draws round are round.
- **Two surfaces.** Chrome (headers, toolbars) sits on `bg-sidebar`, and content sits on `bg-background`.
- **Real data only.** A value that isn't available is left out or labelled unavailable, never faked.

## Color

All colours are OKLCH values in `globals.css`. Each token has a light and a dark value, and Tailwind exposes it as a class (`bg-card`, `text-muted-foreground`, `border-input`). Use those classes rather than `var(--*)` or literal colours.

**Surfaces and text**

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | oklch(0.97 0 0) | oklch(0.13 0 0) | Page canvas, item grids |
| `foreground` | oklch(0.16 0 0) | oklch(0.97 0 0) | Body text |
| `card` | oklch(1 0 0) | oklch(0.18 0 0) | Cards, outline buttons |
| `popover` | oklch(1 0 0) | oklch(0.21 0 0) | Menus, popovers |
| `sidebar` | oklch(0.955 0 0) | oklch(0.11 0 0) | Chrome: headers, toolbars, dialog top and bottom bars |
| `secondary` | oklch(0.93 0 0) | oklch(0.26 0 0) | Badges, secondary buttons |
| `muted` | oklch(0.945 0 0) | oklch(0.23 0 0) | Recessed tracks, hover fills |
| `muted-foreground` | oklch(0.44 0 0) | oklch(0.68 0 0) | Descriptions, counts, icons in badges |
| `accent` | oklch(0.9 0 0) | oklch(0.3 0 0) | Hover on outline buttons |
| `border` | oklch(0.87 0 0) | oklch(0.32 0 0) | Tile-card borders (at /50) |
| `input` | oklch(0.82 0 0) | oklch(0.29 0 0) | Structural separators, panel-card borders |
| `ring` | oklch(0.16 0 0) | oklch(0.97 0 0) | Focus rings |

**Brand and status**

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `primary` | oklch(54.5% 0.159 275) | oklch(72.6% 0.105 277) | The one accent: primary buttons, selection, links |
| `destructive` | oklch(0.55 0.225 27) | oklch(0.62 0.2 25) | Delete, errors; the only signal-coloured badge |
| `success` | oklch(0.72 0.17 150) | oklch(0.72 0.17 150) | Done, uploaded |
| `warning` | oklch(0.8 0.16 85) | oklch(0.82 0.16 85) | Degraded, near limit |
| `info` | oklch(0.72 0.13 235) | oklch(0.74 0.12 235) | Neutral notices |
| `rejected` | oklch(0.7 0.17 10) | oklch(0.7 0.17 10) | Declined invitations and requests |

Each status token has a `-foreground` partner for text on a light tint of the same hue. Charts use `chart-1` to `chart-14`, which are 14 greys and are reversed in dark mode.

On a fixed-colour background, such as a `from-black/90` overlay on a thumbnail, use literal `text-white` or `text-white/80`. `text-foreground` flips with the theme and would lose contrast there.

## Typography

One typeface, `font-stashly`, runs everywhere. The base layer puts it on every element (`* { @apply font-stashly }`), with letter-spacing at 0.01em.

| Family token | Stack | Use |
| --- | --- | --- |
| `font-stashly` | Share Tech Mono, IBM Plex Sans Hebrew | Everything: UI, data, headings |
| `font-sans` | Geist | Not used in components |
| `font-mono` | JetBrains Mono, Geist Mono | Not used in components |

Rules:

- Never write `font-sans` or `font-mono`. When a mockup uses them, translate them to `font-stashly`.
- `text-xs` is the smallest size. Don't use arbitrary sizes like `text-[10px]` or `text-[14px]`; use the scale (`text-xs`, `text-sm`, `text-base`, …).
- Section and card labels use `text-sm uppercase font-stashly`. A count or subtitle beside the label uses `text-sm text-muted-foreground`, on the same row with `flex items-baseline gap-3`.
- Buttons use `text-sm font-medium`, and badges use `text-xs font-normal`.
- An embedded widget with its own font (for example Monaco) needs a `font-family: inherit` carve-out, because the global rule overrides it.

## Shape and radius

Corners are squarish, and nothing is ever a pill. This is the owner's mandatory rule from 13 Nov. `--radius` is 12px (0.75rem), and the scale is derived from it.

| Class | Radius | Typical use |
| --- | --- | --- |
| `rounded-[4px]` | 4px | Chips, `Kbd` keys, counts 20px tall or less; the checkbox corner |
| `rounded-sm` | 8px | `Badge` (24px tall) |
| `rounded-md` | 10px | Buttons, inputs, panel cards |
| `rounded-lg` | 12px | Large surfaces only: a pill on anything 24px tall |
| `rounded-xl` | 16px | Large surfaces |
| `rounded-2xl` | 16px | Tile cards (collection, home, file) |

A corner of half the element's height or more makes a pill. So:

- Never use `rounded-full`. Never use a radius that turns a short element into a pill.
- **Badge** is `<Badge>` from `@/ui/badge` as it stands: 24px tall, `rounded-sm`, mono `text-xs`, a 14px muted icon and a neutral `bg-secondary` fill. Don't add shape, size or font classes. Variants change only colour, and `destructive` is the one signal colour. Put any other status colour in `className`.
- **Switches** in new UI use `<Switch shape="square">`.
- **Avatars** are not circular unless the design draws them round.

## Spacing, layout and surfaces

Spacing uses Tailwind's 4px step (`--spacing: 0.25rem`). Depth comes from two surface tones plus a few named surface classes, not from heavy shadows.

**Regions**

| Region | Pattern |
| --- | --- |
| App header (`app-header.tsx`) | `h-14`, `bg-sidebar`, sticky top, outline buttons with `bg-card!` |
| App toolbar (`app-toolbar.tsx`) | `h-12 p-2`, `bg-sidebar`, sticky bottom: breadcrumbs and bulk actions |
| Content canvas | `bg-background` |
| Separators between regions | `border-b` or `border-t` with `border-input`, never the default `border` token |

**Surface classes**

| Class | Look | Use |
| --- | --- | --- |
| `surface-glass` | Card at 70% opacity, 12px blur, border at 50% | Panel cards |
| `surface-elevated` | Solid card plus `shadow-stashly` and `shadow-md` | Raised panels |
| `surface-inset` | Muted at 50% with an inset shadow | Recessed wells and tracks |

Shadows are soft greys: `shadow-xs`, `shadow-sm`, `shadow-md` and `shadow-stashly`, a three-layer lift.

**Two card patterns** (don't mix them in one grid)

- **Panel card** for page sections: `<Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden">`, with a `CardHeader` of `flex items-baseline px-4 py-4` and a `CardContent` of `p-4`. Never use a bare `<Card>`.
- **Tile card** for browsable tiles (collection, home and file cards): `rounded-2xl border border-border/50 bg-card overflow-hidden`, with a `border-b border-border/50` between cover and body.

**Layering (z-index)**

| Layer | z-index |
| --- | --- |
| Tooltips | `z-9999` (top) |
| App header | `z-40`, the one exception, so it stays above item-page overlays |
| Item-page controls (`image-stage`, `video-stage`) | `z-20` |
| Sticky toolbars | `z-10` at most |
| Dialogs and dropdowns | Radix Portal defaults |

Layout widths are container-query tokens: the header compacts below 60rem, narrows below 48rem and switches to a phone layout below 36rem.

## Components and icons

Build new UI from the primitives in `app/components/ui/` (imported as `@/ui/*`) and the shared pieces in `app/components/core-components/`. Look for an existing component and extend it before you write a new one.

| Layer | Location | Contents |
| --- | --- | --- |
| Primitives | `app/components/ui/` | 54 shadcn/Radix parts: Button, Badge, Card, Dialog, DropdownMenu, InputGroup, Kbd, SegmentedControl, LayoutMenu, Switch, Table, Tooltip, … |
| Shared components | `app/components/core-components/` | DataTable, dialogs (rename, move, share, new folder), collection cards, selection bar, search input |
| Route views | `app/components/views/` | Page-level compositions |
| Icons | `app/components/icons.tsx` | 172 exports; the only icon source |

**Button**: `rounded-md text-sm font-medium`, with icons at `size-5`.

- Variants: `default` (primary fill), `outline` (`bg-card` with an `border-input` border, used in the header), `secondary`, `ghost`, `destructive` and `link`.
- Sizes: `sm` (h-8), `default` (h-9) and `lg` (h-10), plus the square sizes `icon-sm`, `icon` and `icon-lg`.
- A primary action stands alone and is never fused into a `ButtonGroup`.

**Icons**: import them only from `@/components/icons`, never directly from `lucide-react`. If an icon is missing, ask for it to be added. Icons in rows and tables are `size-5` and inherit `text-current`.

**Patterns to reuse**

- Search fields use `InputGroup`, `InputGroupAddon` and `InputGroupInput`, as in `filters.tsx`.
- Single-choice controls use `LayoutMenu` in the header bar and `SegmentedControl` (a recessed `bg-muted` track with a raised `bg-card` segment) in a page body.
- Destructive confirms use `useConfirm`. Never use `window.confirm` or an inline alert dialog.
- Item grids use `ItemCard`, its compound `ItemCard.Actions` menu, and `SelectionProvider` for multi-select.
- Don't use toasts: sonner has been removed, and the app has no ThemeProvider.

## Rules of thumb

A UI change is not done until it has been seen rendering correctly in both light and dark mode.

| Do | Don't |
| --- | --- |
| `font-stashly`, with `text-xs` as the smallest size | `font-sans`, `font-mono`, `text-[10px]` |
| Token classes (`bg-card`, `border-input`) | `var(--*)`, hex values, arbitrary sizes |
| `rounded-[4px]` for chips, `rounded-sm` (via `Badge`) for badges | `rounded-full`, or a pill made with `rounded-lg` |
| `bg-sidebar` for chrome, `bg-background` for canvas | New surface colours |
| Icons from `icons.tsx` | `lucide-react` imports |
| Extend `@/ui` and core-components | Parallel look-alike components |
| Only the controls the spec shows | Extra pickers, toggles, round avatars |
| `text-white` on fixed dark overlays | `text-foreground` on overlays |

Verification:

1. Hard-reload (Ctrl+Shift+R) after adding a new Tailwind class, because a stale stylesheet can make the class look broken.
2. Check the page in the browser through chrome-devtools in light mode, then in dark mode.
3. To prove a class resolves without signing in, open `/auth/sign-in`, add a test `div` and read `getComputedStyle`.

Open question: `globals.css` defines a `text-2xs` size (11px), but the rule says `text-xs` is the smallest. Should `text-2xs` be removed, or does it have an allowed use?
