# Stashly

## Project Overview

**Stashly** is a full-stack web application built with a modern tech stack. It serves as a template for building production-ready applications with server-side rendering, asset bundling, and data management.

### Key Technologies

| Technology     | Version  |
| -------------- | -------- |
| React          | 19.2.0   |
| React Router   | 7.9.6    |
| Vite           | 7.2.0    |
| Express        | 5.1.0    |
| Prisma         | 7.0.1    |
| Stripe         | 19.2.1   |
| better-auth    | 1.4.3    |
| XState         | 5.24.0   |
| shadcn-ui      | latest   |
| TypeScript     | 5.9.3    |
| AWS SDK v3     | ^3.940.0 |

## Project Folder Structure

This project adopts a well-defined folder structure to ensure clear separation of concerns, enhance maintainability, and improve developer experience. The primary directories are organized as follows:

```
stashly/
├── 📁 .github/             # GitHub-specific configurations (CI/CD, issue templates)
├── 📄 .dockerignore        # Files to ignore when building Docker images
├── 📄 .env                # Environment variables (local configuration)
├── 📄 .gitignore          # Files ignored by Git
├── 📄 .hintrc             # Hint configuration file
├── 📄 components.json     # Configuration for shadcn-ui components
├── 📄 Dockerfile           # Docker configuration for containerization
├── 📄 package.json        # Project metadata, scripts, and dependencies
├── 📄 pnpm-lock.yaml      # pnpm lockfile for deterministic dependencies
├── 📄 pnpm-workspace.yaml # pnpm workspace configuration
├── 📄 prisma.config.ts    # Prisma configuration file
├── 📄 react-router.config.ts # React Router configuration
├── 📝 README.md           # Top-level project README
├── 📄 Roadmap.md          # Project roadmap
├── 📄 server.js           # Entry point for the Node.js server
├── 📄 stashly.svg         # Project logo/icon
├── 📄 tsconfig.json       # TypeScript configuration for the entire project
├── 📄 tsconfig.node.json  # TypeScript configuration for Node.js environment
├── 📄 tsconfig.node.tsbuildinfo # TypeScript build info file
├── 📄 tsconfig.vite.json  # TypeScript configuration for Vite
├── 📄 tsconfig.vite.tsbuildinfo # TypeScript Vite build info file
├── 📄 vite.config.ts      # Vite build tool configuration
├── 🖿 app/                 # Main application folder (frontend & shared backend logic)
│   ├── 📄 root.tsx         # Root component for the React application
│   ├── 📄 routes.ts        # Centralized React Router route definitions
│   ├── 📄 stashly.d.ts     # Global TypeScript declaration file for Stashly types
│   ├── 🖿 .client/         # Client-side specific logic and utilities
│   │   └── 📄 auth.ts      # Client-side authentication utilities
│   ├── 🖿 .server/         # Server-side specific logic (API, auth, S3, Stripe)
│   │   ├── 📄 api.errors.ts  # Custom API error definitions
│   │   ├── 📄 api.utils.ts   # Server-side API utilities
│   │   ├── 📄 auth.ts        # Server-side authentication logic (better-auth setup)
│   │   ├── 📄 auth.types.ts  # Authentication-related TypeScript types
│   │   ├── 📄 db.ts          # Database connection and Prisma client instance
│   │   ├── 📄 email.ts       # Email sending utilities
│   │   ├── 📄 env.ts         # Environment variable loading and validation
│   │   ├── 📄 onboard.ts     # User onboarding logic
│   │   ├── 📄 quota.ts       # User quota management logic
│   │   ├── 📄 quota.utils.ts # Quota-related utilities
│   │   ├── 📄 s3.ts          # S3-compatible object storage service
│   │   ├── 📄 stripe.ts      # Stripe payment integration
│   │   ├── 📄 theme.ts       # Theme management logic
│   │   ├── 📄 upload.ts      # File upload handling logic
│   │   ├── 📄 workspace.ts   # Workspace-related server logic
│   │   ├── 🖿 repositories/  # Database interaction logic (Repository Pattern)
│   │   │   ├── 📄 ActivityRepository.ts
│   │   │   ├── 📄 CollectionRepository.ts
│   │   │   ├── 📄 ItemRepository.ts
│   │   │   ├── 📄 NotificationRepository.ts
│   │   │   ├── 📄 PermissionRepository.ts
│   │   │   ├── 📄 QuotaRepository.ts
│   │   │   ├── 📄 shareLink.repository.ts
│   │   │   ├── 📄 StoragePlanRepository.ts
│   │   │   ├── 📄 SubscriptionRepository.ts
│   │   │   ├── 📄 userRepository.ts
│   │   │   ├── 📄 workspaceMember.repository.ts
│   │   │   └── 📄 WorkspaceRepository.ts
│   │   ├── 🖿 search/        # Server-side search logic
│   │   │   ├── 📄 embeddings.ts      # Embeddings generation for semantic search
│   │   │   ├── 📄 filters.ts         # Search filter definitions
│   │   │   ├── 📄 item.filters.ts    # Item-specific search filters
│   │   │   ├── 📄 METHODS.md         # Documentation for search methods
│   │   │   ├── 📄 schema.zod.ts      # Zod schemas for search validation
│   │   │   ├── 📄 search.repository.ts # Search data access logic
│   │   │   ├── 📄 search.service.ts  # Search business logic
│   │   │   └── 📄 search.ts          # Main search utility
│   │   └── 🖿 services/      # Business logic orchestration (Service Layer)
│   │       ├── 📄 ItemService.ts
│   │       ├── 📝 README.md
│   │       ├── 📄 search.service.ts
│   │       ├── 📄 search.types.ts
│   │       ├── 📄 shareLink.service.ts
│   │       ├── 📄 workspaceItem.service.ts
│   │       ├── 📄 WorkspaceItemService.ts
│   │       └── 📄 workspaceMember.service.ts
│   ├── 🖿 assets/            # Static assets like images and icons (SVGs)
│   │   └── (various SVG files)
│   ├── 🖿 auth/              # Authentication-related components/logic
│   │   └── 📄 permissions.ts # Permission checking utilities
│   ├── 🖿 components/        # Reusable React components
│   │   ├── 🖿 auth/
│   │   ├── 🖿 circle-progress-bar/
│   │   ├── 🖿 dropbox ui/
│   │   ├── 🖿 filters/
│   │   ├── 🖿 layouts/
│   │   ├── 🖿 navigation/
│   │   ├── 🖿 pages/
│   │   ├── 🖿 stash/
│   │   ├── 🖿 ui/            # shadcn-ui components (e.g., button.tsx, dialog.tsx)
│   │   │   ├── 📄 accordion.tsx
│   │   │   ├── 📄 alert-dialog.tsx
│   │   │   └── (many other shadcn-ui components)
│   │   ├── 🖿 upload/
│   │   ├── 🖿 workspace/
│   │   ├── 📄 app-content.tsx
│   │   ├── 📄 app-header.tsx
│   │   ├── 📄 app-sidebar.tsx
│   │   ├── 📄 AppContentSection.tsx
│   │   ├── 📄 Breadcrumbs.tsx
│   │   ├── 📄 CollectionComponents.tsx
│   │   ├── 📄 color-mode.tsx
│   │   ├── 📄 CommentsThreadPanel.tsx
│   │   ├── 📄 DocumentViewer.tsx
│   │   ├── 📄 file-preview.tsx
│   │   ├── 📄 file-uploader.tsx
│   │   ├── 📄 FileIcon.tsx
│   │   ├── 📄 FileManagementDashboard.tsx
│   │   ├── 📄 Gallery.tsx
│   │   ├── 📄 Gemini3Dashboard.tsx
│   │   ├── 📄 Gemini3DashboardFiles.tsx
│   │   ├── 📄 Grid.tsx
│   │   ├── 📄 icons.tsx
│   │   ├── 📄 item-card-actions.tsx
│   │   ├── 📄 layout-toggle.tsx
│   │   ├── 📄 logo.tsx
│   │   ├── 📄 SharedUtils.tsx
│   │   ├── 📄 SubscriptionButton.tsx
│   │   └── 📄 user-menu.tsx
│   ├── 🖿 hooks/             # Custom React hooks
│   │   ├── 📄 use-mobile.ts
│   │   ├── 📄 use-slots.ts
│   │   ├── 📄 useInfiniteScroll.ts
│   │   ├── 📄 usePagination.tsx
│   │   └── 📄 usePagination.ts
│   ├── 🖿 machines/          # XState state machine definitions
│   │   ├── 🖿 actors/          # Actor definitions for XState machines
│   │   ├── 🖿 multipart/       # Multipart upload state machine logic
│   │   ├── 🖿 onboard/         # User onboarding state machine
│   │   ├── 🖿 pagination/      # Pagination state machines
│   │   ├── 🖿 queue/           # Upload queue state machine
│   │   ├── 🖿 quota/           # Quota management state machine
│   │   ├── 🖿 reviset/         # Revision set related state machines
│   │   ├── 🖿 sidebar/         # Sidebar state machine
│   │   ├── 🖿 subscription/    # Subscription state machine
│   │   ├── 🖿 upload/          # Main file upload state machine
│   │   ├── 📄 infiniteScroll.machine.ts # Infinite scroll state machine
│   │   ├── 📄 machine.types.ts # TypeScript types for state machines
│   │   ├── 📝 README.md
│   │   ├── 📄 schema.zod.ts    # Zod schemas for state machine validation
│   │   └── 📄 sessionStorage.machine.ts # Session storage state machine
│   ├── 🖿 prisma/            # Browser-side Prisma client setup and types
│   │   ├── 📄 browser.ts
│   │   ├── 📄 client.ts
│   │   ├── 📄 commonInputTypes.ts
│   │   ├── 📄 enums.ts
│   │   ├── 🖿 internal/
│   │   │   ├── 📄 class.ts
│   │   │   ├── 📄 prismaNamespace.ts
│   │   │   └── 📄 prismaNamespaceBrowser.ts
│   │   └── 📄 models.ts
│   ├── 🖿 routes/            # Route-specific components and data loaders/actions
│   │   ├── 🖿 api/           # API routes (data loaders/actions for backend)
│   │   │   ├── 📄 api.types.ts
│   │   │   ├── 📄 auth.ts
│   │   │   └── (many other API route files)
│   │   ├── 🖿 auth/          # Authentication related routes
│   │   │   ├── 📄 layout.tsx
│   │   │   ├── 📄 sign-in.tsx
│   │   │   └── 📄 sign-out.tsx
│   │   ├── 📄 index.tsx      # Index route
│   │   ├── 📄 layout.tsx     # Main application layout route
│   │   ├── 📄 not-found.tsx  # 404 Not Found route
│   │   ├── 🖿 settings/      # User settings routes
│   │   │   ├── 📄 account.tsx
│   │   │   └── (many other settings routes)
│   │   ├── 🖿 stash/         # Personal file storage routes
│   │   │   ├── 📄 collection.tsx
│   │   │   └── (many other stash routes)
│   │   └── 🖿 workspaces/    # Workspace management routes
│   │       ├── 📄 collection.tsx
│   │       └── (many other workspace routes)
│   ├── 🖿 styles/            # Global styles and CSS files
│   │   ├── 📄 global.css
│   │   ├── 📄 globals.css
│   │   └── 📄 theme.css
│   ├── 🖿 types/             # Global TypeScript types
│   │   └── 📄 react.d.ts
│   └── 🖿 utils/             # General-purpose utility functions
│       ├── 🖿 filters/       # Filtering utilities
│       │   ├── 📄 activity.filters.ts
│       │   └── (many other filter files)
│       ├── 📄 breadcrmb.ts   # Breadcrumb generation utilities
│       ├── 📄 collection-actions.ts # Collection-related actions
│       ├── 📄 converters.ts  # Data conversion utilities
│       ├── 📄 dev.ts         # Development-specific utilities
│       ├── 📄 filters.ts     # General filter utilities
│       ├── 📄 formaters.ts   # Data formatting utilities
│       ├── 📄 item-actions.ts # Item-related actions
│       ├── 📄 misc.ts        # Miscellaneous utilities
│       ├── 📄 pagination.ts  # Pagination logic
│       ├── 📄 parsers.ts     # Data parsing utilities
│       ├── 📄 query-params.ts # URL query parameter handling
│       ├── 📄 search.ts      # Search utilities
│       ├── 📄 searchItems.ts # Item search utilities
│       ├── 📄 styles.ts      # Style-related utilities
│       └── 📄 test.ts        # Testing utilities
├── 🖿 docs/                # Project documentation
│   ├── 📄 Combined-Roadmap.md
│   ├── 📄 Deep Dive Getting Started.md
│   └── (many other documentation files)
├── 🖿 hooks/               # Root-level custom hooks (e.g., use-mobile.ts)
│   └── 📄 use-mobile.ts
├── 🖿 memory-bank/         # AI agent's memory/context storage
│   ├── 📄 activeContext.md
│   └── (many other memory files)
├── 🖿 node_modules/        # Installed Node.js dependencies
├── 🖿 prisma/              # Prisma schema, migrations, and seed data
│   ├── 📄 ERD.md             # Entity-Relationship Diagram for the database
│   ├── 🖿 migrations/        # Database migration files
│   ├── 🖿 models/            # Individual Prisma model definitions
│   │   ├── 📄 account.prisma
│   │   └── (many other prisma model files)
│   └── 🖿 seedData/          # Data seeding scripts
├── 🖿 public/              # Static assets served directly by the web server
│   └── 📄 favicon.ico
├── 🖿 scripts/             # Utility scripts for development and automation
│   ├── 📄 apply-index-settings.ts
│   └── (many other scripts)
└── 🖿 tests/               # Unit, integration, and end-to-end tests
    ├── 🖿 e2e/
    ├── 🖿 integration/
    └── 🖿 unit/

### Architecture Overview & Data Flow

This project leverages the latest features of React Router 7, including its "framework mode" for building full-stack React applications.

-   **React Router 7 Architecture:** The application uses a data router (`createBrowserRouter`) which is central to the new architecture. Data fetching is handled by `loader` functions that execute before a route renders, and data mutations are handled by `action` functions. This ensures that data is available to the components when they render, which is essential for server-side rendering (SSR).

-   **Framework Mode:** React Router 7's "framework mode" enables features like SSR, code splitting, and file-based routing. This project utilizes these features to provide a fast and modern user experience.

**Data Flow**

1.  A user navigates to a new route.
2.  React Router calls the `loader` function for that route.
3.  The `loader` function fetches the necessary data from the backend (using the service and repository layers).
4.  The data is passed to the route's component as a prop.
5.  The component renders with the data.
6.  For data mutations (e.g., form submissions), the component calls an `action` function, which performs the mutation and can trigger a re-validation of the data.
7.  The UI is updated accordingly.

### Repository and Service Patterns

The application follows the repository and service patterns to separate data access logic from business logic. This separation of concerns makes the code more modular, testable, and easier to maintain.

-   **Repositories:** Located in `src/app/.server/repositories`, repositories are responsible for all communication with the database. They encapsulate the data access logic for a specific model, providing a clean API for performing CRUD (Create, Read, Update, Delete) operations. This abstraction allows the rest of the application to be agnostic of the database implementation.

-   **Services:** Located in `src/app/.server/services`, services orchestrate the business logic of the application. They use one or more repositories to perform their operations and are responsible for things like permission checks, data validation, and error handling. By centralizing the business logic in services, we can ensure that it is applied consistently throughout the application.

**Example: `ItemRepository`**

The `ItemRepository` in `app/.server/repositories/ItemRepository.ts` provides a set of methods for interacting with the `Item` model in the database. It uses Prisma to perform the database operations.

```ts
// app/.server/repositories/ItemRepository.ts

