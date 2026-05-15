# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Style

- Act first, explain second. When the user asks for commits, edits, or a PR, DO the work — don't produce plans or commit messages without executing.
- Avoid over-reading / over-exploring. Make the change, then verify.
- If blocked by auth (e.g., `gh` GITHUB_TOKEN), surface it immediately rather than retrying silently.
- Avoid over-engineering. Start with the simplest query or approach that works; do not reach for recursive CTEs, abstractions, or sub-agents when a direct edit will do.

## Core Rules

When I ask you to do something, DO IT immediately. Don't over-explain, don't read extra files, don't write specs or plans unless I ask. Act first, explain only if needed.

If I interrupt you, stop immediately and wait for my next instruction. Don't restart from scratch — continue from where you left off unless told otherwise.

## Git Workflow

When committing, actually run `git add` and `git commit` — don't just generate commit messages or describe what you would commit.

Set GITHUB_TOKEN properly before using `gh` CLI. If gh auth fails, ask the user to run `gh auth login` interactively rather than retrying with env vars.

## Development

This is a TypeScript project. Always use TypeScript for new files. Run `pnpm run build` or type-check after significant edits to catch errors early.

## General Instructions

Prefer action over exploration. When the user gives a clear task, execute it immediately rather than exploring the codebase or explaining the approach first.

If you need to choose between approaches, pick the simplest one. Do not modify files outside of app/ unless I say so.

## Project Structure

This is a TypeScript project. When moving or reorganizing files, always update all import paths across the codebase and verify with `tsc --noEmit` or the project's build command after changes.

## Commands

```bash
pnpm dev          # Start dev server (Express + Vite HMR), available at http://localhost:3000 — kill any existing process on :3000 first
pnpm build        # Build for production
pnpm start        # Run production server
pnpm typecheck    # Generate React Router types + run tsc
pnpm format       # Format with Prettier
pnpm test         # Run unit tests once (app/utils/__tests__/)
pnpm test:watch   # Run unit tests in watch mode
pnpm prisma migrate dev   # Run database migrations
pnpm test:e2e     # Run E2E tests (requires dev server)
pnpm test:e2e:ui  # Run E2E tests with Playwright UI
```

## Architecture

Stashly is a **full-stack file management platform** using React Router 7 in framework mode (SSR). The server is Express 5, database is PostgreSQL via Prisma ORM, and complex UI state is managed with XState 5.

### Layer Responsibilities

| Layer | Location | Purpose |
|-------|----------|---------|
| Routes | `app/routes/` | UI components + loaders/actions (data fetching and mutations) |
| API Routes | `app/routes/api/` | Resource routes acting as REST endpoints |
| Actions | `app/.server/*-actions.ts` | Business logic + direct Prisma access, permission enforcement (e.g. `item-actions.ts`, `collection-actions.ts`) |
| Machines | `app/machines/` | XState state machines for complex async workflows |
| Workers | `app/workers/` | Web Workers for CPU-intensive tasks (AI inference, tokenization) |
| Client-only | `app/.client/` | Browser-only code excluded from SSR (auth client, AI client) |
| Schemas | `app/schemas/` | Zod validation schemas shared across client and server |
| Types | `app/types/` | Shared TypeScript type definitions (API types, machine types) |

### Key Conventions

**Server-only code**: Anything in `app/.server/` is excluded from the client bundle. Use this for database access, secrets, and heavy server logic.

**Authentication**: Route `loader` functions check sessions and redirect unauthenticated users:
```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  return { user: session.user }
}
```

**Actions pattern**: Business logic lives in `app/.server/*-actions.ts` files (e.g. `item-actions.ts`, `collection-actions.ts`). These export plain functions that call Prisma directly and enforce permissions inline. Route loaders/actions call these functions — never call `prisma` directly from routes.

```typescript
// In a route loader/action:
import { getCollectionForUser } from '@/services/collection-actions'
const collection = await getCollectionForUser(session.user.id, collectionId)
```

**API errors**: Use `ApiError` and `ApiErrorCode` from `app/.server/api.errors.ts` for consistent error responses in action files. **Do not import this in route files** — the dot-server plugin rejects `@/services/*` imports in `app/routes/`. In route action handlers, duck-type the error: `const err = e as { statusCode?: number; message?: string }`.

