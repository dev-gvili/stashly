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
        shape === 'square' && 'rounded-sm',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'data-[state=checked]:bg-muted-foreground! pointer-events-none block size-3 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%+4px)] data-[state=unchecked]:translate-x-0.5 bg-current! data-[state=unchecked]:bg-background!',
          shape === 'square' && 'rounded-[3px]'
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