import { Prisma, type Item } from "@/prisma/client";
import { prisma } from "@/services/db";

export const itemRepository = {
  async findById(args: Prisma.ItemFindUniqueArgs) {
    return await prisma.item.findUniqueOrThrow({
      ...args,
    });
  },

  async create(args: Prisma.ItemCreateArgs) {
    return await prisma.item.create({
      ...args,
    });
  },

  async update(args: Prisma.ItemUpdateArgs) {
    return await prisma.item.update({
      ...args,
    });
  },

  async delete(id: string) {
    return await prisma.item.delete({
      where: { id },
    });
  },

  async findWorkspaceItems(workspaceId: string) {
    return await prisma.item.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  },
};
```

**Example: ItemService**

The `ItemService` in `app/.server/services/ItemService.ts` uses the `ItemRepository` and other repositories to perform business logic related to items. For example, the `getItemWithPermissions` method retrieves an item and checks if the user has permission to view it.

```ts
// app/.server/services/ItemService.ts

import { itemRepository } from "@/services/repositories/ItemRepository";
import { permissionRepository } from "@/services/repositories/PermissionRepository";
import { workspaceMemberRepository } from "@/services/repositories/workspaceMember.repository";
import { ApiError, ApiErrorCode } from "../api.errors";

export const itemService = {
  async getItemWithPermissions(userId: string, itemId: string) {
    const item = await itemRepository.findById({ where: { id: itemId } });
    if (!item) {
      throw new ApiError(ApiErrorCode.NOT_FOUND, "Item not found");
    }

    const canRead = await permissionRepository.hasItemPermission(
      userId,
      itemId,
      "read"
    );
    if (!canRead && item.workspaceId) {
      await workspaceMemberRepository.requireMembership(
        userId,
        item.workspaceId,
        {
          message: "You do not have access to this item",
        }
      );
    }

    const permissions = await permissionRepository.findByItemId(itemId);

    return { ...item, permissions };
  },

  async copyItem(userId: string, itemId: string, targetWorkspaceId?: string) {
    // ... business logic for copying an item
  },
};
```

### State Management with XState

The application uses [XState](https://xstate.js.org/) for managing complex state logic. The state machines are located in the `app/machines` directory. XState provides a powerful and robust way to model state, making it easier to reason about and test complex stateful logic.

#### Upload Machine (`upload.machine.ts`)

The `upload.machine.ts` file defines a state machine for managing file uploads. It handles concurrent uploads, queuing, and error handling. This is a great example of how XState can be used to manage complex, asynchronous workflows.

**State Machine Diagram**

```mermaid

