import { useParams } from 'react-router'
import { toItemUrl } from '@/utils/converters'
import type { ItemType } from '@/prisma/browser'

export type ItemUrlTarget = {
  type: ItemType
  id: string
  parentId: string
  /**
   * Fallback for the `:me` segment, used only when the current route has no
   * `:me` param. Every authenticated app route sits under `/:me`, so this is a
   * safety net rather than the normal path.
   */
  ownerId: string
}

/** The subset of route params that decides which URL tree an item lives in. */
export type ItemUrlRoute = {
  me?: string
  workspaceId?: string
}

/**
 * Resolves an item's page URL from the current route params. Pure counterpart of
 * {@link useItemUrl} — the hook is only `useParams()` plus this call, so all the
 * branching stays testable without a DOM.
 *
 * The `:me` segment comes from the route, never from the item: in the personal
 * stash the owner and the viewer are the same person, but in a workspace the
 * owner is whichever teammate uploaded the item, and using it would put a
 * stranger's id in the viewer's URL.
 *
 * @param route - `me` and `workspaceId` as read from the current route.
 * @param target - The item to link to.
 * @returns The relative URL for the item's page.
 *
 * @example
 * itemUrlFor({ me: 'usr_1' }, { type: 'folder', id: 'fld_1', parentId: '', ownerId: 'usr_1' })
 * // → "/usr_1/stash/folders/fld_1"
 *
 * @example
 * itemUrlFor({ me: 'usr_1', workspaceId: 'wsp_9' }, { type: 'folder', id: 'fld_1', parentId: '', ownerId: 'usr_2' })
 * // → "/usr_1/workspaces/wsp_9/folders/fld_1"  ← viewer's id, not the owner's
 */
export function itemUrlFor(route: ItemUrlRoute, target: ItemUrlTarget): string {
  return toItemUrl({
    type: target.type,
    id: target.id,
    parentId: target.parentId,
    me: route.me ?? target.ownerId,
    workspaceId: route.workspaceId,
  })
}

/**
 * Returns a builder for item page URLs that is aware of which route tree the
 * caller is rendering in. The same item pages are reachable through the
 * personal stash (`/:me/stash/...`) and through a workspace
 * (`/:me/workspaces/:workspaceId/...`), and the prefix is the only difference —
 * so the builder reads `:me` and `:workspaceId` off the current route instead of
 * making every call site thread them through.
 *
 * Prefer this over calling `toItemUrl` directly from a component.
 *
 * @returns A function taking the item's `type`, `id`, `parentId` and `ownerId`,
 *   and returning the relative URL for its page.
 *
 * @example
 * // Inside a card component — resolves to the workspace URL automatically
 * // when rendered under /:me/workspaces/:workspaceId/*
 * const itemUrl = useItemUrl()
 * const to = itemUrl({ type, id, parentId: parentId ?? '', ownerId: user.id })
 *
 * @example
 * // Rules of hooks: call it above any early return
 * function ActivityEvent({ activity }) {
 *   const itemUrl = useItemUrl()
 *   if (!activity.item) return null
 *   const url = itemUrl({ ...activity.item, parentId: activity.item.parentId ?? '' })
 * }
 */
export function useItemUrl() {
  const { me, workspaceId } = useParams()
  return (target: ItemUrlTarget) => itemUrlFor({ me, workspaceId }, target)
}