**Dot-server plugin**: React Router's dot-server plugin blocks `@/services/*` path-alias imports inside `app/routes/` files (it rejects them as server-only leaks). Keep server-only logic entirely in action/loader functions that import from `.server/` via relative paths. **Never use the `@/services/` alias in a route file.**

### Upload Architecture (XState)

The upload system uses a parent-child actor pattern:
- `upload/upload.machine.ts` — parent, spawns one `file.machine` per file, manages the queue
- `upload/file.machine.ts` — active upload actor: creates multipart upload, uploads chunks in parallel, verifies ETags
- `reviset/file.machine.ts` — legacy reviset actor (still present; `upload/file.machine.ts` is the active path)
- `actors/queue.machine.ts` — controls concurrent upload slots
- `actors/quota.machine.ts` — tracks and enforces storage quota
- `actors/multipart.machine.ts` — multipart S3 coordination actor

Files upload via S3 multipart: frontend → `/api/s3/upload` → uploads directly to S3 bucket. **The `/api/s3/upload` route uses JSON body (`request.json()`) with an `action` discriminator — not form-encoded.**

**Item creation gate**: The thumbnail pipeline and `POST /api/items` must NOT fire on `status === 'done'` (S3 done, but DB row not yet written). Wait for `status === 'itemCreated'` — set by `markAsItemCreated` action in `upload.machine.ts` after `upload.createItem.success`. Firing on `'done'` causes FK violations on `Thumbnail.itemId`.

**`parentId` derivation**: `mediaFile.key.split('/')[0]` — the first segment of the S3 key is always the destination folder ID. Exception: directory drops get `parentId = rootId` (nested folders are not created — known gap).

**Post-upload pagination reset**: After `itemCreated`, call `navigate(location.pathname + location.search, { replace: true, state: { reset: true } })` to trigger `usePagination`'s reset detection. Do NOT use `useRevalidator` — it doesn't update `usePagination`.

### AI Machines

`app/machines/ai/` contains two actors:
- `ai.machine.ts` — coordinates AI inference jobs
- `caption.machine.ts` — generates captions for media items

AI API routes live under the `/api/ai/` prefix (see `app/routes.ts`).

### Web Workers

CPU-intensive work runs off the main thread in `app/workers/`. Current workers:

- `stash.worker.ts` — language detection and tokenization for stash items
- `stash.ai.ts` — AI inference helpers for the stash worker
- `thumbnail.ai.ts` — thumbnail generation AI worker

Workers are loaded via `new Worker(new URL('./workers/...', import.meta.url))`. Type augmentations for third-party worker APIs live in `app/types/tokenizers-augment.d.ts`.

### Schemas and Types

- `app/schemas/` — Zod schemas for validating API request/response payloads (`api.schemas.ts`), XState machine events (`machine.schemas.ts`), and repository filter shapes (`filters.schemas.ts`). Import with `@/schemas/*`.
- `app/types/` — Shared TypeScript types for API contracts (`api.types.ts`), machine actor payloads (`machine.types.ts`, `upload-actors.types.ts`), and global augmentations (`react.d.ts`). Import with `@/types/*`.

Keep Zod schemas and derived TypeScript types co-located: define the Zod schema in `app/schemas/`, then infer and export the TS type from the same file or a parallel file in `app/types/`.

**Temp schema files**: `app/schemas/_temp_a.schemas.ts`, `_temp_b.schemas.ts`, `_temp_c.schemas.ts` contain valid schemas for comments/versions, users/notifications/settings, and members/subscription respectively. These are not yet merged into `api.schemas.ts`. Add new schemas to `api.schemas.ts` directly — do not extend the `_temp_*` files.

### Routing Structure

Routes are defined centrally in `app/routes.ts` using `prefix`, `layout`, and `route` helpers. The main layout (`app/routes/layout.tsx`) wraps all authenticated app routes.

URL pattern: `/:me/stash/*` for personal stash, `/:me/workspaces/:workspaceId/*` for collaborative workspaces.

### Path Aliases (tsconfig)

```
@/*            → app/*
@/db/*         → app/.server/db
@/prisma/*     → app/prisma/*
@/utils/*      → app/utils/*
@/components/* → app/components/*
@/ui/*         → app/components/ui/*
@/hooks/*      → app/hooks/*
@/services/*   → app/.server/*
@/machines/*   → app/machines/*
@/schemas/*    → app/schemas/*
@/workers/*    → app/workers/*
```

