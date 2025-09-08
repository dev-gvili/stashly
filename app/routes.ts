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
		// Health check API route
		route('health', 'routes/api/health.ts', { id: 'api.health' }),
		// Invitations API route
		route('invitations', 'routes/api/invitations.ts', {
			id: 'api.invitations',
		}),
		// Notifications API route
		route('notifications', 'routes/api/notifications.ts', {
			id: 'api.notifications',
		}),
		// Stripe API route
		route('stripe', 'routes/api/stripe.ts', { id: 'api.stripe' }),
		// Favorites API route
		route('favorites', 'routes/api/favorites.ts', { id: 'api.favorites' }),
		// Users API route
		route('users', 'routes/api/users.ts', { id: 'api.users' }),
		// Subscription API route
		route('subscription', 'routes/api/subscription.ts', {
			id: 'api.subscription',
		}),
		// Shares API route
		route('shares', 'routes/api/shares.ts', { id: 'api.shares' }),
		// Quota API route
		route('quota', 'routes/api/quota.ts', { id: 'api.quota' }),
		// Version API route
		route('versions', 'routes/api/versions.ts', { id: 'api.versions' }),
		// Theme management API route
		route('theme', 'routes/api/theme.ts', { id: 'api.theme' }),
		// Items API route
		route('items', 'routes/api/items.ts', { id: 'api.items' }),
		// Workspaces API route
		route('workspaces', 'routes/api/workspaces.ts', {
			id: 'api.workspaces',
		}),
		// Members API route
		route('members', 'routes/api/members.ts', { id: 'api.members' }),
		// Collections API route
		route('collections', 'routes/api/collections.ts', {
			id: 'api.collections',
		}),
		// Settings API route
		route('settings', 'routes/api/settings.ts', { id: 'api.settings' }),
		// Folder View API route
		route('view', 'routes/api/view.ts', { id: 'api.view' }),
		// Search API route
		route('search', 'routes/api/search.ts', { id: 'api.search' }),
		// Images API route
		route('images', 'routes/api/images.ts', { id: 'api.images' }),
		// Authentication API route; wildcard handles login, logout, registration, password reset, and other auth-related requests
		route('auth/*', 'routes/api/auth.ts', { id: 'api.auth' }),
		// S3 & Upload API routes
		...prefix('s3', [
			route('sts-token', 'routes/api/s3/sts-token.ts', {
				id: 'api.s3.sts-token',
			}),
			route('presigned-url', 'routes/api/s3/presigned-url.ts', {
				id: 'api.s3.presigned-url',
			}),
			route('upload', 'routes/api/upload.ts', {
				id: 'api.s3.upload',
			}),
			// ...prefix('multipart', [
			// 	route('create', 'routes/api/s3/multipart/create.ts', {
			// 		id: 'api.s3.multipart.create',
			// 	}),
			// 	route('complete', 'routes/api/s3/multipart/complete.ts', {
			// 		id: 'api.s3.multipart.complete',
			// 	}),
			// 	route('abort', 'routes/api/s3/multipart/abort.ts', {
			// 		id: 'api.s3.multipart.abort',
			// 	}),
			// 	route('part-url', 'routes/api/s3/multipart/part-url.ts', {
			// 		id: 'api.s3.multipart.part-url',
			// 	}),
			// ]),
		]),
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
