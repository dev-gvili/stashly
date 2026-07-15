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
    // Infrastructure
    route('health', 'routes/api/health.ts'),
    route('search/:type', 'routes/api/search.ts'),
    route('auth/*', 'routes/api/auth.ts'),

    // Payments & billing
    route('stripe', 'routes/api/stripe.ts'),
    route('subscription', 'routes/api/subscription.ts'),

    // User preferences
    route('theme', 'routes/api/theme.ts'),
    route('settings', 'routes/api/settings.ts'),
    route('sidebar', 'routes/api/sidebar.ts'),
    route('images', 'routes/api/images.ts'),
    route('view', 'routes/api/view.ts'),

    // Notifications & quota
    route('notifications', 'routes/api/notifications.ts'),
    route('quota', 'routes/api/quota.ts'),

    // Access control
    route('members/*', 'routes/api/members.ts'),
    route('permissions/*', 'routes/api/permissions.ts'),

    // Top-level resources
    route('shares', 'routes/api/shares.ts'),
    route('favorites', 'routes/api/favorites.ts'),
    route('pins', 'routes/api/pins.ts'),
    route('locks', 'routes/api/locks.ts'),
    route('versions', 'routes/api/versions.ts'),
    route('thumbnails', 'routes/api/thumbnails.ts'),
    ...prefix('thumbnails', [
      route(':itemId/presign', 'routes/api/thumbnails-presign.ts', {
        id: 'thumbnail-presign',
      }),
      route(':itemId', 'routes/api/thumbnails.ts', { id: 'thumbnail-detail' }),
    ]),
    route('invitations', 'routes/api/invitations.ts'),
    route('comments/*', 'routes/api/comments.ts'),
    route('activities', 'routes/api/activities.ts'),

    // Workspaces
    route('workspaces', 'routes/api/workspaces.ts'),
    ...prefix('workspaces', [
      route(':workspaceId', 'routes/api/workspaces.ts', {
        id: 'workspace-detail',
      }),
      route(':workspaceId/members', 'routes/api/members.ts', {
        id: 'workspace-members',
      }),
      route(':workspaceId/permissions', 'routes/api/permissions.ts', {
        id: 'workspace-permissions',
      }),
    ]),

    // Users
    route('users', 'routes/api/users.ts'),
    ...prefix('users', [
      route(':userId', 'routes/api/users.ts', { id: 'user-detail' }),
      route(':userId/items', 'routes/api/items.ts', { id: 'user-items' }),
      route(':userId/workspaces', 'routes/api/workspaces.ts', {
        id: 'user-workspaces',
      }),
    ]),

    // Collections resource routes
    route('collections', 'routes/api/collections.ts'),
    ...prefix('collections', [
      route(':collectionId', 'routes/api/collections.ts', {
        id: 'collection-detail',
      }),
      route(':collectionId/items', 'routes/api/items.ts', {
        id: 'collection-items',
      }),
    ]),

    // Items + sub-resources
    route('items', 'routes/api/items.ts'),
    ...prefix('items', [
      route(':itemId', 'routes/api/items.ts', { id: 'item-detail' }),
      route(':itemId/permissions', 'routes/api/permissions.ts', {
        id: 'api-permissions',
      }),
      route(':itemId/versions/:versionId?', 'routes/api/versions.ts', {
        id: 'api-versions',
      }),
      route(':itemId/comments/:commentId?', 'routes/api/comments.ts', {
        id: 'api-comments',
      }),
      route(':itemId/shares/:shareId?', 'routes/api/shares.ts', {
        id: 'api-shares',
      }),
      route(':itemId/favorites', 'routes/api/favorites.ts', {
        id: 'api-favorites',
      }),
      route(':itemId/invitations', 'routes/api/invitations.ts', {
        id: 'api-invitations',
      }),
      route(':itemId/download', 'routes/api/items.ts', { id: 'api-download' }),
    ]),

    // AI endpoints for embedding, captioning, translation, transcription, suggestions, summarization, and chat interactions. These routes are grouped under the 'ai' prefix to logically organize all AI-related API endpoints together. Each route corresponds to a specific AI functionality, allowing for clear and maintainable API design as the application integrates various AI capabilities.
    ...prefix('ai', [
      route('embed', 'routes/api/ai.ts', { id: 'ai-embed' }),
      route('caption', 'routes/api/ai.ts', { id: 'ai-caption' }),
      route('translate', 'routes/api/ai.ts', { id: 'ai-translate' }),
      route('transcribe', 'routes/api/ai.ts', { id: 'ai-transcribe' }),
      route('suggestion', 'routes/api/ai.ts', { id: 'ai-suggestion' }),
      route('summarize', 'routes/api/ai.ts', { id: 'ai-summarize' }),
      route('chat', 'routes/api/ai.ts', { id: 'ai-chat' }),
    ]),

    // S3 object storage endpoints (for direct uploads, multipart uploads, and potentially other S3 interactions like listing, deleting, downloading files, etc.)
    ...prefix('s3', [
      route('upload', 'routes/api/upload.ts', { id: 's3-upload' }),
      route('multipart', 'routes/api/upload.ts', { id: 's3-multipart' }),
      // route('delete', 'routes/api/s3.ts', { id: 's3-delete' }),
      // route('list', 'routes/api/s3.ts', { id: 's3-list' }),
      // route('download', 'routes/api/s3.ts', { id: 's3-download' }),
    ]),
  ]),

  // App main layout, shared between stash ( user ui ), workspaces ( collaboration ui ), and settings,
  layout('routes/layout.tsx', { id: 'layout' }, [
    // Index route, for redirect after signin
    index('routes/index.tsx'),

    // ~~~~~~~~~~~~ User UI Routes ~~~~~~~~~~~ //

    // :me is a dynamic segment that will be replaced with the current user's ID, allowing for easy linking to the user's own stash and settings without needing to know their ID in advance. This also scopes all user-specific routes under a common prefix.
    ...prefix(':me', [
      // stash prefix is used to scope all routes related to the user's personal stash, such as their files, collections, favorites, etc. This keeps the URL structure organized and makes it clear that these routes pertain to the user's own content. The ':me' segment allows for easy redirection to the user's stash without needing to know their specific user ID, while still maintaining a clean and intuitive URL structure for all stash-related pages.
      ...prefix('stash', [
        // home route for stash, could be a dashboard or overview page showing recent activity, stats, or quick links to different sections of the stash. This serves as the landing page when users navigate to their stash and provides a central hub for accessing all their personal content and features.
        index('routes/stash/home.tsx', { id: 'stash-home' }),

        //all route shows all items in the user's stash, providing a comprehensive view of their content. This could include files, collections, folders, suggestions, allowing users to easily browse and manage everything they have stored in their stash from one central location.
        route('all', 'routes/stash/all.tsx', { id: 'stash-all' }),

        // collections route shows all collections in the user's stash. This page could provide an overview of each collection, including the number of items in each collection, recent activity, and quick links to view or manage the collections. It serves as a central place for users to organize and access their grouped content within their stash.
        route('collections', 'routes/stash/collections.tsx', {
          id: 'stash-collections',
        }),

        // collection detail route shows the contents of a specific collection in the user's stash. The ':collectionId' dynamic segment allows users to view and manage individual collections by clicking on them from the collections overview page. This page could display all items within the selected collection, along with options to add or remove items, edit collection details, and view collection-specific activity or stats.
        route('collections/:collectionId', 'routes/stash/collection.tsx', {
          id: 'stash-collection',
        }),

        // favorites route shows all items that the user has marked as favorites in their stash.
        route('favorites', 'routes/stash/favorites.tsx', {
          id: 'stash-favorites',
        }),

        route('pinned', 'routes/stash/pinned.tsx', { id: 'stash-pinned' }),

        //folder route shows the contents of a specific folder in the user's stash. The ':folderId' dynamic segment allows users to navigate into individual folders to view and manage the items contained within them. This page could provide options for organizing files, such as moving items between folders, renaming the folder, or viewing folder-specific details and activity.
        route('folders/:folderId', 'routes/stash/folder.tsx', {
          id: 'stash-folder',
        }),

        // file route shows the details of a specific file within a folder in the user's stash. The dynamic segments ':folderId' and ':fileId' allow users to navigate directly to a specific file by its ID within a particular folder. This page could display the file's metadata, preview, version history, comments, and options for managing the file such as downloading, sharing, or moving it to another location within the stash.
        route('folders/:folderId/files/:fileId', 'routes/stash/file.tsx', {
          id: 'stash-file',
        }),

        // shares route shows all items that the user has shared with others from their stash. This page could provide an overview of each shared item, including who it is shared with, the permissions granted, and recent activity related to the shared content. It serves as a central place for users to manage their shared items and see how their content is being accessed by others.
        route('shares', 'routes/stash/shares.tsx', { id: 'stash-shares' }),

        // images route shows all images in the user's stash, providing a visual gallery of their stored photos and graphics. This page includes different views ( waterfall, river, grid). It serves as a dedicated space for users to easily access and enjoy their visual content within their stash.
        route('images', 'routes/stash/gallery.tsx', { id: 'stash-images' }),

        // videos route shows all videos in the user's stash, providing a dedicated space for users to access and manage their video content. This page could include features such as video previews. playback, and allowing users to easily find and enjoy their stored videos within their stash.
        route('videos', 'routes/stash/gallery.tsx', { id: 'stash-videos' }),
        // route('videos', 'routes/stash/videos.tsx', { id: 'stash-videos' }),

        // recent route shows the most recently added or modified items in the user's stash, providing a quick way for users to access their latest content. This page could display a chronological list of recent activity, including new files, updated collections, and recent shares, allowing users to easily stay up-to-date with their stash's activity and quickly find their most current items.
        route('recent', 'routes/stash/recent.tsx', { id: 'stash-recent' }),

        // search route provides a search interface for users to find specific items within their stash. This page could include advanced search filters, such as file type, date range, and collection, allowing users to quickly locate the content they need from their stash using keywords, specific criteria or semantic search.
        route('search', 'routes/stash/search.tsx', { id: 'stash-search' }),

        // invitations route shows all pending invitations that the user has received to collaborate on items in their stash. This page could provide details about each invitation, such as who sent it, what item it pertains to, and the permissions being offered. It serves as a central place for users to manage their collaboration invitations and easily accept or decline them.
        route('invitations', 'routes/stash/invitations.tsx', {
          id: 'stash-invitations',
        }),

        // trash route shows all items that the user has deleted from their stash but have not yet been permanently removed. This page could provide options for users to restore deleted items back to their stash or permanently delete them. It serves as a safety net for users to recover accidentally deleted content and manage their deleted items before they are permanently removed.
        route('storage', 'routes/stash/storage.tsx', { id: 'stash-storage' }),
        route('trash', 'routes/stash/trash.tsx', { id: 'stash-trash' }),
        route('demo', 'routes/stash/demo.tsx', { id: 'stash-demo' }),
        route('ai-studio', 'routes/stash/ai-studio.tsx', {
          id: 'stash-ai-studio',
        }),
        route('examples', 'routes/stash/examples.tsx', {
          id: 'stash-examples',
        }),
      ]),

      // Workspaces UI Routes
      ...prefix('workspaces', [
        index('routes/workspaces/index.tsx'),
        route(':workspaceId', 'routes/workspaces/workspace.tsx', {
          id: 'stash-workspace',
        }),
        route(':workspaceId/settings', 'routes/workspaces/settings.tsx', {
          id: 'stash-workspace-settings',
        }),
        route(':workspaceId/members', 'routes/workspaces/members.tsx', {
          id: 'stash-workspace-members',
        }),
        route(
          ':workspaceId/folders/:folderId',
          'routes/workspaces/folder.tsx',
          { id: 'stash-workspace-folder' }
        ),
        route(
          ':workspaceId/folders/:folderId/files/:fileId',
          'routes/workspaces/file.tsx',
          { id: 'stash-workspace-file' }
        ),
        route(':workspaceId/shares', 'routes/workspaces/shares.tsx', {
          id: 'stash-workspace-shares',
        }),
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

  // Design option demos (standalone layouts, no auth required)
  ...prefix('options', [
    route('a', 'routes/options/option-a.tsx'),
    route('b', 'routes/options/option-b.tsx'),
    route('c', 'routes/options/option-c.tsx'),
  ]),
] satisfies RouteConfig
