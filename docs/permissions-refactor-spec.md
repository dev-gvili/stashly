# Permissions & Scope Refactor — Spec

**Status:** awaiting approval · **Date:** 2026-09-10
**Baseline commit:** `555de94` (tag `pre-workspace-links`)

> **Binding scope.** I will not modify any file outside the manifest in §8.
> Anything discovered mid-refactor that needs a file outside that list stops the
> work and comes back here as an amendment.

---

## 1. What is already proven

Three facts established by measurement, not inference:

| # | Fact | Evidence |
|---|------|----------|
| **P1** | The folder loader's resolved `where` clause contains **no** owner, permission, or workspace constraint — only `parentId`, `status`, `type`. | Ran the loader's exact filter construction and printed the result: `mentions ownerId? false` |
| **P2** | `currentUserId` is set by the loader but **silently dropped**. Its filter is commented out at `item.filters.ts:211`, and `buildFiltersFactory` applies a param only `if (key in filters)` (`app/utils/filters.ts:127-132`). | Same run |
| **P3** | `workspaceId` is **also** silently dropped: the schema key is `workspaceId` (`item.filters.ts:28`) but the filters-map key is `workspace` (`:118`). No caller sets either param today, so the filter is entirely dead. | grep: zero `set('workspace…')` call sites |

**Consequence:** any signed-in user who knows a folder id can list its children
via `/:me/stash/folders/:folderId`. `params.me` is never compared to the session
user. Pre-existing; it is the root cause this refactor addresses.

P2 and P3 are the same defect class: **a filter key that does not resolve fails
open, and silently.** §6 makes that class impossible to reintroduce.

---

## 2. Non-goals

- No change to `app/utils/filters.ts` (`buildFiltersFactory`) — explicitly fenced.
- No Prisma schema change, no migration, no DB mutation.
- No repointing of further workspace routes (that is the separate step-3 rollout).
- No new npm dependency.
- No change to `app/routes/api/**`.

---

## 3. Item 1 — assert `:me === session.user.id` on all UI routes

**Problem.** 37 UI route loaders exist; none compares `params.me` to the session.
Editing 37 loaders is both large and fail-open — a new route forgets the check.

**Approach.** One enforcement point. React Router 8.0.1 has stable route
`middleware`, which runs *before* child loaders — unlike a parent loader, which
runs in parallel with children and so cannot prevent a child's DB query from
executing. No middleware exists in the repo today.

`app/routes/layout.tsx` already wraps every authenticated route (`:me/stash`,
`:me/workspaces`, `:me/settings`) per `routes.ts:146`.

**Change.** Add a `middleware` export to `app/routes/layout.tsx` that:

- resolves the session once; redirects to `/auth/sign-in` when absent;
- throws 403 if `params.me` is present and `!== session.user.id`;
- puts the session on the middleware context so `layout.tsx`'s loader reads it
  instead of calling `getSession` a second time.

`params.me` is absent on `routes/index.tsx`, `auth/*` and `not-found` (they sit
outside the `:me` prefix), so the guard is conditional and those are unaffected.

**Phase A (this refactor):** middleware asserts `:me` and shares the session with
`layout.tsx`'s own loader only. Child loaders keep their existing `getSession`
calls untouched — removing 37 redundant lookups is a follow-up, not this change.

### 3.1 Middleware verified against the installed package

Checked in `node_modules`, not assumed from docs:

| Check | Result |
|---|---|
| `react-router` version | **8.0.1** |
| `createContext` runtime export | present (`typeof === 'function'`) |
| `RouterContextProvider` runtime export | present (`typeof === 'function'`) |
| `unstable_` prefix on either | **no** — both stable in v8 |
| Future flag required | **none**; `react-router.config.ts` needs no change |
| `Route.MiddlewareFunction` in typegen | already emitted for `layout.tsx` (`+types/layout.ts:37`), plus `ClientMiddlewareFunction` (`:40`) |
| Existing `getLoadContext` / `AppLoadContext` consumers | **none** — `server/app.ts:6` declares an empty interface and `getLoadContext()` is commented out at `:16` |

Semantics that decide the design (from the RR docs, consistent with the above):

- Export shape is an **array**: `export const middleware: Route.MiddlewareFunction[] = [...]`.
- Signature `async ({ request, params, context }, next) => {}`.
- Runs **parent → child on the way down, before any loader**, then unwinds after
  the response. This is precisely why it beats a parent loader: sibling/child
  loaders run in parallel with a parent loader, so a parent loader cannot stop a
  child's DB query from executing.
- `throw redirect(...)` or returning a `Response` short-circuits without calling
  `next()`; if neither happens, `next()` is invoked automatically.
