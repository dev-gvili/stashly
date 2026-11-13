import * as React from 'react'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/styles'

/**
 * Segmented control: a single-choice ToggleGroup drawn as a recessed track
 * (`bg-muted`) with the active segment raised onto `bg-card`.
 *
 * Unlike `ToggleGroup`, a segmented control always has exactly one value, so
 * clicking the active segment never clears it. It never squashes either: the
 * track is `shrink-0` and scrolls sideways (hidden scrollbar) when it's wider
 * than its container, so a crowded toolbar wraps it onto its own line.
 */
const segmentedControlItemVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm font-stashly font-medium whitespace-nowrap text-muted-foreground outline-none transition hover:cursor-pointer hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm',
  {
    variants: {
      size: {
        default: 'h-7 px-2.75 text-xs',
        sm: 'h-6 px-2 text-xs',
        icon: 'h-6.5 w-7.5',
        'icon-sm': 'size-6',
        /** Icon above its label, 64×56: the color-mode switch and the New panel's actions. */
        tile: 'h-14 w-16 flex-col gap-1 px-1 text-xs [&>svg]:size-4.5',
      },
    },
    defaultVariants: { size: 'default' },
  }
)

type SegmentedControlContextValue = VariantProps<typeof segmentedControlItemVariants>

const SegmentedControlContext = React.createContext<SegmentedControlContextValue>({
  size: 'default',
})

export type SegmentedControlProps = Omit<
  ToggleGroupPrimitive.ToggleGroupSingleProps,
  'type' | 'onValueChange'
> &
  React.RefAttributes<HTMLDivElement> &
  SegmentedControlContextValue & {
    onValueChange?: (value: string) => void
  }

function SegmentedControl({
  className,
  size,
  onValueChange,
  children,
  ...props
}: SegmentedControlProps) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="segmented-control"
      type="single"
      loop
      onValueChange={(next) => {
        if (next) onValueChange?.(next)
      }}
      className={cn(
        'inline-flex w-fit max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-md border border-border/60 bg-muted p-0.75 scrollbar-none',
        className
      )}
      {...props}
    >
      <SegmentedControlContext.Provider value={{ size }}>
        {children}
      </SegmentedControlContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

export type SegmentedControlItemProps = React.ComponentProps<
  typeof ToggleGroupPrimitive.Item
> &
  SegmentedControlContextValue

function SegmentedControlItem({
  className,
  size,
  ...props
}: SegmentedControlItemProps) {
  const context = React.useContext(SegmentedControlContext)
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-control-item"
      className={cn(
        segmentedControlItemVariants({ size: size ?? context.size }),
        className
      )}
      {...props}
    />
  )
}

export { SegmentedControl, SegmentedControlItem, segmentedControlItemVariants }
