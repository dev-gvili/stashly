import { RiLayoutHorizontalFill } from '@remixicon/react'
import { LayoutMenu, LayoutMenuItem } from './ui/layout-menu'
import { cn } from '@/utils/styles'
import { useLocation, useSearchParams } from 'react-router'
import { WaterfallIcon, GridIcon, ListIcon, RiverIcon } from './icons'

const LayoutToggle = ({
  className,
  children,
  value,
  ...props
}: React.ComponentPropsWithoutRef<typeof LayoutMenu>) => {
  let [searchParams] = useSearchParams()
  value = value ?? searchParams.get('layout') ?? 'river'
  return (
    <LayoutMenu
      className={cn('h-8 font-stashly', className)}
      value={value}
      variant="outline"
      {...props}
    >
      {children}
    </LayoutMenu>
  )
}

export function River() {
  let location = useLocation()
  if (!location.pathname.includes('/gallery')) return null
  return (
    <LayoutMenuItem tooltip="River view" value="river" >
      <RiverIcon className="size-5!" />
    </LayoutMenuItem>
  )
}

export function Waterfall() {
  let location = useLocation()
  if (!location.pathname.includes('/gallery')) return null
  return (
    <LayoutMenuItem tooltip="Waterfall view" value="waterfall">
      <WaterfallIcon className="size-5!" />
    </LayoutMenuItem>
  )
}

export function Grid() {
  return (
    <LayoutMenuItem tooltip="Grid view" value="grid">
      <GridIcon className="size-5!" />
    </LayoutMenuItem>
  )
}

export function List() {
  let location = useLocation()
  if (
    location.pathname.includes('/gallery') ||
    location.pathname.includes('/videos')
  )
    return null
  return (
    <LayoutMenuItem tooltip="List view" value="list">
      <ListIcon className="size-5!" />
    </LayoutMenuItem>
  )
}

export { LayoutToggle }
