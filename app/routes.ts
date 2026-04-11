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
    route('auth/*', 'routes/api/auth.ts'),
    route('items/*', 'routes/api/items.ts'),
    route('workspaces/*', 'routes/api/workspaces.ts'),
    route('members/*', 'routes/api/members.ts'),
    route('collections/*', 'routes/api/collections.ts'),
    route('permissions/*', 'routes/api/permissions.ts'),
    route('comments/*', 'routes/api/comments.ts'),
    route('health', 'routes/api/health.ts'),
    route('invitations', 'routes/api/invitations.ts'),
    route('notifications', 'routes/api/notifications.ts'),
    route('stripe', 'routes/api/stripe.ts'),
    route('favorites', 'routes/api/favorites.ts'),
    route('users', 'routes/api/users.ts'),
    route('subscription', 'routes/api/subscription.ts'),
    route('shares', 'routes/api/shares.ts'),
    route('quota', 'routes/api/quota.ts'),
    route('versions', 'routes/api/versions.ts'),
    route('theme', 'routes/api/theme.ts'),
    route('images', 'routes/api/images.ts'),
    route('settings', 'routes/api/settings.ts'),
    route('view', 'routes/api/view.ts'),
    route('sidebar', 'routes/api/sidebar.ts'),
    route('search/:type', 'routes/api/search.ts'),

    ...prefix('ai', [
      route('embed', 'routes/api/ai.ts', { id: 'ai-embed' }),
      route('caption', 'routes/api/ai.ts', { id: 'ai-caption' }),
      route('translate', 'routes/api/ai.ts', { id: 'ai-translate' }),
      route('transcribe', 'routes/api/ai.ts', { id: 'ai-transcribe' }),
      route('suggestion', 'routes/api/ai.ts', { id: 'ai-suggestion' }),
      route('summarize', 'routes/api/ai.ts', { id: 'ai-summarize' }),
      route('chat', 'routes/api/ai.ts', { id: 'ai-chat' }),
    ]),
    // S3 (object storage) API routes
    ...prefix('s3', [
      route('upload', 'routes/api/upload.ts', { id: 's3-upload' }),
    ]),
  ]),

  // App main layout, shared between dashboard, workspaces
  layout('routes/layout.tsx', { id: 'layout' }, [
    // Index route, for redirect after signin
    index('routes/index.tsx'),

    // Dashboard routes
    ...prefix(':me', [
      ...prefix('stash', [
        index('routes/stash/home.tsx'),
        route('all', 'routes/stash/all.tsx'),
        route('collections', 'routes/stash/collections.tsx'),
        route('collections/:collectionId', 'routes/stash/collection.tsx'),
        route('favorites', 'routes/stash/favorites.tsx'),
        route('folders/:folderId', 'routes/stash/folder.tsx'),
        route('folders/:folderId/files/:fileId', 'routes/stash/file.tsx'),
        route('gallery', 'routes/stash/gallery.tsx'),
        route('recent', 'routes/stash/recent.tsx'),
        route('search', 'routes/stash/search.tsx'),
        route('shares', 'routes/stash/shares.tsx'),
        route('invitations', 'routes/stash/invitations.tsx'),
        route('trash', 'routes/stash/trash.tsx'),
        route('demo', 'routes/stash/demo.tsx'),
      ]),
      // workspaces routes
      ...prefix('workspaces', [
        index('routes/workspaces/index.tsx'),
        route('create', 'routes/workspaces/create.tsx'),
        route(':workspaceId', 'routes/workspaces/workspace.tsx'),
        route(':workspaceId/settings', 'routes/workspaces/settings.tsx'),
        route(':workspaceId/members', 'routes/workspaces/members.tsx'),
        route(':workspaceId/folders/:folderId', 'routes/workspaces/folder.tsx'),
        route(
          ':workspaceId/folders/:folderId/files/:fileId',
          'routes/workspaces/file.tsx'
        ),
        route(':workspaceId/shares', 'routes/workspaces/shares.tsx'),
        route(':workspaceId/favorites', 'routes/workspaces/favorites.tsx'),
        route(':workspaceId/collections', 'routes/workspaces/collections.tsx'),
        route(
          ':workspaceId/collections/:collectionId',
          'routes/workspaces/collection.tsx'
        ),
        route(':workspaceId/trash', 'routes/workspaces/trash.tsx'),
        route(':workspaceId/recent', 'routes/workspaces/recent.tsx'),
        route(':workspaceId/gallery', 'routes/stash/gallery.tsx', {
          id: 'workspace-gallery',
        }),
      ]),

      // Settings routes
      ...prefix('settings', [
        route('profile', 'routes/settings/profile.tsx'),
        route('account', 'routes/settings/account.tsx'),
        route('security', 'routes/settings/security.tsx'),
        route('billing', 'routes/settings/billing.tsx'),
        route('notifications', 'routes/settings/notifications.tsx'),
        route('appearance', 'routes/settings/appearance.tsx'),
      ]),
    ]),

    route('*', 'routes/not-found.tsx', { id: 'not-found' }), // Catch-all route for 404
  ]),

  route('test', 'routes/stash/recent.tsx', {
    id: 'test-route',
  }), // Public share route
] satisfies RouteConfig