stateDiagram-v2
    [*] --> idle
    idle --> idle: upload.add
    idle --> idle: upload.start
    idle --> idle: upload.done
    idle --> idle: upload.abort
    idle --> success: upload.close
    idle --> error: upload.error
```

**Key Features**

*   **Spawning Child Machines:** The `uploadMachine` spawns a `fileMachine` for each individual file upload. This allows for concurrent uploads, with each `fileMachine` managing the state of a single file.
*   **Queues:** The machine manages a queue of pending, active, and completed uploads. This ensures that only a certain number of uploads are active at any given time.
*   **Concurrency Control:** A guard is used to limit the number of concurrent uploads, preventing the application from being overloaded.
*   **Event-Driven:** The machine is driven by events like `upload.add`, `upload.start`, `upload.done`, and `upload.abort`. This makes the state transitions explicit and easy to follow.

**Example: `upload.machine.ts`**

```ts
// app/machines/upload/upload.machine.ts

import { setup, assign, sendTo } from 'xstate';
import { fileMachine } from './file.machine';

const uploadMachine = setup({
  types: {
    // ...
  },
  actors: {
    fileMachine,
  },
  actions: {
    // ...
  },
  guards: {
    // ...
  },
}).createMachine({
  id: 'upload',
  initial: 'idle',
  context: {
    // ...
  },
  states: {
    idle: {
      on: {
        'upload.add': {
          actions: 'addFile',
        },
        'upload.start': {
          guard: 'concurrentLessThenMax',
          actions: ['addToActiveQueue', 'sendStartUpload'],
        },
        'upload.done': {
          actions: [
            'markAsDone',
            'removeFromActiveQueue',
            'removeFromUploads',
            'uploadPendingFiles',
          ],
        },
        'upload.abort': {
          actions: [
            'removeFromActiveQueue',
            'markAsAborted',
            'removeFromUploads',
            'uploadPendingFiles',
          ],
        },
        'upload.close': {
          target: 'success',
        },
        'upload.error': {
          target: 'error',
        },
      },
    },
    success: {
      // ...
    },
    error: {
      // ...
    },
  },
});
```

### Component Library with shadcn-ui

The application uses [shadcn-ui](https://ui.shadcn.com/) to build its component library. The components are located in the `app/components/ui` directory. `shadcn-ui` provides a set of reusable and accessible components that can be easily customized.

The core idea behind `shadcn-ui` is that you own the code for your components. Instead of providing a pre-built component library as a dependency, `shadcn-ui` gives you a CLI tool that you can use to add the source code of the components you need directly to your project. This gives you full control over the code and allows you to customize the components to your needs.

#### Component Structure

The components are built using a combination of technologies:

*   **React:** The components are written in React.
*   **Tailwind CSS:** The components are styled using Tailwind CSS.
*   **class-variance-authority (cva):** `cva` is used to create variants of the components. This allows you to easily create different versions of a component with different styles.
*   **Radix UI:** Many of the components are built on top of the accessible and unstyled primitives provided by Radix UI.

**Example: `button.tsx`**

The `button.tsx` component in `app/components/ui/button.tsx` is a great example of how `class-variance-authority` (cva) is used to create a flexible and reusable button component.

```ts
// app/components/ui/button.tsx

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/utils/styles"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background shadow-xs hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md gap-1.5 px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