### UI Components

Components use shadcn/ui (source-owned, in `app/components/ui/`) built on Radix UI primitives, styled with TailwindCSS 4. Use `cn()` from `@/utils/styles` for conditional classNames.

### UI Conventions

**Icons**: All icons live in `app/components/icons.tsx`. Always grep it before using any icon. **Do NOT use `lucide-react` directly** — if a needed icon is missing from `icons.tsx`, stop and notify the user so they can add it first.

**Custom components**: Reusable UI components go in `app/components/core-components/`. Route-level views go in `app/components/views/`.

**Destructive actions**: Use the `useConfirm` hook from `@/hooks/useConfirm` — never inline alert dialogs or `window.confirm`.

**Dialog + Dropdown composition**: To open a dialog from a dropdown item, wrap the item with `DialogTrigger asChild` and call `onSelect={(e) => e.preventDefault()}` to prevent the menu closing before the dialog opens. Don't lift open/close state into the parent as props.

**Dropdowns inside clickable cards**: Always use `modal={false}` on `DropdownMenu` and `e.stopPropagation()` on the trigger to prevent card navigation firing.

**Portal event bubbling in clickable cards**: React portals (dialogs, dropdowns) bubble events through the fiber tree even when not DOM descendants. Do NOT add `stopPropagation` inside `DialogContent`. Instead, guard the card's click handler: `if (!e.currentTarget.contains(e.target as Node)) return` — this silently ignores clicks that originate from any portal overlaying the card.

**`formatSize` signature**: Three args — `formatSize('byte', 'unit', Number(value))`.

**Type-safe navigation**: Use `href()` from `react-router` for route links: `href('/:me/stash/collections/:collectionId', { me, collectionId })`.

**`paginateItems`**: Use this from `@/services/item-actions` in loaders when fetching paginated item lists; supports `include`, `where`, `cursor`, `limit`.

**Pagination**: All paginated routes use `usePagination<T>(limit)` from `@/hooks/usePagination`. The loader returns `{ items, nextCursor, hasMore }`. The hook reads initial data from `useLoaderData` and appends pages via URL search params.

**Dialog data loading**: For dialogs that load data on-demand (not at route load time), use `fetcher.load('/api/route?param=x')` inside a `useEffect` triggered by the dialog's `open` state. Use **two separate fetchers** when a component both reads and mutates — one for `fetcher.load()`, one for `fetcher.submit()`.

**Multi-select grids**: Wrap item grids with `<SelectionProvider items={items.map(i => i.id)}>` from `@/components/stash/selection` to enable shift-click range selection and `useSelection()` in child checkboxes.

**Design exploration files**: `option-*.css` and `options/` directories in `app/styles/` are design experiments — never import them in production code and never commit them.

**Header vs Toolbar**: `app-header.tsx` — sticky top bar with upload, filters, layout toggle. `app-toolbar.tsx` — sticky bottom bar with breadcrumbs and bulk-action buttons (restore/trash/delete/favorite). Both use `useParams()` and `useSearchParams()` for conditional rendering.

**`DataTable` styling**: Accepts a `className` prop applied to the `<Table>` element — use it for background/border/rounding (e.g. `className="bg-card rounded-md"`).

**`DataTable` with `ItemCard` actions**: To use `ItemCard.Actions` inside a `DataTable` row, create a wrapper component that provides `ItemCardContext.Provider` (with `useRouteLoaderData` + `useSearchParams`) and pass it to the `actions` prop: `actions={(item) => <ListRowActions item={item} />}`.

**`ItemCard.Thumbnail` is Avatar-style**: Wraps Radix `AvatarPrimitive`. Self-closing `<ItemCard.Thumbnail />` defaults to `ThumbnailImage` + `ThumbnailFallback`. For explicit control compose them: `<ItemCard.Thumbnail><ItemCard.ThumbnailImage /><ItemCard.ThumbnailFallback className="…" /></ItemCard.Thumbnail>`. Real thumbnails have URLs **not** starting with `#` — stage-0 color hashes are placeholders.

