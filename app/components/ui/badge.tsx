import * as React from 'react'
import { Slot as SlotPrimitive } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utils/styles'

/**
 * The app badge. Every badge has one shape, taken from the collection
 * header's stats (the owner's reference badge, 13 Nov): 24px tall, an 8px
 * corner, mono `text-xs` at normal weight, a 14px muted icon, neutral fill.
 *
 * Variants change colour only, never the shape. `default`, `secondary`,
 * `outline` and `accent` all draw the neutral badge (they are kept so callers
 * need no change); `destructive` is the one signal colour. A status that
 * needs its own colour (invitation status) passes it in `className`.
 */
const badgeVariants = cva(
  'inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-sm border border-transparent px-2.25 font-stashly text-xs font-normal whitespace-nowrap transition-[color,box-shadow] [&>svg]:pointer-events-none [&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80',
        secondary: 'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80',
        outline: 'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80',
        accent: 'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80',
        destructive:
          'bg-destructive/15 text-destructive [&>svg]:text-destructive [a&]:hover:bg-destructive/25',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? SlotPrimitive.Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
