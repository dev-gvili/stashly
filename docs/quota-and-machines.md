# Quota & State Machine Integration

This document covers the quota state machine architecture and patterns for managing user storage quotas.

> ⚠️ **Current implementation:** The class-based `QuotaService` pattern shown below has been **superseded** by plain exported functions in [`app/.server/quota-actions.ts`](../app/.server/quota-actions.ts). The state-machine and conceptual portions of this doc still apply; the `QuotaService` class examples are historical. Current entry points include:
>
> - `findQuota`, `findQuotaById`, `findQuotaByUserId(userId, client?)`, `findQuotaByDriveId`, `findQuotaByUserAndDrive`, `assertQuotaExists`
> - `ensureUserQuota(userId, client?)` — idempotent creation; `createQuota` / `deleteQuota`
> - `validateQuotaFreeSpace(quota, size)` — throws if insufficient; `verifyFreeQuota(quota, dataSize)` → boolean; `checkFreeQuota(itemId, quota, dataSize)`
> - `onItemsUploaded`, `onItemsCopied`, `onItemsTrashed`, `onItemsRestored`, `onItemsDeleted` — apply quota deltas
> - `updateTotalQuota` — adjust the total (e.g. on plan change)
> - `calculateQuota` / `toQuota` / `toQuotaStatus` — pure transforms (see below)
> - `searchQuotas` — `searchFactory`-backed list
>
> All the mutating/lookup functions accept an optional `Prisma.TransactionClient` so callers can compose them inside a transaction.

---

## Overview

The quota system uses XState to model quota lifecycle events. The actual database operations are performed by plain exported functions in `app/.server/quota-actions.ts`. The state machine represents all quota-affecting actions: upload, copy, restore, delete.

---

## QuotaService (historical — superseded)

### Module-Level Singleton

Kept for the reasoning, not as a description of the current code: the file below no longer exists, and `app/.server/quota-actions.ts` exports plain functions instead. The original argument was to leverage the module system instead of `getInstance()`, since modules are cached and executed only once:

```typescript
// app/.server/services/quota.service.ts — REMOVED

export class QuotaService {
  // constructor is public — module caching handles the singleton guarantee

  public async hasSufficientQuota({ userId, dataSize }: QuotaInput): Promise<boolean> {
    const quota = await this.findQuota({ userId })
    const remaining = quota.total - quota.used
    return remaining >= dataSize
  }

  public async findQuota({ userId }: { userId: string }) {
    return prisma.quota.findUnique({ where: { userId } })
  }

  public async onUpload({ userId, dataSize }: QuotaInput): Promise<QuotaOutput> {
    const quota = await this.findQuota({ userId })
    const updated = toUpdatedQuota(quota, { used: quota.used + dataSize })
    return prisma.quota.update({ where: { userId }, data: updated })
  }

  public async onDelete({ userId, dataSize }: QuotaInput): Promise<QuotaOutput> { ... }
  public async onCopy({ userId, dataSize }: QuotaInput): Promise<QuotaOutput> { ... }
  public async onRestore({ userId, dataSize }: QuotaInput): Promise<QuotaOutput> { ... }
}

// Export a single instance — this is the singleton
export const quotaService = new QuotaService()
```

**Usage:**
```typescript
import { quotaService } from '@/app/.server/quota'

const quota = await quotaService.findQuota({ userId: 'some-user-id' })
const canProceed = await quotaService.hasSufficientQuota({ userId, dataSize })
```

### Method Naming Convention

- `hasSufficientQuota` — generic check (replaces `canUpload`); used to gate upload, copy, and restore operations
- `onUpload`, `onDelete`, `onCopy`, `onRestore` — mutating operations
- `findQuota` — read-only lookup

---

## `calculateQuota` — Pure Transformation Function

Named `toUpdatedQuota` in earlier drafts; the shipped function is `calculateQuota` in `app/.server/quota-actions.ts`. It calculates the next quota state without side effects:

```typescript
/**
 * Apply a delta to quota fields and return the recalculated values.
 * `used` and `deleted` are clamped to 0 to prevent negative values.
 */
export function calculateQuota(
  current: Pick<QuotaOutput, 'used' | 'deleted' | 'total'>,
  data: Partial<Pick<PrismaQuota, 'used' | 'deleted' | 'total'>>
): Pick<QuotaOutput, 'used' | 'deleted' | 'total' | 'status' | 'remaining'> {
  const total = data.total ?? current.total
  let used = current.used + (data.used ?? 0n)
  if (used < 0n) used = 0n
  let deleted = current.deleted + (data.deleted ?? 0n)
  if (deleted < 0n) deleted = 0n
  const remaining = total - used
  return { total, used, deleted, remaining, status: toQuotaStatus({ used, total }) }
}
```

