# ItemCard.Actions Compound Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the monolithic `ItemCardActions` into a compound component where each action is a self-contained sub-component, and `collection-view.tsx` swaps Trash for `RemoveFromCollection`.

**Architecture:** Extract `ItemCardActions` from `app/components/stash/item-card.tsx` (currently 795 lines) into a new file `app/components/stash/item-card-actions.tsx`. The root renders the `DropdownMenu` shell. When given no children it renders the full default menu (zero breaking changes); when given children it renders them inside the dropdown content. Each predefined sub-component owns its fetcher/hook/dialog state. `Actions.Group` and `Actions.Item` are escape-hatch primitives for custom one-off actions.

**Tech Stack:** React Router 7, React 19, Radix UI (DropdownMenu, Dialog, AvatarPrimitive), TailwindCSS 4, existing project hooks (`usePinItem`, `useLockItem`, `useConfirm`), existing API routes (`/api/items`, `/api/favorites`, `/api/collections`).

**Spec:** `docs/superpowers/specs/2026-05-25-item-card-actions-compound.md`

---

## File Inventory

| File | Action | Responsibility |
|---|---|---|
| `app/components/stash/item-card-actions.tsx` | Create | `Actions` root + 18 sub-components |
| `app/components/stash/item-card.tsx` | Modify | Delete `ItemCardActions`, re-export from new file, attach to `ItemCard.Actions`, drop `console.log` on line 120 |
| `app/components/views/collection-view.tsx` | Modify | Replace `<ItemCard.Actions className="place-self-end" />` (line 331) with explicit composition that includes `Actions.RemoveFromCollection` |

No API, schema, or hook changes — `intent: 'remove_item'` already exists in `app/routes/api/collections.ts` (line 150) and `app/schemas/api.schemas.ts` (line 228).

---

## Task 1: Create item-card-actions.tsx with root shell + primitives

**Files:**
- Create: `app/components/stash/item-card-actions.tsx`

- [ ] **Step 1: Create the file with imports, root shell, and Group + Item primitives**

```tsx
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
```

- [ ] **Step 2: Verify the file typechecks**

Run: `pnpm typecheck`  
Expected: PASS. The file compiles even though `DefaultMenu` is empty — sub-components and the default menu are added in later tasks.

- [ ] **Step 3: Commit**

```bash
git add app/components/stash/item-card-actions.tsx
git commit -m "feat(item-card): scaffold compound Actions with Group/Item primitives"
```

---

## Task 2: Add stateless sub-components (Preview, Download, Copy, Move, Rename, Details)

**Files:**
- Modify: `app/components/stash/item-card-actions.tsx`

These six items have no side effects today — just menu entries with icons.

- [ ] **Step 1: Append the stateless sub-components below the `Item` primitive**

```tsx
// -- Stateless sub-components ------------------------------------------------

function Preview(props: ItemProps) {
  return (
    <Item {...props}>
      <PreviewIcon className="text-current" />
      Preview
    </Item>
  )
}

function Download(props: ItemProps) {
  return (
    <Item {...props}>
      <DownloadIcon className="text-current" />
      Download
    </Item>
  )
}

function Copy(props: ItemProps) {
  return (
    <Item {...props}>
      <CopyIcon className="text-current" />
      Copy
    </Item>
  )
}

function Move(props: ItemProps) {
  return (
    <Item {...props}>
      <MoveToFolder className="text-current" />
      Move
    </Item>
  )
}

function Rename(props: ItemProps) {
  return (
    <Item {...props}>
      <RenameIcon className="text-current" />
      Rename
    </Item>
  )
}

function Details(props: ItemProps) {
  return (
    <Item {...props}>
      <FileDetailsIcon className="text-current" />
      Details
    </Item>
  )
}
```

- [ ] **Step 2: Attach to the public API**

Update the `Object.assign` block at the bottom of the file:

```tsx
export const Actions = Object.assign(ActionsRoot, {
  Group,
  Item,
  Preview,
  Download,
  Copy,
  Move,
  Rename,
  Details,
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/components/stash/item-card-actions.tsx
git commit -m "feat(item-card): add stateless action sub-components"
```

