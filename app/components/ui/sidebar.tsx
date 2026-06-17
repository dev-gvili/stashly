import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { PanelLeftIcon } from 'lucide-react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/utils/styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SidebarFillIcon, SidebarIcon } from '../icons'
import { useBeforeUnload, useFetcher } from 'react-router'
import { ScrollArea } from './scroll-area'

const SIDEBAR_COOKIE_NAME = 'stashly-sidebar'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '4rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

// Backwards-compatible, per-sidebar API (resolved to a single sidebar id).
type SidebarView = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

// Provider-level context holds maps of sidebar state keyed by id.
type SidebarProviderContextValue = {
  defaultOpen: boolean
  openMap: Record<string, boolean>
  openMobileMap: Record<string, boolean>
  setOpenForId: (id: string, value: boolean) => void
  setOpenMobileForId: (id: string, value: boolean) => void
  toggleForId: (id: string) => void
  isMobile: boolean
}

const SidebarContext = React.createContext<SidebarProviderContextValue | null>(
  null
)

// Local scope context so child components inside a Sidebar can call useSidebar()
// without needing to pass an id explicitly.
const SidebarScopeContext = React.createContext<string | null>(null)

function useSidebar(id?: string): SidebarView {
  const provider = React.useContext(SidebarContext)
  if (!provider) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }

  const scoped = React.useContext(SidebarScopeContext)
  const resolvedId = id ?? scoped ?? 'default'

  const open =
    resolvedId in provider.openMap
      ? provider.openMap[resolvedId]
      : provider.defaultOpen
  const openMobile =
    resolvedId in provider.openMobileMap
      ? provider.openMobileMap[resolvedId]
      : provider.defaultOpen

  const setOpen = React.useCallback(
    (value: boolean | ((v: boolean) => boolean)) => {
      const next = typeof value === 'function' ? value(open) : value
      provider.setOpenForId(resolvedId, next)
    },
    [provider, resolvedId, open]
  )

  const setOpenMobile = React.useCallback(
    (value: boolean | ((v: boolean) => boolean)) => {
      const next = typeof value === 'function' ? value(openMobile) : value
      provider.setOpenMobileForId(resolvedId, next)
    },
    [provider, resolvedId, openMobile]
  )

  const toggleSidebar = React.useCallback(
    () => provider.toggleForId(resolvedId),
    [resolvedId]
  )

  const state = open ? 'expanded' : 'collapsed'

  return {
    state,
    open,
    setOpen,
    isMobile: provider.isMobile,
    openMobile,
    setOpenMobile,
    toggleSidebar,
  }
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const sidebarFetcher = useFetcher({ key: 'sidebar' })
  const isMobile = useIsMobile()

  // store per-sidebar open state (keyed by arbitrary id). We start with the
  // 'default' id using the provider props if provided (backwards compatible).
  const initialOpen = openProp ?? defaultOpen
  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>({
    default: initialOpen,
  })
  const [openMobileMap, setOpenMobileMap] = React.useState<
    Record<string, boolean>
  >({
    default: initialOpen,
  })

  const setOpenForId = React.useCallback((id: string, value: boolean) => {
    try {
      if (id === 'default' && setOpenProp) setOpenProp(value)
      setOpenMap((prev) => ({ ...prev, [id]: value }))
    } catch (e) {}
  }, [])

  useBeforeUnload(() => {
    // on unload, persist all sidebar states to cookie
    Object.entries(openMap).forEach(([id, state]) => {
      sidebarFetcher.submit(
        { id, state },
        {
          method: 'POST',
          action: `/api/sidebar`,
        }
      )
    })
  })

  const setOpenMobileForId = React.useCallback(
    (id: string, value: boolean) => {
      try {
        if (id === 'default' && setOpenProp) setOpenProp(value)
        setOpenMobileMap((prev) => ({ ...prev, [id]: value })) // Ensure prev is not undefined
      } catch (e) {}
    },
    [isMobile]
  )

  const toggleForId = React.useCallback(
    (id: string) => {
      if (isMobile) {
        setOpenMobileMap((prev) => ({ ...prev, [id]: !prev[id] }))
      }
      setOpenMap((prev) => ({ ...prev, [id]: !prev[id] })) // Ensure prev is not undefined
    },
    [isMobile, openMap, openMobileMap, defaultOpen]
  )

  // Add keyboard shortcut toggling the default sidebar
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.altKey)
      ) {
        event.preventDefault()
        toggleForId('default')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const contextValue = React.useMemo<SidebarProviderContextValue>(
    () => ({
      defaultOpen,
      openMap,
      openMobileMap,
      setOpenForId,
      setOpenMobileForId,
      toggleForId,
      isMobile,
    }),
    [
      defaultOpen,
      openMap,
      openMobileMap,
      setOpenForId,
      setOpenMobileForId,
      toggleForId,
      isMobile,
    ]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH,
              '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            'group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  id = 'default',
  // optional per-sidebar widths. Strings should include units, e.g. "20rem" or "256px".
  width,
  widthMobile = SIDEBAR_WIDTH_MOBILE,
  widthIcon,
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  id?: string
  width?: string
  widthMobile?: string
  widthIcon?: string
  side?: 'left' | 'right'
  variant?: 'sidebar' | 'floating' | 'inset'
  collapsible?: 'offcanvas' | 'icon' | 'none'
}) {
  // the resolved id for this Sidebar instance (defaults to 'default')
  const resolvedId = id ?? 'default'
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar(resolvedId)

  // separate style from other props so we can merge per-sidebar CSS vars
  const { style: providedStyle, ...restProps } = props

  // Build style that includes per-sidebar overrides for CSS variables.
  const mergedStyle = {
    ...(providedStyle as React.CSSProperties),
    ...(width ? ({ ['--sidebar-width']: width } as any) : {}),
    ...(widthIcon ? ({ ['--sidebar-width-icon']: widthIcon } as any) : {}),
  } as React.CSSProperties

  if (collapsible === 'none') {
    return (
      <SidebarScopeContext.Provider value={resolvedId}>
        <div
          data-slot="sidebar"
          style={mergedStyle}
          className={cn(
            'bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col',
            className
          )}
          {...restProps}
        >
          {children}
        </div>
      </SidebarScopeContext.Provider>
    )
  }

  if (isMobile) {
    const mobileStyle = {
      ...(props.style as React.CSSProperties),
      // for mobile we set the same --sidebar-width var to control the width
      ...(widthMobile ? ({ ['--sidebar-width']: widthMobile } as any) : {}),
      ...(widthIcon ? ({ ['--sidebar-width-icon']: widthIcon } as any) : {}),
    } as React.CSSProperties
    return (
      <SidebarScopeContext.Provider value={resolvedId}>
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...restProps}>
          <SheetContent
            data-sidebar="sidebar"
            data-slot="sidebar"
            data-mobile="true"
            className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
            style={mobileStyle}
            side={side}
            data-state={state}
            data-collapsible={state === 'collapsed' ? collapsible : ''}
            data-variant={variant}
            data-side={side}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Sidebar</SheetTitle>
              <SheetDescription>Displays the mobile sidebar.</SheetDescription>
            </SheetHeader>
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      </SidebarScopeContext.Provider>
    )
  }

  return (
    <SidebarScopeContext.Provider value={resolvedId}>
      <div
        style={mergedStyle}
        className="group peer text-sidebar-foreground"
        data-state={state}
        data-collapsible={state === 'collapsed' ? collapsible : ''}
        data-variant={variant}
        data-side={side}
        data-slot="sidebar"
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          data-slot="sidebar-gap"
          className={cn(
            'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear',
            'group-data-[collapsible=offcanvas]:w-0',
            'group-data-[side=right]:rotate-180',
            variant === 'floating' || variant === 'inset'
              ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
              : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)'
          )}
        />
        <div
          data-slot="sidebar-container"
          className={cn(
            'fixed  h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex',
            side === 'left'
              ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
              : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
            // Adjust the padding for floating and inset variants.
            variant === 'floating' || variant === 'inset'
              ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
              : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
            className
          )}
          {...restProps}
        >
          <div
            data-sidebar="sidebar"
            data-slot="sidebar-inner"
            className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
          >
            {children}
          </div>
        </div>
      </div>
    </SidebarScopeContext.Provider>
  )
}

