/**
 * Layout math shared by the gallery's river and waterfall views.
 *
 * The two `aspect*FromId` functions look interchangeable but are not: the river
 * hashes with `reduceRight` and returns a numeric ratio, the waterfall hashes
 * with `reduce` and returns a Tailwind class. Swapping either one reshuffles
 * every item on screen, so both are kept verbatim.
 */
import type { GalleryImage } from '@/types/stash.types'

/**
 * Builds a `srcSet` of width candidates for an image URL.
 *
 * **A presigned URL is returned unchanged, as a single candidate.** Every query
 * param of a signed URL is covered by its signature, so appending `w=` puts the
 * request outside it and the object store answers 403 (verified on Tigris,
 * 2026-09-16). Silently serving one candidate is the right answer rather than a
 * throw: there is nothing to vary anyway, since a signed thumbnail is one
 * fixed-size WebP per stage, and the variants only ever re-fetched the same
 * bytes under a different URL.
 *
 * @param src - Image URL. Signed URLs are passed through.
 * @param widths - Candidate widths in pixels, used only for unsigned URLs.
 *
 * @example
 * buildSrcSet('/api/images?image=a.png', [256, 512])
 * // → '/api/images?image=a.png&w=256 256w, /api/images?image=a.png&w=512 512w'
 *
 * @example
 * buildSrcSet('https://b.example.com/t.webp?X-Amz-Signature=abc', [256, 512])
 * // → 'https://b.example.com/t.webp?X-Amz-Signature=abc'
 */
export function buildSrcSet(src: string, widths: number[]) {
  if (isSignedUrl(src)) return src
  const hasQuery = src?.indexOf('?') !== -1
  return widths
    .map((w) => `${src}${hasQuery ? '&' : '?'}w=${w} ${w}w`)
    .join(', ')
}

/**
 * True when a URL carries a SigV4 presigned signature, whose query string can
 * no longer be added to. Exported so other URL-rewriting helpers can make the
 * same check before appending anything.
 *
 * @example
 * isSignedUrl('https://b.example.com/t.webp?X-Amz-Signature=abc') // → true
 * isSignedUrl('/api/images?image=a.png') // → false
 */
export function isSignedUrl(src: string | null | undefined): boolean {
  return !!src && src.includes('X-Amz-Signature=')
}

// Preset aspect ratios (width / height), picked deterministically from the item
// id so a given item always lands on the same shape. Rows are justified: each
// row's height is solved so its items fill the full container width edge-to-edge.
const RIVER_ASPECT_CYCLE = [1, 2, 3 / 4, 2, 16 / 9, 4 / 3, 1, 1] as const

const ROW_GAP = 8 // gap-4
export const TARGET_ROW_HEIGHT = 150
const MAX_PER_ROW = 7

function aspectRatioFromId(id: string): number {
  const sum = id.split('').reduceRight((acc, c) => acc + c.charCodeAt(0), 0)
  return RIVER_ASPECT_CYCLE[sum % RIVER_ASPECT_CYCLE.length]
}

export type JustifiedItem<T extends { id: string } = GalleryImage> = {
  img: T
  aspect: number
}
export type JustifiedRow<T extends { id: string } = GalleryImage> = {
  items: JustifiedItem<T>[]
  height: number
  justified: boolean
}

export type JustifiedRowsOptions<T extends { id: string }> = {
  /** Horizontal gap between items, px. Default 8. */
  gap?: number
  /** Row height to aim for before justifying, px. Default `TARGET_ROW_HEIGHT`. */
  rowHeight?: number
  /** Hard cap on items per row. Default 7; the gallery page passes `Infinity`. */
  maxPerRow?: number
  /** Width / height of an item. Default: the id-derived preset ratio. */
  aspectOf?: (item: T) => number
}

/**
 * Greedy justified layout: accumulate items until they'd overflow the container
 * at the target height (or hit the per-row cap), then solve the row height that
 * makes them fill the width exactly. The trailing leftover row is never
 * stretched: it keeps `min(rowHeight, height that would fill the width)`,
 * left-aligned, so a lone item never balloons to full width.
 *
 * Called without options it behaves exactly as before (id-derived aspects, 8px
 * gap, 150px rows, at most 7 per row), which `river-view.tsx` relies on.
 *
 * @example
 * buildJustifiedRows(images, 1200)
 * @example
 * buildJustifiedRows(items, 1200, { gap: 16, rowHeight: 190, maxPerRow: Infinity, aspectOf: (i) => i.aspect })
 */
