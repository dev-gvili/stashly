# Quota & State Machine Integration

This document covers the quota state machine architecture, the `QuotaService` implementation, and patterns for managing user storage quotas.

---

## Overview

The quota system uses XState to model quota lifecycle events and a `QuotaService` (module-level singleton) to perform the actual database operations. The state machine represents all quota-affecting actions: upload, copy, restore, delete.

---

## QuotaService

### Module-Level Singleton (Recommended Pattern)

In modern TypeScript/JavaScript, leverage the module system instead of `getInstance()`. Modules are cached and executed only once:

```typescript
// app/.server/services/quota.service.ts

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

## `toUpdatedQuota` — Pure Transformation Function

A pure function that calculates the next quota state without side effects:

```typescript
/**
 * Creates a new quota object by applying a set of changes to the current quota.
 * Pure function — no side effects.
 *
 * @param current  The current quota (used, deleted, total values)
 * @param data     Changes to apply (any of used, deleted, total)
 * @returns        Updated quota with recalculated state
 */
export function toUpdatedQuota(
  current: Pick<Quota, 'used' | 'deleted' | 'total'>,
  data: Partial<Pick<Quota, 'used' | 'deleted' | 'total'>>
): Pick<Quota, 'used' | 'deleted' | 'total' | 'state'> {
  const total = data.total ?? current.total

  let used = current.used + (data.used ?? 0n)
  let deleted = current.deleted + (data.deleted ?? 0n)

  // Safety: prevent negative values
  if (used < 0n) used = 0n
  if (deleted < 0n) deleted = 0n

  const state = toQuotaState({ used, total })

  return { total, used, deleted, state }
}
```

**Key behaviors:**
- Uses `??` (nullish coalescing) — preserves existing value if change not provided
- BigInt arithmetic (`0n`) — quota values are stored as BigInts
- Floors at zero — prevents invalid states (e.g., restoring more than what's in trash)
- Derives `state` via `toQuotaState()` — determines `'normal'`, `'warning'`, or `'exceeded'`

---

## Quota State Machine

The XState machine mirrors all `QuotaService` methods as states and actors.

```typescript
// machines/quota.machine.ts

export const quotaMachine = setup({
  actors: {
    checkQuota,
    updateUploaded,
    updateDeleted,
    updateCopied,
    updateRestored,
  },
}).createMachine({
  id: 'quota',
  initial: 'idle',
  states: {
    idle: {
      on: {
        '@quota.check': 'checking',
        '@quota.update.uploaded': 'uploaded',
        '@quota.update.deleted': 'deleted',
        '@quota.update.copied': 'copied',
        '@quota.update.restored': 'restored',
      }
    },
    checking: {
      invoke: { src: 'checkQuota', ... }
    },
    uploaded: {
      invoke: { src: 'updateUploaded', ... }
    },
    deleted: {
      invoke: { src: 'updateDeleted', ... }
    },
    copied: {
      invoke: { src: 'updateCopied', ... }
    },
    restored: {
      invoke: { src: 'updateRestored', ... }
    },
  }
})
```

---

## Backend API Endpoint

`api/quota.ts` — handles quota actions via a discriminated union schema:

```typescript
switch (action) {
  case 'check-quota': {
    const hasQuota = await quotaService.hasSufficientQuota({ userId: user.id, dataSize })
    if (!hasQuota) return { error: 'Insufficient quota' }
    const currentQuota = await quotaService.findQuota({ userId: user.id })
    return QuotaOutputSchema.parse({
      ...currentQuota,
      remaining: currentQuota.total - currentQuota.used,
    })
  }
  case 'update-after-uploaded': {
    return await quotaService.onUpload({ userId: user.id, dataSize })
  }
  case 'update-after-copied': {
    return await quotaService.onCopy({ userId: user.id, dataSize })
  }
  case 'update-after-restored': {
    return await quotaService.onRestore({ userId: user.id, dataSize })
  }
}
```

---

## `canUpload` / `hasSufficientQuota` — Explanation

The `hasSufficientQuota` property (formerly `canUpload`) is a boolean flag that indicates whether a user currently has permission to upload new files based on quota rules.

It answers the question: **"Can the user perform this storage-consuming action right now?"**

Used to gate all storage-consuming operations (upload, copy, restore) — not just uploads. The UI checks this before enabling the upload button, preventing failed operations and improving user experience.

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
