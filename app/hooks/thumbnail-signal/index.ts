/**
 * Active signal selector — change `ACTIVE_SIGNAL` to swap implementations.
 *
 * All three options (store / fetcher / xstate) expose the same
 * `useThumbnailPublisher(itemId)` and `useLiveThumbnail(itemId)` hooks.
 * Both producer (orchestrator) and consumer (card) import from this
 * file, so flipping the constant changes both sides atomically.
 */
import * as store from './signal-store'
import * as fetcherSignal from './signal-fetcher'
import * as xstateSignal from './signal-xstate'

export type ActiveSignal = 'store' | 'fetcher' | 'xstate'

export const ACTIVE_SIGNAL: ActiveSignal = 'fetcher'

const impl =
ACTIVE_SIGNAL === 'fetcher'
  ? fetcherSignal
  : ACTIVE_SIGNAL === 'store'
    ? store
      : xstateSignal

export const useThumbnailPublisher = impl.useThumbnailPublisher
export const useLiveThumbnail = impl.useLiveThumbnail

export type { ThumbProgress, ThumbnailPublisher } from './signal.types'
