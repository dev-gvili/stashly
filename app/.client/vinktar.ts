import { getClient, getUserId, identify, init, reset } from '@vinktarhq/browser'

/** The signed-in user seen before `startVinktar` ran, identified once it does. */
let pendingUserId: string | undefined

/**
 * Starts Vinktar in the browser, once. The root loader hands over the key and
 * release from the server's environment, so they are runtime config rather
 * than values baked into the bundle at build time.
 *
 * Without a key (local dev with none set) it stays off.
 *
 * @param config - `key`: the project's public write key; `release`: the git SHA of the deploy.
 *
 * @example
 * useEffect(() => startVinktar(loaderData.vinktar), [])
 */
export function startVinktar(config: { key?: string; release?: string }) {
  if (getClient() || !config.key) return
  init({
    writeKey: config.key,
    release: config.release,
    // Our own requests carry the visit's device and session ids, which the
    // server's `vinktarRequest()` adopts.
    propagateIdentity: [window.location.origin],
  })
  if (pendingUserId) identifyUser(pendingUserId)
}

/**
 * Links this visit to the signed-in user. Safe to call on every render of the
 * app layout: it only identifies when the user changes. Called before
 * `startVinktar` (child effects run before the root's), it waits for it.
 *
 * @param userId - The user's database id.
 *
 * @example
 * useEffect(() => identifyUser(user.id), [user.id])
 */
export function identifyUser(userId: string) {
  if (!getClient()) {
    pendingUserId = userId
    return
  }
  if (getUserId() !== userId) identify(userId)
}

/**
 * Forgets the user on sign-out and starts a new device id, so the next person
 * on this browser is not attributed to the previous one.
 *
 * @example
 * resetVinktarUser()
 */
export function resetVinktarUser() {
  pendingUserId = undefined
  reset()
}
