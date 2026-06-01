/**
 * Shared types for the three thumbnail-signal implementations.
 *
 * Each signal (store / fetcher / xstate) exposes the same producer +
 * consumer API so the orchestrator hook and the card component are
 * decoupled from the underlying broadcast mechanism.
 */

export interface ThumbProgress {
  stage: 1 | 2 | 3
  src: string
  width?: number
  height?: number
}

export interface ThumbnailPublisher {
  /** Stage 1: local blob URL — never persisted server-side. */
  publishLocal(state: { src: string }): void
  /** Stages 2/3: PUT to S3 already done; PATCH /api/thumbnails/:id and broadcast. */
  publishPersisted(state: { stage: 2 | 3; src: string; width: number; height: number }): void
}
