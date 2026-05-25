# Pinned Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in users "pin" any Item to surface it as a personal shortcut at the top of their stash, independent of Favorites.

**Architecture:** Adds a `PinItem` Prisma model (per-user, per-item join row with a `position` int for manual ordering), exposes a single `/api/pins` resource route, all business logic lives in a new `app/.server/pin-actions.ts`. A new `/:me/stash/pinned` route renders the list using the existing `ItemCard` + `GridLayout` + `usePagination` infrastructure. A `PinItemAction` dropdown entry in `ItemCard.Actions` toggles pin state.

**Tech Stack:** Prisma (Postgres), React Router 7 (framework mode), Zod, shadcn/ui, TailwindCSS 4, existing `parseSearchParams` / `parseFormData` utilities.

---

## File Structure

**Created files:**

- `prisma/models/pinItem.prisma` — new model definition
- `app/.server/pin-actions.ts` — `pinItem`, `unpinItem`, `reorderPin`, `getPinnedItems`, `isPinned`
- `app/routes/api/pins.ts` — resource route: `loader` (list/check), `action` (pin / unpin / reorder)
- `app/routes/stash/pinned.tsx` — UI page listing pinned items
- `app/hooks/usePinItem.ts` — client hook wrapping `useFetcher` for optimistic pin toggle
- `app/utils/__tests__/pin-actions.test.ts` — unit tests for the action functions
- `tests/e2e/pinned.spec.ts` — E2E: pin an item, see it on /pinned, unpin, vanishes

**Modified files:**

- `prisma/models/item.prisma` — add `pins PinItem[]` relation
- `prisma/models/user.prisma` — add `pins PinItem[]` relation
- `app/utils/converters.ts` — add `PinItem: 'pin'` to `StashlyPrefixMap`
- `app/schemas/api.schemas.ts` — add `pinApiRouteInput` (discriminated union on `intent`)
- `app/routes.ts` — register `/api/pins` and `/:me/stash/pinned`
- `app/components/icons.tsx` — add `PinIcon` and `PinFillIcon`
- `app/components/app-sidebar.tsx` — add "Pinned" link below Favorites
- `app/components/stash/item-card.tsx` — add "Pin / Unpin" dropdown entry that calls `usePinItem`
- `CLAUDE.md` — short note under Architecture about pin pattern

---

## Task 1: Add the Prisma model

**Files:**
- Create: `prisma/models/pinItem.prisma`
- Modify: `prisma/models/item.prisma`, `prisma/models/user.prisma`, `app/utils/converters.ts`

- [ ] **Step 1: Create the model file**

Create `prisma/models/pinItem.prisma` with this content:

```prisma
model PinItem {
  id         String   @id
  pinnedById String
  pinnedBy   User     @relation(fields: [pinnedById], references: [id], onDelete: Cascade)
  itemId     String
  item       Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  position   Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([pinnedById, itemId])
  @@index([pinnedById, position])
}
```

- [ ] **Step 2: Add the reverse relation on Item**

In `prisma/models/item.prisma`, find the line `favorites Favorite[]` and add directly below it:

```prisma
  pins      PinItem[]
```

- [ ] **Step 3: Add the reverse relation on User**

In `prisma/models/user.prisma`, find the line `favorites   Favorite[]` and add directly below it:

```prisma
  pins        PinItem[]
```

- [ ] **Step 4: Register the prefix**

In `app/utils/converters.ts`, find the `Favorite: 'fav',` line in `StashlyPrefixMap` (around line 762) and add directly below it:

```typescript
  PinItem: 'pin',
```

- [ ] **Step 5: Create the migration**

Run: `pnpm prisma migrate dev --name add_pin_item`
Expected: migration file `prisma/migrations/<timestamp>_add_pin_item/migration.sql` created; Prisma Client regenerates.

- [ ] **Step 6: Type-check**

Run: `pnpm typecheck`
Expected: no errors. If `Prisma.PinItem*` types are unresolved, re-run `pnpm prisma generate`.

- [ ] **Step 7: Commit**