- Values move to loaders via `context.set(ctx, v)` / `context.get(ctx)`, where
  `ctx = createContext<T>(defaultValue?)`. Reading an unset context **throws**
  unless a default was supplied — so the session context will be created with a
  `null` default and narrowed in the loader.

**Conclusion:** the middleware path is available, typed, and carries no migration
risk from existing context consumers. The Q3 fallback stays approved but is not
expected to be exercised; if it is, that gets called out in the report.

---

## 4. Items 2 + 3 — permission checks move into action functions

**Pattern to follow — already in this codebase.** `collection-actions.ts` does
exactly this: `assertItemPermission(userId, collectionId, 'write')` at the top of
each exported action (`:386, :417, :437, :457, :480, :499, :533`). Item actions
will match it.

**Existing infrastructure, reused rather than rebuilt.** `permission-actions.ts`
already has `hasItemPermission(userId, itemId, role = 'read', tx?)`, which
resolves both explicit permissions **and** ownership (`item?.ownerId === userId`),
and `assertItemPermission(userId, itemId, role)`, which throws
`StashlyError(FORBIDDEN)`.

**The gap.** Nothing combines an item check with a workspace-membership check, so
callers would have to remember two calls and keep them in sync. One new function
closes it.

**Rule this establishes.** A route loader/action never performs a permission check
itself. It passes `userId` (and `workspaceId` when present) to the action, and the
action throws. The inline `requireMembership` added to `folder.tsx` during step 3
is therefore **temporary** and is removed by this work.

---

## 5. Item 4 — `breadcrumbs` owns its own trimming

**Today.** `breadcrumbs(itemId)` returns the full ancestor chain and each caller
decides what to show. Only `folder.tsx` trims:
`folder?.ownerId === session.user.id ? allCrumbs : allCrumbs.slice(-1)` — using a
*separate* `prisma.item.findUnique` to learn the owner. `all.tsx` and `file.tsx`
do not trim at all, so a non-owner sees the full ancestor chain there, including
names of folders they cannot open.

**Change.** `breadcrumbs(itemId, userId)` performs the trim internally. The
recursive CTE already walks the chain, so adding `"ownerId"` to its `SELECT`
yields the owner with **no extra query** — and lets `folder.tsx` drop its
`findUnique` entirely.

**Trim rule** (Q2, answered — keep current): full chain when the user owns the
target item, otherwise the last crumb only. Extended to the other two callers,
which currently do not trim at all.

**Benchmark (Q2) — measured 2026-09-11**, dev DB, 20 runs per cell:

| depth | current: queries | current p50/p95 | per-ancestor: queries | per-ancestor p50/p95 |
|---|---|---|---|---|
| 6 | **1** | **1.2 / 2.7 ms** | **13** | **5.2 / 187.0 ms** |

At depth 6 the friendlier rule costs **13× the queries, ~4× the p50 and ~69× the
p95**. The query count is structural, not incidental: `hasItemPermission` issues
two queries (permission lookup + owner lookup), so the per-ancestor rule is
`1 + 2n` queries against the current rule's single CTE. The p95 blow-up is what
a folder page would actually feel.

*Caveat on coverage:* the dev DB only contains chains of depth 6 — depths 3 and
10 were not measurable here, so the table has one row rather than three. The
`1 + 2n` relationship means depth 10 would be 21 queries; that is arithmetic
from the measured shape, not a measurement.

**Conclusion: keep the current rule.** Revisit only if per-ancestor visibility
becomes a product requirement, and then with a batched permission lookup rather
than a check per ancestor.

---

## 6. Item 6 — filters build where-clauses; actions do the checks

**Contract, to be written as a header comment in `item.filters.ts`:**

> A `*.filters.ts` file turns validated URL params into a Prisma `where` clause.
> It validates *shape* — present / non-empty / valid enum — never *authority*.
> Every authorization decision belongs in an action function.

**Concrete changes to `item.filters.ts`:**

1. Rename filters-map key `workspace` → `workspaceId` so the schema key actually
   resolves (fixes **P3**). Zero call sites set it today, so nothing breaks.
2. Delete the dead commented-out `currentUserId` filter block at `:211`. The key
   stays in the *schema* because the `favorited` filter reads
   `params.currentUserId` as context (`:139`) — a comment will say so, so nobody
   "restores" it as a scoping filter.
3. Add an `accessibleBy` filter producing the personal-scope clause:
   `OR: [{ ownerId }, { permissions: { some: { users: { some: { id } } } } }]`.
   This is what `currentUserId` should have been: it admits items shared *with*
   the user, which a bare `ownerId` equality would wrongly exclude.