---

## Task 3: Add Favorite sub-component

**Files:**
- Modify: `app/components/stash/item-card-actions.tsx`

`Favorite` toggles via `GET /api/favorites` with `intent: favorite | unfavorite`. State is derived from `useItemCard().favorites` overlaid with fetcher response (mirrors the monolith on lines 117–207 of `item-card.tsx`).

- [ ] **Step 1: Append the Favorite component**

```tsx
// -- Favorite ----------------------------------------------------------------

function Favorite(props: ItemProps) {
  const fetcher = useFetcher<{ favorited?: boolean }>()
  const { id, favorites, user } = useItemCard()
  const initial = toFavorite({ favorites, userId: user?.id })
  const favorited = fetcher.data?.favorited ?? initial

  return (
    <Item
      {...props}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        fetcher.submit(
          { intent: favorited ? 'unfavorite' : 'favorite', itemId: id },
          { method: 'GET', action: href('/api/favorites') }
        )
        props.onClick?.(e)
      }}
    >
      <HeartIcon
        fill={favorited ? 'currentColor' : 'none'}
        className="text-current"
      />
      {favorited ? 'Unfavorite' : 'Favorite'}
    </Item>
  )
}
```

- [ ] **Step 2: Attach to public API**

```tsx
export const Actions = Object.assign(ActionsRoot, {
  Group, Item, Preview, Download, Copy, Move, Rename, Details,
  Favorite,
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/components/stash/item-card-actions.tsx
git commit -m "feat(item-card): add Favorite action sub-component"
```

---

## Task 4: Add Pin and Lock sub-components

**Files:**
- Modify: `app/components/stash/item-card-actions.tsx`

Both use existing hooks: `usePinItem(id, initial)` and `useLockItem(id, initial)`. Initial values come from `useItemCard()` — `pins` array for pin (matches the user via `pinnedById`), `locked.lockedById` for lock.

- [ ] **Step 1: Append Pin and Lock components**

```tsx
// -- Pin ---------------------------------------------------------------------

function Pin(props: ItemProps) {
  const { id, pins, user } = useItemCard()
  const initiallyPinned =
    Array.isArray(pins) && pins.some((p) => p.pinnedById === user?.id)
  const { pinned, toggle, isPending } = usePinItem(id, initiallyPinned)

  return (
    <Item
      {...props}
      disabled={isPending}
      onSelect={(e) => {
        e.preventDefault()
        toggle()
        props.onSelect?.(e)
      }}
    >
      {pinned ? (
        <PinFillIcon className="text-current" />
      ) : (
        <PinIcon className="text-current" />
      )}
      {pinned ? 'Unpin' : 'Pin'}
    </Item>
  )
}

// -- Lock --------------------------------------------------------------------

function Lock(props: ItemProps) {
  const { id, locked: itemLock, user } = useItemCard()
  const initiallyLocked = itemLock?.lockedById === user?.id
  const { locked, toggle, isPending } = useLockItem(id, initiallyLocked)

  return (
    <Item
      {...props}
      disabled={isPending}
      onSelect={(e) => {
        e.preventDefault()
        toggle()
        props.onSelect?.(e)
      }}
    >
      {locked ? (
        <LockFillIcon className="text-current" />
      ) : (
        <UnlockFillIcon className="text-current" />
      )}
      {locked ? 'Unlock' : 'Lock'}
    </Item>
  )
}
```

- [ ] **Step 2: Attach to public API**

```tsx
export const Actions = Object.assign(ActionsRoot, {
  Group, Item, Preview, Download, Copy, Move, Rename, Details, Favorite,
  Pin, Lock,
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/components/stash/item-card-actions.tsx
git commit -m "feat(item-card): add Pin and Lock action sub-components"
```

---

## Task 5: Add Share, Invite, and Activity sub-components (dialog-owning)

**Files:**
- Modify: `app/components/stash/item-card-actions.tsx`

