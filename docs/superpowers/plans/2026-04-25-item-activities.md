# Item Activities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display a per-item Google Drive–style activity feed (avatar + prose + timestamp + item chip) in the gallery detail sidebar and via an item card drawer, backed by fire-and-forget activity recording in all mutating server functions.

**Architecture:** Recording appended fire-and-forget to existing server action functions. A new `/api/activities` GET resource route serves paginated results. A shared `<ActivityFeed>` + `<ActivityEntry>` component pair renders both integration points. Gallery sidebar gets activities via its SSR loader; item card drawer uses `fetcher.load` on open.

**Tech Stack:** Prisma, React Router 7, `useFetcher`, shadcn/ui Sheet, TailwindCSS 4, framer-motion, Vitest.

---

## File Map

| Status | File | Role |
|--------|------|------|
| Modify | `prisma/models/action.prisma` | Add `PermissionAction` model + link in `ItemAction` |
| Create | `app/utils/activity.ts` | `formatActivity()` pure function |
| Create | `app/utils/__tests__/activity.test.ts` | Unit tests for `formatActivity` |
| Create | `app/routes/api/activities.ts` | GET `/api/activities?itemId=` resource route |
| Modify | `app/routes.ts` | Register `activities` route |
| Modify | `app/.server/item-actions.ts` | Wire `createActivity` into 9 functions |
| Modify | `app/.server/permission-actions.ts` | Wire `createActivity` into 3 functions |
| Modify | `app/.server/comment-actions.ts` | Wire `createActivity` into `createComment` |
| Modify | `app/.server/version-actions.ts` | Wire `createActivity` into `createVersion` |
| Create | `app/components/core-components/activity-entry.tsx` | Single feed row component |
| Create | `app/components/core-components/activity-feed.tsx` | Feed list + empty + skeleton |
| Modify | `app/routes/stash/gallery-image.tsx` | Add activities to loader + sidebar section |
| Create | `app/components/core-components/item-activity-drawer.tsx` | Fetcher-loaded drawer |

---

## Task 1: Schema — Add PermissionAction

**Files:**
- Modify: `prisma/models/action.prisma`

- [ ] **Step 1: Add PermissionAction model and link to ItemAction**

Open `prisma/models/action.prisma`. After the `AccessAction` model (line ~32), add:

```prisma
model PermissionAction {
  id        String      @id
  type      String      // "grant" | "revoke" | "update"
  userId    String
  role      String
  action    ItemAction?
}
```

In `ItemAction`, add after the existing `copy` / `copyActionId` fields:

```prisma
permission          PermissionAction? @relation(fields: [permissionActionId], references: [id])
permissionActionId  String?           @unique
```

- [ ] **Step 2: Run migration**

```bash
pnpm prisma migrate dev --name add_permission_action
```

Expected: migration file created, Prisma client regenerated, no errors.

- [ ] **Step 3: Verify types compile**

```bash
pnpm typecheck
```

Expected: no errors related to `PermissionAction`.

- [ ] **Step 4: Commit**

```bash
git add prisma/models/action.prisma prisma/migrations
git commit -m "feat(schema): add PermissionAction model"
```

---

## Task 2: Utility — `formatActivity`

**Files:**
- Create: `app/utils/activity.ts`
- Create: `app/utils/__tests__/activity.test.ts`

Context: `ActivityWithRelations` is the type returned by `findManyActivities` / `searchActivities` from `app/.server/activity-actions.ts`. Its shape:
```ts
{
  id: string
  item: Item | null
  time: ActivityTime | null
  action: {
    create: CreateAction | null
    rename: RenameAction | null   // { oldName, newName }
    move: MoveAction | null       // { from, to }
    delete: DeleteAction | null   // { name, itemType }
    restore: RestoreAction | null
    copy: CopyAction | null       // { from, to }
    share: ShareAction | null     // { recipients: string[] }
    version: VersionAction | null // { newVersion }
    comment: CommentAction | null // { isReply }
    permission: PermissionAction | null // { type, userId, role }
    access: AccessAction | null
  } | null
  access: AccessAction | null
}
```

- [ ] **Step 1: Write failing tests**

