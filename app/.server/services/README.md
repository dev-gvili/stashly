# Server Services — Overview

This folder contains server-side service classes that act as an orchestration layer between route handlers and the repositories (Prisma repositories).

Key characteristics:

- Each service encapsulates business logic (permission checks, joins, quotas) and ensures the route loaders/actions have a focused set of responsibilities.
- Services make calls to repositories (e.g. `workspaceMemberRepository`, `itemRepository`) and may use Prisma transactions where multiple updates must be atomic.

Example service: `WorkspaceItemService.ts`

- Responsible for aligning item-level permissions with workspace role changes, syncing selected user permissions, and managing lifecycle operations for items inside a workspace.
- Uses transaction client to perform bulk updates. Functions like `syncItemPermissionsWithWorkspaceRole` and `removeAllItemPermissionsForUser` provide atomic operations.

Best practices:

- Keep ESIs (error handling and domain messages) within the service — return domain errors to be translated by route handlers into appropriate responses.
- Prefer small functions testing one domain action to keep services testable and to simplify mocking repositories in tests.

Files to explore:

- `app/.server/services/WorkspaceItemService.ts`
- `app/.server/services/ItemService.ts`
- `app/.server/services/workspaceMember.service.ts`

Potential improvements:

- Add more README docs or comments describing the input/output shape of each service method.
- Add a couple of small async tests bridging the service and repositories with an attached transaction to verify operations.
