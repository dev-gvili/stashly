import { useCallback, useMemo } from 'react'
import { useFetchers, useSubmit } from 'react-router'

const ACTION = '/api/collections'

type CollectionRef = { id: string; name: string }

/**
 * Collection writes, one function per intent. Submits go through
 * `useSubmit({ navigate: false })` rather than a component-owned fetcher: a
 * card that trashes itself unmounts, and its fetcher would die with it.
 *
 * @example
 * const { removeItems } = useCollectionMutations()
 * removeItems(collection, ['itm_1', 'itm_2'])
 */
export function useCollectionMutations() {
  const submit = useSubmit()

  const send = useCallback(
    (fields: Record<string, string>) =>
      submit(fields, {
        method: 'post',
        action: ACTION,
        navigate: false,
        preventScrollReset: true,
      }),
    [submit]
  )

  return useMemo(
    () => ({
      create(name: string) {
        send({ intent: 'create_collection', name })
      },
      rename(col: CollectionRef, newName: string) {
        send({ intent: 'rename_collection', collectionId: col.id, newName })
      },
      addItems(col: CollectionRef, itemIds: string[]) {
        send({
          intent: 'add_items_to_collection',
          collectionId: col.id,
          itemIds: itemIds.join(','),
        })
      },
      removeItems(col: CollectionRef, itemIds: string[]) {
        send({
          intent: 'remove_items_from_collection',
          collectionId: col.id,
          itemIds: itemIds.join(','),
        })
      },
      empty(col: CollectionRef) {
        send({ intent: 'clear_collection', collectionId: col.id })
      },
      trash(col: CollectionRef) {
        send({ intent: 'trash_collection', collectionId: col.id })
      },
    }),
    [send]
  )
}

/**
 * Ids of items whose removal is in flight, read from every pending fetcher so
 * a grid can hide them at once (optimistic UI) without local state.
 */
export function usePendingRemovedIds(collectionId: string): Set<string> {
  const fetchers = useFetchers()
  return useMemo(() => {
    const ids = new Set<string>()
    for (const f of fetchers) {
      const data = f.formData
      if (!data || data.get('intent') !== 'remove_items_from_collection') continue
      if (data.get('collectionId') !== collectionId) continue
      for (const id of String(data.get('itemIds') ?? '').split(',')) {
        if (id) ids.add(id)
      }
    }
    return ids
  }, [fetchers, collectionId])
}