Create `app/utils/__tests__/activity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatActivity } from '../activity'
import type { ActivityWithRelations } from '@/types/activity.types'

function makeActivity(overrides: Partial<ActivityWithRelations>): ActivityWithRelations {
  return {
    id: 'act_1',
    item: null,
    time: null,
    access: null,
    action: null,
    ...overrides,
  } as ActivityWithRelations
}

describe('formatActivity', () => {
  it('formats create', () => {
    const a = makeActivity({ action: { create: { id: 'c1' }, rename: null, move: null, delete: null, restore: null, copy: null, share: null, version: null, comment: null, permission: null, access: null, activity: null, id: 'ia1', commentActionId: null, createActionId: 'c1', deleteActionId: null, editActionId: null, moveActionId: null, renameActionId: null, restoreActionId: null, shareActionId: null, versionActionId: null, activityId: 'act_1', copyActionId: null, permissionActionId: null, edit: null } })
    expect(formatActivity(a)).toBe('You created an item')
  })

  it('formats rename', () => {
    const a = makeActivity({ action: { rename: { id: 'r1', oldName: 'old.jpg', newName: 'new.jpg', action: null }, create: null, move: null, delete: null, restore: null, copy: null, share: null, version: null, comment: null, permission: null, access: null, activity: null, id: 'ia1', commentActionId: null, createActionId: null, deleteActionId: null, editActionId: null, moveActionId: null, renameActionId: 'r1', restoreActionId: null, shareActionId: null, versionActionId: null, activityId: 'act_1', copyActionId: null, permissionActionId: null, edit: null } })
    expect(formatActivity(a)).toBe('You renamed old.jpg → new.jpg')
  })

  it('formats move', () => {
    const a = makeActivity({ action: { move: { id: 'm1', from: 'folder-a', to: 'folder-b', action: null }, create: null, rename: null, delete: null, restore: null, copy: null, share: null, version: null, comment: null, permission: null, access: null, activity: null, id: 'ia1', commentActionId: null, createActionId: null, deleteActionId: null, editActionId: null, moveActionId: 'm1', renameActionId: null, restoreActionId: null, shareActionId: null, versionActionId: null, activityId: 'act_1', copyActionId: null, permissionActionId: null, edit: null } })
    expect(formatActivity(a)).toBe('You moved this item to folder-b')
  })

  it('formats delete', () => {
    const a = makeActivity({ action: { delete: { id: 'd1', name: 'report.pdf', itemType: 'file', action: null }, create: null, rename: null, move: null, restore: null, copy: null, share: null, version: null, comment: null, permission: null, access: null, activity: null, id: 'ia1', commentActionId: null, createActionId: null, deleteActionId: 'd1', editActionId: null, moveActionId: null, renameActionId: null, restoreActionId: null, shareActionId: null, versionActionId: null, activityId: 'act_1', copyActionId: null, permissionActionId: null, edit: null } })
    expect(formatActivity(a)).toBe('You deleted report.pdf')
  })

  it('formats permission grant', () => {
    const a = makeActivity({ action: { permission: { id: 'p1', type: 'grant', userId: 'usr_1', role: 'editor', action: null }, create: null, rename: null, move: null, delete: null, restore: null, copy: null, share: null, version: null, comment: null, access: null, activity: null, id: 'ia1', commentActionId: null, createActionId: null, deleteActionId: null, editActionId: null, moveActionId: null, renameActionId: null, restoreActionId: null, shareActionId: null, versionActionId: null, activityId: 'act_1', copyActionId: null, permissionActionId: 'p1', edit: null } })
    expect(formatActivity(a)).toBe('You granted editor access')
  })

  it('returns fallback for unknown', () => {
    const a = makeActivity({ action: null })
    expect(formatActivity(a)).toBe('Activity recorded')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm vitest run app/utils/__tests__/activity.test.ts
```

Expected: FAIL — `formatActivity` not found.

- [ ] **Step 3: Create `app/utils/activity.ts`**