**Key behaviors:**
- Deltas, not absolutes — `data.used` is *added* to `current.used` (`data.total`, by contrast, replaces)
- Uses `??` (nullish coalescing) — preserves existing value if change not provided
- BigInt arithmetic (`0n`) — quota values are stored as BigInts
- Floors at zero — prevents invalid states (e.g., restoring more than what's in trash)
- Derives `status` (not `state`) via `toQuotaStatus()` — `'normal'`, `'warning'` (>90%), `'critical'` (>99%), or `'exceeded'` (>100%); a `total` of `0n` is `'exceeded'` as soon as anything is used

`toQuota(prismaQuota)` is the lighter sibling: it just decorates a raw Prisma row with `remaining` and `status`.

---

## Quota State Machine

The live machine is `app/machines/quota/quota.machine.ts`, with its actors in `quota.actors.ts` and the fetch helpers in `quota.utils.ts`. It only **reads** quota: one state per read, no write path.

```typescript
// app/machines/quota/quota.machine.ts

export const quotaMachine = setup({
  actors: {
    verify: verifyQuota,   // POST /api/quota { action: 'verify-free-quota' } → boolean
    check: checkQuota,     // POST /api/quota { action: 'check-free-quota' }
    find: findQuota,       // POST /api/quota { action: 'find-quota' }
  },
}).createMachine({
  id: 'quota',
  context: { quota: { driveId: '', id: '', deleted: 0n, total: 0n, used: 0n, remaining: 0n, status: 'normal' }, error: undefined },
  initial: 'idle',
  states: {
    idle: {
      on: {
        '@quota.check':  { target: 'check' },
        '@quota.verify': { target: 'verify' },
        '@quota.find':   { target: 'find' },
      },
    },
    check:   { invoke: { src: 'check',  ... } },  // → success | error
    verify:  { invoke: { src: 'verify', ... } },
    find:    { invoke: { src: 'find',   ... } },
    success: { /* → idle */ },
    error:   { /* → idle */ },
  }
})
```

`quotaMachine` is registered as an actor of `upload/upload.machine.ts`. `app/machines/actors/quota.machine.ts` is an abandoned prototype that nothing imports.

### Where quota is written

Only on the server, in the same code that changes the rows it accounts for. No request body can change a quota.

| Change | Where | How |
|---|---|---|
| Upload | `createUploadedItem` (`item-actions.ts`) | `uploadChargeSql` (`quota-actions.ts`, the same SET and `withinTotal` rule as `onItemsUploaded`), inside the one statement that creates the `Item` (`insertUploadedItem`). Row and charge commit together or not at all; a user with no `Quota` row gets no row either, and `refuseUploadCharge` says why after a refusal. |
| Trash, restore, delete | `item-actions.ts` | `onItemsTrashed` / `onItemsRestored` / `onItemsDeleted`, with the byte count the statement itself moved |
| Copy | `item-actions.ts` | `onItemsCopied`, after an `ensureUserQuota` check |
| Plan limit | billing (`subscription-actions.ts`, `settings/billing.tsx`) | `updateTotalQuota` |

History: until 2026-09-27 an upload was charged twice, once by the file machine's `updatingQuota` and once in `createUploadedItem`. `c6751b2` kept a client-side charge in `dbMachine` (`chargingQuota`, with retries) and removed the server one. On 2026-10-08 that was reversed: the server charge is back in the transaction, and the client charge and the `items-uploaded` action are gone, because a client-posted charge could be skipped or name its own size.

---

## Backend API Endpoint

`app/routes/api/quota.ts` — **JSON body** (`request.json()`), parsed by `quotaApiRouteInput`, a discriminated union on `action`. **Read-only.** The `userId` always comes from the session, never from the body. A body that fails the schema (an unknown action, including the write actions removed on 2026-10-08, or a negative or oversized `dataSize`) gets a **400**:

```typescript
const parsed = quotaApiRouteInput.safeParse(await request.json())
if (!parsed.success) throw data({ error: 'Invalid quota request' }, { status: 400 })

switch (input.action) {
  case 'find-quota':        return quotaApiRouteOutput.parse(await findQuota({ userId: user.id }))
  case 'verify-free-quota': return verifyFreeQuota(await findQuota({ userId: user.id }), input.dataSize)   // boolean
  case 'check-free-quota':  return checkFreeQuota(input.itemId, await findQuota({ userId: user.id }), input.dataSize)
}
```

Callers: `verifyBatchQuota()` in `app/hooks/useUpload.ts` sends `verify-free-quota` once for a whole batch (each file in that batch is then queued with `skipQuotaCheck: true`), and `quota.actors.ts` sends the three reads on behalf of the quota machine. Covered by `app/routes/api/__tests__/quota.test.ts`.

---

## "Does the user have room?" — the three shipped forms

The old `canUpload` / `hasSufficientQuota` idea survives as three functions in `quota-actions.ts`, differing only in how they answer:

| Function | Returns | Used by |
|----------|---------|---------|
| `verifyFreeQuota(quota, dataSize)` | `boolean` | `verify-free-quota` — batch pre-check from `useUpload`'s `verifyBatchQuota` |
| `checkFreeQuota(itemId, quota, dataSize)` | `{ itemId, result: 'allowed' \| 'denied' }` — the file machine's `isQuotaCheckPassed` guard reads `quotaCheckResult.result === 'allowed'` | `check-free-quota` — the per-file `checkingQuota` state |
| `validateQuotaFreeSpace(quota, size)` | `void`, **throws** `StashlyError(INSUFFICIENT_QUOTA)` if insufficient | Server-side callers that want to abort a mutation outright |

All three answer the same question — **"Can the user perform this storage-consuming action right now?"** — and gate every storage-consuming operation (upload, copy, restore), not just uploads.

---

## Context Binding Pattern

When passing service methods as callbacks (e.g., to event handlers or promise chains), `this` can be lost. Two approaches to prevent this:

### Option 1: Bind in Constructor

```typescript
class Logger {
  prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
    this.logMessage = this.logMessage.bind(this) // ← bound in constructor
  }

  logMessage(message: string) {
    console.log(`${this.prefix}: ${message}`)
  }
}
```

### Option 2: Arrow Function Properties (Preferred in Modern Codebases)

```typescript
class ModernLogger {
  prefix: string
  constructor(prefix: string) { this.prefix = prefix }

  // Arrow function — `this` is lexically scoped to the class instance
  logMessage = (message: string) => {
    console.log(`${this.prefix}: ${message}`)
  }
}
```

Arrow function properties are cleaner and less error-prone. They automatically capture the correct `this` context without explicit binding.

The module-level singleton pattern (`export const quotaService = new QuotaService()`) is used in this project instead, which avoids most `this` context issues since the instance is always accessed directly.
