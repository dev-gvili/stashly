import styles from '@/styles/globals.css?url'
import shareTechMonoFonts from '@fontsource/share-tech-mono/index.css?url'
import React from 'react'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useFetcher,
  useLocation,
  useMatches,
  useNavigation,
  useRouteLoaderData,
  type ShouldRevalidateFunction,
} from 'react-router'
import type { Route } from './+types/root'
import { getColorScheme } from './.server/theme'
import { startVinktar, trackRouteView } from '@/.client/vinktar'
import { requestIdMiddleware } from '@/services/log'
import { requestTimingMiddleware } from '@/services/middleware/request-timing'
import { routePattern } from '@/utils/misc'

export const links: Route.LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: shareTechMonoFonts },
]

export function meta({ 
  loaderData,
  params
}: Route.MetaArgs) {
  return [
    { title: 'Stashly' },
    
    {
      name: 'description',
      content: 'Your personal file management system!',
    },
  ]
}
export const shouldRevalidate: ShouldRevalidateFunction = () => false

// A request id on every log line and error, then slow and failed requests,
// every route's loaders and actions included.
export const middleware: Route.MiddlewareFunction[] = [
  requestIdMiddleware,
  requestTimingMiddleware,
]

// Return the theme from the session storage using the loader
export async function loader({ request }: Route.LoaderArgs) {
  let colorScheme = await getColorScheme(request)
  // The browser SDK's config, read at runtime so a Fly secret is enough. The
  // key is the project's public write key: it can only append events.
  const vinktar = {
    key: process.env.VINKTAR_KEY,
    release: process.env.VINKTAR_RELEASE,
  }
  return { colorScheme, vinktar }
}

export function Layout({ children }: { children: React.ReactNode }) {
  let fetcher = useFetcher({ key: 'color-scheme' })
  let loaderData = fetcher.data ?? useRouteLoaderData<typeof loader>('root')
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 't' && event.altKey) {
        // event.stopPropagation()
        if (loaderData?.colorScheme === 'dark') {
          fetcher.submit(
            { 'color-scheme': 'light' },
            { method: 'post', action: '/api/theme' }
          )
        } else if (loaderData?.colorScheme === 'light') {
          fetcher.submit(
            { 'color-scheme': 'system' },
            { method: 'post', action: '/api/theme' }
          )
        } else {
          fetcher.submit(
            { 'color-scheme': 'dark' },
            { method: 'post', action: '/api/theme' }
          )
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loaderData])

  return (
    // Suppress hydration warning because the script might modify this class
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={loaderData?.colorScheme ?? 'system'}
    >
      <head>
        <Meta />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Links />
      </head>
      <body className="bg-background overflow-hidden antialiased font-stashly transition-all duration-400">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { vinktar } = loaderData
  React.useEffect(() => startVinktar(vinktar), [vinktar])
  useRouteViews()
  return <Outlet />
}

/**
 * Sends one page view per pathname change, named by the leaf route. Keyed on
 * the pathname alone: filters, sorting and the selection all live in the
 * query string, and each would otherwise count as a view.
 *
 * Declared after `startVinktar`'s effect, so the first view finds it started.
 */
function useRouteViews() {
  const matches = useMatches()
  const { pathname } = useLocation()
  const navigation = useNavigation()
  const navigationStartedAt = React.useRef<number | null>(null)
  const initial = React.useRef(true)
  // StrictMode (React Router's default client entry) runs effects twice in dev.
  const lastPathname = React.useRef<string | null>(null)
  const lastRoute = React.useRef<{ routeId: string; pattern: string }>(
    undefined
  )

  React.useEffect(() => {
    if (navigation.state !== 'idle' && navigationStartedAt.current === null) {
      navigationStartedAt.current = performance.now()
    }
  }, [navigation.state])

  React.useEffect(() => {
    const leaf = matches.at(-1)
    if (!leaf || lastPathname.current === pathname) return
    lastPathname.current = pathname
    const startedAt = navigationStartedAt.current
    const route = {
      routeId: leaf.id,
      pattern: routePattern(leaf.pathname, leaf.params),
    }
    trackRouteView({
      ...route,
      from: lastRoute.current,
      // The first view: since the document started loading.
      durationMs: initial.current
        ? performance.now()
        : startedAt === null
          ? 0
          : performance.now() - startedAt,
      initial: initial.current,
    })
    initial.current = false
    lastRoute.current = route
    navigationStartedAt.current = null
    // Only a new pathname is a new view; `matches` changes with it.
  }, [pathname])
}