**`StashPickerItem` → `ItemCard` adapter**: To render a picker shape through `ItemCard`, fill defaults: `status: 'normal'`, `inclusiveSize: item.size`, `parentId: null`, `ownerId: ''`, `workspaceId: null`, `driveId: ''`, `updatedAt: null`, `tags: []`, `favorites: []`, `file: null`, `folder: null`. Map `thumbnailUrl` → `thumbnails: [{ id, url, width: null, height: null, size: 'medium', view: 'grid' }]`.

**`ItemStatus` values**: `'normal' | 'archived' | 'trashed' | 'locked' | 'shared'` — there is no `'active'`.

**Surface layering**: chrome (headers, toolbars, dialog top/bottom) uses `bg-sidebar`; canvas (content, item grids) uses `bg-background`. App-header pattern: `h-14`, outline buttons with `bg-card!`. App-toolbar pattern: `h-12 p-2` sticky bottom.

**Border color**: structural separators (`border-b`/`border-t` between regions) always use `border-input` — never the default `border` token.

**`Card` component pattern**: Always override Card defaults — never use a bare `<Card>` without explicit classes. Full pattern: `<Card className="border border-input rounded-md surface-glass bg-card p-0 overflow-hidden">`. `CardHeader`: `flex items-baseline px-4 py-4`. `CardTitle`: `text-sm uppercase font-stashly`. `CardDescription`: `text-sm text-muted-foreground`. `CardContent`: `p-4`.

**Inline icons in tables/lists**: Use `size-5` — matches the standard icon scale used in `DataTable` cells and list rows. Don't override icon color unless intentional (they inherit `text-current`).

**Section/card headers**: Label text uses `text-sm uppercase font-stashly`; secondary descriptor (count, subtitle) uses `text-sm text-muted-foreground` via `CardDescription` or a `<span>`. Keep them on the same baseline row with `flex items-baseline gap-3`.

**`font-stashly`**: Apply to all data-display components (cards, tables, lists, KPI strips). It is the app's monospaced/display font — use it consistently, not just on headings.

**Search inputs use `InputGroup`**: import `InputGroup` + `InputGroupAddon` + `InputGroupInput` from `@/ui/input-group`. Don't roll your own input with an absolutely-positioned search icon — mirror the `filters.tsx` pattern.

**`ButtonGroup` is for related secondary actions only**: never fuse a primary submit button with a secondary action in a `ButtonGroup` — primary actions stand alone.

**Toggle/segmented control styling**: For filter rows or segmented controls, mirror `LayoutMenu`/`LayoutMenuItem` from `app/components/ui/layout-menu.tsx` — container `max-w-max rounded`, items `bg-card text-foreground hover:bg-muted aria-checked:bg-muted! aria-checked:text-accent-foreground first-of-type:rounded-l-md last-of-type:rounded-r-md`. Don't roll your own `ToggleGroup` styling.

**No sub-`text-xs` sizes**: never use arbitrary text sizes like `text-[10px]` / `text-[11px]`. `text-xs` is the smallest allowed scale value.

**AA contrast on fixed-color backgrounds**: when text sits on a fixed gradient or color (e.g. `from-black/90` overlays), use literal `text-white` / `text-white/80` — `text-foreground` and `text-muted-foreground` invert per theme and break contrast in the opposite scheme.

**Hooks location**: All hooks go in `app/hooks/` — never co-locate them inside `app/components/` subdirectories, even if tightly coupled to one component family.

**Filter system layout**: `app/components/filters/` contains `filter.types.ts` (all types), `filter.data.ts` (CATEGORIES/STATUSES/TYPES/FLAGS + URL constants), `filter-primitives.tsx` (Chip/Kbd/DashedDiv), `sort-pill.tsx` (SortPill), and `filters.tsx` (Filters + HeaderFilters). `useFilters` hook lives in `app/hooks/useFilters.ts`.

**`JSX` namespace**: Always `import type { JSX } from 'react'` when a file uses `JSX.Element` in type annotations — the namespace is not globally available in this project.

### Prisma Schema

Models are split across `prisma/models/*.prisma` files and merged. Generated client outputs to `app/prisma/`. Core models: `User`, `Workspace`, `Item`, `Collection`, `Permission`, `Comment`.