**Usage Example:**

```tsx
import { Button } from '@/components/ui/button';

function MyComponent() {
  return (
    <div>
      <Button>Default Button</Button>
      <Button variant="destructive">Destructive Button</Button>
      <Button size="lg">Large Button</Button>
    </div>
  );
}
```

### Utility Functions

The `app/utils` directory contains a rich set of utility functions for various purposes. These functions are organized into different files based on their functionality.

#### Data Conversion and Generation (`converters.ts`)

This file contains functions for converting data between different formats and for generating new data.

*   **`toBuffer`:** Converts an `AsyncIterable<Uint8Array>` to a `Buffer`.
*   **`toBase64`:** Converts a string to a base64 encoded string.
*   **`toUserInitial`:** Generates a 2-letter user initial from a name or email.
*   **`toCategory`:** Determines the `ItemCategory` based on a file's MIME type.
*   **`toIcon`:** Maps an `ItemCategory` or `ItemType` to a React icon component.
*   **`toChunkArray`:** Splits an array into smaller chunks.
*   **`toTypedObjects`:** Converts `FormData` entries into typed objects.
*   **`toObjectId`, `getPrefixForModel`:** Functions for generating unique, Stripe-like IDs with prefixes.

**Usage Example: `toObjectId`**

```ts
import { toObjectId, getPrefixForModel } from '@/utils/converters';

const newUserId = toObjectId(getPrefixForModel('User'));
// => "usr_..."
```

