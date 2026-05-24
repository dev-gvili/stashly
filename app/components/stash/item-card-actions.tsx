// app/components/stash/item-card-actions.tsx
import React from 'react'
import { useFetcher, href } from 'react-router'
import { useItemCard } from '@/hooks/useItemCard'
import { usePinItem } from '@/hooks/usePinItem'
import { useLockItem } from '@/hooks/useLockItem'
import useConfirm from '@/hooks/useConfirm'
import { toFavorite } from '@/utils/converters'
import { cn } from '@/utils/styles'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { ScrollArea } from '@/ui/scroll-area'
import { Button } from '@/ui/button'
import { ShareDialog } from '@/components/core-components/share-dialog'
import { InviteDialog } from '@/components/core-components/invite-dialog'
import { ItemActivityDrawer } from '@/components/core-components/item-activity-drawer'
import ShareItemFillIcon, {
  ActivityIcon,
  CopyIcon,
  DeleteIcon,
  DownloadIcon,
  FileDetailsIcon,
  GroupIcon,
  HeartIcon,
  LockFillIcon,
  MenuDotsIcon,
  MoveToFolder,
  PinFillIcon,
  PinIcon,
  PreviewIcon,
  RemoveIcon,
  RenameIcon,
  RestoreIcon,
  TrashIcon,
  UnlockFillIcon,
} from '@/components/icons'

// -- Group primitive ---------------------------------------------------------

interface GroupProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuGroup> {
  label?: React.ReactNode
}

function Group({ label, children, className, ...props }: GroupProps) {
  return (
    <DropdownMenuGroup className={className} {...props}>
      {label && (
        <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
          {label}
        </DropdownMenuLabel>
      )}
      {children}
    </DropdownMenuGroup>
  )
}

// -- Item primitive ----------------------------------------------------------

type ItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuItem>

const Item = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuItem>,
  ItemProps
>(({ className, ...props }, ref) => (
  <DropdownMenuItem
    ref={ref}
    className={cn('items-start hover:cursor-pointer', className)}
    {...props}
  />
))
Item.displayName = 'Actions.Item'

// -- Root --------------------------------------------------------------------

interface ActionsRootProps extends React.ComponentPropsWithoutRef<typeof Button> {
  children?: React.ReactNode
}

function ActionsRoot({ children, ...triggerProps }: ActionsRootProps) {
  const { status } = useItemCard()
  const hasChildren = React.Children.count(children) > 0

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        {...triggerProps}
      >
        <MenuDotsIcon className="size-6!" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        hideWhenDetached
        align="end"
        avoidCollisions
        className="space-y-4 w-48 bg-sidebar z-40"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="h-full pr-2" type="auto">
          <section className="max-h-80 space-y-2">
            {hasChildren ? children : <DefaultMenu status={status} />}
          </section>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// DefaultMenu is filled in by Task 8 (shorthand wiring). Placeholder for now.
function DefaultMenu({ status }: { status: string }) {
  return null
}

// -- Public API --------------------------------------------------------------

export const Actions = Object.assign(ActionsRoot, {
  Group,
  Item,
})
