// configure node process.env variables
declare namespace NodeJS {
  interface ProcessEnv {
    // App environment
    NODE_ENV: 'development' | 'production' | 'test'
    PORT?: string
    APP_NAME: string

    // Social Auth Providers
    GITHUB_CLIENT_ID: string
    GITHUB_CLIENT_SECRET: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    MICROSOFT_CLIENT_ID: string
    MICROSOFT_CLIENT_SECRET: string

    // Fly.io - Tigris storage service
    AWS_BUCKET_NAME?: string
    AWS_ACCESS_KEY: string
    AWS_SECRET_KEY: string
    AWS_ENDPOINT_URL: string
    AWS_REGION: string

    // Prisma Postgres server
    DATABASE_URL: string

    //  Other
    SESSION_SECRET: string // Used for session management

    // BetterAuth (single sign-on)
    BETTER_AUTH_SECRET: string
    BASE_URL: string

    // Email service
    EMAIL_SERVICE_URL: string
    EMAIL_SERVICE_TOKEN: string

    // Stripe
    STRIPE_PUBLISHABLE_KEY: string
    STRIPE_SECRET_KEY: string
    STRIPE_WEBHOOK_SECRET: string

    // Sentry
    SENTRY_DSN?: string
  }
}

declare module '*.svg' {
  import * as React from 'react'

  const ReactComponent: React.FunctionComponent<
    React.ComponentProps<'svg'> & { title?: string }
  >
  export default ReactComponent
}

declare global {
  namespace Stashly {
    /**
     * Route handles: global flags and metadata that can be exported from
     * a route module and consumed by the application at runtime to alter
     * layout, navigation and other behavior. These are commonly used with
     * React Router's "handle" export on route modules.
     *
     * Example usage in a route module:
     * export const handle: Stashly.RouteHandle = { dashboardHandle: true };
     *
     * Useful for determining whether to highlight a navigation item, add
     * extra UI, or include structured data/hydration hints.
     */
    interface Handle<LoaderData = unknown> {
      /**
       * A hint used by serialization/hydration to control whether the
       * route loader data should be included in the initial HTML for the
       * client. Either a boolean or a function that returns true/false.
       */
      hydrate?: boolean | HydrateFunction<LoaderData>
      /**
       * A function used to compute structured data (e.g., JSON-LD) for a
       * route, often used for SEO markup in the head.
       */
      structuredData?: StructuredDataFunction<LoaderData>

      // Navigation handle flags — routes can set these to surface
      // location-specific navigation items or highlight sections.
      /** Should this route be shown in the main site navigation? */
      mainNavigation?: boolean
      /** Should this route appear in the dashboard navigation? */
      dashboardNavigation?: boolean
      /**
       * Optional breadcrumb label or a function to compute a breadcrumb label
       * for this route. A function receives the route params and loader data
       * for that route and should return a string label. Use this to provide
       * readable breadcrumb segments (e.g., workspace or folder name).
       */
      breadcrumb?:
        | string
        | ((params: Record<string, string>, loaderData?: LoaderData) => string)
      /** Should this route appear in the collection navigation? */
      collectionNavigation?: boolean
      /** Should this route appear in the folder navigation? */
      folderNavigation?: boolean
      /** Should this route appear in the workspace navigation? */
      workspaceNavigation?: boolean
      /** Should this route appear in the settings navigation? */
      settingsNavigation?: boolean
    }

    // Add workspace/gallery flags to Handle via declaration merging
    // (declare them again without using `extends` — `interface Handle` is intentionally reopened)
    interface Handle<LoaderData = unknown> {
      /** Flag indicating this route renders a workspace UI (e.g. tree/folders) */
      workspaceHandle?: boolean
      /** Flag indicating this route renders a gallery UI */
      galleryHandle?: boolean
    }
    interface RouteHandle<LoaderData = unknown> extends Handle<LoaderData> {
      /** Gallery view within the application */
      galleryHandle?: boolean
      /** Workspace view */
      workspaceHandle?: boolean
      /** Dashboard root or dashboard-related route */
      dashboardHandle?: boolean
      /** Recent files view */
      recentHandle?: boolean
      /** Favorites view */
      favoritesHandle?: boolean
      /** Collections view */
      collectionsHandle?: boolean
      /** Folders view */
      foldersHandle?: boolean
      /** Shares page */
      sharesHandle?: boolean
      /** Trash / bin */
      trashHandle?: boolean
      /** Workspace members page */
      membersHandle?: boolean
      /** Settings section */
      settingsHandle?: boolean
      /** User profile page */
      profileHandle?: boolean
      /** Account page */
      accountHandle?: boolean
      /** Security settings */
      securityHandle?: boolean
      /** Billing settings */
      billingHandle?: boolean
      /** Notifications settings */
      notificationsHandle?: boolean
      /** Appearance or theme settings */
      appearanceHandle?: boolean
    }
    interface DashboardHandle<
      LoaderData = unknown,
    > extends RouteHandle<LoaderData> {
      /** The dashboard root or primary dashboard area */
      dashboardHandle?: boolean
      /** Recent files view */
      recentHandle?: boolean
      /** Favorites view */
      favoritesHandle?: boolean
      /** Collections view */
      collectionsHandle?: boolean
      /** Folder view */
      foldersHandle?: boolean
      /** Shares view for the dashboard */
      sharesHandle?: boolean
      /** Trash / Recycle Bin view */
      trashHandle?: boolean
      /** Settings within the dashboard context */
      settingsHandle?: boolean
      /** Gallery view within dashboard */
      galleryHandle?: boolean
      /** Search results page */
      searchHandle?: boolean
      /** Individual collection page */
      collectionHandle?: boolean
      /** Individual folder page */
      folderHandle?: boolean
      /** Individual file detail page */
      fileHandle?: boolean
    }
    interface RecentHandle<
      LoaderData = unknown,
    > extends RouteHandle<LoaderData> {
      recentHandle?: boolean
    }
    interface FavoritesHandle<
      LoaderData = unknown,
    > extends DashboardHandle<LoaderData> {
      favoritesHandle?: boolean
    }
    interface GalleryHandle<
      LoaderData = unknown,
    > extends DashboardHandle<LoaderData> {
      galleryHandle?: boolean
    }
    interface WorkspaceHandle<
      LoaderData = unknown,
    > extends RouteHandle<LoaderData> {
      /** Workspace view */
      workspaceHandle?: boolean
      /** Gallery view within the workspace */
      galleryHandle?: boolean
      /** Workspace-specific recent files */
      recentHandle?: boolean
      /** Workspace-specific favorites */
      favoritesHandle?: boolean
      /** Workspace collections */
      collectionsHandle?: boolean
      /** Workspace folders */
      foldersHandle?: boolean
      /** Shared items inside the workspace */
      sharesHandle?: boolean
      /** Workspace trash */
      trashHandle?: boolean
      /** Workspace members page */
      membersHandle?: boolean
      /** Workspace settings */
      settingsHandle?: boolean
    }
  }
}
export {}
