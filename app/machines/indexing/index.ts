/**
 * Search indexing for uploaded files. See `README.md` in this folder.
 *
 * @example
 * import { enqueueIndexing, useIndexingRevalidation } from '@/machines/indexing'
 */
export { enqueueIndexing } from './client'
export { useIndexingRevalidation } from './hooks'
export type { IndexJob, IndexOutcome } from './indexing.types'
