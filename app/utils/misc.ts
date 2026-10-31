
/**
 * this function take any number of functions with any number of arguments and run them one by one
 * @param fns any number of functions
 * @returns void
 */
export const callAll =
  (...fns: any[]) =>
  (...args: any[]) => {
    return fns.forEach((fn) => typeof fn === 'function' && fn(...args))
  }

/**
 * The route pattern a matched pathname came from, rebuilt from its params:
 * each segment that is a param's value becomes `:name`, and a splat's tail
 * becomes `*`. Analytics groups page views by this rather than the URL, which
 * carries user and item ids.
 *
 * @param pathname - The match's pathname (`useMatches()` → `pathname`).
 * @param params - The match's params.
 *
 * @example
 * routePattern('/usr_1/stash/folders/fld_2', { me: 'usr_1', folderId: 'fld_2' })
 * // → '/:me/stash/folders/:folderId'
 */
export function routePattern(
  pathname: string,
  params: Record<string, string | undefined>
): string {
  let path = pathname
  let suffix = ''
  const splat = params['*']
  if (splat && path.endsWith(`/${splat}`)) {
    path = path.slice(0, -splat.length - 1)
    suffix = '/*'
  }
  const named = Object.entries(params).filter(
    (entry): entry is [string, string] => entry[0] !== '*' && !!entry[1]
  )
  const segments = path.split('/').map((segment) => {
    const value = safeDecode(segment)
    const param = named.find(([, v]) => v === value)
    return param ? `:${param[0]}` : segment
  })
  return segments.join('/') + suffix
}

/** `decodeURIComponent` that answers a malformed segment as it is. */
function safeDecode(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