export function buildJustifiedRows<T extends { id: string } = GalleryImage>(
  images: T[],
  containerWidth: number,
  options: JustifiedRowsOptions<T> = {}
): JustifiedRow<T>[] {
  const gap = options.gap ?? ROW_GAP
  const rowHeight = options.rowHeight ?? TARGET_ROW_HEIGHT
  const maxPerRow = options.maxPerRow ?? MAX_PER_ROW
  const aspectOf = options.aspectOf ?? ((item: T) => aspectRatioFromId(item.id))

  const rows: JustifiedRow<T>[] = []
  let current: JustifiedItem<T>[] = []
  let aspectSum = 0

  for (const img of images) {
    const aspect = aspectOf(img)
    current.push({ img, aspect })
    aspectSum += aspect

    const gaps = gap * (current.length - 1)
    const widthAtTarget = aspectSum * rowHeight + gaps
    if (widthAtTarget >= containerWidth || current.length >= maxPerRow) {
      const height = (containerWidth - gaps) / aspectSum
      rows.push({ items: current, height, justified: true })
      current = []
      aspectSum = 0
    }
  }

  if (current.length > 0) {
    const gaps = gap * (current.length - 1)
    const fill = (containerWidth - gaps) / aspectSum
    rows.push({
      items: current,
      height: Math.min(rowHeight, fill),
      justified: false,
    })
  }

  return rows
}

// ---------------------------------------------------------------------------
// Gallery page: layouts and sizes (the browser lays the tiles out)
// ---------------------------------------------------------------------------

export const GALLERY_LAYOUTS = ['river', 'waterfall', 'grid'] as const
export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number]
export const DEFAULT_GALLERY_LAYOUT: GalleryLayout = 'waterfall'

/**
 * Size per zoom step 1→5: the river's target row height, the waterfall's and
 * grid's target column width, in px.
 */
export const GALLERY_ZOOM_SIZES: Record<GalleryLayout, readonly number[]> = {
  river: [110, 150, 190, 240, 300],
  waterfall: [150, 190, 240, 300, 380],
  grid: [130, 170, 210, 260, 320],
}

/** Width / height of an image, falling back to 1 when either side is missing. */
export function aspectOf(width: number | null | undefined, height: number | null | undefined): number {
  return width && height && width > 0 && height > 0 ? width / height : 1
}

// ---------------------------------------------------------------------------
// Date grouping
// ---------------------------------------------------------------------------

export type DateGroup<T> = {
  key: string
  /** `null` for the single group shown when grouping is off. */
  label: string | null
  sub: string | null
  items: T[]
}

const DAY_MS = 86_400_000
const SHORT_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Groups items by `createdAt` in the runtime's local timezone: **Today**, **Last
 * week** (the 7 days before today), then one group per calendar month. Items
 * are sorted newest first inside each group; empty groups are dropped. With
 * `byDate` off, everything is one unlabelled group in the order given.
 *
 * @example
 * groupByDate(images, true, new Date())
 * // → [{ label: 'Today', sub: 'Mon, Nov 3', … }, { label: 'Last week', sub: 'Oct 27 – Nov 2', … }, { label: 'October', sub: '2026', … }]
 */
export function groupByDate<T extends { createdAt: string | Date }>(
  items: T[],
  byDate: boolean,
  now: Date = new Date(),
  locale?: string
): DateGroup<T>[] {
  if (!byDate) {
    return items.length ? [{ key: 'all', label: null, sub: null, items }] : []
  }
  const today = startOfDay(now)
  const weekStart = today - 7 * DAY_MS
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const todayGroup: DateGroup<T> = {
    key: 'today',
    label: 'Today',
    sub: new Date(today).toLocaleDateString(locale, { weekday: 'short', ...SHORT_DATE }),
    items: [],
  }
  const weekGroup: DateGroup<T> = {
    key: 'last-week',
    label: 'Last week',
    sub: `${new Date(weekStart).toLocaleDateString(locale, SHORT_DATE)} – ${new Date(today - DAY_MS).toLocaleDateString(locale, SHORT_DATE)}`,
    items: [],
  }
  const months = new Map<string, DateGroup<T>>()

  for (const item of sorted) {
    const d = new Date(item.createdAt)
    const t = d.getTime()
    if (t >= today) todayGroup.items.push(item)
    else if (t >= weekStart) weekGroup.items.push(item)
    else {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      let group = months.get(key)
      if (!group) {
        group = {
          key,
          label: d.toLocaleDateString(locale, { month: 'long' }),
          sub: String(d.getFullYear()),
          items: [],
        }
        months.set(key, group)
      }
      group.items.push(item)
    }
  }

  return [todayGroup, weekGroup, ...months.values()].filter((g) => g.items.length > 0)
}

