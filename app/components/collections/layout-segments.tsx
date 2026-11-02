import type { ComponentType, SVGProps } from 'react'

import { GridFillIcon, ListFillIcon } from '@/components/icons'
import { SegmentedControl, SegmentedControlItem } from '@/ui/segmented-control'
import { Tooltip } from '@/ui/tooltip'

export type CollectionLayout = 'grid' | 'list'

export interface LayoutOption<T extends string = CollectionLayout> {
  value: T
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export const COLLECTION_LAYOUTS: LayoutOption[] = [
  { value: 'grid', label: 'Grid view', icon: GridFillIcon },
  { value: 'list', label: 'List view', icon: ListFillIcon },
]

export interface LayoutSegmentsProps<T extends string = CollectionLayout> {
  value: T
  onValueChange: (value: T) => void
  options?: LayoutOption<T>[]
  className?: string
}

/**
 * Icon-only view switcher (Grid / List). Each segment has an accessible
 * label and a tooltip. For URL-backed state (`?layout=`), pair it with
 * `useLayoutParam()`.
 */
export function LayoutSegments<T extends string = CollectionLayout>({
  value,
  onValueChange,
  options = COLLECTION_LAYOUTS as unknown as LayoutOption<T>[],
  className,
}: LayoutSegmentsProps<T>) {
  return (
    <SegmentedControl
      size="icon"
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label="Layout"
      className={className}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <Tooltip key={optionValue} content={label} asChild>
          <SegmentedControlItem value={optionValue} aria-label={label}>
            <Icon aria-hidden className="size-3.75" />
          </SegmentedControlItem>
        </Tooltip>
      ))}
    </SegmentedControl>
  )
}