**Preventing recurrence (the P2/P3 class).** A new unit test asserts that every
key in `itemFilterSchema` either has an entry in the filters map or appears on an
explicit `CONTEXT_ONLY_KEYS` allowlist. A future commented-out or misnamed filter
then fails CI instead of silently disabling a constraint. This is the durable fix
and it touches no fenced file.

### 6.1 Audit of the other 15 `*.filters.ts` — **completed 2026-09-11**

Compared schema keys against filter-map keys in all 16 files by importing each
module (a grep-based first pass gave a false positive on every file — those
files declare their schema as `z\n  .object({`, which the pattern missed. Worth
knowing before anyone repeats it).

**14 of 16 clean.** Two genuine mismatches, neither live:

| File | Finding |
|---|---|
| `drive.filters.ts` | Filters `createdAt`, `updatedAt` are **unreachable** (no matching schema key). Schema key `workspaceId` has **no filter**. |
| `notification.filters.ts` | Filter `user` is **unreachable**. Schema keys `id`, `userId`, `type` have **no filter**. |

**Severity: latent, not exploitable today.** The `notification.userId` gap looks
like P1 but is not reached: `listNotifications` builds its `where` by hand
(`{ userId, ...status, ...type }`) and never calls `buildNotificationFilters`.
The builders are consumed only by `searchNotifications` / `searchDrives`, and
neither is called from any route.

They should still be fixed — a future route wiring `searchNotifications` to
user-supplied filters would ship an unscoped notification search — but that is
**an amendment, not this spec**. No file in this section was modified.

---

## 7. Item 5 — activity feed invariant

**A correction to something I said earlier.** I flagged that
`activity-timeline.tsx` changed behaviour for items owned by other users. That
case is unreachable: `getRecentActivityForUser` filters
`where: { item: { ownerId: userId } }` (`activity-actions.ts:248`), so every
returned activity is on an item the viewer owns. With item 1 enforcing
`params.me === session.user.id`, the identity `params.me === item.ownerId` holds
by construction. **My link-builder change is a true no-op here** — nothing to
re-test.

### 7.1 Visibility rule (Q1, answered)

| Context | Who may see an item's activity |
|---|---|
| Personal | the item **owner** only |
| Workspace | the item **owner**, or a workspace **admin** |

Users an item is merely *shared with* do **not** see its activity in either
context.

**Change.** `getRecentActivityForUser` gains an optional `workspaceId`:

- **absent** → personal context. `where: { item: { ownerId: userId } }`,
  additionally constrained to `item: { workspaceId: null }` so a workspace item
  can never leak into the personal feed. *(Current behaviour omits that second
  constraint; adding it is a tightening, and the only user-visible change here.)*
- **present** → workspace context. Assert membership first (§4), then return
  activity for items in that workspace where the caller is the item owner **or**
  holds `admin`/`owner` in the workspace. `WorkspaceMemberRole` is
  `viewer | member | admin | owner`, so the satisfying set is `['admin','owner']`.

No current caller passes `workspaceId` — `stash/home.tsx:102` is the only
call site and is personal context. The workspace branch is therefore inert until
a workspace overview route calls it, and is specified now so the rule lives in
the action rather than being invented later at a call site.

**Test.** Pin both branches, and pin that a shared-with (non-owner, non-admin)
user sees nothing.

---

## 8. Complete file manifest — nothing outside this list will be touched

### Modified

| File | Function / export | Change | Why |
|---|---|---|---|
| `app/routes/layout.tsx` | new `middleware`; `loader` | Assert `params.me === session.user.id`; resolve session once and share via context; loader reads context instead of re-calling `getSession`. | Item 1 — single fail-closed point ahead of all child loaders. |
| `app/.server/permission-actions.ts` | **new** `assertItemAccess(userId, itemId, opts?: { workspaceId?, role?, tx? })` | Combines `requireMembership` (when `workspaceId` given) with `assertItemPermission`. Delegates to existing helpers; adds no new query path. | Items 2–3 — one call site per action instead of two that can desynchronise. |
| `app/.server/permission-actions.ts` | `assertItemPermission` | Add optional `tx?: PrismaTx`, forwarded to `hasItemPermission` (which already accepts it). | Lets actions run the check inside their own transaction. |
| `app/.server/item-actions.ts` | `GetFolderContentParams`, `getFolderContent` | Add required `userId: string` and optional `workspaceId?: string`; call `assertItemAccess(userId, parentId, { workspaceId })` before querying; throw when `workspaceId` is given but membership fails. | Items 2, 6 — closes **P1** at the only layer that can see the caller. |
| `app/.server/breadcrumbs.ts` | `breadcrumbs` | Signature → `(itemId, userId)`; add `"ownerId"` to the CTE `SELECT`; trim internally. | Item 4 — removes a duplicated rule and one `findUnique` per folder page. |
| `app/utils/filters/item.filters.ts` | filters map, schema comments | Rename `workspace` → `workspaceId`; delete dead `currentUserId` block; add `accessibleBy`; add contract header. | Item 6, fixes **P3**. |
| `app/routes/stash/folder.tsx` | `loader` | Remove the temporary inline `requireMembership`; pass `userId`/`workspaceId` to `getFolderContent`; pass `userId` to `breadcrumbs`; drop the now-redundant `prisma.item.findUnique`. ~~set `accessibleBy`~~ — see D1. | Items 2, 4. |