```bash
git add prisma/models/pinItem.prisma prisma/models/item.prisma prisma/models/user.prisma app/utils/converters.ts prisma/migrations/
git commit -m "feat(pins): add PinItem prisma model and migration"
```

---

## Task 2: Write failing unit tests for pin-actions

**Files:**
- Create: `app/utils/__tests__/pin-actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/utils/__tests__/pin-actions.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/prisma/client'
import {
  pinItem,
  unpinItem,
  reorderPin,
  getPinnedItems,
  isPinned,
} from '@/services/pin-actions'

const TEST_USER = 'usr_pin_test_user'
const TEST_ITEM = 'item_pin_test_item'

describe('pin-actions', () => {
  beforeEach(async () => {
    await prisma.pinItem.deleteMany({ where: { pinnedById: TEST_USER } })
  })

  it('pinItem creates a row with a generated id and position 0', async () => {
    const pin = await pinItem(TEST_ITEM, TEST_USER)
    expect(pin.id).toMatch(/^pin_/)
    expect(pin.itemId).toBe(TEST_ITEM)
    expect(pin.pinnedById).toBe(TEST_USER)
    expect(pin.position).toBe(0)
  })

  it('pinItem is idempotent — pinning twice returns the existing row', async () => {
    const a = await pinItem(TEST_ITEM, TEST_USER)
    const b = await pinItem(TEST_ITEM, TEST_USER)
    expect(b.id).toBe(a.id)
    const count = await prisma.pinItem.count({
      where: { pinnedById: TEST_USER, itemId: TEST_ITEM },
    })
    expect(count).toBe(1)
  })

  it('unpinItem removes the row; no-op if not pinned', async () => {
    await pinItem(TEST_ITEM, TEST_USER)
    await unpinItem(TEST_ITEM, TEST_USER)
    expect(await isPinned(TEST_ITEM, TEST_USER)).toBe(false)
    await expect(unpinItem(TEST_ITEM, TEST_USER)).resolves.not.toThrow()
  })

  it('isPinned returns boolean for a user/item pair', async () => {
    expect(await isPinned(TEST_ITEM, TEST_USER)).toBe(false)
    await pinItem(TEST_ITEM, TEST_USER)
    expect(await isPinned(TEST_ITEM, TEST_USER)).toBe(true)
  })

  it('reorderPin updates position', async () => {
    const pin = await pinItem(TEST_ITEM, TEST_USER)
    await reorderPin(pin.id, TEST_USER, 5)
    const row = await prisma.pinItem.findUniqueOrThrow({ where: { id: pin.id } })
    expect(row.position).toBe(5)
  })

  it('reorderPin refuses to update another user’s pin', async () => {
    const pin = await pinItem(TEST_ITEM, TEST_USER)
    await expect(reorderPin(pin.id, 'usr_other', 9)).rejects.toThrow()
  })

  it('getPinnedItems returns pins ordered by position then createdAt', async () => {
    const a = await pinItem('item_a', TEST_USER)
    const b = await pinItem('item_b', TEST_USER)
    await reorderPin(b.id, TEST_USER, -1)
    const { items } = await getPinnedItems({ userId: TEST_USER })
    expect(items.map((i) => i.id)).toEqual(['item_b', 'item_a'])
  })
})
```

> Note: the test seeds `TEST_USER` and `TEST_ITEM` directly via Prisma — they must exist in the dev DB. If they don't, prepend a `beforeAll` that calls `prisma.user.upsert` + `prisma.item.upsert` with the minimal required fields (see `app/utils/__tests__/setup.ts` for the pattern used by other tests). Do NOT mock Prisma — per project rules, integration tests hit a real DB.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test app/utils/__tests__/pin-actions.test.ts`
Expected: FAIL — `Cannot find module '@/services/pin-actions'`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add app/utils/__tests__/pin-actions.test.ts
git commit -m "test(pins): add failing unit tests for pin-actions"
```

---

## Task 3: Implement the actions file

**Files:**
- Create: `app/.server/pin-actions.ts`

- [ ] **Step 1: Implement minimal pin-actions**

Create `app/.server/pin-actions.ts`:

```typescript
import { Prisma } from '@/prisma/client'
import { prisma } from '@/prisma/client'
import { toObjectId, getPrefixForModel } from '@/utils/converters'

