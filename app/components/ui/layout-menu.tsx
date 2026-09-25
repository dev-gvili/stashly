import { useSearchParams } from 'react-router'
import {
  ToggleGroup,
  ToggleGroupItem,
  type ToggleGroupSingleProps,
} from '@/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { cn } from '@/utils/styles'
import { useEffect, type ComponentPropsWithoutRef } from 'react'
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
  const hasLayout = searchParams.has('layout')
  // Views gate on `?layout=` (GridLayout renders nothing without it), so a
  // clean URL must get the default written into it, not just highlighted.
  useEffect(() => {
    if (hasLayout) return
    setSearchParams(
      (prev) => {
        prev.set('layout', 'grid')
        return prev
      },
      { replace: true, preventScrollReset: true }
    )
  }, [hasLayout, setSearchParams])
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
      size="default"
      className={cn('max-w-max rounded-md ring-2 ring-accent', className)}
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
          'font-stashly bg-card text-foreground hover:bg-muted aria-checked:text-accent-foreground aria-checked:bg-muted! first-of-type:ml-0! last-of-type:mr-0! first-of-type:rounded-l-md last-of-type:rounded-r-md hover:cursor-pointer border-none ',
          className
        )}
        {...props}
      >
        {children}
      </ToggleGroupItem>
    </Tooltip>
  )
}
