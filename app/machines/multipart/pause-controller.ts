/**
 * Controls pause/resume for an in-flight multipart upload.
 * Workers check `waitIfPaused()` before starting each new chunk, so already
 * in-flight chunk transfers complete naturally — only the next chunk waits.
 */
export class PauseController {
  private _paused = false
  private _waiters: Array<() => void> = []

  pause() {
    this._paused = true
  }

  resume() {
    this._paused = false
    for (const resolve of this._waiters) resolve()
    this._waiters = []
  }

  waitIfPaused(): Promise<void> {
    if (!this._paused) return Promise.resolve()
    return new Promise<void>((resolve) => this._waiters.push(resolve))
  }
}
