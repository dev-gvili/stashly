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

export type JustifiedItem = { img: GalleryImage; aspect: number }
type JustifiedRow = { items: JustifiedItem[]; height: number; justified: boolean }

// Greedy justified layout: accumulate items until they'd overflow the container
// at the target height (or hit the per-row cap), then solve the row height that
// makes them fill the width exactly. The trailing leftover row keeps the target
// height (left-aligned) so a lone item never balloons to full width.
export function buildJustifiedRows(
  images: GalleryImage[],
  containerWidth: number
): JustifiedRow[] {
  const rows: JustifiedRow[] = []
  let current: JustifiedItem[] = []
  let aspectSum = 0

  for (const img of images) {
    const aspect = aspectRatioFromId(img.id)
    current.push({ img, aspect })
    aspectSum += aspect

    const gaps = ROW_GAP * (current.length - 1)
    const widthAtTarget = aspectSum * TARGET_ROW_HEIGHT + gaps
    if (widthAtTarget >= containerWidth || current.length >= MAX_PER_ROW) {
      const height = (containerWidth - gaps) / aspectSum
      rows.push({ items: current, height, justified: true })
      current = []
      aspectSum = 0
    }
  }

  if (current.length > 0) {
    rows.push({ items: current, height: TARGET_ROW_HEIGHT, justified: false })
  }

  return rows
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
