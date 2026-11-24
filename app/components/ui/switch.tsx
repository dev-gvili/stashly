import * as React from 'react'
import {Switch as SwitchPrimitive} from 'radix-ui'

import { cn } from '@/utils/styles'

/**
 * `shape="square"` draws the track and thumb on small corners instead of a
 * pill, to sit with the app's squarish controls (the search dialog). The
 * default stays the pill every other switch uses.
 */
function Switch({
  className,
  shape = 'pill',
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & { shape?: 'pill' | 'square' }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer data-[state=checked]:bg-muted! data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50  inline-flex h-5 w-8 shrink-0 items-center rounded-full shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        // Smaller as well as squarer (owner's call): 28 × 16 with a 10px thumb.
        // rounded-sm is 8px here (--radius is 12px), a pill on a 16px track.
        shape === 'square' && 'h-4 w-7 rounded-[4px]',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'data-[state=checked]:bg-muted-foreground! pointer-events-none block size-3 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%+4px)] data-[state=unchecked]:translate-x-0.5 bg-current! data-[state=unchecked]:bg-background!',
          // A plain 16 × 12 key on a 2px inset, muted in both states. The
          // checked colour stays the base muted-foreground: the default
          // checked track is bg-muted, where a primary-foreground key all but
          // disappears (oklch 0.99 on 0.945 light, 0.15 on 0.23 dark). A caller
          // that colours the checked track lightens the key with it.
          shape === 'square' &&
            'h-3 w-4 rounded-[3px] shadow-xs data-[state=unchecked]:translate-x-0.5 data-[state=checked]:translate-x-2.5 data-[state=unchecked]:bg-muted-foreground!'
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