Each owns its own `open` state and renders its dialog/drawer as a sibling to the menu item inside a fragment. Radix portals the dialog to `document.body`, so being inside `DropdownMenuContent` is safe (existing pattern in the monolith).

- [ ] **Step 1: Append Share, Invite, Activity**

```tsx
// -- Share -------------------------------------------------------------------

function Share(props: ItemProps) {
  const [open, setOpen] = React.useState(false)
  const { id, name, type } = useItemCard()
  const itemType = type === 'folder' ? 'folder' : 'file'

  return (
    <>
      <Item
        {...props}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
          props.onClick?.(e)
        }}
      >
        <ShareItemFillIcon className="text-current" />
        Share
      </Item>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        itemId={id}
        itemName={name}
        itemType={itemType}
      />
    </>
  )
}

// -- Invite ------------------------------------------------------------------

function Invite(props: ItemProps) {
  const [open, setOpen] = React.useState(false)
  const { id, name } = useItemCard()

  return (
    <>
      <Item
        {...props}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
          props.onClick?.(e)
        }}
      >
        <GroupIcon className="text-current" />
        Invite
      </Item>
      <InviteDialog
        itemId={id}
        itemName={name}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

// -- Activity ----------------------------------------------------------------

function Activity(props: ItemProps) {
  const [open, setOpen] = React.useState(false)
  const { id } = useItemCard()

  return (
    <>
      <Item
        {...props}
        onClick={(e) => {
          setOpen(true)
          props.onClick?.(e)
        }}
      >
        <ActivityIcon className="text-current" />
        Activity
      </Item>
      <ItemActivityDrawer itemId={id} open={open} onOpenChange={setOpen} />
    </>
  )
}
```

- [ ] **Step 2: Attach to public API**

```tsx
export const Actions = Object.assign(ActionsRoot, {
  Group, Item, Preview, Download, Copy, Move, Rename, Details, Favorite,
  Pin, Lock,
  Share, Invite, Activity,
})
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/components/stash/item-card-actions.tsx
git commit -m "feat(item-card): add Share/Invite/Activity action sub-components"
```

---

## Task 6: Add Trash, Restore, Delete, RemoveFromCollection destructive actions

**Files:**
- Modify: `app/components/stash/item-card-actions.tsx`

`Trash`, `Restore` fire `/api/items` fetcher submits. `Delete` wraps the submit in `useConfirm`. `RemoveFromCollection` takes a `collectionId` prop and fires `/api/collections` with `intent: 'remove_item'`.

- [ ] **Step 1: Append destructive sub-components**

