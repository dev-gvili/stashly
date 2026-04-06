# Orphaned Files Report

> Generated: 2026-04-02
> Scope: `app/**/*.ts` and `app/**/*.tsx`
> Method: 7 parallel agents scanned each major folder, checking every file against import statements and route registrations across the entire repo (`app/`, `server.js`).

---

## Summary

| Folder | Files Checked | Orphaned | Notes |
|--------|--------------|----------|-------|
| `app/components/` | 95 | **34** | 10 custom + 24 unused UI library components |
| `app/machines/` | 33 | **10** | Dead state machines and draft code |
| `app/.server/` | 49 | **8** | Unintegrated services and utilities |
| `app/routes/` | 68 | **3** | Unregistered route files |
| `app/utils/` | 27 | **3** | 2 confirmed + 1 questionable |
| `app/auth/` · `app/workers/` · misc | 30 | **2** | Abandoned helpers |
| `app/prisma/` | 54 | **0** | All auto-generated, actively used |
| `app/scripts/` | 0 | **0** | No TypeScript files |
| **Total** | **356** | **60** | |

---

## app/components/ — 34 orphaned

### Custom components (10 files)

These are hand-written components with no import references anywhere.

| File | Notes |
|------|-------|
| `app/components/CommentsThreadPanel.tsx` | Comments UI panel, never wired into any route |
| `app/components/Grid.tsx` | Generic grid layout component, unused |
| `app/components/SharedUtils.tsx` | Utility component, no consumers |
| `app/components/SubscriptionButton.tsx` | Billing CTA, not referenced in any route or layout |
| `app/components/theme-toggle.tsx` | Dark/light toggle, never imported |
| `app/components/file-uploader.tsx` | Alternative upload UI, superseded by the XState upload machine |
| `app/components/dropbox ui/page.tsx` | Dropbox-style page (note: space in folder name), no consumers |
| `app/components/stash/item-card-actions.tsx` | Stash item actions overlay, not used in item card |
| `app/components/stash/item-card-checkbox.tsx` | Checkbox for stash items, not referenced |
| `app/components/stash/item-info-card.tsx` | Info card variant, not imported anywhere |

### Unused UI library components (24 files)

These shadcn/ui components are installed in `app/components/ui/` and re-exported from `ui/index.ts`, but **no file in the codebase imports them** — directly or via the barrel. They may have been scaffolded proactively but are not yet used. Safe to remove unless planned for near-term use.

| File |
|------|
| `app/components/ui/accordion.tsx` |
| `app/components/ui/calendar.tsx` |
| `app/components/ui/carousel.tsx` |
| `app/components/ui/chart.tsx` |
| `app/components/ui/collapsible.tsx` |
| `app/components/ui/command.tsx` |
| `app/components/ui/context-menu.tsx` |
| `app/components/ui/drawer.tsx` |
| `app/components/ui/field.tsx` |
| `app/components/ui/form.tsx` |
| `app/components/ui/hover-card.tsx` |
| `app/components/ui/input-otp.tsx` |
| `app/components/ui/item.tsx` |
| `app/components/ui/kbd.tsx` |
| `app/components/ui/menubar.tsx` |
| `app/components/ui/navigation-menu.tsx` |
| `app/components/ui/radio-group.tsx` |
| `app/components/ui/resizable.tsx` |
| `app/components/ui/skeleton.tsx` |
| `app/components/ui/slider.tsx` |
| `app/components/ui/sonner.tsx` |
| `app/components/ui/table.tsx` |
| `app/components/ui/toggle-group.tsx` |

---

## app/machines/ — 10 orphaned

Heavy dead code. Most appear to be abandoned experiments or draft machines that were never integrated.

| File | Notes |
|------|-------|
| `app/machines/actors/Uploader.tsx` | React component stub, imports `systemMachine` but is itself unreferenced |
| `app/machines/actors/multipart.machine.ts` | Separate multipart upload machine; the active one is `s3.multipart.ts` |
| `app/machines/infiniteScroll.machine.ts` | Root-level infinite scroll machine, duplicate of the pagination folder version |
| `app/machines/pagination/infinite-scroll.machine.ts` | Second `infiniteScrollMachine` definition, also unused |
| `app/machines/queue/queue.machine.1.ts` | Versioned draft (`.1` suffix), not the active queue machine |
| `app/machines/sidebar/sidebar.machine.ts` | Exports `sidebarMachine` but no component or hook consumes it |
| `app/machines/subscription/subscription.machine.ts` | Exports default `machine`; subscription-related code exists but doesn't import this file |
| `app/machines/upload/root.machine.ts` | High-level upload tracker that wraps `uploadMachine`, never instantiated |
| `app/machines/ai/ai.machine.ts` | AI orchestration machine, never integrated |
| `app/machines/ai/caption.machine.ts` | Image captioning machine, never integrated |

---

## app/.server/ — 8 orphaned

Unintegrated server-side modules. Some look like features started but never wired up; others look like refactoring leftovers.

