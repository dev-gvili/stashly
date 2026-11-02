import type { ComponentType, SVGProps } from 'react'

import {
  AudioFillIcon,
  DocumentFillIcon,
  ImageFillIcon,
  VideoFillIcon,
} from '@/components/icons'
import { SegmentedControl, SegmentedControlItem } from '@/ui/segmented-control'
import { cn } from '@/utils/styles'

export type CollectionKind = 'image' | 'document' | 'audio' | 'video'
export type KindFilterValue = 'all' | CollectionKind

export interface KindFilterOption {
  value: KindFilterValue
  label: string
  count?: number
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

const KINDS: { value: CollectionKind; label: string; icon: KindFilterOption['icon'] }[] = [
  { value: 'image', label: 'Images', icon: ImageFillIcon },
  { value: 'document', label: 'Documents', icon: DocumentFillIcon },
  { value: 'audio', label: 'Audio', icon: AudioFillIcon },
  { value: 'video', label: 'Video', icon: VideoFillIcon },
]

/**
 * Build the segments from per-kind counts. "All" always comes first. Pass
 * `hideEmpty: false` for the picker dialog, which lists every kind even if
 * the collection has none.
 *
 * @example
 * kindFilterOptions({ image: 22, document: 3 })
 * // → All 25 · Images 22 · Documents 3
 */
export function kindFilterOptions(
  counts: Partial<Record<CollectionKind, number>> = {},
  { hideEmpty = true, withCounts = true } = {}
): KindFilterOption[] {
  const total = KINDS.reduce((sum, k) => sum + (counts[k.value] ?? 0), 0)
  const kinds = KINDS.filter((k) => !hideEmpty || (counts[k.value] ?? 0) > 0)
  return [
    { value: 'all', label: 'All', count: withCounts ? total : undefined },
    ...kinds.map((k) => ({
      ...k,
      count: withCounts ? (counts[k.value] ?? 0) : undefined,
    })),
  ]
}

export interface KindFilterSegmentsProps {
  value: KindFilterValue
  onValueChange: (value: KindFilterValue) => void
  options: KindFilterOption[]
  /** Leading kind icons. Off in the collection toolbar, where counts already carry the meaning. */
  showIcons?: boolean
  'aria-label'?: string
  className?: string
}

/**
 * Filters a collection's items by file type. Segments show a mono count
 * after the label, and the active segment is raised onto the card surface.
 */
export function KindFilterSegments({
  value,
  onValueChange,
  options,
  showIcons = false,
  'aria-label': ariaLabel = 'Filter by type',
  className,
}: KindFilterSegmentsProps) {
  return (
    <SegmentedControl
      value={value}
      onValueChange={(next) => onValueChange(next as KindFilterValue)}
      aria-label={ariaLabel}
      className={className}
    >
      {options.map(({ value: optionValue, label, count, icon: Icon }) => (
        <SegmentedControlItem key={optionValue} value={optionValue}>
          {showIcons && Icon && <Icon aria-hidden className="size-3.5" />}
          <span className="font-stashly">{label}</span>
          {count !== undefined && (
            <span
              className={cn(
                'font-stashly text-xs font-normal text-muted-foreground/80 tabular-nums'
              )}
            >
              {count}
            </span>
          )}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}