```ts
import type { Prisma } from '@/prisma/client'

type ActivityWithRelations = Prisma.ActivityGetPayload<{
  include: {
    time: true
    item: true
    action: {
      include: {
        create: true
        rename: true
        move: true
        delete: true
        restore: true
        copy: true
        share: true
        version: true
        comment: true
        permission: true
        access: true
        edit: true
      }
    }
    access: true
  }
}>

export type { ActivityWithRelations }

export function formatActivity(activity: ActivityWithRelations): string {
  const a = activity.action
  if (!a) return 'Activity recorded'
  if (a.create) return 'You created an item'
  if (a.rename) return `You renamed ${a.rename.oldName} → ${a.rename.newName}`
  if (a.move) return `You moved this item to ${a.move.to}`
  if (a.delete) return `You deleted ${a.delete.name}`
  if (a.restore) return 'You restored this item'
  if (a.copy) return `You copied this item to ${a.copy.to}`
  if (a.share) return `You shared this item with ${a.share.recipients.join(', ')}`
  if (a.version) return `You uploaded version ${a.version.newVersion}`
  if (a.comment) return a.comment.isReply ? 'You replied to a comment' : 'You commented on this item'
  if (a.permission) {
    if (a.permission.type === 'grant') return `You granted ${a.permission.role} access`
    if (a.permission.type === 'revoke') return 'You revoked access'
    return `You updated access to ${a.permission.role}`
  }
  if (a.edit) return 'You edited this item'
  if (activity.access) return 'You viewed this item'
  return 'Activity recorded'
}

export function formatActivityTimestamp(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm vitest run app/utils/__tests__/activity.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/utils/activity.ts app/utils/__tests__/activity.test.ts
git commit -m "feat(activities): formatActivity utility + tests"
```

---

## Task 3: API Route — `/api/activities`

**Files:**
- Create: `app/routes/api/activities.ts`
- Modify: `app/routes.ts`

- [ ] **Step 1: Create the route file**

Create `app/routes/api/activities.ts`:

```ts
import { data, redirect } from 'react-router'
import { auth } from '@/services/auth'
import { parseSearchParams } from '@/utils/parsers'
import { searchActivities } from '@/services/activity-actions'
import { z } from 'zod'
import type { Route } from './+types/activities'

const schema = z.object({
  itemId: z.string().optional(),
  cursor: z.string().optional(),
  take: z.coerce.number().min(1).max(50).default(20),
})

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) return data({ error: 'Unauthorized' }, { status: 401 })

  const params = parseSearchParams({ request, schema })

  const result = await searchActivities({
    itemId: params.itemId,
    cursor: params.cursor,
    take: params.take,
    strategy: 'cursor',
  })

  return data(result)
}
```

- [ ] **Step 2: Register route in `app/routes.ts`**

In `app/routes.ts`, inside the `...prefix('api', [...])` block, add after the `comments` line:

```ts
route('activities', 'routes/api/activities.ts'),
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/routes/api/activities.ts app/routes.ts
git commit -m "feat(activities): GET /api/activities resource route"
```

---

## Task 4: Recording — `item-actions.ts`

**Files:**
- Modify: `app/.server/item-actions.ts`

Context: `createActivity` is imported from `./activity-actions`. `getPrefixForModel` and `toObjectId` are already imported. The pattern for every call:

```ts
createActivity({
  item: { connect: { id: ITEM_ID } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      SUB_ACTION: { create: { id: toObjectId(getPrefixForModel('SUB_MODEL')), ...fields } },
    },
  },
}).catch(() => {})
```

- [ ] **Step 1: Add import**

At the top of `app/.server/item-actions.ts`, add:

```ts
import { createActivity } from './activity-actions'
```

- [ ] **Step 2: Wire `renameItem`**

After `return item` inside `renameItem`'s transaction (line ~58), before the `})` closing the transaction, add:

```ts
createActivity({
  item: { connect: { id: itemId } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      rename: { create: { id: toObjectId(getPrefixForModel('RenameAction')), oldName: item.name, newName } },
    },
  },
}).catch(() => {})
```

Note: `item.name` is the OLD name (before rename) because we fetched with `include: { parent: true }` and the update returns the updated name. Read the original name BEFORE the update by fetching first, or capture the old name from a prior select. The simplest fix: add a `findUnique` before the update to capture `oldName`:

```ts
const existing = await tx.item.findUniqueOrThrow({ where: { id: itemId }, select: { name: true } })
const item = await tx.item.update({ where: { id: itemId }, data: { name: newName }, include: { parent: true } })
createActivity({
  item: { connect: { id: itemId } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      rename: { create: { id: toObjectId(getPrefixForModel('RenameAction')), oldName: existing.name, newName } },
    },
  },
}).catch(() => {})
return item
```

- [ ] **Step 3: Wire `trashItems`**

After the `prisma.item.updateMany(...)` call in `trashItems`, add (for each id in `ids`, create one activity per top-level id only — `ids[0]` is fine for batch):

```ts
for (const id of ids) {
  createActivity({
    item: { connect: { id } },
    time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
    action: {
      create: {
        id: toObjectId(getPrefixForModel('ItemAction')),
        delete: { create: { id: toObjectId(getPrefixForModel('DeleteAction')), name: id, itemType: 'file' } },
      },
    },
  }).catch(() => {})
}
```