// ---------------------------------------------------------------------------
// Preferences cookie (`stashly-gallery`)
// ---------------------------------------------------------------------------

export const GALLERY_PREFS_COOKIE = 'stashly-gallery'
export type GalleryPrefs = { zoom: number; gap: number; byDate: boolean }
export const DEFAULT_GALLERY_PREFS: GalleryPrefs = { zoom: 3, gap: 16, byDate: true }

/**
 * Reads the gallery preferences from a `Cookie` header (server) or
 * `document.cookie` (client). Missing or malformed values fall back to the
 * defaults one field at a time. The value is `zoom.gap.byDate`, e.g. `3.16.1`.
 *
 * @example
 * parseGalleryPrefs('stashly-gallery=4.8.0') // → { zoom: 4, gap: 8, byDate: false }
 */
export function parseGalleryPrefs(cookieHeader: string | null | undefined): GalleryPrefs {
  const raw = cookieHeader
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GALLERY_PREFS_COOKIE}=`))
    ?.slice(GALLERY_PREFS_COOKIE.length + 1)
  if (!raw) return DEFAULT_GALLERY_PREFS
  const [z, g, b] = decodeURIComponent(raw).split('.')
  const zoom = Number(z)
  const gap = Number(g)
  return {
    zoom: Number.isInteger(zoom) && zoom >= 1 && zoom <= 5 ? zoom : DEFAULT_GALLERY_PREFS.zoom,
    gap:
      Number.isInteger(gap) && gap >= 0 && gap <= 20 && gap % 2 === 0
        ? gap
        : DEFAULT_GALLERY_PREFS.gap,
    byDate: b === '0' ? false : b === '1' ? true : DEFAULT_GALLERY_PREFS.byDate,
  }
}

/**
 * The `document.cookie` assignment string for a set of preferences.
 *
 * @example
 * serializeGalleryPrefs({ zoom: 3, gap: 16, byDate: true })
 * // → 'stashly-gallery=3.16.1; Path=/; Max-Age=31536000; SameSite=Lax'
 */
export function serializeGalleryPrefs(prefs: GalleryPrefs): string {
  return `${GALLERY_PREFS_COOKIE}=${prefs.zoom}.${prefs.gap}.${prefs.byDate ? 1 : 0}; Path=/; Max-Age=31536000; SameSite=Lax`
}

const WATERFALL_ASPECT_CYCLE = [
  'aspect-[2/2.5]',
  'aspect-square',
  'aspect-[1/2.5]',
  'aspect-[3/2.5]',
  // 'aspect-[4/3]',
  // 'aspect-[2/1]',
  // 'aspect-[3/4]',
] as const

export function aspectClassFromId(id: string): string {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return WATERFALL_ASPECT_CYCLE[sum % WATERFALL_ASPECT_CYCLE.length]
}

/** `WATERFALL_ASPECT_CYCLE` as width / height numbers, same order. */
const WATERFALL_ASPECT_RATIOS = [2 / 2.5, 1, 1 / 2.5, 3 / 2.5] as const

/**
 * The tile shape (width / height) an item gets on the Images page, chosen by
 * the same id hashes the original views used: River from `RIVER_ASPECT_CYCLE`
 * (`aspectRatioFromId`), Waterfall from the `aspectClassFromId` cycle, Grid a
 * fixed 4:3. An image therefore keeps the shape it always had, independent of
 * the photo's own proportions (the owner's choice, 2026-11-09).
 *
 * @example
 * tileAspectFromId('river', 'itm_a')     // → one of 1, 2, 0.75, 16/9, 4/3
 * tileAspectFromId('waterfall', 'itm_a') // → one of 0.8, 1, 0.4, 1.2
 */
export function tileAspectFromId(layout: GalleryLayout, id: string): number {
  if (layout === 'river') return aspectRatioFromId(id)
  if (layout === 'waterfall') {
    const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return WATERFALL_ASPECT_RATIOS[sum % WATERFALL_ASPECT_RATIOS.length]
  }
  return 4 / 3
}
