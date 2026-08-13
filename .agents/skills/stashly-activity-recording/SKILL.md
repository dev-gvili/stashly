---
name: stashly-activity-recording
description: Stashly activity recording — the fire-and-forget createActivity pattern, per-file record*Activity helpers, ItemAction action types, pins/favorites wiring, openedAt tracking, and StashlyPrefixMap. Load when adding activity tracking, a new action kind, or working on pins/favorites in the Stashly repo.
---

# Stashly Activity Recording

**Fire-and-forget pattern**: Use `Promise.resolve().then(() => createActivity({...})).catch(() => {})` — not just `createActivity({...}).catch(() => {})`. Arguments to `createActivity` may throw synchronously (e.g. `toObjectId` when a prefix is missing), which `.catch()` on the returned promise cannot intercept.

**Per-file `record*Activity` helpers**: each `*-actions.ts` defines its own private helper at the top of the file (see `pin-actions.ts`, `collection-actions.ts`, `item-actions.ts`'s `recordFavoriteActivity`, `storage-actions.ts`'s `recordBucketEmptied`). Keeps fire-and-forget boilerplate out of business logic; mirror this pattern in new action files.

**`DeleteAction.itemType`**: the `ObjectType` enum only has `file | folder` — collections map to `'folder'` (closest semantic match, mirrors `trashItems` behaviour).

**Hard-delete activity is best-effort**: `Activity.itemId` has `onDelete: Cascade`. Recording an activity after a permanent delete (`permanentlyDeleteItem`, `deleteCollection`) will FK-fail silently because the parent item is already gone. Pattern is intentional — soft-delete (trash) is the durable record.

**`searchFactory` does not auto-apply `defaultInclude`**: Pass `include` explicitly on every `searchActivities` / `searchItems` call or relations will be omitted from results.

**`StashlyPrefixMap`**: Every new Prisma model that uses `toObjectId(getPrefixForModel('ModelName'))` must have an entry in `app/utils/converters.ts`. Missing entries throw synchronously: `Invalid prefix: must be a non-empty string without an underscore`.

**`Activity.access` include level**: `access: true` belongs at the top-level `Activity` include, not inside `action: { include: { ... } }` (which maps to `ItemAction` — `ItemAction` has no `access` field).

## Pins & Favorites

**Pinned items**: `PinItem` is a per-user, per-item join row with a `position` int for manual ordering. Business logic lives in `app/.server/pin-actions.ts`; the resource route is `/api/pins` (POST `intent: pin|unpin|reorder`, GET `intent: list|check`). Pin/Unpin is surfaced in `ItemCard.Actions` via the `usePinItem` hook (`app/hooks/usePinItem.ts`) for optimistic toggling. The pinned page lives at `/:me/stash/pinned`. `StashItem` carries an optional `pins?: StashPin[]` field — populated by `getPinnedItems` and `getFavoritedItems` selects so the dropdown shows the correct initial label.

**Favorites**: mirrors the pinned-items pattern. Business logic lives in `app/.server/item-actions.ts` (`addFavorite`/`addFavorites`/`removeFavorite`); the resource route is `/api/favorites` (POST `intent: favorite|unfavorite|favorite_items`). Favorite/Unfavorite is surfaced via the `useFavorite` hook (`app/hooks/useFavorite.ts`) for optimistic toggling, used in both `ItemCard.Actions` and the standalone `Favorite` heart button. `favorite_items` bulk-favorites a comma-separated `selectedItems` list for the toolbar's multi-select action.

## Activity action types

`ItemAction` has a 1:1 relation to one of: `CreateAction`, `RenameAction`, `MoveAction`, `CopyAction`, `DeleteAction { name, itemType }`, `RestoreAction`, `ShareAction`, `VersionAction`, `CommentAction`, `PermissionAction`, `UploadAction`, `EditAction`, `PinAction { kind: pinned|unpinned|reordered }`, `FavoriteAction { kind: favorited|unfavorited }`, `CollectionAction { kind: item_added|item_removed|emptied, collectionId, itemId, count }`, `BucketAction { kind: emptied }`.

When adding a new kind: add the model + enum, add a prefix to `StashlyPrefixMap`, extend `defaultInclude` and `OverviewActivityKind` in `activity-actions.ts`, extend `formatActivity` in `app/utils/activity.ts`, and add a verb to `ACTIVITY_VERB` in `overview-view.tsx`.

## Where activity surfaces

`ActivityFeed` (`app/components/core-components/activity-feed.tsx`, rows rendered by `activity-entry.tsx`) is the single render surface. Two callers: `item-activity-drawer.tsx` and the item page's side panel (`app/components/views/item-page/item-panel.tsx`). The old gallery-image sidebar is gone — the item page replaced it.

## `openedAt` tracking

Any route loader that opens a file, folder, collection, or image must call `touchOpenedAt(itemId)` from `@/services/item-actions` fire-and-forget — `Promise.resolve().then(() => touchOpenedAt(id)).catch(() => {})`. This keeps `openedAt` current for recency/suggested-items features. Current callers: `routes/stash/folder.tsx`, `routes/stash/file.tsx`, `routes/stash/collection.tsx`. There is no longer a `gallery-image.tsx` route — images open through the shared item page at `stash/folders/:folderId/files/:fileId` (`file.tsx`), so its `touchOpenedAt` call covers them too.