| File | Notes |
|------|-------|
| `app/.server/api.utils.ts` | Exports `handleApiResponse`; `api.errors.ts` is used but not this file |
| `app/.server/collection-actions.ts` | Well-structured collection CRUD ops, never imported in any route or service |
| `app/.server/env.ts` | Exports `toRequiredEnv` env validation utility; environment access elsewhere doesn't use it |
| `app/.server/lmr.ts` | `LiquidModelRunner` class for local LLM inference with demo code at the bottom; never integrated |
| `app/.server/s3-extractors.ts` | Comprehensive S3 content extraction helpers; never imported |
| `app/.server/search/filters.ts` | Exports `createFilter`, `FilterBuilder`, `buildFiltersFactory`; search infra that was never wired up |
| `app/.server/search/search.repository.ts` | Exports `searchRepository` instance; not imported by any search route or service |
| `app/.server/search/search.ts` | Search module with no import references found |

---

## app/routes/ — 3 orphaned

Route files that are neither registered in `app/routes.ts` nor imported anywhere.

| File | Notes |
|------|-------|
| `app/routes/api/s3/presigned.ts` | Contains a POST handler for S3 presigned URLs. The active endpoint is `routes/api/s3.ts` (registered in routes.ts:56). This appears to be a legacy or duplicate implementation. |
| `app/routes/workspaces/gallery.tsx` | Workspace-specific gallery view. The active workspace gallery route (routes.ts:109-111) points to `routes/stash/gallery.tsx` instead. |
| `app/routes/workspaces/search.tsx` | Incomplete workspace search page — contains TODO comments and no corresponding route registration. |

---

## app/utils/ — 3 orphaned

| File | Status | Notes |
|------|--------|-------|
| `app/utils/filters/drive.filters.ts` | **Orphaned** | Drive-specific filter helpers, no consumers |
| `app/utils/aimodel.test.ts` | **Orphaned** | Misleadingly named — contains production AI model code, not a test file. Located outside `__tests__/`, not run by Vitest. |
| `app/utils/pagination.ts` | **Questionable** | Not imported in code; appears only in documentation files. `utils/index.ts` explicitly excludes it (server-only note). May be intentionally dormant or docs are stale. |

---

## app/auth/ and app/workers/ — 2 orphaned

| File | Notes |
|------|-------|
| `app/auth/permissions.ts` | Exports `Role`, `Permission`, and `rolePermissions` enums. Never imported anywhere — permissions logic appears to be handled elsewhere (e.g., directly in repository guards). |
| `app/workers/stash.worker.helpers.ts` | Utility helpers for the stash worker. The worker itself (`stash.worker.ts`) is loaded and active, but this helper file is not imported by it or anything else. |

---

## app/prisma/ — 0 orphaned

All 54 files are auto-generated by Prisma (`/* !!! This is code generated by Prisma. Do not edit directly. !!! */`). Entry points (`client.ts`, `browser.ts`, `enums.ts`) are actively imported across the codebase. Individual model files are barrel-exported via `models.ts`. No action needed.

---

## Recommended Cleanup Priority

### High — likely dead code, safe to delete

1. **`app/machines/`** — 10 files. Multiple clearly abandoned draft machines (`.1` suffix, duplicate infiniteScroll, never-integrated AI machines). High confidence these are dead.
2. **`app/.server/`** — 8 files. Unintegrated features (`lmr.ts`, `s3-extractors.ts`, `collection-actions.ts`) and search infra that was never wired up. High impact on bundle/clarity.
3. **`app/components/stash/`** — 3 custom stash component variants never connected to the item card.
4. **`app/routes/workspaces/search.tsx`** — Explicitly incomplete (TODO comments), no registration.

### Medium — review before deleting

5. **`app/auth/permissions.ts`** — Permissions enums that shadow or duplicate existing role checks. Worth checking if a migration to this file was planned.
6. **`app/routes/api/s3/presigned.ts`** — Duplicate S3 handler; verify `routes/api/s3.ts` fully covers its functionality before deleting.
7. **`app/workers/stash.worker.helpers.ts`** — May have been intended as a future import into the worker.
8. **`app/utils/aimodel.test.ts`** — Rename to a proper location or delete if logic is duplicated elsewhere.

### Low — shadcn/ui scaffolding, keep or trim based on roadmap

9. **`app/components/ui/` (24 files)** — Unused shadcn components. Safe to delete if not on the near-term feature roadmap; easy to re-add via `pnpm dlx shadcn-ui@latest add <component>`.

---

## Notes on Methodology

- **Route files** were checked against both `import` statements and `app/routes.ts` route registrations (via `route()`, `layout()`, `prefix()` helpers).
- **Worker files** were checked for both `import` and `new Worker(new URL(...))` patterns.
- **Prisma files** are all auto-generated and excluded from cleanup recommendations.
- **`.d.ts` declaration files** (`react.d.ts`, `tokenizers-augment.d.ts`, `stashly.d.ts`) are ambient and intentionally not imported — excluded from orphan counts.
- **Test files** in `__tests__/` directories are run by Vitest directly — excluded from orphan counts.
- The `app/utils/pagination.ts` case is flagged as questionable rather than confirmed orphaned, as its exclusion from `index.ts` may be intentional (server-only constraint noted in the barrel file).
