/**
 * Layout math shared by the gallery's river and waterfall views.
 *
 * The two `aspect*FromId` functions look interchangeable but are not: the river
 * hashes with `reduceRight` and returns a numeric ratio, the waterfall hashes
 * with `reduce` and returns a Tailwind class. Swapping either one reshuffles
 * every item on screen, so both are kept verbatim.
 */
import type { GalleryImage } from '@/types/stash.types'

export function buildSrcSet(src: string, widths: number[]) {
  const hasQuery = src?.indexOf('?') !== -1
  return widths
    .map((w) => `${src}${hasQuery ? '&' : '?'}w=${w} ${w}w`)
    .join(', ')
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
