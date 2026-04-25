# Item Activities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display a per-item activity feed in Google Drive style — avatar + prose description + timestamp + item chip — surfaced in the gallery detail sidebar and via an item card drawer.

**Architecture:** Recording is fire-and-forget inside existing server action functions. Display uses a shared `<ActivityFeed>` component fed by a new `/api/activities` resource route (fetcher-loaded on drawer open; SSR-loaded in the gallery sidebar). Phase 2 adds SSE via an optional `streamUrl` prop.

**Tech Stack:** Prisma (existing Activity/ItemAction schema), React Router 7 resource routes, `fetcher.load`, framer-motion, shadcn/ui, TailwindCSS 4.

---

## Schema

### New model: `PermissionAction`

Add to `prisma/models/action.prisma`:

```prisma
model PermissionAction {
  id        String      @id
  type      String      // "grant" | "revoke" | "update"
  userId    String      // recipient of the permission change
  role      String      // "viewer" | "editor" | "owner"
  action    ItemAction?
}
```

Add to `ItemAction`:
```prisma
permission          PermissionAction? @relation(fields: [permissionActionId], references: [id])
permissionActionId  String?           @unique
```

No other schema changes required — `Activity`, `ItemAction`, `ActivityTime`, and all other sub-action models already exist.

---

## Recording

Activity recording is added as fire-and-forget at the end of each mutating server function. Pattern:

```ts
createActivity({ ... }).catch(() => {})
```

Never throws. Never blocks the primary operation.

### Functions to wire

| File | Function(s) | Sub-action created |
|------|-------------|--------------------|
| `item-actions.ts` | `createUploadedItem`, `createFolder` | `CreateAction` |
| `item-actions.ts` | `renameItem` | `RenameAction { oldName, newName }` |
| `item-actions.ts` | `moveItem`, `moveItems` | `MoveAction { from, to }` |
| `item-actions.ts` | `trashItem`, `trashItems` | `DeleteAction { name, itemType }` |
| `item-actions.ts` | `deleteItem`, `deleteItems` | `DeleteAction { name, itemType }` |
| `item-actions.ts` | `restoreItem`, `restoreItems` | `RestoreAction` |
| `item-actions.ts` | `copyItem` | `CopyAction { from, to }` |
| `permission-actions.ts` | `createPermission` | `PermissionAction { type: "grant", userId, role }` |
| `permission-actions.ts` | `updatePermission` | `PermissionAction { type: "update", userId, role }` |
| `permission-actions.ts` | `deletePermission` | `PermissionAction { type: "revoke", userId, role }` |
| `comment-actions.ts` | comment create | `CommentAction { authorId, isReply, participants }` |
| `version-actions.ts` | version create | `VersionAction { newVersion }` |

`ActivityTime` is always created with `observedAt: new Date()`. `reportedAt` is left null.

Each `createActivity` call structure:
```ts
await createActivity({
  item: { connect: { id: itemId } },
  time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
  action: {
    create: {
      id: toObjectId(getPrefixForModel('ItemAction')),
      <subAction>: {
        create: { id: toObjectId(getPrefixForModel('<SubActionModel>')), ...fields }
      }
    }
  }
}).catch(() => {})
```

---

## API Route

**File:** `app/routes/api/activities.ts`

```
GET /api/activities?itemId=itm_xxx&take=20&cursor=act_yyy
```

- Auth-gated: session required, 401 if missing
- Uses `searchActivities` from `activity-actions.ts`
- Returns `{ items: ActivityWithRelations[], nextCursor: string | null, hasMore: boolean }`
- Default `take`: 20, max: 50
- Ordered by `id: 'desc'` (newest first)

Register in `app/routes.ts` under the existing `api` prefix.

---

## Utility

**File:** `app/utils/activity.ts`

Pure function `formatActivity(activity: ActivityWithRelations): string` — returns human-readable prose:

| Action | Prose |
|--------|-------|
| `create` | `"You created {name}"` |
| `rename` | `"You renamed {oldName} → {newName}"` |
| `move` | `"You moved this item to {to}"` |
| `delete` (trash) | `"You moved {name} to trash"` |
| `delete` (permanent) | `"You permanently deleted {name}"` |
| `restore` | `"You restored this item"` |
| `copy` | `"You copied this item to {to}"` |
| `share` | `"You shared this item with {recipients.join(', ')}"` |
| `version` | `"You uploaded version {newVersion}"` |
| `comment` | `"You commented on this item"` |
| `permission grant` | `"You granted {role} access"` |
| `permission revoke` | `"You revoked access"` |
| `permission update` | `"You updated access to {role}"` |
| `access` | `"You viewed this item"` |

---

## UI Components

### `app/components/core-components/activity-feed.tsx`

```ts
interface ActivityFeedProps {
  activities: ActivityWithRelations[]
  streamUrl?: string  // Phase 2: opens EventSource when provided
}
```

- Scrollable list of `<ActivityEntry>` rows
- Empty state: "No activity yet"
- Loading skeleton: 3 placeholder rows (avatar circle + two lines)
- When `streamUrl` provided: opens `EventSource`, prepends new events to local state on `message`

### `app/components/core-components/activity-entry.tsx`

Layout per entry (Google Drive style):
```
[avatar]  You renamed report.pdf → final-report.pdf
          9 Dec 2025, 06:15
          [item chip: 📄 report.pdf]
```

- Avatar: user profile image, falls back to initials
- Timestamp: absolute format `"d MMM yyyy, HH:mm"` 
- Item chip: file-type icon + item name, truncated, links to the item

---

## Integration

### Gallery sidebar (`app/routes/stash/gallery-image.tsx`)

In the loader, add after the existing item query:
```ts
const activities = await findManyActivities({
  where: { itemId: item.id },
  orderBy: { id: 'desc' },
  take: 20,
  include: { time: true, action: { include: { ... } } }
})
```

Add an "Activity" section at the bottom of the right sidebar, below the Camera section, rendering `<ActivityFeed activities={activities} />`.

### Item card drawer (`app/components/core-components/item-activity-drawer.tsx`)

- Triggered by an activity icon in the item options menu
- Uses `fetcher.load('/api/activities?itemId=...')` inside a `useEffect` on `open` state change
- Shows skeleton while `fetcher.state === 'loading'`
- Renders `<ActivityFeed>` once data arrives
- Implemented as a shadcn `<Sheet>` (side drawer), slides in from the right

---

## Phase 2: SSE (deferred)

When ready:
1. Add `app/routes/api/activities.stream.ts` — returns a `Response` with `Content-Type: text/event-stream`, polls DB every 5s for new activities newer than `since` param, pushes as JSON events
2. Pass `streamUrl="/api/activities/stream?itemId=..."` to `<ActivityFeed>` in both integration points
3. `ActivityFeed` opens `EventSource`, listens for `message`, prepends new `ActivityWithRelations` to local state

No component API changes needed — `streamUrl` is already in the interface.