#### Data Formatting (`formaters.ts`)

This file contains functions for formatting data for display.

*   **`datetime`:** Formats a date using `Intl.DateTimeFormat`.
*   **`currency`:** Formats a number as a currency using `Intl.NumberFormat`.
*   **`formatSize`:** Formats a file size into a human-readable string (e.g., "1.2 GB").
*   **`currencyIL`:** A specific currency formatter for Israeli Shekels.
*   **`capitalize`:** Capitalizes the first letter of a string.
*   **`formatErrors`:** Formats Zod validation errors into a string.

**Usage Example: `formatSize`**

```ts
import { formatSize } from '@/utils/formaters';

const fileSize = 1234567890;
const formattedSize = formatSize('byte', 'unit', fileSize);
// => "1.23 GB"
```

#### Pagination (`pagination.ts`)

This file provides a generic and powerful utility for handling pagination for Prisma models. It supports three pagination strategies: `offset`, `cursor`, and `stream`.

**Usage Example: `paginate`**

```ts
import { paginate } from '@/utils/pagination';
import { prisma } from '@/services/db';

async function getPaginatedItems(page: number, take: number) {
  return await paginate(prisma.item, {
    strategy: 'offset',
    page,
    take,
    where: { ownerId: 'user123' },
  });
}
```

