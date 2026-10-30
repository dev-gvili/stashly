# Copilot Instructions for Stashly

This document provides guidance for AI coding agents to effectively contribute to the Stashly codebase.

## 1. Big Picture Architecture

Stashly is a full-stack application built with **React Router**, **Vite**, **Express**, and **Prisma**, focusing on efficient file management and uploads.

- **Frontend**: React application in `app/` using React Router for routing and SSR:
  - `app/root.tsx`: Main entry point and layout wrapper
  - `app/routes/`: Route components following React Router conventions
  - `app/components/`: Shared components, especially file upload related ones in `upload/`

- **Backend**: Express server in `server/`:
  - `server/app.ts`: Main Express setup and middleware configuration
  - `server/plugins/`: Core server functionalities and extensions
  - `server/adapters/`: Integration with external services (S3, etc.)

- **Database**: Prisma ORM with repository pattern:
  - `prisma/schema.prisma`: Database schema definition
  - `app/.server/repositories/`: Data access logic (auto-generated)
  - `app/.server/filters/`: Query filter builders (auto-generated)

- **State Management**: Complex state flows using **XState**:
  - `app/machines/`: State machine definitions
  - Key machines:
    - `upload.machine.ts`: Parent machine managing overall upload process
    - `file.machine.ts`: Individual file upload state management
    - `queue.machine.ts`: Upload queue orchestration
    - `quota/quota.actors.ts`: the `checkQuota` pre-upload check, invoked by the file machine (quota is charged and enforced on the server, in `createUploadedItem`; `quota.machine.ts` is not spawned)

- **Services Layer**: Business logic is encapsulated in services located in `app/.server/services/`. These services orchestrate data access via repositories and enforce business rules and permissions.
  - `WorkspaceItemService.ts`: Manages items within a workspace, handling permissions and lifecycle.

## 2. Developer Workflows

### Getting Started

1.  Install dependencies: `pnpm install`
2.  Start the development server: `pnpm dev`

Access the app at `http://localhost:5173`.

### Code Generation

Use the repository generator for new data access layers:

```bash
pnpm tsx ./scripts/generateRepository.v2.ts <ModelName>
```

This creates:

- Repository in `app/.server/repositories/<ModelName>.repository.ts`
- Filters in `app/.server/filters/<ModelName>.filters.ts`

## 3. Project-Specific Conventions

### State Management with XState

The project uses a sophisticated state machine architecture for file uploads:

1. **Parent-Child Pattern**

   ```typescript
   // upload.machine.ts
   const uploadMachine = setup({
     actors: {
       fileMachine, // Child machine for individual files
       queueMachine, // Manages upload slots
     },
   }).createMachine({
     context: {
       fileActors: new Map(), // Tracks spawned file actors
       queues: {
         active: new Set(),
         pending: new Map(),
       },
     },
   })
   ```

2. **Actor Communication**
   - Parent machine spawns child actors for each file
   - Queue machine controls concurrent upload slots
   - Events flow up from children to parent for status updates

### Routing and Data Loading

React Router is used for file-based routing. Key patterns include:

- **Layouts**: Nested routes inherit layouts, like in `app/routes/layout.tsx`, which provides the main sidebar and content structure.
- **Authentication**: Route `loader` functions are used to protect routes by checking for an active session. Unauthorized users are redirected to the sign-in page.

```typescript
// app/routes/layout.tsx
export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) {
    throw redirect('/auth/sign-in')
  }
  return { user: session.user }
}
```

- **API Routes**: The `app/routes/api/` directory contains resource routes that function as API endpoints.

### Repository Pattern

Standard CRUD operations plus advanced filtering:

```typescript
// Example repository usage
const users = await userRepository.search({
  filters: {
    role: 'admin',
    createdAfter: lastWeek,
  },
  pagination: {
    page: 1,
    perPage: 20,
  },
})
```

### Services Layer

Services act as a bridge between route handlers and repositories. They contain the core business logic.

```typescript
// app/.server/services/WorkspaceItemService.ts
export class WorkspaceItemService {
  async createItem(
    userId: string,
    workspaceId: string,
    data: Prisma.ItemCreateInput
  ): Promise<Item> {
    // 1. Enforce permissions
    await workspaceMemberRepository.requireAtLeastRole(
      userId,
      workspaceId,
      'member'
    )

    // 2. Call repository to create the item
    const item = await itemRepository.create({
      // ... data mapping
    })

    // 3. Grant creator initial permissions
    await permissionRepository.create({
      // ... permission data
    })

    return item
  }
}
```

### File Upload Architecture

1. **Multi-part Upload Flow**:
   - Create upload session
   - Upload chunks in parallel
   - Complete upload with ETag verification

2. **Quota Management**:
   - Check quota before upload
   - Track usage during upload
   - Update quota on completion

## 4. Integration Points

- **Authentication**: Uses `better-auth` with configuration in `app/auth/`
- **Storage**: S3-compatible object storage via AWS SDK
- **UI Components**: TailwindCSS + Shadcn UI in `app/components/ui/`

## 5. Common Patterns

1. **Error Handling in Machines**

   ```typescript
   // Example error state configuration
   error: {
     entry: 'logError',
     on: {
       RETRY: {
         target: 'uploading',
         actions: 'resetProgress'
       }
     }
   }
   ```

2. **Progress Tracking**

   ```typescript
   // Progress updates flow through events
   on: {
     'PROGRESS': {
       actions: assign({
         progress: (_, event) => event.progress
       })
     }
   }
   ```

3. **Component Structure**
   - Wrap XState machines in container components
   - Use custom hooks for machine interactions
   - Keep UI components pure and presentation-focused