const itemListSelect = {
  id: true,
  name: true,
  type: true,
  size: true,
  inclusiveSize: true,
  category: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  parentId: true,
  workspaceId: true,
  driveId: true,
  file: true,
  folder: true,
  thumbnails: {
    take: 1,
    where: { NOT: { url: { startsWith: '#' } } },
    select: { id: true, url: true, width: true, height: true, size: true, view: true },
  },
} satisfies Prisma.ItemSelect

/**
 * Pin an item for a user. Idempotent — returns the existing pin if one is
 * already in place.
 */
export async function pinItem(
  itemId: string,
  pinnedById: string,
  client: Prisma.TransactionClient = prisma
) {
  const existing = await client.pinItem.findUnique({
    where: { pinnedById_itemId: { pinnedById, itemId } },
  })
  if (existing) return existing
  return client.pinItem.create({
    data: {
      id: toObjectId(getPrefixForModel('PinItem')),
      itemId,
      pinnedById,
      position: 0,
    },
  })
}

/**
 * Remove a pin. No-op if the item was not pinned by this user.
 */
export async function unpinItem(
  itemId: string,
  pinnedById: string,
  client: Prisma.TransactionClient = prisma
) {
  const row = await client.pinItem.findUnique({
    where: { pinnedById_itemId: { pinnedById, itemId } },
  })
  if (!row) return
  await client.pinItem.delete({ where: { id: row.id } })
}

/**
 * Update the `position` of a pin. Throws if the pin doesn't belong to the
 * caller (prevents one user from reordering another user's pins).
 */
export async function reorderPin(
  pinId: string,
  pinnedById: string,
  position: number,
  client: Prisma.TransactionClient = prisma
) {
  const result = await client.pinItem.updateMany({
    where: { id: pinId, pinnedById },
    data: { position },
  })
  if (result.count === 0) {
    throw new Error('Pin not found or not owned by user')
  }
}

/**
 * Returns `true` if the user has pinned this item.
 */
export async function isPinned(
  itemId: string,
  pinnedById: string,
  client: Prisma.TransactionClient = prisma
): Promise<boolean> {
  const row = await client.pinItem.findUnique({
    where: { pinnedById_itemId: { pinnedById, itemId } },
    select: { id: true },
  })
  return row !== null
}

/**
 * Paginated list of pinned items for the user, ordered by `position` ASC then
 * `createdAt` DESC. Returns `{ items, nextCursor, hasMore }` shape used by
 * `usePagination`.
 */