**Collection size is DB-managed**: Two Postgres triggers (`collection_size_trigger` on `CollectionMember`, `item_size_collection_sync_trigger` on `Item`) automatically maintain `Item.size` for collections. Never add manual size arithmetic back to `collection-actions.ts` — `addItemToCollection`, `removeItemFromCollection`, etc. do NOT need to update size.

**Nullable relation filtering**: To filter on fields inside a nullable relation, use `relation: { is: { field: value } }` — **not** `relation: { isNot: null, field: value }`. Prisma's TS types reject field filters alongside `isNot`.

**`orderBy` one-field-per-object rule**: `ItemOrderByWithRelationInput` allows exactly one relation field per object. Never merge two relation sorts into one object — Prisma throws at runtime. Use an array: `[{ folder: { childCount: 'asc' } }, { collectionItems: { _count: 'asc' } }]`.

**Relation count sort**: To sort by a relation's count, use `{ relation: { _count: 'asc' } }` (underscore required — `count` without it throws `Unknown argument`). Example: `{ collectionItems: { _count: 'desc' } }`.

**Sort URL convention**: `?orderBy[col]=dir` → qs parses to `{ orderBy: { col: dir } }`. For nested fields: `?orderBy[folder][childCount]=asc`. For multi-field array orderBy: indexed notation `?orderBy[0][folder][childCount]=asc&orderBy[1][collectionItems][_count]=asc` → qs produces `[{ folder: {...} }, { collectionItems: {...} }]`. `getFolderContent` defensively splits any merged multi-key objects before passing to Prisma.

### Integrations

- **Auth**: `better-auth` configured in `app/.server/auth.ts`, OAuth via GitHub/Google/Microsoft
- **Search**: pgvector + embeddings for full-text and semantic search (`app/.server/search/`)
- **AI features**: Hugging Face transformers, ONNX Runtime, Whisper (speech-to-text).
- **Payments**: Stripe, webhooks handled at `/api/stripe`
- **Storage**: AWS S3-compatible (Tigris on Fly.io), configured in `app/.server/s3.ts`

## Database / SQL

Start with the simplest query that works. Do not use recursive CTEs or over-engineered approaches. Optimize only if there's a demonstrated performance need.

## Prisma Client

- Import Prisma client from `app/prisma/client` — do NOT use the generated client via tsx or any other path.

## Zod Conventions

- Use `z.url()`, `z.email()`, etc. (not deprecated `z.string().url()` syntax)
- Follow project's existing zod schema patterns in `app/schemas/`

## Conventions

- Primary language: TypeScript (strict)
- Use path aliases (e.g. `@/schemas/`, `@/machines/`) for cross-directory imports; use relative imports only within the same directory
- Schema and type definitions go in `app/schemas/` and `app/types/` respectively — do not scatter them across feature files
- Avoid raw `prisma` calls in route loaders — always go through actions files in `app/.server//[feature]-actions.ts`
- Client-only code (browser APIs, client-side state) goes in `app/.client/`; server-only code goes in `app/.server/`

## Testing

### E2E Tests (Playwright)

Tests live in `tests/e2e/`. Run against `http://localhost:3000` (the dev server is auto-started via `webServer` in `playwright.config.ts`).

**Structure:**

| File | Purpose |
|------|---------|
| `global-setup.ts` | Seeds test user + session into DB, writes `tests/e2e/.auth/session.json` |
| `global-teardown.ts` | Cleanup after all tests |
| `fixtures.ts` | Exports an authenticated `test` fixture (loads session cookie from `.auth/`) |
| `pages/*.page.ts` | Page Object Models: `AuthPage`, `LayoutPage`, `StashPage` |
| `auth.spec.ts` | Unauthenticated flows (sign-in, redirects) |
| `navigation.spec.ts` | Authenticated navigation flows |

**Prerequisites:**
- `.env` must have `DATABASE_URL` and `BETTER_AUTH_SECRET`
- A `free` storage plan must exist in the DB (run `pnpm prisma migrate dev` + seed)

**Auth approach:** `global-setup.ts` creates a real DB session and writes a signed `better-auth.session_token` cookie to `tests/e2e/.auth/session.json`. Authenticated specs import `test` from `fixtures.ts`; unauthenticated specs import directly from `@playwright/test`.

