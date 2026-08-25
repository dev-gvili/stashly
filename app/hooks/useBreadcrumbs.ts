import type { Breadcrumb } from '@/services/breadcrumbs'
import { useMatches } from 'react-router'

/**
 * Type guard for a single breadcrumb entry coming out of untyped loader data.
 * Loader payloads reach `useMatches` as `unknown`, so each candidate is checked
 * for the `{ id: string; name: string }` shape before it is trusted.
 *
 * @param value - Candidate value pulled from a route match's `loaderData.crumbs`.
 *
 * @example
 * // Narrow an unknown array down to real breadcrumbs
 * const crumbs = (data.crumbs as unknown[]).filter(isBreadcrumb)
 *
 * @example
 * // Reject malformed entries
 * isBreadcrumb({ id: 'abc', name: 'Docs' }) // true
 * isBreadcrumb({ id: 1, name: 'Docs' })     // false
 */
function isBreadcrumb(value: unknown): value is Breadcrumb {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).name === 'string'
  )
}

/**
 * Reads breadcrumb data from the nearest route match that exposes a `crumbs` array.
 * Searches matches from deepest to shallowest so nested routes take precedence,
 * dropping the synthetic `root` crumb. Yields `null` when no route in the current
 * match stack has crumbs.
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
export function useBreadcrumbs(): Breadcrumb[] | null {
  const matches = useMatches()

  for (let i = matches.length - 1; i >= 0; i--) {
    const data = matches[i].loaderData as Record<string, unknown> | undefined
    if (!data || !Array.isArray(data.crumbs)) continue

    const crumbs = data.crumbs.filter(isBreadcrumb).filter((crumb) => crumb.name !== 'root')
    if (crumbs.length > 0) return crumbs
  }

  return null
}
