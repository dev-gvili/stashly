/**
 * Uploaded files waiting for their card to be seen.
 *
 * A thumbnail is only made once its card is on screen. For a fresh upload the
 * original `File` is still in memory, which saves downloading it again, so the
 * upload runner hands it here at `itemCreated` and the thumbnail queue takes it
 * when the card becomes visible.
 *
 * Holding a `File` costs no new memory: the upload manager already keeps the
 * same objects in its `mediaFiles` map until the panel is cleared. A file is
 * released when its thumbnail job finishes, successful or not; one that is
 * never viewed stays until the tab reloads, after which a visible card falls
 * back to downloading the original.
 *
 * Cards subscribe (see `useThumbnailWhenVisible`), so a card already on screen
 * re-checks itself the moment its file arrives.
 */

const held = new Map<string, File>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

/**
 * Keeps an uploaded file until its card is seen.
 *
 * @param itemId - The item the file was uploaded as.
 * @param file - The uploaded file, still in memory.
 *
 * @example
 * if (mediaFile.status === 'itemCreated') holdFile(mediaFile.id, mediaFile.file)
 */
export function holdFile(itemId: string, file: File): void {
  if (held.get(itemId) === file) return
  held.set(itemId, file)
  notify()
}

/**
 * The held file for an item, or null when there is none.
 *
 * @example
 * const file = getHeldFile(itemId) // null → the original has to be downloaded
 */
export function getHeldFile(itemId: string): File | null {
  return held.get(itemId) ?? null
}

/** Whether an uploaded file is waiting for this item. */
export function hasHeldFile(itemId: string): boolean {
  return held.has(itemId)
}

/**
 * Lets go of an item's file once its thumbnail job has finished.
 *
 * @example
 * releaseFile(itemId) // after the job settles, success or failure
 */
export function releaseFile(itemId: string): void {
  if (held.delete(itemId)) notify()
}

/**
 * Calls `listener` whenever a file is held or released. Returns the
 * unsubscribe function, in the shape `useSyncExternalStore` expects.
 *
 * @example
 * const isHeld = useSyncExternalStore(subscribeToHeldFiles, () => hasHeldFile(id), () => false)
 */
export function subscribeToHeldFiles(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test seam: forgets every held file. */
export function resetHeldFiles(): void {
  held.clear()
  notify()
}
