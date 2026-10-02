/**
 * The thumbnail pipeline's public surface. See `README.md` in this folder.
 *
 * @example
 * import { useThumbnailWhenVisible, useLiveThumbnail } from '@/machines/thumbnail'
 */
export {
  useThumbnailWhenVisible,
  useLiveThumbnail,
  holdUploadedFile,
  pauseDownloads,
  resumeDownloads,
} from './hooks'

export type { ThumbProgress, ThumbJob, ThumbMode } from './thumbnail.types'