#### Work in Progress

Some of the files in the `app/utils` directory are considered "work in progress". This means that they are either not yet fully implemented or are expected to be refactored in the future. These files are a good place to look for opportunities to contribute to the project.

### Routing with `routes.ts`

The application's routes are defined in the `app/routes.ts` file. This file uses the `@react-router/dev/routes` package to define the routes in a structured and type-safe way.

#### Route Structure

The routes are defined as an array of `RouteConfig` objects. The file uses `prefix` and `layout` helpers to group related routes together.

*   **`prefix(path, routes)`:** This helper function prefixes all the routes in the `routes` array with the given `path`.
*   **`layout(path, children)`:** This helper function creates a layout route. The `children` routes will be rendered inside the layout.

**Example: `app/routes.ts`**

```ts
// app/routes.ts

import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  // Auth routes
  ...prefix("auth", [
    layout("routes/auth/layout.tsx", [
      route("sign-in", "routes/auth/sign-in.tsx"),
      route("sign-out", "routes/auth/sign-out.tsx"),
    ]),
  ]),

  // API routes
  ...prefix("api", [
    route("auth/*", "routes/api/auth.ts"),
    route("items/*", "routes/api/items.ts"),
    // ... other API routes
  ]),

  // App main layout
  layout("routes/layout.tsx", { id: "layout" }, [
    index("routes/index.tsx"),

    // Dashboard routes
    ...prefix(":me", [
      ...prefix("stash", [
        index("routes/stash/index.tsx"),
        route("collections", "routes/stash/collections.tsx"),
        // ... other stash routes
      ]),
      // ... other dashboard routes
    ]),

    route("*", "routes/not-found.tsx", { id: "not-found" }),
  ]),
] satisfies RouteConfig;
```

