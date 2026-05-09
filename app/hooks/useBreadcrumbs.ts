import type { Breadcrumb } from '@/services/breadcrumbs'
import { useMatches } from 'react-router'

/**
 * Reads breadcrumb data from the nearest route match that exposes a `crumbs` array.
 * Searches matches from deepest to shallowest so nested routes take precedence.
 * Returns `null` when no route in the current match stack has crumbs.
 *
 * @returns Array of `{ id, name }` breadcrumb entries, or `null` if none found.
 *
 * @example
 * // Render a breadcrumb trail in a layout
 * const crumbs = useBreadcrumbs()
 * return crumbs ? <Breadcrumbs crumbs={crumbs} /> : null
 *
 * @example
 * // Guard against missing crumbs
 * const crumbs = useBreadcrumbs()
 * if (!crumbs) return <span>Home</span>
 * return crumbs.map(c => <span key={c.id}>{c.name}</span>)
 *
 * @example
 * // Expose crumbs from a route loader so this hook can find them
 * // In the loader: return { crumbs: [{ id: folderId, name: folder.name }], ...items }
 */

function isBreadcrumb(value: unknown): value is Breadcrumb {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).name === 'string'
  )
}

export function useBreadcrumbs(): Breadcrumb[] | null {
  const matches = useMatches()

  for (let i = matches.length - 1; i >= 0; i--) {
    const data = matches[i].data as Record<string, unknown> | undefined
    if (!data || !Array.isArray(data.crumbs)) continue

    const crumbs = data.crumbs.filter(isBreadcrumb)
    if (crumbs.length > 0) return crumbs
  }

  return null
}