- [ ] **Step 4: Wire `restoreItems`**

After the `prisma.item.updateMany(...)` call in `restoreItems`, add:

```ts
for (const id of ids) {
  createActivity({
    item: { connect: { id } },
    time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
    action: {
      create: {
        id: toObjectId(getPrefixForModel('ItemAction')),
        restore: { create: { id: toObjectId(getPrefixForModel('RestoreAction')) } },
      },
    },
  }).catch(() => {})
}
```

- [ ] **Step 5: Wire `deleteItem`**

After `prisma.item.delete(...)` in `deleteItem`, add:

```ts
createActivity({
  item: { connect: { id } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      delete: { create: { id: toObjectId(getPrefixForModel('DeleteAction')), name: id, itemType: 'file' } },
    },
  },
}).catch(() => {})
```

- [ ] **Step 6: Wire `moveItem`**

Inside the `moveItem` transaction, after `tx.item.update(...)`, add:

```ts
createActivity({
  item: { connect: { id: itemId } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      move: { create: { id: toObjectId(getPrefixForModel('MoveAction')), from: itemToMove.parentId ?? '', to: targetFolderId } },
    },
  },
}).catch(() => {})
```

- [ ] **Step 7: Wire `copyItem`**

At the end of the `copyItem` transaction (before each `return newItem`), add:

```ts
createActivity({
  item: { connect: { id: newItem.id } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      copy: { create: { id: toObjectId(getPrefixForModel('CopyAction')), from: itemId, to: targetParentId ?? '' } },
    },
  },
}).catch(() => {})
```

- [ ] **Step 8: Wire `createUploadedItem`**

At the end of `createUploadedItem`'s transaction (after `onItemsUploaded`, before `return item`), add:

```ts
createActivity({
  item: { connect: { id: item.id } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      create: { create: { id: toObjectId(getPrefixForModel('CreateAction')) } },
    },
  },
}).catch(() => {})
```

- [ ] **Step 9: Wire `createFolder`**

At the end of `createFolder` (after `prisma.item.create`), add:

```ts
createActivity({
  item: { connect: { id: folder.id } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      create: { create: { id: toObjectId(getPrefixForModel('CreateAction')) } },
    },
  },
}).catch(() => {})
```

Note: `createFolder` currently returns the result of `prisma.item.create(...)` directly. You'll need to store it in a variable first:

```ts
const folder = await prisma.item.create({ ... })
createActivity({ item: { connect: { id: folder.id } }, ... }).catch(() => {})
return folder
```