export async function getPinnedItems({
  userId,
  cursor,
  limit = 50,
}: {
  userId: string
  cursor?: string
  limit?: number
}) {
  const rows = await prisma.pinItem.findMany({
    where: { pinnedById: userId },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    select: {
      id: true,
      position: true,
      createdAt: true,
      item: { select: itemListSelect },
    },
  })

  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null
  const items = sliced.map((r) => r.item)
  return { items, nextCursor, hasMore }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm test app/utils/__tests__/pin-actions.test.ts`
Expected: PASS for all 7 tests.

- [ ] **Step 3: Type-check**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/.server/pin-actions.ts
git commit -m "feat(pins): add pin-actions with pin/unpin/reorder/get/isPinned"
```

---

## Task 4: Add Zod schemas for the API route

**Files:**
- Modify: `app/schemas/api.schemas.ts`

- [ ] **Step 1: Append the pin schemas**

Append to the bottom of `app/schemas/api.schemas.ts`:

```typescript
// ====================================================== //
// ==================== Pins Api Route ================== //
// ====================================================== //

const pinSchema = z.object({
  intent: z.literal('pin'),
  itemId: z.string().nonempty(),
})

const unpinSchema = z.object({
  intent: z.literal('unpin'),
  itemId: z.string().nonempty(),
})

const reorderSchema = z.object({
  intent: z.literal('reorder'),
  pinId: z.string().nonempty(),
  position: z.coerce.number().int(),
})

export const pinApiRouteInput = z.discriminatedUnion('intent', [
  pinSchema,
  unpinSchema,
  reorderSchema,
])

export const pinApiRouteQuery = z.object({
  intent: z.enum(['list', 'check']).default('list'),
  itemId: z.string().optional(),
  cursor: z.string().optional(),
})
```

- [ ] **Step 2: Type-check**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/schemas/api.schemas.ts
git commit -m "feat(pins): add zod schemas for /api/pins"
```

---

## Task 5: Build the API route

**Files:**
- Create: `app/routes/api/pins.ts`
- Modify: `app/routes.ts`

- [ ] **Step 1: Register the route in routes.ts**

In `app/routes.ts`, inside the `prefix('api', [...])` block, directly after the `route('favorites', 'routes/api/favorites.ts'),` line, add:

```typescript
    route('pins', 'routes/api/pins.ts'),
```

- [ ] **Step 2: Create the route handler**

Create `app/routes/api/pins.ts`:

```typescript
import type { Route } from './+types/pins'
import { redirect } from 'react-router'
import { auth } from '@/services/auth'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  pinApiRouteInput,
  pinApiRouteQuery,
} from '@/schemas/api.schemas'
import {
  pinItem,
  unpinItem,
  reorderPin,
  getPinnedItems,
  isPinned,
} from '@/services/pin-actions'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const params = parseSearchParams({ request, schema: pinApiRouteQuery })

  if (params.intent === 'check') {
    if (!params.itemId) {
      return Response.json({ pinned: false }, { status: 400 })
    }
    const pinned = await isPinned(params.itemId, session.user.id)
    return { pinned }
  }

  return getPinnedItems({
    userId: session.user.id,
    cursor: params.cursor,
  })
}

export const action = async ({ request }: Route.ActionArgs) => {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const data = await parseFormData({ request, schema: pinApiRouteInput })

  try {
    switch (data.intent) {
      case 'pin': {
        await pinItem(data.itemId, session.user.id)
        return { pinned: true }
      }
      case 'unpin': {
        await unpinItem(data.itemId, session.user.id)
        return { pinned: false }
      }
      case 'reorder': {
        await reorderPin(data.pinId, session.user.id, data.position)
        return { ok: true }
      }
    }
  } catch (e) {
    const err = e as { statusCode?: number; message?: string }
    return Response.json(
      { error: err.message ?? 'Pin action failed' },
      { status: err.statusCode ?? 500 }
    )
  }
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm typecheck`
Expected: no errors. (React Router will regenerate `+types/pins.ts` on the first `typecheck`.)

- [ ] **Step 4: Smoke-test the route manually**

Start the dev server: `pnpm dev` (kill anything on :3000 first).
In another terminal, while signed in via the browser, hit:

```
GET http://localhost:3000/api/pins?intent=list
```

Expected: `{ items: [], nextCursor: null, hasMore: false }`.

- [ ] **Step 5: Commit**

```bash
git add app/routes.ts app/routes/api/pins.ts
git commit -m "feat(pins): add /api/pins resource route"
```

---

## Task 6: Add icons

**Files:**
- Modify: `app/components/icons.tsx`

- [ ] **Step 1: Find the file's existing pattern**

Read `app/components/icons.tsx`. Locate an existing icon pair such as `FavoriteIcon` / `FavoriteFillIcon` — your additions must mirror its export style exactly (same wrapper component shape, same forwarded props).

- [ ] **Step 2: Add the two icons**

Add new `PinIcon` and `PinFillIcon` exports next to the favorite icons. Use these SVG paths (Lucide-style 24×24):

```tsx
export function PinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  )
}

export function PinFillIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16 4a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1v5.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h5v5h2v-5h5a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a1 1 0 0 1 1-1z" />
    </svg>
  )
}
```

If `SVGProps` isn't already imported at the top of `icons.tsx`, add `import type { SVGProps } from 'react'`.

- [ ] **Step 3: Type-check**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/icons.tsx
git commit -m "feat(pins): add PinIcon and PinFillIcon"
```