function SidebarTrigger({
  sidebarId,
  className,
  onClick,
  children,
  tooltip,
  ...props
}: React.ComponentProps<typeof Button> & { sidebarId?: string, tooltip?: string }) {
  const { isMobile, setOpenMobile, open, toggleSidebar, state } =
    useSidebar(sidebarId)

  let tooltipContent = tooltip || (state === 'collapsed' ? 'Open Sidebar' : 'Close Sidebar')

  return (
    <Tooltip content={tooltipContent} align="start" asChild>
      <Button
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        variant="outline"
        size="icon-sm"
        className={cn('', className)}
        onClick={(event) => {
          onClick?.(event)
          isMobile ? setOpenMobile(!open) : toggleSidebar()
        }}
        {...props}
      >
        {children || (
          <>
            <SidebarFillIcon
              className={cn(
                'size-5',
                state === 'expanded' ? 'rotate-180 duration-200' : ''
              )}
            />
            <span className="sr-only">{tooltipContent}</span>
          </>
        )}
      </Button>
    </Tooltip>
  )
}

function SidebarRail({
  sidebarId,
  className,
  ...props
}: React.ComponentProps<'button'> & { sidebarId?: string }) {
  const { toggleSidebar } = useSidebar(sidebarId)

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 sm:flex',
        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'bg-background relative flex w-full flex-1 flex-col',
        'md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn('bg-background h-8 w-full shadow-none', className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn('bg-sidebar-border mx-2 w-auto', className)}
      {...props}
    />
  )
}

function SidebarContent({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 group-data-[collapsible=icon]:overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        'text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-stashly font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 md:after:hidden',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn('w-full text-sm', className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn(
        'flex w-full min-w-0 flex-col gap-1 group-data-[state=collapsed]:items-center',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn('group/menu-item relative font-stashly', className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium font-stashly data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        outline:
          'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
      },
      size: {
        default: 'h-8 text-xs',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot : 'button'
  const { isMobile, state } = useSidebar()

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  if (typeof tooltip === 'string') {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip
      content={tooltip.children as string}
      side="right"
      align="center"
      asChild={asChild}
      hidden={state !== 'collapsed' || isMobile}
    >
      <TooltipTrigger asChild>{button}</TooltipTrigger>
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean
  showOnHover?: boolean
}) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 md:after:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        showOnHover &&
          'peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        'text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-stashly font-medium tabular-nums select-none',
        'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<'div'> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn('flex h-8 items-center gap-2 rounded-md px-2', className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            '--skeleton-width': width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        'border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn('group/menu-sub-item relative', className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  asChild = false,
  size = 'md',
  isActive = false,
  className,
  ...props
}: React.ComponentProps<'a'> & {
  asChild?: boolean
  size?: 'sm' | 'md'
  isActive?: boolean
}) {
  const Comp = asChild ? Slot : 'a'

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
        'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        'group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}
