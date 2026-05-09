# Developer Notes

Miscellaneous developer notes covering TypeScript patterns, tooling, database conventions, and codebase-specific decisions.

---

## Table of Contents

1. [Combining TypeScript Files](#1-combining-typescript-files)
2. [TypeScript Function Overloads — Refactor Pattern](#2-typescript-function-overloads--refactor-pattern)
3. [GitHub Copilot Instructions (Codebase Guide)](#3-github-copilot-instructions-codebase-guide)
5. [Faker-JS Mock Generation](#5-faker-js-mock-generation)
6. [Prisma Schema & SQL Triggers](#6-prisma-schema--sql-triggers)

---

## 1. Combining TypeScript Files

When merging multiple TypeScript files into one (e.g., combining `search.ts` and `pagination.ts` into `ss.ts`):

**Steps:**
1. Place content from the most foundational file first (e.g., `pagination.ts`)
2. Add content from the dependent file after
3. Remove duplicate imports — keep only one import per module at the top
4. Clean up any re-exported types that are now in scope

**Common simplifications after merging:**
- Remove redundant `switch` statements that were routing between separate implementations
- Simplify intermediate type definitions that only existed to bridge file boundaries
- Use the existing types directly rather than re-wrapping them

**Type inference bug fix — `include` parameter:**

If `include` is not passed, the return type may infer a union of all models instead of the base type:

```typescript
// Fix: check if TInclude is undefined
type InferredModel<TInclude> = TInclude extends undefined
  ? BaseModel          // no include → base model type
  : BaseModel & { [K in keyof TInclude]: RelatedModel }  // with include
```

---

## 2. TypeScript Function Overloads — Refactor Pattern

### The Problem with Interface Merging

Declaring the same interface multiple times causes TypeScript to merge them into one interface with all properties optional:

```typescript
// BAD — these merge into one interface with everything optional
interface RunSearchOptions extends PageBasedOptions { page?: number; pageSize?: number }
interface RunSearchOptions extends CursorBasedOptions { cursor?: string; limit?: number }
// Result: RunSearchOptions has page?, pageSize?, cursor?, limit? — breaks overloads
```

### The Fix: Union Type

Use a **union type** for the implementation signature:

```typescript
// GOOD — RunSearchOptions is one-of, not all-optional
type RunSearchOptions<TWhereInput, TOrderBy, TInclude> =
  | PageBasedOptions<TWhereInput, TOrderBy, TInclude>
  | CursorBasedOptions<TWhereInput, TOrderBy, TInclude>
  | StreamOptions<TWhereInput, TOrderBy, TInclude>
  | NoPaginationOptions<TWhereInput, TOrderBy, TInclude>
```

Inside the implementation, use `'cursor' in options`, `'page' in options`, `'stream' in options` as type guards — TypeScript narrows the union correctly.

### Generic Constraint for IDs

Add `TModel extends { id: string }` when cursor-based or streaming logic accesses `.id`:

```typescript
export function runSearch<
  TModel extends { id: string },
  TWhereInput,
  TOrderBy,
  TInclude,
>(...)
```

### SearchFactory with Object.assign Pattern

Extend the Prisma delegate directly instead of returning a standalone function:

```typescript
function Users(prismaUser: PrismaClient['user']) {
  return Object.assign(prismaUser, {
    async signup(data: Signup): Promise<User> {
      return prismaUser.create({ data })
    },
  })
}

// Usage:
const users = Users(prisma.user)
const user = await users.signup({ ... })
const count = await users.count()  // original Prisma method still available
```

Applied to `searchFactory`:

```typescript
export function searchFactory<TDelegate extends PrismaClient[Uncapitalize<Prisma.ModelName>], ...>(
  dbDelegate: TDelegate,
  buildFilters: ...,
  defaultInclude: TInclude,
  defaultOrderBy: ...
) {
  return Object.assign(dbDelegate, {
    search: (options?) => { ... }
  })
}
```

### Correct Prisma Delegate Type

```typescript
// Derive the delegate type using Uncapitalize<ModelName> to match Prisma client properties
type TDelegate = (typeof prisma)[Uncapitalize<TModelName>]
// e.g., TModelName = 'User' → TDelegate = type of prisma.user
```

### Fixing TS2742: Inferred Type Cannot Be Named

When `searchFactory` infers a complex anonymous Prisma type, TypeScript cannot name it without referencing internal library paths. **Fix:** Define an explicit named type using `Prisma.ModelGetPayload`:

```typescript
const itemInclude = {
  owner: true,
  workspace: true,
} satisfies Prisma.ItemInclude

export type ItemWithRelations = Prisma.ItemGetPayload<{
  include: typeof itemInclude
}>

// Then annotate explicitly:
const searchItems: SearchFunction<ItemWithRelations, ItemSearchParams, ItemOrderBy>
  = searchFactory(prisma.item, buildFilters, itemInclude, defaultOrderBy)
```

---

## 3. AI Coding Agent Instructions

Two files guide AI coding agents in this repository:

- **`CLAUDE.md`** (root) — primary, kept up-to-date. Covers commands, architecture, conventions, gotchas, and the `New Feature Checklist`.
- **`.github/copilot-instructions.md`** — for GitHub Copilot. May lag CLAUDE.md.

Both should reflect the current architecture:

- **Layer:** Routes → action functions in `app/.server/*-actions.ts` → Prisma. (The previous services/repositories split has been collapsed.)
- **Machines:** XState 5; upload pipeline in `app/machines/upload/`; AI in `app/machines/ai/`; multipart in `app/machines/multipart/`
- **Schemas:** Zod in `app/schemas/`; types in `app/types/`
- **Filters:** `app/.server/filters/` with `searchFactory` from `app/utils/search.ts`
- **Conventions:** TypeScript strict, Zod validation at API boundaries, `better-auth` for auth, `parseFormData` + `intent` discriminator for mutating routes (except `/api/s3/upload` which uses JSON)

When updating either file, mirror changes in CLAUDE.md first — it's the canonical source.

---

## 4. Faker-JS Mock Generation

### Mock GitHub Tags

```typescript
import { faker } from '@faker-js/faker'

export interface GitHubTag {
  name: string
  commit: { sha: string; url: string }
  zipball_url: string
  tarball_url: string
  node_id: string
}

const createMockTag = (): GitHubTag => {
  const owner = faker.internet.userName().toLowerCase()
  const repo = faker.lorem.slug(2)
  const tagName = `v${faker.system.semver()}`
  const commitSha = faker.git.commitSha()
  return {
    name: tagName,
    commit: {
      sha: commitSha,
      url: `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`,
    },
    zipball_url: `https://api.github.com/repos/${owner}/${repo}/zipball/refs/tags/${tagName}`,
    tarball_url: `https://api.github.com/repos/${owner}/${repo}/tarball/refs/tags/${tagName}`,
    node_id: `MDM6UmV${faker.string.alphanumeric({ length: 24 })}`,
  }
}

export const generateMockTags = (count: number): GitHubTag[] => {
  if (count <= 0) return []
  return Array.from({ length: count }, createMockTag)
}
```

### Mock GitHub Labels

```typescript
export interface GitHubLabel {
  id: number
  node_id: string
  url: string
  name: string
  color: string
  default: boolean
  description: string | null
}

const GITHUB_LABEL_NAMES = [
  'bug', 'enhancement', 'documentation', 'help wanted', 'good first issue',
  'duplicate', 'wontfix', 'invalid', 'question', 'priority: high',
  'priority: low', 'needs-triage', 'testing', 'feature',
]

const createMockLabel = (): GitHubLabel => {
  const owner = faker.internet.userName().toLowerCase()
  const repo = faker.lorem.slug(2)
  const labelName = faker.helpers.arrayElement(GITHUB_LABEL_NAMES)
  return {
    id: faker.number.int({ min: 100000, max: 999999999 }),
    node_id: `L_kwDOA_${faker.string.alphanumeric(22)}`,
    url: `https://api.github.com/repos/${owner}/${repo}/labels/${encodeURIComponent(labelName)}`,
    name: labelName,
    color: faker.string.hexadecimal({ length: 6, prefix: '' }),
    default: faker.datatype.boolean({ probability: 0.2 }),
    description: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.7 }),
  }
}

export const generateMockLabels = (count: number): GitHubLabel[] => {
  if (count <= 0) return []
  return Array.from({ length: count }, createMockLabel)
}
```

**Key faker methods used:**
- `faker.system.semver()` — realistic semver like `1.2.3`
- `faker.git.commitSha()` — 40-character git hash
- `faker.helpers.arrayElement(arr)` — random pick from array
- `faker.string.hexadecimal({ length: 6, prefix: '' })` — color code without `#`
- `faker.datatype.boolean({ probability: 0.2 })` — weighted boolean
- `faker.helpers.maybe(() => ..., { probability: 0.7 })` — optional value with probability

---

## 6. Prisma Schema & SQL Triggers

### Core Data Model: Item + Facets

The system uses a **central `Item` model** with optional facets for type-specific data:

```
Item (common: name, size, path, ownerId, workspaceId, driveId, createdAt, updatedAt)
  ├── File      (mimeType, hash, extension, bucket, key)
  ├── Folder    (childCount, inclusiveChildCount)
  ├── Image     (width, height, camera model, etc.)
  ├── Video     (duration, resolution, etc.)
  ├── Audio     (bitrate, duration, artist, etc.)
  └── Photo     (EXIF: GPS, exposure, etc.)
```

Each `Item` has a record in exactly one facet table, linked by `itemId`. This avoids a single bloated table with hundreds of optional columns.

**Key Item features:**
- **Folder hierarchy:** Self-referencing `parentId` / `children` for nested folder tree
- **Locking system:** `LockedItem` prevents concurrent editing
- **Performance:** Numerous `@@index` on `type`, `name`, `workspaceId`, etc.

### Automatic Child Count — SQL Trigger

A PostgreSQL trigger automatically maintains the `Folder.childCount` field:

```sql
CREATE OR REPLACE FUNCTION update_child_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."parentId" IS NOT NULL THEN
      UPDATE "Folder" SET "childCount" = "childCount" - 1
      WHERE "itemId" = OLD."parentId";
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."parentId" IS NOT NULL THEN
      UPDATE "Folder" SET "childCount" = "childCount" + 1
      WHERE "itemId" = NEW."parentId";
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
      IF OLD."parentId" IS NOT NULL THEN
        UPDATE "Folder" SET "childCount" = "childCount" - 1
        WHERE "itemId" = OLD."parentId";
      END IF;
      IF NEW."parentId" IS NOT NULL THEN
        UPDATE "Folder" SET "childCount" = "childCount" + 1
        WHERE "itemId" = NEW."parentId";
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_child_count_insert AFTER INSERT ON "Item" FOR EACH ROW EXECUTE FUNCTION update_child_count();
CREATE TRIGGER item_child_count_update AFTER UPDATE ON "Item" FOR EACH ROW EXECUTE FUNCTION update_child_count();
CREATE TRIGGER item_child_count_delete AFTER DELETE ON "Item" FOR EACH ROW EXECUTE FUNCTION update_child_count();
```

**How it works:**
- `INSERT` with non-null `parentId` → increments parent's `childCount`
- `DELETE` → decrements parent's `childCount`
- `UPDATE` where `parentId` changes (item moved) → decrements old parent, increments new parent
- `IS DISTINCT FROM` correctly handles moves to/from root level (`parentId = NULL`)

**Why a trigger:** Moves data integrity responsibility from application code to the database, ensuring `childCount` can never be incorrect regardless of how the data is modified.

**Example result after creating a folder with 2 children:**

```
Item table:
  "folder-123" | "My Documents" | folder | null
  "file-abc"   | "report.docx"  | file   | "folder-123"
  "file-xyz"   | "notes.txt"    | file   | "folder-123"

Folder table:
  "folder-123" | childCount: 2  ← automatically maintained by trigger
```

---

## 7. `searchFactory` — One-Liner Repository Search Binding

> ⚠️ **Note:** This content was captured from an earlier AI conversation and may not reflect the current codebase. Review and verify against actual code before using.

A `searchFactory` helper that binds a Prisma delegate, a filter builder, default include, and default orderBy into a single reusable search function — reducing each repository's `search*` method to a one-liner.

### utils/searchFactory.ts

```ts
import { runSearch } from './queryHelpers'

export function searchFactory<
  TModel,
  TWhereInput,
  TOrderBy,
  TInclude,
  TParams
>(
  dbDelegate: { findMany: Function; count: Function },
  buildFilters: (params: TParams) => TWhereInput,
  defaultInclude: TInclude,
  defaultOrderBy: (params: TParams) => TOrderBy
) {
  return (
    options: TParams & {
      page?: number
      pageSize?: number
      cursor?: string
      limit?: number
      batchSize?: number
      orderBy?: TOrderBy
      maxNoPaginationLimit?: number
      stream?: boolean
    }
  ) => {
    const where = buildFilters(options)
    const orderBy = options.orderBy ?? defaultOrderBy(options)
    return runSearch<TModel, TWhereInput, TOrderBy, TInclude>(
      dbDelegate,
      { where, orderBy, include: defaultInclude, ...options }
    )
  }
}
```

### workspaceMemberRepository usage

```ts
const defaultInclude = { member: true, workspace: true }
const defaultOrderBy = (params: z.infer<typeof workspaceMemberFilterSchema>) =>
  params.workspaceId ? { member: { name: 'asc' } } : { workspace: { name: 'asc' } }

export const searchMembers = searchFactory<
  Prisma.WorkspaceMemberGetPayload<{ include: typeof defaultInclude }>,
  Prisma.WorkspaceMemberWhereInput,
  Prisma.WorkspaceMemberOrderByWithRelationInput,
  typeof defaultInclude,
  z.infer<typeof workspaceMemberFilterSchema>
>(prisma.workspaceMember, buildWorkspaceMemberFilters, defaultInclude, defaultOrderBy)

// Repository method becomes:
async searchMembers(options) {
  return searchMembers(options)
}
```

### itemRepository usage

```ts
const defaultInclude = { workspace: true, owner: true }
const defaultOrderBy = (params: z.infer<typeof itemFilterSchema>) =>
  params.workspaceId ? { createdAt: 'desc' } : { name: 'asc' }

export const searchItems = searchFactory<
  Prisma.ItemGetPayload<{ include: typeof defaultInclude }>,
  Prisma.ItemWhereInput,
  Prisma.ItemOrderByWithRelationInput,
  typeof defaultInclude,
  z.infer<typeof itemFilterSchema>
>(prisma.item, buildItemFilters, defaultInclude, defaultOrderBy)
```

---

## 8. Repository Starter Template

> ⚠️ **Note:** This content was captured from an earlier AI conversation and may not reflect the current codebase. Review and verify against actual code before using.

Template for scaffolding a new repository with the full type-safe filter + search stack.

### model.filters.ts

```ts
import { z } from 'zod'
import { Prisma } from '@/prisma/client'
import { createFilterFactory, buildFiltersFactory } from '@/utils/filters'

export const modelFilterSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().optional()
})

const createModelFilter = createFilterFactory<
  Prisma.ModelWhereInput,
  z.infer<typeof modelFilterSchema>
>()

export const modelFilters = {
  workspaceId: createModelFilter(z.string().uuid(), (workspaceId) => ({ workspaceId })),
  ownerId: createModelFilter(z.string().uuid(), (ownerId) => ({ ownerId })),
  search: createModelFilter(z.string().min(1), (search, params) => {
    if (params.workspaceId) {
      return {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      }
    }
    return {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { workspace: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }
  })
}

export const buildModelFilters = buildFiltersFactory({
  filters: modelFilters,
  schema: modelFilterSchema
})
```

### modelRepository.ts

```ts
import { Prisma } from '@/prisma/client'
import { buildModelFilters, modelFilterSchema } from './model.filters'
import { searchFactory } from '@/utils/searchFactory'
import { z } from 'zod'

const defaultInclude = { workspace: true, owner: true }
const defaultOrderBy = (params: z.infer<typeof modelFilterSchema>) =>
  params.workspaceId ? { createdAt: 'desc' } : { name: 'asc' }

const searchModels = searchFactory<
  Prisma.ModelGetPayload<{ include: typeof defaultInclude }>,
  Prisma.ModelWhereInput,
  Prisma.ModelOrderByWithRelationInput,
  typeof defaultInclude,
  z.infer<typeof modelFilterSchema>
>(prisma.model, buildModelFilters, defaultInclude, defaultOrderBy)

export class ModelRepository {
  async search(options: z.infer<typeof modelFilterSchema> & {
    page?: number; pageSize?: number; cursor?: string; limit?: number
    batchSize?: number; orderBy?: Prisma.ModelOrderByWithRelationInput
    maxNoPaginationLimit?: number; stream?: boolean
  }) {
    return searchModels(options)
  }
}
```

### Pattern summary

| Layer | File | Responsibility |
|---|---|---|
| Schema | `model.filters.ts` | Zod schema + typed filter definitions |
| Builder | `model.filters.ts` | `buildModelFilters` — composes `where` clause |
| Helper | `utils/searchFactory.ts` | Binds delegate + filters + defaults |
| Repository | `modelRepository.ts` | One-liner `search` method |