- [ ] **Step 10: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add app/.server/item-actions.ts
git commit -m "feat(activities): record create/rename/move/trash/restore/delete/copy activities"
```

---

## Task 5: Recording — Permissions, Comments, Versions

**Files:**
- Modify: `app/.server/permission-actions.ts`
- Modify: `app/.server/comment-actions.ts`
- Modify: `app/.server/version-actions.ts`

- [ ] **Step 1: Add import to all three files**

In each file, add:
```ts
import { createActivity } from './activity-actions'
```

- [ ] **Step 2: Wire `createPermission` in `permission-actions.ts`**

`createPermission` receives `data: Prisma.PermissionCreateInput`. The itemId comes from `data.item?.connect?.id`. After the `prisma.permission.create(...)` call:

```ts
const perm = await (tx ?? prisma).permission.create({ data, ... })
if (data.item?.connect?.id) {
  createActivity({
    item: { connect: { id: data.item.connect.id } },
    time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
    action: {
      create: {
        id: toObjectId(getPrefixForModel('ItemAction')),
        permission: { create: { id: toObjectId(getPrefixForModel('PermissionAction')), type: 'grant', userId: String(data.users?.connect?.id ?? ''), role: String(data.roles ?? '') } },
      },
    },
  }).catch(() => {})
}
return perm
```

- [ ] **Step 3: Wire `updatePermission` in `permission-actions.ts`**

After `prisma.permission.update(...)`, look up the permission's itemId and add:

```ts
const perm = await prisma.permission.update({ ...args })
if (perm.itemId) {
  createActivity({
    item: { connect: { id: perm.itemId } },
    time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
    action: {
      create: {
        id: toObjectId(getPrefixForModel('ItemAction')),
        permission: { create: { id: toObjectId(getPrefixForModel('PermissionAction')), type: 'update', userId: perm.userId ?? '', role: String(perm.roles ?? '') } },
      },
    },
  }).catch(() => {})
}
return perm
```

- [ ] **Step 4: Wire `deletePermission` in `permission-actions.ts`**

`deletePermission` receives `id: string`. Fetch before delete to get `itemId`:

```ts
export function deletePermission(id: string, tx?: PrismaTx): Promise<Permission> {
  const client = tx ?? prisma
  return client.permission.findUniqueOrThrow({ where: { id }, select: { itemId: true, userId: true, roles: true } })
    .then((perm) => {
      return client.permission.delete({ where: { id } }).then((deleted) => {
        if (perm.itemId) {
          createActivity({
            item: { connect: { id: perm.itemId } },
            time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
            action: {
              create: {
                id: toObjectId(getPrefixForModel('ItemAction')),
                permission: { create: { id: toObjectId(getPrefixForModel('PermissionAction')), type: 'revoke', userId: perm.userId ?? '', role: String(perm.roles ?? '') } },
              },
            },
          }).catch(() => {})
        }
        return deleted
      })
    })
}
```

- [ ] **Step 5: Wire `createComment` in `comment-actions.ts`**

After `prisma.comment.create(...)`:

```ts
const comment = await prisma.comment.create({ ... })
createActivity({
  item: { connect: { id: itemId } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      comment: { create: { id: toObjectId(getPrefixForModel('CommentAction')), isReply: false, authorId: ownerId, participants: [ownerId] } },
    },
  },
}).catch(() => {})
return comment
```

- [ ] **Step 6: Wire `createVersion` in `version-actions.ts`**

Read `createVersion` signature (it creates an `ItemVersion`). After the `prisma.itemVersion.create(...)` call:

```ts
const version = await prisma.itemVersion.create({ ... })
createActivity({
  item: { connect: { id: itemId } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      version: { create: { id: toObjectId(getPrefixForModel('VersionAction')), newVersion: version.id } },
    },
  },
}).catch(() => {})
return version
```

- [ ] **Step 7: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/.server/permission-actions.ts app/.server/comment-actions.ts app/.server/version-actions.ts
git commit -m "feat(activities): record permission/comment/version activities"
```

---

## Task 6: UI — `ActivityEntry` Component

**Files:**
- Create: `app/components/core-components/activity-entry.tsx`

Context: check `app/components/icons.tsx` before using any icon — only use icons already defined there. Use `cn()` from `@/utils/styles`.

- [ ] **Step 1: Create `activity-entry.tsx`**

```tsx
import { formatActivity, formatActivityTimestamp } from '@/utils/activity'
import type { ActivityWithRelations } from '@/utils/activity'
import { cn } from '@/utils/styles'

interface ActivityEntryProps {
  activity: ActivityWithRelations
  className?: string
}

export function ActivityEntry({ activity, className }: ActivityEntryProps) {
  const prose = formatActivity(activity)
  const timestamp = formatActivityTimestamp(activity.time?.observedAt)
  const name = activity.item?.name ?? 'this item'

  return (
    <div className={cn('flex gap-3 py-3', className)}>
      <div className="mt-0.5 size-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground overflow-hidden">
        <span>Y</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">{prose}</p>
        {timestamp && (
          <p className="text-xs text-muted-foreground">{timestamp}</p>
        )}
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium max-w-full">
          <span className="truncate">{name}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/core-components/activity-entry.tsx
git commit -m "feat(activities): ActivityEntry component"
```

---

## Task 7: UI — `ActivityFeed` Component

**Files:**
- Create: `app/components/core-components/activity-feed.tsx`

- [ ] **Step 1: Create `activity-feed.tsx`**

