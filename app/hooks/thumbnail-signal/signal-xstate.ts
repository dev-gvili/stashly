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

export function useLiveThumbnail(itemId: string): ThumbProgress | null {
  return useSelector(
    thumbnailActor,
    (s) => s.context.entries.get(itemId) ?? null,
    (a, b) => a === b,
  )
}