#### Loaders and Actions

React Router 7 introduces `loader` and `action` functions for handling data loading and mutations.

*   **`loader` functions:** A `loader` function is an async function that is called before a route is rendered. It can be used to fetch data from the backend and pass it to the component as a prop.

*   **`action` functions:** An `action` function is an async function that is called when a form is submitted. It can be used to perform data mutations on the backend.

**Example: A route with a loader**

```typescript
// app/routes/stash/index.tsx

import { json, type LoaderFunction } from 'react-router';
import { itemService } from '@/app/.server/services/ItemService';

export const loader: LoaderFunction = async ({ params }) => {
  const items = await itemService.searchUserItems(params.me, '');
  return json(items);
};

export default function Stash() {
  const items = useLoaderData();
  // ...
}
```

#### Navigation

React Router's `Link` and `useNavigate` hooks can be used for navigation.

**Example: Navigating to a user's stash**

```tsx
import { Link } from 'react-router';

function MyComponent() {
  const userId = 'user123';
  return (
    <Link to={`/${userId}/stash`}>Go to my stash</Link>
  );
}
```

## Data Models

The application uses Prisma to define its data models. The core models are:

- **User:** Represents a user of the application.
- **Workspace:** Represents a collaborative workspace for users.
- **Item:** Represents a file, folder, or collection within a workspace or a user's personal stash.
- **Collection:** Represents a collection of items.
- **Permission:** Represents permissions for users on items and workspaces.
- **Comment:** Represents a comment on an item.

## Integrations

### S3 File Storage

The application uses an S3-compatible object storage for file management. The `S3Service` class in `app/.server/s3.ts` provides a comprehensive interface for interacting with the storage service.

**Integration Example:**

To upload a file, the frontend first requests a presigned URL from the `/api/s3/presigned` endpoint. It then uses this URL to upload the file directly to the S3 bucket.

```ts
// Example of generating a presigned URL
const response = await fetch('/api/s3/presigned', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'my-file.txt' }),
})
const { url } = await response.json()

// Example of uploading a file using the presigned URL
await fetch(url, {
  method: 'PUT',
  body: myFile,
})
```

### Stripe Payments

The application uses Stripe for payment processing. The Stripe SDK is initialized in `app/.server/stripe.ts` with API version `2025-08-27.basil`. The application is configured to handle Stripe webhooks to manage subscriptions and payments.

**Integration Example:**

When a user completes a checkout session, Stripe sends a `checkout.session.completed` event to the `/api/stripe` webhook. The webhook handler then updates the user's subscription status in the database.

## Performance Metrics

Performance is a key consideration for this application. The following metrics should be monitored:

- **Server Response Time:** The time it takes for the server to respond to a request.
- **Page Load Time:** The time it takes for a page to load in the user's browser.
- **Database Query Performance:** The time it takes to execute database queries.

Performance testing should be conducted regularly to identify and address any bottlenecks.

## Setup and Installation

