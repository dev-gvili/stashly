import shareTechMonoFonts from '@fontsource/share-tech-mono/index.css?url'
import styles from '@/styles/globals.css?url'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useFetcher,
  useRouteError,
  useRouteLoaderData,
  type ShouldRevalidateFunction,
} from 'react-router'
import type { Route } from './+types/root'
import { getColorScheme } from './.server/theme'
import React, { useEffect } from 'react'

export const links: Route.LinksFunction = () => [
  { rel: 'stylesheet', href: styles },
  { rel: 'stylesheet', href: shareTechMonoFonts },
]

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Stashly' },
    {
      name: 'description',
      content: 'Your personal file management system!',
    },
  ]
}
export const shouldRevalidate: ShouldRevalidateFunction = () => false

// export const shouldRevalidate: ShouldRevalidateFunction = ({
//   currentUrl,
//   nextUrl,
//   formAction,
//   defaultShouldRevalidate,
// }) => {
//   let current = currentUrl.searchParams
//   let next = nextUrl.searchParams
//   let currentSelectedItems = getQueryParamArray(current, 'selectedItems')
//   let nextSelectedItems = getQueryParamArray(next, 'selectedItems')
//   if (currentSelectedItems.length !== nextSelectedItems.length) {
//     return false
//   }
//   // if (formAction !== '/api/theme') {
//   //   return false
//   // }

//   if (current.get('cursor') !== next.get('cursor')) {
//     return true
//   }
//   return false
// }

// Return the theme from the session storage using the loader
export async function loader({ request }: Route.LoaderArgs) {
  let colorScheme = await getColorScheme(request)
  return { colorScheme }
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
  }, [loaderData.colorScheme])

  return (
    // Suppress hydration warning because the script might modify this class
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={loaderData?.colorScheme ?? 'system'}
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
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

export default function App() {
  return <Outlet />
}