```tsx
// -- Trash -------------------------------------------------------------------

function Trash(props: ItemProps) {
  const fetcher = useFetcher()
  const { id } = useItemCard()

  return (
    <Item
      variant="destructive"
      {...props}
      className={cn('mt-2 items-start hover:cursor-pointer', props.className)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        fetcher.submit(
          { intent: 'trash_item', selectedItem: id },
          { method: 'POST', action: href('/api/items') }
        )
        props.onClick?.(e)
      }}
    >
      <TrashIcon className="text-current" />
      <span className="text-nowrap shrink-0">Trash</span>
    </Item>
  )
}

// -- Restore -----------------------------------------------------------------

function Restore(props: ItemProps) {
  const fetcher = useFetcher()
  const { id } = useItemCard()

  return (
    <Item
      {...props}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        fetcher.submit(
          { intent: 'restore_item', selectedItem: id },
          { method: 'POST', action: href('/api/items') }
        )
        props.onClick?.(e)
      }}
    >
      <RestoreIcon className="text-current" />
      Restore
    </Item>
  )
}

// -- Delete ------------------------------------------------------------------

function Delete(props: ItemProps) {
  const fetcher = useFetcher()
  const { id, name } = useItemCard()
  const onDelete = React.useCallback(() => {
    fetcher.submit(
      { intent: 'delete_item', selectedItem: id },
      { method: 'POST', action: href('/api/items') }
    )
  }, [id, fetcher])
  const { open } = useConfirm(onDelete)

  return (
    <Item
      variant="destructive"
      {...props}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        open({
          variant: 'destructive',
          title: `Are you sure you want to delete ${name}?`,
          description:
            'This action cannot be undone, deleted items cannot be restored.',
          confirmText: 'Delete',
        })
        props.onClick?.(e)
      }}
    >
      <DeleteIcon className="text-current" />
      <span>Delete</span>
    </Item>
  )
}

// -- RemoveFromCollection ----------------------------------------------------

interface RemoveFromCollectionProps extends ItemProps {
  collectionId: string
}

function RemoveFromCollection({
  collectionId,
  ...props
}: RemoveFromCollectionProps) {
  const fetcher = useFetcher()
  const { id, name } = useItemCard()
  const onRemove = React.useCallback(() => {
    fetcher.submit(
      { intent: 'remove_item', itemId: id, collectionId },
      { method: 'POST', action: href('/api/collections') }
    )
  }, [id, collectionId, fetcher])
  const { open } = useConfirm(onRemove)

  return (
    <Item
      variant="destructive"
      {...props}
      className={cn('mt-2 items-start hover:cursor-pointer', props.className)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        open({
          variant: 'destructive',
          title: `Remove ${name} from this collection?`,
          description:
            'The item stays in your stash; it just leaves this collection.',
          confirmText: 'Remove',
        })
        props.onClick?.(e)
      }}
    >
      <RemoveIcon className="text-current" />
      <span className="text-nowrap shrink-0">Remove from collection</span>
    </Item>
  )
}
```

- [ ] **Step 2: Confirm `RemoveIcon` exists in `app/components/icons.tsx`**

Run: `grep -n "RemoveIcon" app/components/icons.tsx`  
Expected: A matching export. If missing, **stop and notify the user** (per CLAUDE.md: do not use `lucide-react` directly).

- [ ] **Step 3: Attach to public API**

```tsx
export const Actions = Object.assign(ActionsRoot, {
  Group, Item, Preview, Download, Copy, Move, Rename, Details, Favorite,
  Pin, Lock, Share, Invite, Activity,
  Trash, Restore, Delete, RemoveFromCollection,
})
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/stash/item-card-actions.tsx
git commit -m "feat(item-card): add destructive actions + RemoveFromCollection"
```

---

## Task 7: Wire shorthand default menu (no children = full default)

**Files:**
- Modify: `app/components/stash/item-card-actions.tsx`

Replace the placeholder `DefaultMenu` with the full composition. When `status === 'trashed'`, render `Restore` + `Delete` only. Otherwise, render the full menu identical to today.

- [ ] **Step 1: Replace the `DefaultMenu` stub with the full implementation**

Find the existing `function DefaultMenu({ status }: { status: string }) { return null }` and replace it with:

```tsx
function DefaultMenu({ status }: { status: string }) {
  if (status === 'trashed') {
    return (
      <>
        <Restore />
        <Delete />
      </>
    )
  }

  return (
    <>
      <Group>
        <Preview />
        <Download />
      </Group>
      <Group label="Quick actions">
        <Favorite />
        <Pin />
      </Group>
      <Group label="Access">
        <Share />
        <Invite />
        <Lock />
      </Group>
      <Group label="Organize">
        <Copy />
        <Move />
        <Rename />
      </Group>
      <Group label="Information">
        <Activity />
        <Details />
      </Group>
      <Trash />
    </>
  )
}
```

- [ ] **Step 2: Add the `Delete` key listener to `ActionsRoot`**

Per the spec, the keyboard handler stays in shorthand mode. Edit `ActionsRoot` to mount the listener only when `!hasChildren`:

```tsx
function ActionsRoot({ children, ...triggerProps }: ActionsRootProps) {
  const fetcher = useFetcher()
  const { id, status } = useItemCard()
  const hasChildren = React.Children.count(children) > 0

  React.useEffect(() => {
    if (hasChildren) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Delete') {
        event.preventDefault()
        event.stopPropagation()
        fetcher.submit(
          { intent: 'trash_item', selectedItem: id },
          { method: 'POST', action: href('/api/items') }
        )
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hasChildren, id, fetcher])

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
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`  
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/components/stash/item-card-actions.tsx
git commit -m "feat(item-card): wire shorthand default menu in compound Actions"
```

---

## Task 8: Replace `ItemCardActions` in item-card.tsx with re-export

**Files:**
- Modify: `app/components/stash/item-card.tsx`

Delete the monolithic `ItemCardActions` definition (lines 103–362), drop the `console.log` (was on line 120), drop now-unused imports, import the new `Actions` from `./item-card-actions`, and attach it to the public compound API.

- [ ] **Step 1: Remove the monolithic `ItemCardActions` component**

Delete the entire `const ItemCardActions = (props: ...) => { ... } ItemCardActions.displayName = 'ItemCardActions'` block (currently lines 103–362) along with the trailing comment on line 363.

- [ ] **Step 2: Prune now-unused imports at the top of `item-card.tsx`**

Inspect the remaining file. Remove from the import list any symbol no longer referenced after deleting `ItemCardActions`. Likely candidates: `useFetcher`, `useCallback`, `Slot` (if unused elsewhere — keep it; it is used by `ItemCardRoot`), all icons that only appeared in the menu (`ShareItemFillIcon`, `ActivityIcon`, `CopyIcon`, `DeleteIcon`, `DownloadIcon`, `FileDetailsIcon`, `HeartIcon`, `LockIcon`, `MenuDotsIcon`, `MoveToFolder`, `PinIcon`, `PinFillIcon`, `PreviewIcon`, `RenameIcon`, `RestoreIcon`, `ShareItemIcon`, `ShareFillIcon`, `TrashIcon`, `GroupIcon`, `LockFillIcon`, `UnlockFillIcon`), `ShareDialog`, `InviteDialog`, `ItemActivityDrawer`, `DropdownMenu` / `DropdownMenuContent` / `DropdownMenuGroup` / `DropdownMenuItem` / `DropdownMenuLabel` / `DropdownMenuTrigger`, `useConfirm`, `usePinItem`, `useLockItem`, `Button`, `ScrollArea`, `toFavorite`, `href`.

Keep imports still used by the remaining card-structure components: `FolderIcon` (used by `ItemThumbnailFallback`), `Link`/`useNavigate`/`useRouteLoaderData`/`useSearchParams`, `Favorite` (the standalone component, used by `ItemFavorite`), `Checkbox`, etc.

After pruning, run `pnpm typecheck` after step 4 to confirm — any unused-import errors there mean you missed one.

- [ ] **Step 3: Import the new Actions and attach it to the compound API**

Near the top of `item-card.tsx`, add:

```tsx
import { Actions as ItemCardActions } from './item-card-actions'
```

At the bottom of the file, update the `Object.assign` block. Change:

```tsx
export const ItemCard = Object.assign(ItemCardRoot, {
  Header: ItemHeader,
  Content: ItemContent,
  Footer: ItemFooter,
  Name: ItemName,
  Thumbnail: ItemThumbnail,
  ThumbnailImage: ItemThumbnailImage,
  ThumbnailFallback: ItemThumbnailFallback,
  Count: ItemCount,
  Size: ItemSize,
  Link: ItemLink,
  Favorite: ItemFavorite,
  Checkbox: ItemCardCheckBox,
  Actions: ItemCardActions,
})
```

(The `Actions: ItemCardActions` line stays unchanged in name — only the imported source is different.)

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`  
Expected: PASS. If any unused-import warnings appear, prune those imports.

- [ ] **Step 5: Commit**

```bash
git add app/components/stash/item-card.tsx
git commit -m "refactor(item-card): replace monolithic Actions with compound re-export"
```

---

## Task 9: Update collection-view.tsx to swap Trash for RemoveFromCollection

**Files:**
- Modify: `app/components/views/collection-view.tsx`