The `.auth/` directory and Playwright output dirs (`playwright-report/`, `test-results/`) are git-ignored.

## Development Workflow

Apply this workflow for **significant changes** — new features, new routes/services/repositories, behaviour changes, schema migrations, or anything that meaningfully affects how the app works.

**Skip it for small changes** like renaming a CSS class, tweaking a layout, fixing a TypeScript type, adjusting a label, or other minor cosmetic/trivial fixes. Those can go straight to a single commit on main.

For significant changes, follow these steps:

1. **Tests** — Add or update tests:
   - Unit tests (Vitest, in `app/utils/__tests__/`) for logic, utilities, and service functions
   - E2E tests (Playwright, in `tests/e2e/`) if the change affects user-facing flows or routes

2. **Docs** — Update `CLAUDE.md` and/or `README.md` if the change affects architecture, commands, conventions, or the E2E setup

3. **Commit** — Detailed message with a conventional prefix (`feat:`, `fix:`, `refactor:`, etc.) and a body explaining the *why*

4. **PR** — Descriptive title and body (summary + test plan)

5. **Merge** — Merge to `main` once the PR is clean

## New Feature Checklist

When adding a new feature, these steps are **mandatory** in order:

1. **Actions file** — Create `app/.server/[feature]-actions.ts` with all business logic. Plain exported functions, no classes, pass context as params.
2. **API route** — Create `app/routes/api/[feature].ts` using `parseFormData` / `parseSearchParams` for all request parsing. Never access `request` fields manually.
3. **Zod schemas** — Add request/response schemas to `app/schemas/api.schemas.ts`. Use discriminated unions on `intent` for action routes.
4. **UI placement** — Reusable components go in `app/components/core-components/`. Route-level views go in `app/components/views/`. Never scatter feature UI into ad-hoc locations.
5. **Types** — Add shared TypeScript types to `app/types/stash.types.ts`. Infer from Zod schemas where possible.
6. **Custom hooks** — Name hooks `use[Feature][Noun]` (e.g. `useShareLinks`, `useShareDialog`). Place in `app/hooks/`.
7. **Tests** — Add E2E tests in `tests/e2e/` for user-facing flows. Add unit tests in `app/utils/__tests__/` for service logic.

**Notes:**
- Use `usePagination<T>(limit)` for any route that returns a list of items — never build ad-hoc pagination.
- No arbitrary Tailwind sizes: use scale values (`text-sm`, `p-4`) not raw values (`text-[10px]`, `p-[13px]`).
- Check `app/utils/` before creating new utility functions — reuse what exists.
- Use the `/shadcn-ui` skill when building new UI components.

## Activity Recording

**Fire-and-forget pattern**: Use `Promise.resolve().then(() => createActivity({...})).catch(() => {})` — not just `createActivity({...}).catch(() => {})`. Arguments to `createActivity` may throw synchronously (e.g. `toObjectId` when a prefix is missing), which `.catch()` on the returned promise cannot intercept.

**`searchFactory` does not auto-apply `defaultInclude`**: Pass `include` explicitly on every `searchActivities` / `searchItems` call or relations will be omitted from results.

**`StashlyPrefixMap`**: Every new Prisma model that uses `toObjectId(getPrefixForModel('ModelName'))` must have an entry in `app/utils/converters.ts`. Missing entries throw synchronously: `Invalid prefix: must be a non-empty string without an underscore`.

**`Activity.access` include level**: `access: true` belongs at the top-level `Activity` include, not inside `action: { include: { ... } }` (which maps to `ItemAction` — `ItemAction` has no `access` field).

**Item card dropdown**: Actions live in the internal `ItemCardActions` component inside `app/components/stash/item-card.tsx`.

**Pinned items**: `PinItem` is a per-user, per-item join row with a `position` int for manual ordering. Business logic lives in `app/.server/pin-actions.ts`; the resource route is `/api/pins` (POST `intent: pin|unpin|reorder`, GET `intent: list|check`). Pin/Unpin is surfaced in `ItemCard.Actions` via the `usePinItem` hook (`app/hooks/usePinItem.ts`) for optimistic toggling. The pinned page lives at `/:me/stash/pinned`. `StashItem` carries an optional `pins?: StashPin[]` field — populated by `getPinnedItems` and `getFavoritedItems` selects so the dropdown shows the correct initial label.

