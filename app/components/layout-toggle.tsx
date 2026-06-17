import { RiLayoutMasonryFill } from '@remixicon/react'
import { LayoutMenu, LayoutMenuItem } from './ui/layout-menu'
import { cn } from '@/utils/styles'
import { useLocation, useSearchParams } from 'react-router'
import {
  WaterfallFillIcon,
  GridFillIcon,
  ListFillIcon,
  RiverFillIcon,
} from './icons'

const LayoutToggle = ({
  className,
  children,
  value,
  ...props
}: React.ComponentPropsWithoutRef<typeof LayoutMenu>) => {
  let location = useLocation()
  if (location.pathname.includes('/files')) return null

  let [searchParams] = useSearchParams()
  value = value ?? searchParams.get('layout') ?? 'river'
  return (
    <LayoutMenu
      className={cn('font-stashly', className)}
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
  if (
    !location.pathname.includes('/images') &&
    !location.pathname.includes('/videos')
  )
    return null
  return (
    <LayoutMenuItem tooltip="River view" value="river">
      <RiverFillIcon className="size-5! rotate-90" />
    </LayoutMenuItem>
  )
}

export function Waterfall() {
  let location = useLocation()
  if (
    !location.pathname.includes('/images') &&
    !location.pathname.includes('/videos')
  )
    return null
  return (
    <LayoutMenuItem tooltip="Waterfall view" value="waterfall">
      <WaterfallFillIcon className="size-5!" />
    </LayoutMenuItem>
  )
}

export function Grid() {
  return (
    <LayoutMenuItem tooltip="Grid view" value="grid">
      <GridFillIcon className="size-5!" />
    </LayoutMenuItem>
  )
}

export function List() {
  let location = useLocation()
  if (
    location.pathname.includes('/images') ||
    location.pathname.includes('/videos')
  )
    return null
  return (
    <LayoutMenuItem tooltip="List view" value="list">
      <ListFillIcon className="size-5! rotate-90" />
    </LayoutMenuItem>
  )
}

export { LayoutToggle }