To get started with the project, follow these steps:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/stashly.git
    ```

2.  **Install dependencies:**

    The project uses `pnpm` for package management.

    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**

    Create a `.env` file in the root of the project and add the following environment variables:

    ```
    DATABASE_URL="postgresql://user:password@host:port/database"
    STRIPE_SECRET_KEY="your-stripe-secret-key"
    AWS_ACCESS_KEY="your-aws-access-key"
    AWS_SECRET_KEY="your-aws-secret-key"
    AWS_ENDPOINT_URL="your-s3-endpoint-url"
    BETTER_AUTH_SECRET="your-better-auth-secret"
    GITHUB_CLIENT_ID="your-github-client-id"
    GITHUB_CLIENT_SECRET="your-github-client-secret"
    GOOGLE_CLIENT_ID="your-google-client-id"
    GOOGLE_CLIENT_SECRET="your-google-client-secret"
    MICROSOFT_CLIENT_ID="your-microsoft-client-id"
    MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"
    ```

4.  **Run database migrations:**

    The project uses Prisma for database migrations.

    ```bash
    pnpm prisma migrate dev
    ```

5.  **Start the development server:**

    ```bash
    pnpm run dev
    ```

    The application will be available at http://localhost:3000.

## Contribution Guidelines

We welcome contributions to the project! To contribute, please follow these guidelines:

1.  **Fork the repository:**

    Fork the repository to your own GitHub account.

2.  **Create a new branch:**

    Create a new branch for your feature or bug fix.

    ```bash
    git checkout -b my-new-feature
    ```

3.  **Make your changes:**

    Make your changes to the codebase.

4.  **Format your code:**

    Before committing your changes, make sure to format your code using Prettier.

    ```bash
    pnpm run format
    ```

5.  **Commit your changes:**

    Commit your changes with a descriptive commit message.

    ```bash
    git commit -m "feat: add new feature"
    ```

6.  **Push your changes:**

    Push your changes to your fork.

    ```bash
    git push origin my-new-feature
    ```

7.  **Create a pull request:**

    Create a pull request from your fork to the main repository.

## Common Workflows

This section provides examples of how to perform common tasks in the application.

### Adding a New Route with Data Loading and Mutations

To add a new route with data loading and mutations, you need to do the following:

1.  **Create a new route file:**

    Create a new file in the `app/routes` directory. This file will contain the route's component, loader, and action.

    ```tsx
    // app/routes/my-new-route.tsx

    import { json, useLoaderData, Form, useActionData } from 'react-router';
    import { type LoaderFunction, type ActionFunction } from 'react-router';

    export const loader: LoaderFunction = async ({ request }) => {
      // Fetch data from the backend
      const data = { message: 'Hello, world!' };
      return json(data);
    };

    export const action: ActionFunction = async ({ request }) => {
      const formData = await request.formData();
      const name = formData.get('name');
      // Perform a mutation on the backend
      return json({ message: `Hello, ${name}!` });
    };

    export default function MyNewRoute() {
      const loaderData = useLoaderData();
      const actionData = useActionData();

      return (
        <div>
          <h1>{loaderData.message}</h1>
          <Form method="post">
            <input type="text" name="name" />
            <button type="submit">Submit</button>
          </Form>
          {actionData && <p>{actionData.message}</p>}
        </div>
      );
    }
    ```

2.  **Add the route to `app/routes.ts`:**

    Add the new route to the `app/routes.ts` file.

    ```ts
    // app/routes.ts

    // ...

    export default [
      // ...
      route("my-new-route", "routes/my-new-route.tsx"),
      // ...
    ] satisfies RouteConfig;
    ```

### Adding a New React Component

To add a new React component, you need to do the following:

1.  **Create a new component file:**

    Create a new file in the `app/components` directory. It's a good practice to create a new folder for each component.

    ```tsx
    // app/components/my-new-component/my-new-component.tsx
    
    import React from 'react';
    
    export function MyNewComponent() {
      return <div>My new component</div>;
    }
    ```

2.  **Use the component:**

    You can now use the new component in your application.

    ```tsx
    import { MyNewComponent } from '@/components/my-new-component/my-new-component';
    
    function MyPage() {
      return (
        <div>
          <h1>My Page</h1>
          <MyNewComponent />
        </div>
      );
    }
    ```

### Adding a New State Machine

To add a new state machine, you need to do the following:

1.  **Create a new machine file:**

    Create a new file in the `app/machines` directory.

    ```ts
    // app/machines/my-new-machine.ts
    
    import { setup } from 'xstate';
    
    export const myNewMachine = setup({
      // ...
    }).createMachine({
      id: 'my-new-machine',
      initial: 'idle',
      context: {
        // ...
      },
      states: {
        idle: {
          // ...
        },
      },
    });
    ```

2.  **Use the machine:**

    You can use the new machine in your components using the `@xstate/react` package.

    ```tsx
    import { useMachine } from '@xstate/react';
    import { myNewMachine } from '@/machines/my-new-machine';
    
    function MyComponent() {
      const [state, send] = useMachine(myNewMachine);
    
      // ...
    }
    ```