**`openedAt` tracking**: Any route loader that opens a file, folder, collection, or image must call `touchOpenedAt(itemId)` from `@/services/item-actions` fire-and-forget — `Promise.resolve().then(() => touchOpenedAt(id)).catch(() => {})`. This keeps `openedAt` current for recency/suggested-items features. Current callers: `folder.tsx`, `file.tsx`, `collection.tsx`, `gallery-image.tsx`.

## Gallery Views

**Gallery route structure**: `gallery.tsx` is a parent route; `gallery-image.tsx` is the child (fixed overlay, `z-50`). Both render simultaneously — the gallery stays mounted behind the overlay. Child route closes via `navigate(-1)`.

**Per-item view transition components**: Can't call hooks inside `.map()`, so each gallery layout has its own item component (`GridItem`, `RiverItem`, `WaterfallItem`). Each calls `useViewTransitionState(item.id)` and sets the transition name only when the transition is active — prevents duplicate `viewTransitionName` values while the gallery stays mounted:
```tsx
const isTransitioning = useViewTransitionState(item.id)
style={isTransitioning ? { viewTransitionName: `img-${item.id}` } : undefined}
```
Links use `<Link to={item.id} viewTransition unstable_mask=".">` — `unstable_mask="."` keeps the gallery URL in the address bar.

**`backdrop-blur` on named view-transition elements**: NEVER apply `backdrop-filter: blur` to an element that has a `view-transition-name`. The blur bakes into the rasterized snapshot at capture time — as the old snapshot fades out over live content, it produces a visible ripple/blur artifact. Put `backdrop-blur` on an unnamed parent or sibling; use `bg-black/75` opacity on the named element itself.

**Waterfall layout**: CSS `columns-*` masonry in `app/components/views/waterfall-view.tsx`. Each item uses an id-derived aspect ratio (`aspectFromId`) to vary cell height. The `<img>` element **must keep both `width` and `height` HTML attributes** — removing `height` breaks lazy loading because CSS columns renders items as 0-height boxes that never enter the viewport.

**Seed thumbnail dimensions**: `generateThumbnail` in `prisma/seedData/data.ts` stores dimensions differently per view:
- `waterfall` → fixed `width`, variable `height`
- `river` → variable `width`, fixed `height`
- `grid` → square (equal width and height)

**Theme structure**: `app/styles/globals.css` has **four** theme blocks that must all be updated together: `[data-theme='light']`, `[data-theme='dark']`, and two `[data-theme='system']` blocks (one per `prefers-color-scheme` media query).

## Thumbnail Pipeline

Client-side 5-stage progressive generation. All output is **WebP**. Entry point: `app/hooks/useThumbnail.ts`.

**Gate**: pipeline starts only after `status === 'itemCreated'` (not `'done'`). `useUpload.ts` watches for `itemCreated` and calls `runThumbnail(id, file)`. A module-level `thumbnailedIds = new Set<string>()` (shared across hook instances) ensures the pipeline fires exactly once per file.

| Stage | What | Mechanism |
|-------|------|-----------|
| 0 | Color hash placeholder | `hashToColor(name, type)` → hex stored directly as `url` in DB — no S3 |
| 1 | 8×8 blur preview | Image: `extractTinyThumbnail` · Video: `generateVideoThumbnail` · PDF: `generatePdfThumbnail` (from `@/utils/pdf`) — **local `URL.createObjectURL` only, NOT persisted to S3 or DB** |
| 2 | 512px resize | Image: `canvasResize(file, 512)` · Video: re-encode frame · PDF: `renderPdfPageToBlob(file, 512)` → presign → PUT to S3, URL written as `${publicUrl}?v=2` |
| 3 | ViT saliency crop | AI worker (`thumbnail.ai.ts`) — **images only**, URL written as `${publicUrl}?v=3` |
| 4 | Florence-2 caption overlay | AI worker — **images only**, URL written as `${publicUrl}?v=4` |

**Cache-bust query param**: stages 2/3/4 share the same S3 key, so the URL written to `Thumbnail.url` includes `?v={stage}`. Without this, browser cache (`Cache-Control: max-age=3600` on the S3 object) keeps showing the prior stage even after the object is overwritten.