```tsx
import { ActivityEntry } from './activity-entry'
import type { ActivityWithRelations } from '@/utils/activity'
import { cn } from '@/utils/styles'

interface ActivityFeedProps {
  activities: ActivityWithRelations[]
  isLoading?: boolean
  className?: string
  streamUrl?: string  // Phase 2 — reserved, not implemented yet
}

function ActivitySkeleton() {
  return (
    <div className="flex gap-3 py-3 animate-pulse">
      <div className="mt-0.5 size-8 shrink-0 rounded-full bg-muted" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-2.5 w-1/3 rounded bg-muted" />
        <div className="h-6 w-1/2 rounded bg-muted" />
      </div>
    </div>
  )
}

export function ActivityFeed({ activities, isLoading, className }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className={cn('divide-y divide-border', className)}>
        <ActivitySkeleton />
        <ActivitySkeleton />
        <ActivitySkeleton />
      </div>
    )
  }

  if (!activities.length) {
    return (
      <div className={cn('py-8 text-center text-sm text-muted-foreground', className)}>
        No activity yet
      </div>
    )
  }

  return (
    <div className={cn('divide-y divide-border', className)}>
      {activities.map((activity) => (
        <ActivityEntry key={activity.id} activity={activity} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/core-components/activity-feed.tsx
git commit -m "feat(activities): ActivityFeed component with skeleton + empty state"
```

---

## Task 8: Integration — Gallery Sidebar

**Files:**
- Modify: `app/routes/stash/gallery-image.tsx`

Context: `gallery-image.tsx` has a loader that fetches item details and a sidebar panel on the right with sections for Details, Camera. Activities go below Camera. `findManyActivities` is imported from `@/services/activity-actions`. The `ActivityFeed` type uses `ActivityWithRelations` from `@/utils/activity`.

- [ ] **Step 1: Update loader**

In `gallery-image.tsx`, add to imports:
```ts
import { findManyActivities } from '@/services/activity-actions'
import type { ActivityWithRelations } from '@/utils/activity'
```

Inside the loader, after the `const item = await prisma.item.findUniqueOrThrow(...)` call, add:
```ts
const activities = await findManyActivities({
  where: { itemId: item.id },
  orderBy: { id: 'desc' },
  take: 20,
})
```

Return `{ item, fullUrl, activities }`.

- [ ] **Step 2: Render ActivityFeed in sidebar**

In the component, destructure `activities` from `loaderData`. After the closing `</section>` of the Camera section (or the Details section if Camera is absent), add:

```tsx
import { ActivityFeed } from '@/components/core-components/activity-feed'

{/* inside the sidebar <div className="flex-1 space-y-6 p-4"> */}
<section>
  <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    Activity
  </h3>
  <ActivityFeed activities={activities} />
</section>
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/routes/stash/gallery-image.tsx
git commit -m "feat(activities): activity feed in gallery image sidebar"
```

---

## Task 9: Integration — Item Activity Drawer

**Files:**
- Create: `app/components/core-components/item-activity-drawer.tsx`

Context: uses shadcn `Sheet` from `@/components/ui/sheet`. Uses `useFetcher` from `react-router`. Receives `itemId` and a trigger element. Opens on trigger click, fetches `/api/activities?itemId=` on open.

- [ ] **Step 1: Create `item-activity-drawer.tsx`**

```tsx
import { useEffect } from 'react'
import { useFetcher } from 'react-router'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ActivityFeed } from './activity-feed'
import type { ActivityWithRelations } from '@/utils/activity'

interface ItemActivityDrawerProps {
  itemId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ItemActivityDrawer({ itemId, open, onOpenChange }: ItemActivityDrawerProps) {
  const fetcher = useFetcher<{ items: ActivityWithRelations[] }>()

  useEffect(() => {
    if (open && fetcher.state === 'idle' && !fetcher.data) {
      fetcher.load(`/api/activities?itemId=${itemId}`)
    }
  }, [open])

  const activities = fetcher.data?.items ?? []
  const isLoading = fetcher.state === 'loading'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-sm">Activity</SheetTitle>
        </SheetHeader>
        <ActivityFeed activities={activities} isLoading={isLoading} />
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/core-components/item-activity-drawer.tsx
git commit -m "feat(activities): ItemActivityDrawer with fetcher-loaded feed"
```

---

## Self-Review

**Spec coverage:**
- ✅ PermissionAction schema added (Task 1)
- ✅ All recording targets wired: create, rename, move, trash, restore, delete, copy, permission, comment, version (Tasks 4–5)
- ✅ `/api/activities` GET route (Task 3)
- ✅ `formatActivity` for all action types (Task 2)
- ✅ `ActivityEntry` Google Drive style (Task 6)
- ✅ `ActivityFeed` with skeleton + empty state (Task 7)
- ✅ Gallery sidebar integration (Task 8)
- ✅ Item card drawer integration (Task 9)
- ✅ `streamUrl` prop reserved for Phase 2 (Task 7)

**Type consistency:** `ActivityWithRelations` exported from `app/utils/activity.ts` and used in both components and the drawer — consistent throughout.
