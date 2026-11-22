import { useFetcher, useRouteLoaderData } from 'react-router'
import type { loader } from '../root'

export type ColorScheme = 'dark' | 'light' | 'system'

export const isColorScheme = (v: unknown): v is ColorScheme =>
  v === 'dark' || v === 'light' || v === 'system'

/**
 * The color scheme the `color-scheme` cookie holds, and a setter that writes
 * it through `/api/theme`. Every caller shares one fetcher (by key), so the
 * header toggle and Settings → Appearance show a pick at once, read from the
 * pending submission, and never disagree.
 */
export function useColorScheme(): [ColorScheme, (next: ColorScheme) => void] {
  const fetcher = useFetcher<{ colorScheme: ColorScheme | null }>({ key: 'color-scheme' })
  const root = useRouteLoaderData<typeof loader>('root')
  const pending = fetcher.formData?.get('color-scheme')
  const current: ColorScheme =
    (isColorScheme(pending) && pending) ||
    fetcher.data?.colorScheme ||
    root?.colorScheme ||
    'system'

  const set = (next: ColorScheme) => {
    if (next === current) return
    fetcher.submit({ 'color-scheme': next }, { method: 'post', action: '/api/theme' })
  }
  return [current, set]
}
