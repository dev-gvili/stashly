import * as React from 'react'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import { cn } from '@/utils/styles'

function ScrollArea({
  className,
  children,
  scrollbars = 'vertical',
  type = 'auto',
  ...props
}: Omit<React.ComponentProps<typeof ScrollAreaPrimitive.Root>, 'type'> & {
  // Radix keeps the viewport's overflow-x hidden unless a horizontal
  // scrollbar is mounted — pass 'both' for content wider than the viewport.
  scrollbars?: 'vertical' | 'both'
  type?: 'hover' | 'always' | 'scroll' | 'auto' | 'hidden' | undefined
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative', className)}
      type={type}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1 z-50"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      {scrollbars === 'both' && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'peer flex touch-none transition-colors select-none size-2.5',
        orientation === 'vertical' &&
          'h-full w-2.5 border-l border-l-transparent p-px',
        orientation === 'horizontal' &&
          'h-2.5 flex-col border-t border-t-transparent',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="bg-foreground/25 relative flex-1 rounded-full  before:absolute before:inset-0 before:m-auto before:size-1 before:rounded-full before:bg-transparent"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
