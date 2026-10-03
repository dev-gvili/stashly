/** `/:me/stash/trash/folders/:folderId`, the view inside a trashed folder. */
const TRASH_FOLDER_PATH = /^\/([^/]+)\/stash\/trash\/folders\/[^/]+\/?$/

/**
 * Where a restore sends the page it was made from.
 *
 * From inside a trashed folder, every restore takes that folder out of Trash
 * as well: whatever is restored there sits inside it, and a restored item
 * always gets its trashed folders back with it, so it has a live place to
 * land. Reloading the folder view would then find the folder gone from Trash
 * (a 404), so the page goes back to the Trash entries instead. Anywhere else
 * it reloads where it is, as before.
 *
 * @param url - The page the restore was made from (the request's referer),
 *   with the query already cleaned of the restored `selectedItems`.
 * @returns The path and query to redirect to.
 *
 * @example
 * toTrashRedirectUrl(new URL('http://x/usr_1/stash/trash/folders/item_f?layout=grid'))
 * // → '/usr_1/stash/trash?layout=grid'
 * toTrashRedirectUrl(new URL('http://x/usr_1/stash/trash?layout=grid'))
 * // → '/usr_1/stash/trash?layout=grid'
 */
export function toTrashRedirectUrl(url: URL): string {
  const query = url.searchParams.toString()
  const suffix = query ? `?${query}` : ''
  const inFolder = url.pathname.match(TRASH_FOLDER_PATH)
  if (inFolder) return `/${inFolder[1]}/stash/trash${suffix}`
  return `${url.pathname}${suffix}`
}