### Deviations from this spec (approved in flight)

**D1 — `accessibleBy` is not applied to the folder route's children query.**
*Accepted 2026-09-11.* There is no permission cascade in the codebase:
`grantItemPermission` is only ever called on a single item, and nothing grants
permissions to descendants. A recipient of a shared folder therefore holds a
permission on that folder and on none of its children, so filtering children by
`accessibleBy` would render a shared folder **empty**. It also buys no security —
`getFolderContent` already asserts read access on the parent before querying, so
a second stricter rule on the children only removes legitimate content. The
filter itself ships and is tested; its home is a list view with no parent
constraint, not this route.
| `app/routes/stash/all.tsx` | `loader` (`:115`, `:123`) | Pass `userId` to `getFolderContent` and `breadcrumbs`. | Required by the two signature changes. |
| `app/routes/stash/file.tsx` | `loader` (`:120`) | Pass `userId` to `breadcrumbs`. | Required by the signature change. |
| `app/.server/activity-actions.ts` | `getRecentActivityForUser` | Add optional `workspaceId`; personal branch also constrained to `item: { workspaceId: null }`; workspace branch asserts membership then admits item owner **or** workspace `admin`/`owner`. | Item 5 / **Q1**. Added to the manifest by the Q1 answer — was test-only before. |

### Created

| File | Contents | Why |
|---|---|---|
| `app/utils/__tests__/item-filters-coverage.test.ts` | Every `itemFilterSchema` key has a filter entry or is on `CONTEXT_ONLY_KEYS`. | Makes the P2/P3 defect class fail CI. |
| `app/.server/__tests__/breadcrumbs-trim.test.ts` | Owner sees full chain; non-owner sees last crumb only. Pure trim logic, no DB. | Item 4 regression cover. |
| `app/utils/__tests__/activity-visibility.test.ts` | Personal branch = owner only and never workspace items; workspace branch = owner or `admin`/`owner` member; shared-with user sees nothing. | Item 5 / Q1. |

### Read-only (audited, never modified)

`app/utils/filters.ts` · the other 15 `app/utils/filters/*.filters.ts` ·
`app/.server/workspace-actions.ts` · `app/routes.ts`

---

## 9. Verification plan

Every claim gets a number, per the repo's debugging rules.

1. **Known baselines.** `pnpm typecheck` = **202** errors; `pnpm test` =
   **484 passed / 11 failed** (the 11 pre-existing). Both re-run after each item;
   any delta is explained or fixed.
2. **P1 is closed.** Re-run the filter-resolution script from §1, plus a new
   variant calling `getFolderContent` as a non-owner and asserting it throws
   `FORBIDDEN`. Before/after output pasted into the final report.
3. **Item 1.** Request `/:userB/stash/folders/:id` while signed in as user A;
   confirm 403 rather than a rendered page.
4. **Browser.** Personal folder page and workspace folder page both render, via
   chrome-devtools MCP. Requires you signed in to the MCP Chrome — I will ask.
5. **No existing test is modified** to make a change pass.

---

## 10. Questions — **answered 2026-09-11**

- **Q1 (§7) — activity visibility.** *Answer:* workspace context → **owner or
  admin**; personal context → **owner only**. This makes item 5 a production
  change, not just a test; see §7 and the manifest entry for
  `activity-actions.ts`.
- **Q2 (§5) — breadcrumb trim.** *Answer:* keep current ("last crumb only"), but
  produce **before/after benchmarks of the cost** of the per-ancestor alternative
  before revisiting. Adds a measurement deliverable, no behaviour change.
- **Q3 (§3) — middleware fallback.** *Answer:* approved as a fallback, conditional
  on verifying RR 8 middleware first. **Verification done — see §3.1. The
  fallback is not expected to be needed.**

---

## 11. Order of work

1. §6 filters contract + coverage test — *no behaviour change; makes the rest safe*
2. §4 `assertItemAccess` + `getFolderContent` guard — *closes P1*
3. §3 `:me` middleware
4. §5 breadcrumbs
5. §7 activity test
6. Full verification sweep (§9), then report

Each numbered item lands as a separate commit.
