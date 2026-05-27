# ItemCard.Actions — Compound Component Design

**Date:** 2026-05-25  
**Status:** Approved for implementation

---

## Problem

`ItemCardActions` is a monolithic component with all actions hardcoded. Different contexts (collection view, pinned, trash) need to render different subsets of actions or swap specific actions (e.g. "Remove from Collection" instead of "Trash"). Today the only customisation hook is `status === 'trashed'` baked inside the component.

---

## Goals

- Let callsites pick a subset of actions or swap specific ones without duplicating logic.
- Zero breaking changes to the 7 existing callsites that use `<ItemCard.Actions />`.
- Each action sub-component is self-contained: it owns its fetcher, hook calls, and any dialog/drawer state.

---

## Design

### API shape

Three layers:

1. **Shorthand (no children)** — `<ItemCard.Actions />` renders the full default menu, identical to today. The trashed-state branch (`Restore` + `Delete`) remains inside the shorthand. All existing callsites continue to work unchanged.

2. **Predefined sub-components** — `ItemCard.Actions.*` exposes every current action as a named sub-component. Each carries its own logic so callers just include or omit what they need.

3. **Escape-hatch primitives** — `Actions.Group` and `Actions.Item` let callers build completely custom actions without any predefined logic.

### Sub-component registry

| Sub-component | Logic it owns |
|---|---|
| `Actions.Group` | `DropdownMenuGroup` + optional `label` prop |
| `Actions.Item` | Thin `DropdownMenuItem` wrapper, all props forwarded |
| `Actions.Preview` | Menu item, no side effects |
| `Actions.Download` | Menu item, no side effects |
| `Actions.Favorite` | Fetcher submit (favorite / unfavorite), reads `useItemCard()` |
| `Actions.Pin` | `usePinItem` hook, optimistic toggle |
| `Actions.Share` | Local `open` state + renders `ShareDialog` (portaled) |
| `Actions.Invite` | Local `open` state + renders `InviteDialog` (portaled) |
| `Actions.Lock` | `useLockItem` hook, optimistic toggle |
| `Actions.Copy` | Menu item, no side effects |
| `Actions.Move` | Menu item, no side effects |
| `Actions.Rename` | Menu item, no side effects |
| `Actions.Activity` | Local `open` state + renders `ItemActivityDrawer` (portaled) |
| `Actions.Details` | Menu item, no side effects |
| `Actions.Trash` | Fetcher submit `trash_item` |
| `Actions.Restore` | Fetcher submit `restore_item` |
| `Actions.Delete` | `useConfirm` → fetcher submit `delete_item` |
| `Actions.RemoveFromCollection` | `useConfirm` → fetcher submit `remove_from_collection`; requires `collectionId` prop |

### Callsite examples

```tsx
// All existing callsites — zero changes
<ItemCard.Actions className="place-self-end" />

// Collection view — swap Trash for Remove, keep all other actions
<ItemCard.Actions className="place-self-end">
  <A.Group>
    <A.Preview />
    <A.Download />
  </A.Group>
  <A.Group label="Quick actions">
    <A.Favorite />
    <A.Pin />
  </A.Group>
  <A.Group label="Access">
    <A.Share />
    <A.Invite />
    <A.Lock />
  </A.Group>
  <A.Group label="Organize">
    <A.Copy />
    <A.Move />
    <A.Rename />
  </A.Group>
  <A.Group label="Information">
    <A.Activity />
    <A.Details />
  </A.Group>
  <A.RemoveFromCollection collectionId={collectionId} />
</ItemCard.Actions>

// Minimal custom context — escape hatch
<ItemCard.Actions>
  <A.Group>
    <A.Preview />
    <A.Download />
  </A.Group>
  <A.Item variant="destructive" onClick={handleCustomAction}>
    <CustomIcon /> Custom action
  </A.Item>
</ItemCard.Actions>
```

### Root component behaviour

- `Actions` root renders the `DropdownMenu` shell (trigger button with `MenuDotsIcon`, `modal={false}`, `DropdownMenuContent` with `ScrollArea`).
- When `children` is `undefined` or `null` (detected via `React.Children.count`): renders the full default menu (existing behaviour, including the trashed branch).
- When `children` is provided: renders children directly inside the `ScrollArea` content area. The `Delete` key listener is only active in shorthand mode; explicit compositions manage their own keyboard handling. The root no longer manages any action-level state in this mode — each sub-component is self-contained.

### Dialog / drawer rendering

Sub-components that own dialog state (`Share`, `Invite`, `Activity`) render their dialog as a fragment sibling to their `DropdownMenuItem`:

```tsx
const ActionsShare = () => {
  const [open, setOpen] = useState(false)
  const { id, name, type } = useItemCard()
  return (
    <>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setOpen(true) }}>
        <ShareItemFillIcon /> Share
      </DropdownMenuItem>
      <ShareDialog open={open} onOpenChange={setOpen} itemId={id} itemName={name} itemType={type === 'folder' ? 'folder' : 'file'} />
    </>
  )
}
```

Radix portals the dialog to `document.body` regardless of React-tree position, so placing it inside `DropdownMenuContent` is safe. `modal={false}` on the root `DropdownMenu` prevents scroll-lock conflicts.

---

## File structure

Current `item-card.tsx` is 795 lines. Actions logic moves to a dedicated file:

```
app/components/stash/
  item-card.tsx              ← card structure only (Root, Header, Content, Footer,
  │                             Thumbnail, ThumbnailImage, ThumbnailFallback,
  │                             Name, Size, Count, Link, Checkbox, Favorite)
  item-card-actions.tsx      ← Actions root + all sub-components (new file)
```

`item-card.tsx` re-exports `Actions` and mounts it on `ItemCard.Actions` — no import changes at callsites.

---

## Out of scope

- Implementing Copy, Move, Rename functionality (menu items exist, wiring deferred).
- Keyboard shortcut handler inside `Actions` (the `Delete` key listener currently in the monolith stays in the shorthand default for now).
- Any changes to `Actions.Item` props beyond `DropdownMenuItem`'s existing API.

---

## Rollout

1. Create `item-card-actions.tsx` with `Actions` root + all sub-components.
2. Wire the `children`-aware branch into the root.
3. Re-export from `item-card.tsx`, attach to `ItemCard.Actions`.
4. Update `collection-view.tsx` to use explicit composition with `Actions.RemoveFromCollection`.
5. Remove the `console.log` on line 120 of `item-card.tsx`.
6. Typecheck.
