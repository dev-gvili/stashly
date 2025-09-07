import { Outlet, redirect, type ShouldRevalidateFunction } from 'react-router'
import { auth } from '@/.server/auth'
import type { Route } from './+types/layout'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'
import { AppContent } from '@/components/AppContent'
import { Fragment } from 'react/jsx-runtime'
import { useId } from 'react'

// export const shouldRevalidate: ShouldRevalidateFunction = ({
// 	currentUrl,
// 	defaultShouldRevalidate,
// 	nextUrl,
// }) => {
// 	// Prevent revalidation if the URL hasn't changed
// 	if (currentUrl.pathname === nextUrl.pathname) {
// 		return false
// 	}
// 	return defaultShouldRevalidate
// }

export async function loader({ request }: Route.LoaderArgs) {
	const session = await auth.api.getSession(request)
	if (!session) {
		throw redirect('/auth/sign-in')
	}
	return { user: session.user }
}

export default function Layout() {
	const id = useId()
	return (
		<Fragment key={id}>
			<SidebarProvider defaultOpen={false}>
				<AppSidebar />
				<AppContent>
					<Outlet />
				</AppContent>
			</SidebarProvider>
		</Fragment>
	)
}
