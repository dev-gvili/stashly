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
		route('items/*', 'routes/api/items.ts', { id: 'api.items' }),
		// Workspaces API route
		route('workspaces/*', 'routes/api/workspaces.ts', {
			id: 'api.workspaces',
		}),

		// Members API route

		route('members/*', 'routes/api/members.ts', { id: 'api.members' }),
		// Teams API route
		route('teams/*', 'routes/api/teams.ts', { id: 'api.teams' }),
		// Roles API route
		route('roles/*', 'routes/api/roles.ts', { id: 'api.roles' }),
		// Permissions API route
		route('permissions/*', 'routes/api/permissions.ts', {
			id: 'api.permissions',
		}),
		// Audit Logs API route
		route('audit-logs/*', 'routes/api/audit-logs.ts', {
			id: 'api.audit-logs',
		}),
		// Webhooks API route
		route('webhooks/*', 'routes/api/webhooks.ts', { id: 'api.webhooks' }),
		// Integrations API route
		route('integrations/*', 'routes/api/integrations.ts', {
			id: 'api.integrations',
		}),
		// Templates API route
		route('templates/*', 'routes/api/templates.ts', {
			id: 'api.templates',
		}),
		// Assets API route
		route('assets/*', 'routes/api/assets.ts', { id: 'api.assets' }),
		// Tags API route
		route('tags/*', 'routes/api/tags.ts', { id: 'api.tags' }),
		// Categories API route
		route('categories/*', 'routes/api/categories.ts', {
			id: 'api.categories',
		}),
		// Comments API route
		route('comments/*', 'routes/api/comments.ts', { id: 'api.comments' }),

		// Collections API route
		route('collections/*', 'routes/api/collections.ts', {
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
		]),
	]),

	layout('routes/layout.tsx', { id: 'layout' }, [
		// Main layout for the application, wraps all routes
		index('routes/index.tsx'), // Default route, can be used for landing page or overview

		// Dashboard routes
		...prefix('dashboard', [
			index('routes/dashboard/index.tsx'), // Default route for dashboard, can be used for overview
			route('integrations', 'routes/dashboard/integrations.tsx', {
				id: 'dashboard.integrations',
			}), // Route for managing integrations in the dashboard
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
			route('collections/new', 'routes/dashboard/new-collection.tsx'), // Route for creating a new collection in the dashboard
			route(
				'collections/:collectionId',
				'routes/dashboard/collection.tsx',
				{
					id: 'dashboard.collection',
				}
			), // Route for a specific collection in the dashboard
			route(
				'collections/:collectionId/items/*',
				'routes/dashboard/collection-items.tsx',
				{
					id: 'dashboard.collection.items',
				}
			), // Route for items in a specific collection

			route('collections/:collectionId/settings', 'routes/dashboard/collection-settings.tsx', {
				id: 'dashboard.collection.settings',
			}), // Route for collection settings	

			route('collections/:collectionId/items/:itemId', 'routes/dashboard/collection-item.tsx', {
				id: 'dashboard.collection.item',
			}), // Route for a specific item within a collection

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
				route('collections', 'routes/workspaces/collections.tsx', {
					id: 'workspaces.collections',
				}), // Route for collections within a workspace	
				route('collections/:collectionId', 'routes/workspaces/collection.tsx', {
					id: 'workspaces.collection',
				}), // Route for a specific collection within a workspace	
				route('collections/:collectionId/items/:itemId', 'routes/workspaces/collection-item.tsx', {
					id: 'workspaces.collection.item',
				}), // Route for a specific item within a collection in a workspace	

				route('collections/:collectionId/settings', 'routes/workspaces/collection-settings.tsx', {
					id: 'workspaces.collection.settings',
				}), // Route for collection settings within a workspace		
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
