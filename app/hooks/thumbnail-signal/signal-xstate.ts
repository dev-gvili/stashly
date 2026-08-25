/**
 * Option C — Dedicated XState actor at module scope.
 *
 * A small standalone machine holds `Map<itemId, ThumbProgress>`. Producer
 * sends events; consumer subscribes via `useSelector`. Kept separate from
 * the upload machine so progress survives after the file is removed from
 * the upload queue. PATCH is dispatched via `useFetcher`.
 */
import { useCallback } from 'react'
import { createActor, setup, assign } from 'xstate'
import { useSelector } from '@xstate/react'
import { useFetcher } from 'react-router'
import type { ThumbProgress, ThumbnailPublisher } from './signal.types'

type SetEvent = { type: 'set'; itemId: string; progress: ThumbProgress }
type Context = { entries: Map<string, ThumbProgress> }

const thumbnailMachine = setup({
  types: {
    context: {} as Context,
    events: {} as SetEvent,
  },
}).createMachine({
  id: 'thumbnail-progress',
  context: { entries: new Map() },
  on: {
    set: {
      actions: assign({
        entries: ({ context, event }) => {
          const next = new Map(context.entries)
          next.set(event.itemId, event.progress)
          return next
        },
      }),
    },
  },
})

const thumbnailActor = createActor(thumbnailMachine)
thumbnailActor.start()

/**
 * Producer side of the XState signal — sends `set` events into the module-scope
 * thumbnail actor. Kept separate from the upload machine on purpose, so progress
 * survives the file being removed from the upload queue.
 *
 * @param itemId - Item whose thumbnail progress this publisher broadcasts.
 *
 * @example
 * // Stage 1 — actor event only, no HTTP
 * const publisher = useThumbnailPublisher(itemId)
 * publisher.publishLocal({ src: objectUrl })
 *
 * @example
 * // Stage 3 — the salient crop, PATCHed and broadcast together
 * publisher.publishPersisted({ stage: 3, src: stage3Url, width: 512, height: 512 })
 */
export function useThumbnailPublisher(itemId: string): ThumbnailPublisher {
  const patchFetcher = useFetcher()

  const publishLocal = useCallback(
    ({ src }: { src: string }) => {
      thumbnailActor.send({ type: 'set', itemId, progress: { stage: 1, src } })
    },
    [itemId],
  )

  const publishPersisted = useCallback(
    ({ stage, src, width, height }: { stage: 2 | 3; src: string; width: number; height: number }) => {
      const fd = new FormData()
      fd.append('stage', String(stage))
      fd.append('url', src)
      fd.append('width', String(width))
      fd.append('height', String(height))
      patchFetcher.submit(fd, { method: 'patch', action: `/api/thumbnails/${itemId}` })
      thumbnailActor.send({
        type: 'set',
        itemId,
        progress: { stage, src, width, height },
      })
    },
    [itemId, patchFetcher],
  )

  return { publishLocal, publishPersisted }
}

/**
 * Consumer side of the XState signal — subscribes to one item's entry in the
 * actor's map, comparing by reference so unrelated items advancing don't
 * re-render this card.
 *
 * @param itemId - Item to watch.
 *
 * @example
 * // Paint the freshest stage available
 * const live = useLiveThumbnail(item.id)
 * <img src={live?.src ?? fallbackUrl} />
 *
 * @example
 * // Show a shimmer until the first stage arrives
 * const live = useLiveThumbnail(item.id)
 * {live === null ? <Skeleton /> : <img src={live.src} />}
 */
export function useLiveThumbnail(itemId: string): ThumbProgress | null {
  return useSelector(
    thumbnailActor,
    (s) => s.context.entries.get(itemId) ?? null,
    (a, b) => a === b,
  )
}
