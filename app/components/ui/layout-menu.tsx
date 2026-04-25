import { RiLayoutMasonryFill, RiLayout2Fill } from '@remixicon/react'
import { useSearchParams } from 'react-router'
import {
  ToggleGroup,
  ToggleGroupItem,
  type ToggleGroupSingleProps,
} from '@/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { cn } from '@/utils/styles'
import type { ComponentPropsWithoutRef } from 'react'
import { callAll } from '../../utils/misc'

export interface LayoutMenuProps
  extends
    Omit<ToggleGroupSingleProps, 'type'>,
    Pick<Parameters<typeof ToggleGroupItem>[0], 'variant' | 'size'> {
  onLayoutChange?: (value: string) => void
}

export interface LayoutItemProps extends ComponentPropsWithoutRef<
  typeof ToggleGroupItem
> {
  tooltip: string
}

export const LayoutMenu = ({
  className,
  value,
  onLayoutChange,
  children,
  ...props
}: LayoutMenuProps) => {
  const [searchParams, setSearchParams] = useSearchParams()
  value = value || searchParams.get('layout') || 'river'
  const _onLayoutChange = (value: string) => {
    if (!value) {
      return
    }
    setSearchParams((prev) => {
      prev.set('layout', value)
      return prev
    })
  }
  return (
    <ToggleGroup
      onValueChange={callAll(_onLayoutChange, onLayoutChange)}
      value={value}
      type="single"
      loop
      variant="outline"
      size="sm"
      className={cn('max-w-max rounded', className)}
      {...props}
    >
      {children}
    </ToggleGroup>
  )
}

export const LayoutMenuItem = ({
  tooltip,
  children,
  className,
  ...props
}: LayoutItemProps) => {
  return (
    <Tooltip content={tooltip} asChild>
      <ToggleGroupItem
        name="layout"
        variant="outline"
        className={cn(
          'data-[state=on]:text-accent-foreground! hover:bg-inherit aria-checked:text-accent-foreground aria-checked:bg-accent/30  first-of-type:ml-0.5! last-of-type:mr-0.5! first-of-type:rounded-l-md last-of-type:rounded-r-md hover:cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </ToggleGroupItem>
    </Tooltip>
  )
}
