import { useFetcher } from 'react-router'
import { useCallback } from 'react'

type FavoriteResponse = { favorited?: boolean; error?: string }

/**
 * Optimistically toggles the favorited state of an item via `POST /api/favorites`.
 *
 * Derived state priority (highest → lowest):
 * 1. In-flight `fetcher.formData` intent (`favorite` / `unfavorite`) — immediate optimistic value
 * 2. Settled `fetcher.data.favorited` from the server response
 * 3. `initiallyFavorited` prop (loader data)
 *
 * @param itemId - The ID of the item to favorite or unfavorite.
 * @param initiallyFavorited - Favorited state from the server at render time (default `false`).
 *
 * @example
 * // Basic toggle button inside an item card
 * function FavoriteButton({ item }: { item: StashItem }) {
 *   const alreadyFavorited = item.favorites?.some(f => f.favoritedById === currentUserId) ?? false
 *   const { favorited, toggle, isPending } = useFavorite(item.id, alreadyFavorited)
 *
 *   return (
 *     <button onClick={toggle} disabled={isPending} aria-pressed={favorited}>
 *       {favorited ? 'Unfavorite' : 'Favorite'}
 *     </button>
 *   )
 * }
 *
 * @example
 * // Inside ItemCard.Actions
 * const { favorited, toggle } = useFavorite(item.id, (item.favorites?.length ?? 0) > 0)
 * <DropdownMenuItem onSelect={toggle}>
 *   {favorited ? 'Remove from favorites' : 'Add to favorites'}
 * </DropdownMenuItem>
 */
export function useFavorite(itemId: string, initiallyFavorited = false) {
  const fetcher = useFetcher<FavoriteResponse>()

  const favorited =
    fetcher.formData?.get('intent') === 'favorite'
      ? true
      : fetcher.formData?.get('intent') === 'unfavorite'
        ? false
        : (fetcher.data?.favorited ?? initiallyFavorited)

  const toggle = useCallback(() => {
    const intent = favorited ? 'unfavorite' : 'favorite'
    fetcher.submit(
      { intent, itemId },
      { method: 'POST', action: '/api/favorites' }
    )
  }, [fetcher, itemId, favorited])

  return {
    favorited,
    toggle,
    isPending: fetcher.state !== 'idle',
  }
}
