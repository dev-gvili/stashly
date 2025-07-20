import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	type ShouldRevalidateFunction,
} from 'react-router'
import { PreventFlashOnWrongTheme, Theme, ThemeProvider, useTheme } from 'remix-themes'
import { themeService } from '@/services/theme.server'
import styles from './styles/global.css?url'
import type { Route } from './+types/root'

export const links: Route.LinksFunction = () => [
	{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
	{
		rel: 'preconnect',
		href: 'https://fonts.gstatic.com',
		crossOrigin: 'anonymous',
	},
	{
		rel: 'stylesheet',
		href: 'https://fonts.googleapis.com/css2?family=Tomorrow:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap',
	},
	{ rel: 'stylesheet', href: styles },
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

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
}) => false

// Return the theme from the session storage using the loader
export async function loader({ request }: Route.LoaderArgs) {
	// const session = await auth.api.getSession(request)
	// if (session) {
	// 	throw redirect('/dashboard')
	// // }
	const { getTheme } = await themeService(request)
	return {
		theme: getTheme(),
	}
}
// Wrap your app with ThemeProvider.
// `specifiedTheme` is the stored theme in the session storage.
// `themeAction` is the action name that's used to change the theme in the session storage.
export default function AppWithProviders({ loaderData }: Route.ComponentProps) {
	const data = loaderData.theme
	return (
		<ThemeProvider
			specifiedTheme={data ?? Theme.LIGHT }
			themeAction="/api/theme"
			disableTransitionOnThemeChange={true}
		>
			<App />
		</ThemeProvider>
	)
}

// export function Layout({ children }: { children: React.ReactNode }) {
// 	return (
// 		<html lang="en">
// 			<head>
// 				<meta charSet="utf-8" />
// 				<meta
// 					name="viewport"
// 					content="width=device-width, initial-scale=1"
// 				/>
// 				<Meta />
// 				<Links />
// 			</head>
// 			<body>
// 				{children}
// 				<ScrollRestoration />
// 				<Scripts />
// 			</body>
// 		</html>
// 	)
// }

export function App() {
	const data = useLoaderData<Route.ComponentProps['loaderData']>()
	const [theme] = useTheme()
	return (
		<html lang="en" data-theme={theme ?? ''}>
			<head>
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1"
				/>
				<Meta />
				<PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} />
				<Links />
			</head>
			<body>
				<Outlet />
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = 'Oops!'
	let details = 'An unexpected error occurred.'
	let stack: string | undefined

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? '404' : 'Error'
		details =
			error.status === 404
				? 'The requested page could not be found.'
				: error.statusText || details
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message
		stack = error.stack
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	)
}
