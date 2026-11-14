import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { CheckIcon, DoubleCheckIcon } from '@/components/icons'
import { cn } from '@/utils/styles'

function Checkbox({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // The file card's checkbox is the one look everywhere (owner, 14 Nov):
        // 24px, an 8px corner, an input-coloured box that turns foreground
        // with a background-coloured double check and an accent ring.
        'peer size-6 shrink-0 rounded-sm border border-input bg-input text-foreground shadow-xs transition-shadow outline-none hover:cursor-pointer',
        'data-[state=checked]:border-transparent data-[state=checked]:bg-foreground data-[state=checked]:text-background data-[state=checked]:ring-2 data-[state=checked]:ring-accent/50',
        'data-[state=indeterminate]:border-transparent data-[state=indeterminate]:bg-foreground data-[state=indeterminate]:text-background',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children ? (
        children
      ) : (
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="flex items-center justify-center transition-none"
        >
          <DoubleCheckIcon className="size-5" />
        </CheckboxPrimitive.Indicator>
      )}
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
