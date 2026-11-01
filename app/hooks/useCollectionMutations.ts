import { useCallback, useMemo } from 'react'
import { useFetchers, useSubmit } from 'react-router'
import { toast } from 'sonner'

const ACTION = '/api/collections'

type CollectionRef = { id: string; name: string }

/**
 * Collection mutations with their toasts. Every message says the files stay in
 * the stash, and Remove / Empty / Trash carry an Undo that re-submits the
 * inverse intent.
 *
 * Submits go through `useSubmit({ navigate: false })` rather than a
 * component-owned fetcher: a card that trashes itself unmounts, and an Undo
 * clicked afterwards would otherwise call a dead fetcher.
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

  return useMemo(() => {
    const addItems = (col: CollectionRef, itemIds: string[], quiet = false) => {
      send({
        intent: 'add_items_to_collection',
        collectionId: col.id,
        itemIds: itemIds.join(','),
      })
      if (quiet) return
      toast.success(
        `Added ${itemIds.length} ${itemIds.length === 1 ? 'file' : 'files'} to “${col.name}”`
      )
    }

    return {
      create(name: string) {
        send({ intent: 'create_collection', name })
        toast.success(`Created “${name}”`)
      },
      rename(col: CollectionRef, newName: string) {
        send({ intent: 'rename_collection', collectionId: col.id, newName })
        toast.success(`Renamed to “${newName}”`)
      },
      addItems,
      removeItems(col: CollectionRef, itemIds: string[]) {
        send({
          intent: 'remove_items_from_collection',
          collectionId: col.id,
          itemIds: itemIds.join(','),
        })
        const n = itemIds.length
        toast.success(
          `Removed ${n} ${n === 1 ? 'file' : 'files'} from “${col.name}”. The files stay in your stash.`,
          {
            action: {
              label: 'Undo',
              onClick: () => addItems(col, itemIds, true),
            },
          }
        )
      },
      /**
       * @param memberIds Current member ids, for Undo. Omitted where the caller
       *   only knows the count (the index), so no Undo is offered there.
       */
      empty(col: CollectionRef, memberIds?: string[]) {
        send({ intent: 'clear_collection', collectionId: col.id })
        toast.success(`Emptied “${col.name}”. The files stay in your stash.`, {
          action: memberIds?.length
            ? {
                label: 'Undo',
                onClick: () => addItems(col, memberIds, true),
              }
            : undefined,
        })
      },
      trash(col: CollectionRef) {
        send({ intent: 'trash_collection', collectionId: col.id })
        toast.success(`Moved “${col.name}” to trash. The files stay in your stash.`, {
          action: {
            label: 'Undo',
            onClick: () =>
              send({ intent: 'restore_collection', collectionId: col.id }),
          },
        })
      },
    }
  }, [send])
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
