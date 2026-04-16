import type { Breadcrumb } from '@/services/breadcrumbs'
import { useMatches } from 'react-router'

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