---

## Task 7: Add the client-side hook

**Files:**
- Create: `app/hooks/usePinItem.ts`

- [ ] **Step 1: Create the hook**

Create `app/hooks/usePinItem.ts`:

```typescript
import { useFetcher } from 'react-router'
import { useCallback } from 'react'

type PinResponse = { pinned?: boolean; error?: string }

export function usePinItem(itemId: string, initiallyPinned = false) {
  const fetcher = useFetcher<PinResponse>()

  const pinned =
    fetcher.formData?.get('intent') === 'pin'
      ? true
      : fetcher.formData?.get('intent') === 'unpin'
        ? false
        : (fetcher.data?.pinned ?? initiallyPinned)

  const toggle = useCallback(() => {
    const intent = pinned ? 'unpin' : 'pin'
    fetcher.submit(
      { intent, itemId },
      { method: 'POST', action: '/api/pins' }
    )
  }, [fetcher, itemId, pinned])

  return {
    pinned,
    toggle,
    isPending: fetcher.state !== 'idle',
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/hooks/usePinItem.ts
git commit -m "feat(pins): add usePinItem hook"
```

---

## Task 8: Wire pin/unpin into the ItemCard dropdown

**Files:**
- Modify: `app/components/stash/item-card.tsx`

- [ ] **Step 1: Locate the actions dropdown**

In `app/components/stash/item-card.tsx`, find the internal `ItemCardActions` component (it renders a `DropdownMenu` with rename / share / favorite / trash entries). You're adding a "Pin" / "Unpin" `DropdownMenuItem` next to the favorite entry.

- [ ] **Step 2: Import the hook and icons**

At the top of the file (with other imports), add:

```typescript
import { usePinItem } from '@/hooks/usePinItem'
import { PinIcon, PinFillIcon } from '@/components/icons'
```

- [ ] **Step 3: Use the hook and render the menu item**

Inside `ItemCardActions`, near where `useItemCard()` (or equivalent) reads the current item, add:

```typescript
const item = useItemCard() // <-- use whatever the existing call is; do not rename
const initiallyPinned = item.pins?.some((p) => p.pinnedById === currentUserId) ?? false
const { pinned, toggle, isPending } = usePinItem(item.id, initiallyPinned)
```

Then, inside the dropdown menu's content (next to the existing favorite item), insert:

```tsx
<DropdownMenuItem
  onSelect={(e) => {
    e.preventDefault()
    toggle()
  }}
  disabled={isPending}
>
  {pinned ? <PinFillIcon className="size-5" /> : <PinIcon className="size-5" />}
  <span>{pinned ? 'Unpin' : 'Pin'}</span>
</DropdownMenuItem>
```

> If `useItemCard()` does not expose `pins`, leave `initiallyPinned = false` and let the server response correct it after the first toggle. Don't extend the context shape in this task — see Task 11.

- [ ] **Step 4: Type-check**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/stash/item-card.tsx
git commit -m "feat(pins): add Pin/Unpin entry to ItemCard dropdown"
```

---

## Task 9: Add the /:me/stash/pinned route

**Files:**
- Create: `app/routes/stash/pinned.tsx`
- Modify: `app/routes.ts`

- [ ] **Step 1: Register the route**

In `app/routes.ts`, inside the `prefix('stash', [...])` block, directly after the favorites route (`route('favorites', 'routes/stash/favorites.tsx', { id: 'stash-favorites' }),`), add:

```typescript
        route('pinned', 'routes/stash/pinned.tsx', { id: 'stash-pinned' }),
