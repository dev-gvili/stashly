/**
 * Controls pause/resume for an in-flight multipart upload.
 * Workers check `waitIfPaused()` before starting each chunk, and send each
 * chunk with `signal`, which a pause aborts: the parts in flight are cancelled
 * and sent again after resume, so a paused upload stops moving bytes at once.
 * Before, only the next chunk waited, and up to `concurrency` parts (50 MB)
 * kept uploading after the click, so the bar went on from 45% to 98%.
 */
export class PauseController {
  private _paused = false
  private _waiters: Array<() => void> = []
  private _run = new AbortController()

  pause() {
    if (this._paused) return
    this._paused = true
    this._run.abort(new DOMException('Upload paused', 'AbortError'))
  }

  resume() {
    if (this._paused) this._run = new AbortController()
    this._paused = false
    for (const resolve of this._waiters) resolve()
    this._waiters = []
  }

  /** Aborts when the upload is paused; a new one is handed out after resume. */
  get signal(): AbortSignal {
    return this._run.signal
  }

  waitIfPaused(): Promise<void> {
    if (!this._paused) return Promise.resolve()
    return new Promise<void>((resolve) => this._waiters.push(resolve))
  }
}
