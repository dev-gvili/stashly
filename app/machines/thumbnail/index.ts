/**
 * Implementation switch for the thumbnail pipeline.
 *
 * Flip `USE_THUMBNAIL_MACHINE` to move every call site between the machine
 * path in this folder and the original hooks, atomically. Both sides expose the
 * same three hooks plus the same pause/resume pair, so nothing downstream knows
 * which one it is talking to.
 *
 * The choice is made once, at module evaluation — not per render — so this is
 * a module-scope ternary rather than a conditional hook call. Same shape as the
 * `ACTIVE_SIGNAL` switch in `app/hooks/thumbnail-signal/index.ts`, which is the
 * precedent for it.
 *
 * **This file is temporary.** It exists so the machine path can be proven side
 * by side against the original in a real browser. Once that comparison is done,
 * the loser is deleted and this switch goes with it — see
 * `app/machines/thumbnail/README.md`.
 */
import * as machine from './hooks'

import { useThumbnail as legacyUseThumbnail } from '@/hooks/useThumbnail'
import {
  useThumbnailBackfill as legacyUseThumbnailBackfill,
  pauseBackfill as legacyPauseBackfill,
  resumeBackfill as legacyResumeBackfill,
} from '@/hooks/useThumbnailBackfill'
import { useLiveThumbnail as legacyUseLiveThumbnail } from '@/hooks/thumbnail-signal'

/**
 * True: thumbnails run through the XState manager in this folder, and search
 * indexing through `app/machines/indexing/`. False: the original hooks, where
 * `useThumbnail` does both itself.
 */
export const USE_THUMBNAIL_MACHINE = true

const legacy = {
  useThumbnail: legacyUseThumbnail,
  useThumbnailBackfill: legacyUseThumbnailBackfill,
  useLiveThumbnail: legacyUseLiveThumbnail,
  pauseBackfill: legacyPauseBackfill,
  resumeBackfill: legacyResumeBackfill,
}

const impl = USE_THUMBNAIL_MACHINE ? machine : legacy

export const useThumbnail = impl.useThumbnail
export const useThumbnailBackfill = impl.useThumbnailBackfill
export const useLiveThumbnail = impl.useLiveThumbnail
export const pauseBackfill = impl.pauseBackfill
export const resumeBackfill = impl.resumeBackfill

export type { ThumbProgress, ThumbJob, ThumbMode } from './thumbnail.types'