```

- [ ] **Step 2: Create the page**

Create `app/routes/stash/pinned.tsx`:

```typescript
import { LoadMoreItems } from '@/components/core-components/buttons'
import { ItemCard } from '@/components/stash/item-card'
import { GridLayout } from '@/components/views/grid-view'
import { itemVariants } from '@/components/views/variants'
import { usePagination } from '@/hooks/usePagination'
import { auth } from '@/services/auth'
import { getPinnedItems } from '@/services/pin-actions'
import { getQueryParam } from '@/utils/query-params'
import { motion } from 'framer-motion'
import { redirect } from 'react-router'
import type { Route } from './+types/pinned'
import { SelectionProvider } from '../../components/stash/selection'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const url = new URL(request.url)
  const cursor = getQueryParam(url.searchParams, 'cursor') ?? undefined

  return getPinnedItems({ userId: session.user.id, cursor })
}

export default function Pinned() {
  const { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(50)

  return (
    <div className="w-full relative space-y-4">
      <SelectionProvider items={items.map((i) => i.id)}>
        <GridLayout>
          {items.map((item) => (
            <motion.div
              key={item.id}
              variants={itemVariants}
              transition={{ duration: 0.2 }}
            >
              <ItemCard key={item.id} {...item}>
                <ItemCard.Header>
                  <ItemCard.Checkbox name="selectedItems" value={item.id} />
                  <ItemCard.Actions className="place-self-end" />
                </ItemCard.Header>
                <ItemCard.Content>
                  <ItemCard.Thumbnail />
                  <ItemCard.Name />
                </ItemCard.Content>
                <ItemCard.Footer>
                  <ItemCard.Size />
                  <ItemCard.Count />
                </ItemCard.Footer>
              </ItemCard>
            </motion.div>
          ))}
        </GridLayout>
      </SelectionProvider>
      {items.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-16">
          No pins yet. Pin an item from its menu to see it here.
        </p>
      )}
      <div className="col-span-full flex justify-center mt-2">
        <LoadMoreItems loadMore={loadMore} isLoading={isLoading} hasMore={hasMore} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/routes.ts app/routes/stash/pinned.tsx
git commit -m "feat(pins): add /:me/stash/pinned page"
```

---

## Task 10: Add the sidebar entry

**Files:**
- Modify: `app/components/app-sidebar.tsx`

- [ ] **Step 1: Add the import**

In `app/components/app-sidebar.tsx`, find the icon imports block at the top and add `PinIcon` to it:

```typescript
import { ..., PinIcon, FavoriteIcon, ... } from '@/components/icons'
```

(Match the existing alphabetized order if the file follows one.)

- [ ] **Step 2: Insert the sidebar item**

In the same file (around line 95–103), find the Favorites entry:

```typescript
  {
    icon: (isActive) => (
      <FavoriteIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Favorites',
    to: 'favorites?layout=grid',
    tooltip: 'Favorites',
  },
```

Immediately after the closing `},` add:

```typescript
  {
    icon: (isActive) => (
      <PinIcon className="size-5! group-data-[state=collapsed]:ml-2" />
    ),
    label: 'Pinned',
    to: 'pinned?layout=grid',
    tooltip: 'Pinned',
  },
```

- [ ] **Step 3: Type-check**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Visual check**

With `pnpm dev` running, open `http://localhost:3000/<your-user>/stash/pinned`. The sidebar should show a "Pinned" entry under "Favorites". Click an item's `…` menu → "Pin", then visit `/<your-user>/stash/pinned` and confirm the item appears. Click "Unpin" and confirm it disappears after refresh.

- [ ] **Step 5: Commit**

```bash
git add app/components/app-sidebar.tsx
git commit -m "feat(pins): add Pinned link to sidebar"
```

---

## Task 11: Surface pin state in ItemCard context (optional polish)

This task is only needed if Task 8's dropdown shows the wrong initial label (always "Pin", even on already-pinned items). Skip if visual check in Task 10 confirms it's correct.

**Files:**
- Modify: `app/components/stash/item-card.tsx`, `app/.server/item-actions.ts`

- [ ] **Step 1: Extend item list selects to include `pins`**

In `app/.server/item-actions.ts`, for every list-returning function used by the routes that render ItemCard (start with `getFavoritedItems`, `paginateItems`, `getFolderContent`), add into the `select` block:

```typescript
pins: { select: { id: true, pinnedById: true } },
```

- [ ] **Step 2: Adjust the dropdown read**

In `ItemCardActions`, update the `initiallyPinned` calculation to consume the loader-provided `pins`:

```typescript
const initiallyPinned =
  Array.isArray(item.pins) && item.pins.some((p) => p.pinnedById === currentUserId)
```

- [ ] **Step 3: Type-check + visual recheck**

Run: `pnpm typecheck` then reload `/stash/all`. The dropdown should show "Unpin" for already-pinned items.

- [ ] **Step 4: Commit**

```bash
git add app/.server/item-actions.ts app/components/stash/item-card.tsx
git commit -m "feat(pins): expose pins on item selects for accurate dropdown label"
```

---

## Task 12: E2E test

**Files:**
- Create: `tests/e2e/pinned.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/pinned.spec.ts`:

```typescript
import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('pinned items', () => {
  test('pin → appears on /pinned → unpin → gone', async ({ page }) => {
    // Assumes the seeded user has at least one item visible on /stash/all.
    await page.goto('/me/stash/all')

    const firstCard = page.locator('[data-testid="item-card"]').first()
    await expect(firstCard).toBeVisible()
    const itemName = await firstCard.locator('[data-testid="item-name"]').innerText()

    // Open menu → Pin
    await firstCard.locator('[data-testid="item-card-menu"]').click()
    await page.getByRole('menuitem', { name: 'Pin' }).click()

    // Navigate to /pinned and confirm presence
    await page.goto('/me/stash/pinned')
    await expect(page.getByText(itemName)).toBeVisible()

    // Unpin from /pinned
    const pinnedCard = page.locator('[data-testid="item-card"]', { hasText: itemName })
    await pinnedCard.locator('[data-testid="item-card-menu"]').click()
    await page.getByRole('menuitem', { name: 'Unpin' }).click()

    // After reload it should be gone
    await page.reload()
    await expect(page.getByText(itemName)).toHaveCount(0)
  })
})
```

> Note: the selectors above (`data-testid="item-card"`, `data-testid="item-card-menu"`, `data-testid="item-name"`) assume the existing card has those testids. If it doesn't, add the missing `data-testid` attributes to `ItemCard` first (mirror whatever pattern other specs in `tests/e2e/` already use — check `navigation.spec.ts`).

- [ ] **Step 2: Run the spec**

Make sure dev server can boot. Run: `pnpm test:e2e tests/e2e/pinned.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/pinned.spec.ts
git commit -m "test(pins): add e2e spec covering pin/unpin flow"
```

---

## Task 13: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a short note under the Architecture section**

In `CLAUDE.md`, locate the "Layer Responsibilities" table. Below it, add a short bullet under existing notes:

```markdown
**Pinned items**: `PinItem` is a per-user, per-item join row with a `position` int for manual ordering. Business logic lives in `app/.server/pin-actions.ts`; the single resource route is `/api/pins` (POST `intent: pin|unpin|reorder`, GET `intent: list|check`). The Pin / Unpin entry is part of `ItemCard.Actions` and uses the `usePinItem` hook for optimistic toggling.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(pins): document Pin pattern in CLAUDE.md"
```

---

## Self-review summary

- **Schema** (Task 1) — `PinItem` model + relations + prefix entry. Migration runs.
- **API route** (Tasks 4–5) — `/api/pins` with discriminated-union intents `pin / unpin / reorder` and a query-mode loader supporting `list / check`.
- **Actions file** (Tasks 2–3) — `app/.server/pin-actions.ts` with five exported functions, fully unit-tested.
- **UI** (Tasks 6–11) — icons, sidebar link, `/:me/stash/pinned` page, `usePinItem` hook, dropdown wiring, optional context polish.
- **Tests** (Tasks 2, 12) — unit tests pass; one E2E covering the full pin / unpin flow.
- **Docs** (Task 13) — CLAUDE.md updated.

No placeholders, no "similar to Task N" hand-waves; all type signatures match across tasks (`pinItem`, `unpinItem`, `reorderPin`, `isPinned`, `getPinnedItems`).