**S3 client config**: `app/.server/s3.ts` sets `requestChecksumCalculation: 'WHEN_REQUIRED'` on `S3Client`. Without this, AWS SDK v3 signs a CRC32 checksum requirement (`x-amz-checksum-crc32=AAAAAA==`, CRC32 of empty body) into presigned `PutObject` URLs, causing browser PUTs to fail with a checksum mismatch.

PDFs stop after stage 2. The PDF.js worker URL is set globally on import in `app/utils/pdf.ts` via `pdfjs-dist/build/pdf.worker.min.mjs?url`.

**Compute worker**: heavy thumbnail compute (PDF.js parsing, canvas resize, image decoding, PDF text extraction) runs in a singleton dedicated worker at `app/workers/thumbnail.compute.worker.ts` with an internal concurrency cap of **1** and a 30-second per-op timeout. `useThumbnail.ts` is a thin orchestrator that dispatches RPC requests via `compute({ kind, file })` and handles HTTP + React state on main. Video thumbnails stay on main because they require `<video>` DOM access. Stages 3 and 4 (image AI) also stay on main — they call into `app/workers/thumbnail.ai.ts`, which is a regular module using WebGPU (not a Worker — the file location is historical).

The cap is 1 because PDF.js inside a dedicated worker falls back to **fake worker mode** (it can't spawn a sub-worker reliably from inside another worker). In fake-worker mode, multiple concurrent PDF operations terminate each other's tasks ("Worker task was terminated" warnings) — serializing is safer than the throughput win.

**OffscreenCanvas**: `app/utils/thumbnail.ts` and `app/utils/pdf.ts` use `OffscreenCanvas` rather than `document.createElement('canvas')` so they work in both main and worker contexts. `extractTinyThumbnail` and `generatePdfThumbnail` return `Blob` (not data URL).

**PDF.js `OffscreenCanvasFactory`**: passing our own `OffscreenCanvas` as the *target* of `page.render()` is not enough — PDF.js's default `DOMCanvasFactory` calls `document.createElement('canvas')` for **internal auxiliary canvases** (subpixel-AA font detection, intermediate image-scaling buffers). In a worker, `document` is undefined and rendering crashes silently with `Cannot read properties of undefined (reading 'createElement')`. `app/utils/pdf.ts` defines a custom `OffscreenCanvasFactory` (`{ create, reset, destroy }`) and passes it via `getDocument({ CanvasFactory: OffscreenCanvasFactory })` only when `typeof document === 'undefined'`. In a normal page context the default `DOMCanvasFactory` is used. Without this, simple PDFs render fine but anything with text + AA or images blows up — the user-visible symptom was "stage 0 only".

**PDF.js verbosity**: `pdfjs.getDocument(...)` calls pass `verbosity: 0` (errors only) to silence the high-frequency `"Worker task was terminated"` warnings PDF.js emits on every `doc.destroy()` in fake-worker mode. They are non-fatal (PDF.js logs them with "ignoring errors") but spam the console.

**Presign → PUT → PATCH pattern** (stages 1–4):
1. `GET /api/thumbnails/:itemId/presign` → `{ uploadUrl, publicUrl }`
2. `PUT blob` to S3 `uploadUrl` with `Content-Type: image/webp`
3. `PATCH /api/thumbnails/:itemId` with `{ stage, url, width, height }`

**S3 key**: `thumbnails/{itemId}.webp` — one file per item, overwritten as stages improve. `publicUrl = https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp`.

**Gallery query** — always exclude hex-color stage-0 placeholders from both the item filter and the thumbnail select:
```typescript
// where (items must have a real thumbnail)
thumbnails: { some: { url: { not: null }, NOT: { url: { startsWith: '#' } } } }
// select (best thumbnail per item)
thumbnails: { take: 1, where: { NOT: { url: { startsWith: '#' } } } }
```

**Thumbnail utils** (`app/utils/thumbnail.ts`): `hashToColor`, `extractTinyThumbnail`, `canvasResize`, `dataUrlToBlob`. For video thumbnails: `generateVideoThumbnail(file)` from `app/utils/video.ts`.

## Workflows

### Agent/Subagent Creation

When creating new agents or subagents, define the agent's purpose, inputs, outputs, and dependencies in a markdown spec before writing code.

