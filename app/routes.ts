import {
	type RouteConfig,
	index,
	layout,
	prefix,
	route,
} from '@react-router/dev/routes'

export default [
	// Auth routes
	...prefix('auth', [
		layout('routes/auth/layout.tsx', [
			route('sign-in', 'routes/auth/sign-in.tsx'),
			route('sign-out', 'routes/auth/sign-out.tsx'),
		]),
	]),

	// API routes
	...prefix('api', [
		route('health', 'routes/api/health.ts', { id: 'api.health' }), // Health check API route
		route('invitations', 'routes/api/invitations.ts', {
			id: 'api.invitations',
		}), // Invitations API route
		route('notifications', 'routes/api/notifications.ts', {
			id: 'api.notifications',
		}), // Notifications API route
		route('upload', 'routes/api/upload.ts', { id: 'api.upload' }), // Upload API route
		route('favorites', 'routes/api/favorites.ts', { id: 'api.favorites' }), // Favorites API route
	   route('users', 'routes/api/users.ts', { id: 'api.users' }), // Users API route
	   route('subscription', 'routes/api/subscription.ts', { id: 'api.subscription' }), // Subscription API route
		route('shares', 'routes/api/shares.ts', { id: 'api.shares' }), // Shares API route
		route('versions', 'routes/api/versions.ts', { id: 'api.versions' }), // Version API route
		route('theme', 'routes/api/theme.ts', { id: 'api.theme' }), // Theme management API route
		route('items', 'routes/api/items.ts', { id: 'api.items' }), // Items API route
		route('workspaces', 'routes/api/workspaces.ts', {
			id: 'api.workspaces',
		}), // Workspaces API route
		route('s3/*', 'routes/api/s3.ts', { id: 'api.s3' }), // S3 API route
		route('members', 'routes/api/members.ts', { id: 'api.members' }), // Members API route
		route('collections/*', 'routes/api/collections.ts', {
				id: 'api.collections',
		}), // Collections API route
		route('settings', 'routes/api/settings.ts', { id: 'api.settings' }), // Settings API route
		route('view', 'routes/api/view.ts', { id: 'api.view' }), // Folder View API route
		route('search', 'routes/api/search.ts', { id: 'api.search' }), // Search API route
		route('images', 'routes/api/images.ts', { id: 'api.images' }), // Images API route
		route('auth/*', 'routes/api/auth.ts', { id: 'api.auth' }), // Authentication API route, wildcard to handle all auth-related requests
	]),
	layout('routes/layout.tsx', { id: 'layout' }, [
		// Main layout for the application, wraps all routes
		index('routes/index.tsx'), // Default route, can be used for landing page or overview

		// Dashboard routes
		...prefix('dashboard', [
			index('routes/dashboard/index.tsx'), // Default route for dashboard, can be used for overview
			route('items/*', 'routes/dashboard/item.tsx', {
				id: 'dashboard.items',
			}), // Route for viewing a specific item in the dashboard
			route('shared', 'routes/dashboard/shared.tsx', {
				id: 'dashboard.shared',
			}), // Route for shared items in the dashboard
			route('recent', 'routes/dashboard/recent.tsx', {
				id: 'dashboard.recent',
			}), // Route for recent items in the dashboard
			route('trash', 'routes/dashboard/trash.tsx', {
				id: 'dashboard.trash',
			}), // Route for trashed items in the dashboard
			route('collections', 'routes/dashboard/collections.tsx', {
				id: 'dashboard.collections',
			}), // Route for collections in the dashboard
			route(
				'collections/:collectionId',
				'routes/dashboard/collection.tsx',
				{ id: 'dashboard.collection' }
			), // Route for a specific collection in the dashboard
			route('search', 'routes/dashboard/search.tsx', {
				id: 'dashboard.search',
			}), // Route for search functionality in the dashboard
		]),

		// workspaces routes
		...prefix('workspaces', [
			index('routes/workspaces/index.tsx'), // Default route for workspaces, can be used for overview
			route('create', 'routes/workspaces/create.tsx', {
				id: 'workspaces.create',
			}), // Route for creating a new workspace
			route(':workspaceId', 'routes/workspaces/workspace.tsx', [
				route('settings', 'routes/workspaces/settings.tsx', {
					id: 'workspaces.settings',
				}), // Route for workspace settings
				route('members', 'routes/workspaces/members.tsx', {
					id: 'workspaces.members',
				}), // Route for workspace members
				route('items/:itemId', 'routes/workspaces/item.tsx', {
					id: 'workspaces.item',
				}),
			]),
		]),

		// Settings routes
		...prefix('settings', [
			route('profile', 'routes/settings/profile.tsx', {
				id: 'settings.profile',
			}), // Route for user profile settings
			route('account', 'routes/settings/account.tsx', {
				id: 'settings.account',
			}), // Route for account settings
			route('security', 'routes/settings/security.tsx', {
				id: 'settings.security',
			}), // Route for security settings
			route('billing', 'routes/settings/billing.tsx', {
				id: 'settings.billing',
			}), // Route for billing settings
			route('notifications', 'routes/settings/notifications.tsx', {
				id: 'settings.notifications',
			}), // Route for notification settings
			route('appearance', 'routes/settings/appearance.tsx', {
				id: 'settings.appearance',
			}), // Route for appearance settings
		]),
	]),
] satisfies RouteConfig