The relevant block is around line 327–342 in the `CollectionItemCard` render. The shorthand `<ItemCard.Actions />` is replaced with explicit composition. We need access to `collectionId` — `useParams()` is already imported (line 2) and used elsewhere in the file (`CollectionItemRow`, line 358).

- [ ] **Step 1: Read `useParams` from inside the component**

Find the `CollectionItemCard` (or equivalent named function rendering `<ItemCard {...stashItem}>` around line 327). Add a `useParams` call inside it before the `return`:

```tsx
const { collectionId } = useParams()
```

If `collectionId` is missing (e.g. the same component is reused outside a collection route), fall back to the shorthand — see step 2.

- [ ] **Step 2: Replace `<ItemCard.Actions className="place-self-end" />` with explicit composition**

```tsx
<ItemCard.Header>
  <ItemCard.Checkbox name="selectedItems" value={item.id} />
  {collectionId ? (
    <ItemCard.Actions className="place-self-end">
      <ItemCard.Actions.Group>
        <ItemCard.Actions.Preview />
        <ItemCard.Actions.Download />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.Group label="Quick actions">
        <ItemCard.Actions.Favorite />
        <ItemCard.Actions.Pin />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.Group label="Access">
        <ItemCard.Actions.Share />
        <ItemCard.Actions.Invite />
        <ItemCard.Actions.Lock />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.Group label="Organize">
        <ItemCard.Actions.Copy />
        <ItemCard.Actions.Move />
        <ItemCard.Actions.Rename />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.Group label="Information">
        <ItemCard.Actions.Activity />
        <ItemCard.Actions.Details />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.RemoveFromCollection collectionId={collectionId} />
    </ItemCard.Actions>
  ) : (
    <ItemCard.Actions className="place-self-end" />
  )}
</ItemCard.Header>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`  
Expected: PASS.

- [ ] **Step 4: Verify in the browser**

1. Ensure dev server is running: `pnpm dev` (kill any process on port 3000 first).
2. Open `http://localhost:3000` and navigate to a collection.
3. Open the `…` menu on an item card. Confirm:
   - All groups appear (Preview/Download, Quick actions, Access, Organize, Information).
   - The bottom destructive action reads **Remove from collection** with the `RemoveIcon`, NOT Trash.
   - Clicking it shows a confirmation dialog. Confirming removes the item from the collection and the list updates.
4. Navigate to a non-collection page (`/me/stash/all`). Open an item's `…` menu. Confirm it still shows **Trash** at the bottom — i.e. the default shorthand still works elsewhere.

If any step fails, **do not commit**. Diagnose and fix before continuing.

- [ ] **Step 5: Commit**

```bash
git add app/components/views/collection-view.tsx
git commit -m "feat(collection-view): swap Trash for RemoveFromCollection in item card actions"
```

---

## Task 10: Final verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`  
Expected: PASS, zero errors.

- [ ] **Step 2: Lint / format**

Run: `pnpm format`  
Expected: clean exit.

- [ ] **Step 3: Smoke-test remaining callsites**

In the running dev server, open the `…` menu on an item in each of these views and confirm the full default menu still renders correctly:

- `/me/stash/all` → `all.tsx`
- `/me/stash/folder/:folderId` → `folder.tsx`
- `/me/stash/pinned` → `pinned.tsx`
- `/me/stash/favorites` → `favorites.tsx`
- `/me/stash/trash` → `trash.tsx` (should show **Restore** + **Delete** only)

- [ ] **Step 4: Final commit if any cleanup landed**

If `pnpm format` modified files:

```bash
git add -A
git commit -m "chore: format after item-card actions refactor"
```

Otherwise skip.

---

## Out of scope (per spec)

- Wiring real handlers for Copy / Move / Rename — those menu items remain visual-only as they were.
- Removing the keyboard `Delete` listener from explicit-composition callsites — by design, callsites that compose explicitly own their own keyboard handling.
- Adding new tests — this is a structural refactor of existing UI logic; behaviour is validated via typecheck + manual smoke-test of the rendered menu. The codebase has no component-level unit tests for item-card today; adding any would be net-new convention.
