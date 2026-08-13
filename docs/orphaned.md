# Orphaned Files Report

> Generated: 2026-04-02
> **Re-verified: 2026-08-13**
> Scope: `app/**/*.ts` and `app/**/*.tsx`
> Method (2026-04-02): 7 parallel agents scanned each major folder, checking every file against import statements and route registrations across the entire repo (`app/`, `server.js`).
> Method (2026-08-13 re-verification): **targeted, not exhaustive.** Every file named in the 2026-04-02 tables was re-checked for existence, then hunted for importers by filename stem, path-alias form (`@/components/…`, `@/ui/…`, `@/machines/…`, `@/utils/…`, `@/services/…`), and relative-import form, plus barrel re-exports, dynamic `import()`, `new Worker`/`new URL`, `app/routes.ts` registrations, and `tests/` + `__tests__/` references. A short list of named suspects outside the tables was also spot-checked (see [Newly found orphans](#newly-found-orphans-2026-08-13)). **The rest of the `app/` tree was NOT rescanned** — files absent from both this report and that spot-check list are simply unverified, not certified live.

---

## What changed since 2026-04-02

| Outcome | Count |
|---------|-------|
| Previously listed, **now deleted** from the repo | 18 |
| Previously listed, **now actively imported** (de-listed) | 14 |
| Previously listed, **still orphaned** | 27 |
| **Newly found** orphans (targeted spot-check only) | 8 |
| **New total orphaned** | **35** |

> Arithmetic note on the original report: its summary claimed **60** orphans, but the tables enumerate **59** rows — the `app/components/ui/` section is headed "24 files" while listing 23. The 2026-08-13 accounting above is against the 59 enumerated rows.

### Counting rule for `app/components/ui/` (intra-`ui/` imports)

`app/components/ui/index.ts` is an unconditional `export * from './<every-component>'` barrel, so barrel membership alone proves nothing. The rule applied consistently throughout this report:

> **A `ui/` component counts as USED only if its import chain reaches a file outside `app/components/ui/`** — via a direct path import, the `@/ui/*` alias, or a named import pulled through the `@/components/ui` barrel. An import from a *sibling* `ui/` file does **not** by itself rescue a component; the sibling must itself be reachable from outside `ui/`.

Worked examples of the rule:

- `skeleton.tsx` is imported by `ui/image.tsx` and `ui/sidebar.tsx` (both intra-`ui/`, which alone would not count) — **but also** by `app/components/views/item-page/stage-skeleton-loader.tsx` via the barrel, which four item-page stages import. **USED.**
- `toggle-group.tsx` is imported by `ui/layout-menu.tsx` (intra-`ui/`) — **and also** by `core-components/search-input.tsx` and three `options/option-*/layout.tsx` files. **USED.**
- The 14 `ui/` components still listed below have **zero** importers of any kind, intra-`ui/` or otherwise, so the rule never had to break a tie for them.

---

## Summary (as of 2026-08-13)

| Folder | Files present | Orphaned | Notes |
|--------|--------------|----------|-------|
| `app/components/` | 217 | **21** | 7 custom + 14 unused UI library components |
| `app/machines/` | 29 | **12** | Dead state machines and draft code |
| `app/.server/` | 36 | **1** | Was 8 — 6 deleted, 1 now wired up |
| `app/routes/` | 80 | **0** | All 3 previously-listed route files deleted |
| `app/utils/` | 49 | **0** | Was 3 — 1 deleted, 2 now imported |
| `app/auth/` · `app/workers/` | 12 | **1** | Was 2 — worker helpers now imported |
| `app/prisma/` | 64 | **0** | All auto-generated, actively used |
| `app/scripts/` | 0 | **0** | No TypeScript files |
| *(subtotal of folders above)* | *487* | *35* | |
| `app/hooks/` · `app/schemas/` · `app/types/` · `app/.client/` · root | 56 | **?** | **Not scanned** — no file here was listed in 2026-04 or spot-checked in 2026-08 |
| **Total `app/` tree** | **543** | **35 known** | |

"Files present" is a raw count of `.ts`/`.tsx` under each folder today (includes `__tests__/` and `.d.ts`); it is **not** a claim that all of them were re-verified. Only the files named in this document were. The 56 files in the unscanned row are unverified in both directions.

---

## app/components/ — 21 orphaned

### Custom components (7 files)

| File | Status | Notes |
|------|--------|-------|
| `app/components/CommentsThreadPanel.tsx` | **Still orphaned** | Comments UI panel, never wired into any route. No path or symbol references found. |
| `app/components/SubscriptionButton.tsx` | **Still orphaned** | Billing CTA, not referenced in any route or layout. |
| `app/components/file-uploader.tsx` | **Still orphaned** | Alternative upload UI (`export function FileUploader`), superseded by the XState upload machine. No importers of the path or the symbol. |
| `app/components/icons_temp.tsx` | **Orphaned — new 2026-08-13** | Scratch icon set alongside the live `icons.tsx`. No importers. |
| `app/components/Gemini3Dashboard.tsx` | **Orphaned — new 2026-08-13** | Design-exploration dashboard. No importers, no route registration. |
| `app/components/Gemini3DashboardFiles.tsx` | **Orphaned — new 2026-08-13** | Companion to the above. No importers, no route registration. |
| `app/components/FileManagementDashboard.tsx` | **Orphaned — new 2026-08-13** | Prototype dashboard. No importers, no route registration. |

**Deleted since 2026-04** (were listed, file no longer exists):

| File |
|------|
| `app/components/Grid.tsx` |
| `app/components/SharedUtils.tsx` |
| `app/components/theme-toggle.tsx` |
| `app/components/dropbox ui/page.tsx` *(whole `dropbox ui/` folder removed)* |
| `app/components/stash/item-card-checkbox.tsx` |
| `app/components/stash/item-info-card.tsx` |

**De-listed — now actively imported:**

| File | Imported by |
|------|-------------|
| `app/components/stash/item-card-actions.tsx` | `app/components/stash/item-card.tsx:34` — `import { Actions as ItemCardActions } from './item-card-actions'`, re-exposed as the `ItemCard.Actions.*` compound API and consumed by `app/components/views/collection-view.tsx` (`ItemCard.Actions.Preview/Download/Favorite/Pin/Share/…`). |

### Unused UI library components (14 files)

shadcn/ui components installed in `app/components/ui/` and re-exported from `ui/index.ts`, with **no importer that reaches outside `app/components/ui/`** — no direct path import, no `@/ui/*` alias import, and no named symbol of theirs pulled through the `@/components/ui` barrel by any of the 21 files that use it. See the [counting rule](#counting-rule-for-appcomponentsui-intra-ui-imports) above.

| File | Exported symbols checked app-wide |
|------|-----------------------------------|
| `app/components/ui/calendar.tsx` | `Calendar`, `CalendarDayButton` |
| `app/components/ui/carousel.tsx` | `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselNext`, `CarouselPrevious` |
| `app/components/ui/chart.tsx` | `ChartConfig`, `ChartContainer`, `ChartTooltip`, `ChartLegend`, `ChartStyle` |
| `app/components/ui/collapsible.tsx` | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` |
| `app/components/ui/context-menu.tsx` | `ContextMenu` + 14 subcomponents |
| `app/components/ui/drawer.tsx` | `Drawer` + 9 subcomponents |
| `app/components/ui/field.tsx` | `Field`, `FieldGroup`, `FieldLabel`, `FieldError`, … |
| `app/components/ui/form.tsx` | `Form`, `FormField`, `FormControl`, `useFormField`, … |
| `app/components/ui/input-otp.tsx` | `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator` |
| `app/components/ui/menubar.tsx` | `Menubar` + 15 subcomponents |
| `app/components/ui/navigation-menu.tsx` | `NavigationMenu` + 7 subcomponents |
| `app/components/ui/radio-group.tsx` | `RadioGroup`, `RadioGroupItem` |
| `app/components/ui/resizable.tsx` | `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` |
| `app/components/ui/sonner.tsx` | `Toaster` |

**De-listed — now reached from outside `app/components/ui/`:**

| File | Reached by |
|------|-----------|
| `app/components/ui/accordion.tsx` | `core-components/card-examples/faq-accordion-card.tsx` (`@/components/ui/accordion`) and `faq-card.tsx` (`@/ui/accordion`) — both reachable from `routes/stash/examples.tsx`, registered at `app/routes.ts:222`. |
| `app/components/ui/command.tsx` | `core-components/move-to-folder-dialog.tsx` and `components/options/option-a/layout.tsx` (both `@/ui/command`). |
| `app/components/ui/hover-card.tsx` | `app/components/upload/index.tsx:42` (`'../ui/hover-card'`) — that barrel is imported by `app-header.tsx`, `states/files-empty-state.tsx`, and `routes/layout.tsx`. |
| `app/components/ui/item.tsx` | `views/invitations/invitation-parts.tsx:34` imports `Item` from the `@/components/ui` barrel and renders `<Item>` (line 281). |
| `app/components/ui/kbd.tsx` | `core-components/card-examples/shortcuts-card.tsx:2` (`@/components/ui/kbd`). |
| `app/components/ui/skeleton.tsx` | `views/item-page/stage-skeleton-loader.tsx:2` imports `Skeleton` from the `@/components/ui` barrel; that loader is imported by `code-viewer.tsx`, `markdown-stage.tsx`, `pdf-stage.tsx`, `text-stage.tsx`. Also `ui/image.tsx` and `ui/sidebar.tsx` (intra-`ui/`, non-decisive). |
| `app/components/ui/slider.tsx` | `views/item-page/audio-stage.tsx:15` and `video-stage.tsx` import `Slider` from the `@/components/ui` barrel; `audio-stage` is imported by `routes/stash/file.tsx:5`. |
| `app/components/ui/table.tsx` | `core-components/data-table.tsx:10` (`@/ui/table`) and `components/options/option-a/layout.tsx:11`; `data-table` is imported by `views/list-view.tsx` and `routes/stash/storage.tsx`. |
| `app/components/ui/toggle-group.tsx` | `core-components/search-input.tsx:7`, `options/option-{a,b,c}/layout.tsx`, and `ui/layout-menu.tsx` (intra-`ui/`, non-decisive). |

---

## app/machines/ — 12 orphaned

Heavy dead code. Most appear to be abandoned experiments or draft machines that were never integrated.

| File | Status | Notes |
|------|--------|-------|
| `app/machines/actors/Uploader.tsx` | **Still orphaned** | React component stub (`export default UploadManager`), itself unreferenced. |
| `app/machines/actors/multipart.machine.ts` | **Still orphaned** | Separate multipart upload machine; the active implementation lives in `app/machines/multipart/s3.multipart.*`. `multipartMachine` appears only in its own file. |
| `app/machines/actors/queue.machine.ts` | **Orphaned — new 2026-08-13** | `queueMachine` defined here has no importers. Distinct from `app/machines/reviset/queue.machine.ts` (also orphaned). |
| `app/machines/actors/quota.machine.ts` | **Orphaned — new 2026-08-13** | Shadow copy of `app/machines/quota/quota.machine.ts`. Every `quotaMachine` importer (`upload/upload.machine.ts:16`, `schemas/machine.schemas.ts`) resolves to `quota/quota.machine`, never to `actors/`. |
| `app/machines/pagination/infinite-scroll.machine.ts` | **Still orphaned** | `infiniteScrollMachine` appears only in its own file. (Its root-level twin was deleted.) |
| `app/machines/queue/queue.machine.1.ts` | **Still orphaned** | Versioned draft (`.1` suffix), no importers. Note it is the *only* consumer of `upload/file.machine.ts` — an orphan-to-orphan chain, so neither is rescued. |
| `app/machines/reviset/queue.machine.ts` | **Orphaned — new 2026-08-13** | Defines and re-exports `queueMachine` (line 347). No file imports `reviset/queue`. Sits next to the *live* `reviset/file.machine.ts`, so folder name alone is not a signal. |
| `app/machines/sidebar/sidebar.machine.ts` | **Still orphaned** | `sidebarMachine` appears only in its own file. |
| `app/machines/subscription/subscription.machine.ts` | **Still orphaned** | Exports default `machine`; no path importers. |
| `app/machines/upload/file.machine.ts` | **Orphaned — new 2026-08-13** | Superseded by `reviset/file.machine.ts`. Its import in `upload/upload.machine.ts` is **commented out at line 15**; the live line 12 imports from `'../reviset/file.machine'`. Only other reference is a `import type` in the orphaned `queue/queue.machine.1.ts:15`. |
| `app/machines/ai/ai.machine.ts` | **Still orphaned** | AI orchestration machine, never integrated. `aiMachine` appears only in its own file. |
| `app/machines/ai/caption.machine.ts` | **Still orphaned** | Image captioning machine. Its `imageCaptionMachine` export is duplicated inside `ai/ai.machine.ts:77`; neither is imported. |

**Deleted since 2026-04:**

| File |
|------|
| `app/machines/infiniteScroll.machine.ts` |
| `app/machines/upload/root.machine.ts` |

**Explicitly NOT orphaned (checked because the folder looks abandoned):**

| File | Imported by |
|------|-------------|
| `app/machines/reviset/file.machine.ts` | `app/machines/upload/upload.machine.ts:12` — `import { fileMachine } from '../reviset/file.machine'`; also `app/schemas/machine.schemas.ts:3`. `uploadMachine` is instantiated in `app/hooks/useUpload.ts`. |

---

## app/.server/ — 1 orphaned

| File | Status | Notes |
|------|--------|-------|
| `app/.server/env.ts` | **Still orphaned** | Exports `toRequiredEnv`. Its only mention outside the file is a **commented-out** block at `app/.server/auth.ts:10`. |

**Deleted since 2026-04:**

| File |
|------|
| `app/.server/api.utils.ts` |
| `app/.server/lmr.ts` |
| `app/.server/s3-extractors.ts` |
| `app/.server/search/filters.ts` |
| `app/.server/search/search.repository.ts` |
| `app/.server/search/search.ts` |

The whole `app/.server/search/` directory is gone.

**De-listed — now actively imported:**

| File | Imported by |
|------|-------------|
| `app/.server/collection-actions.ts` | `app/routes/api/collections.ts:13` (relative `../../.server/collection-actions`), `app/routes/stash/collection.tsx:5` and `app/routes/stash/collections.tsx:2` (`@/services/collection-actions`), plus `app/.server/__tests__/collection-actions.test.ts`. |

---

## app/routes/ — 0 orphaned

All three previously-listed route files have been deleted. `app/routes/workspaces/` no longer contains `gallery.tsx` or `search.tsx`, and `app/routes/api/s3/presigned.ts` is gone.

**Deleted since 2026-04:**

| File |
|------|
| `app/routes/api/s3/presigned.ts` |
| `app/routes/workspaces/gallery.tsx` |
| `app/routes/workspaces/search.tsx` |

---

## app/utils/ — 0 orphaned

**Deleted since 2026-04:**

| File |
|------|
| `app/utils/aimodel.test.ts` |

**De-listed — now actively imported:**

| File | Imported by |
|------|-------------|
| `app/utils/filters/drive.filters.ts` | `app/.server/drive-actions.ts:4` — `import { buildDriveFilters } from '@/utils/filters/drive.filters'`. `drive-actions` is itself live (`machines/onboard/onboard.machine.ts:10`, `routes/settings/billing.tsx:8`). |
| `app/utils/pagination.ts` | `app/utils/search.ts:8` (`from './pagination'`), and `search.ts`'s `searchFactory` is imported by 10+ live server actions (`item-actions`, `collection-actions`, `share-actions`, `invitation-actions`, `quota-actions`, …). The 2026-04 "questionable" flag is resolved: **used**. (It is still absent from `utils/index.ts` by design — server-only note — and the `@/ui` barrel's `export * from './pagination'` is the unrelated `ui/pagination.tsx`.) |

---

## app/auth/ and app/workers/ — 1 orphaned

| File | Status | Notes |
|------|--------|-------|
| `app/auth/permissions.ts` | **Still orphaned** | Exports `Role`, `Permission`, `rolePermissions`. `rolePermissions` appears only in its own file (line 28); permission logic lives in `app/.server/permission-actions.ts` instead. |

**De-listed — now actively imported:**

| File | Imported by |
|------|-------------|
| `app/workers/stash.worker.helpers.ts` | `app/workers/stash.ai.ts:13` (`'./stash.worker.helpers'`) and `app/workers/__tests__/helpers.test.ts:7`. `stash.ai.ts` is live via `machines/pipeline/pipeline.actors.ts:10` and `workers/thumbnail.ai.ts:1`. |

---

## app/prisma/ — 0 orphaned

All files are auto-generated by Prisma (`/* !!! This is code generated by Prisma. Do not edit directly. !!! */`). Entry points (`client.ts`, `browser.ts`, `enums.ts`) are actively imported across the codebase. Individual model files are barrel-exported via `models.ts`. No action needed.

---

## Newly found orphans (2026-08-13)

Found by a **targeted spot-check of named suspects only**, not an exhaustive rescan. Each was checked for path imports, alias imports, relative imports, symbol references, `app/routes.ts` registration, dynamic `import()`, and test references.

| File | Notes |
|------|-------|
| `app/components/icons_temp.tsx` | No importers; the live icon set is `app/components/icons.tsx`. |
| `app/components/Gemini3Dashboard.tsx` | No importers, no route registration. |
| `app/components/Gemini3DashboardFiles.tsx` | No importers, no route registration. |
| `app/components/FileManagementDashboard.tsx` | No importers, no route registration. |
| `app/machines/actors/queue.machine.ts` | See machines table. |
| `app/machines/actors/quota.machine.ts` | See machines table. |
| `app/machines/upload/file.machine.ts` | See machines table — import commented out at `upload.machine.ts:15`. |
| `app/machines/reviset/queue.machine.ts` | See machines table. |

### Spot-checked and confirmed NOT orphaned

| File | Imported by |
|------|-------------|
| `app/components/Gallery.tsx` | `app/routes/stash/gallery.tsx:2` (`import { Gallery } from '@/components/Gallery'`); that route is registered three times in `app/routes.ts` (lines 198, 201, 260). |
| `app/components/DocumentViewer.tsx` | `app/routes/stash/recent.tsx:1` (`import DocumentViewerPage from '@/components/DocumentViewer'`); registered at `app/routes.ts:205` and `:279`. |
| `app/machines/reviset/file.machine.ts` | See machines section. |

---

## Recommended Cleanup Priority

### High — likely dead code, safe to delete

1. **`app/machines/`** — 12 files. Abandoned drafts (`.1` suffix), duplicate `quota`/`queue`/`file` machines shadowing the live ones, never-integrated AI machines. Highest confidence in the report. **Careful:** `reviset/file.machine.ts` is LIVE while `upload/file.machine.ts` is dead — the naming is inverted from what the folder layout suggests. Delete by exact path, never by stem.
2. **`app/components/` prototypes** — `Gemini3Dashboard.tsx`, `Gemini3DashboardFiles.tsx`, `FileManagementDashboard.tsx`, `icons_temp.tsx`. Design explorations with no route registration.
3. **`app/components/CommentsThreadPanel.tsx`, `SubscriptionButton.tsx`, `file-uploader.tsx`** — three surviving custom orphans, unchanged in status since April.

### Medium — review before deleting

4. **`app/auth/permissions.ts`** — permissions enums that duplicate the live checks in `.server/permission-actions.ts`. Worth confirming no migration to this file was planned.
5. **`app/.server/env.ts`** — the only reference is a commented-out block in `auth.ts`, which reads like an intent to adopt it rather than abandon it.

### Low — shadcn/ui scaffolding, keep or trim based on roadmap

6. **`app/components/ui/` (14 files)** — down from 23 in April; nine former orphans are now in real use, so this folder is actively converging. Easy to re-add via `pnpm dlx shadcn-ui@latest add <component>`, but the trend argues for leaving them.

---

## Notes on Methodology

- **Before deleting anything from this report, follow `.agents/skills/dead-code-verification/SKILL.md`**: re-run the checklist yourself, delete in batches of 3–5, and typecheck between batches. This document is a starting point, not a conclusion — it went stale in both directions in four months.
- **Orphan-to-orphan chains do not rescue a file.** An import that arrives only from another orphan is noted inline rather than counted as usage (see `upload/file.machine.ts` ← `queue/queue.machine.1.ts`).
- **Commented-out imports do not count as usage** — two files in this report (`upload/file.machine.ts`, `.server/env.ts`) are referenced only from comments.
- **Barrel files** were treated per the [`ui/` counting rule](#counting-rule-for-appcomponentsui-intra-ui-imports): unconditional `export *` membership is not usage; a named symbol pulled through the barrel by an outside file is.
- **Route files** were checked against both `import` statements and `app/routes.ts` registrations (via `route()`, `layout()`, `prefix()` helpers).
- **Worker files** were checked for both `import` and `new Worker(new URL(...))` patterns.
- **Prisma files** are all auto-generated and excluded from cleanup recommendations.
- **`.d.ts` declaration files** (`react.d.ts`, `tokenizers-augment.d.ts`, `stashly.d.ts`) are ambient and intentionally not imported — excluded from orphan counts.
- **Test files** in `__tests__/` directories are run by Vitest directly — excluded from orphan counts. Conversely, a file imported *only* by a test still counts as used here (none in this revision rest on that alone).
- **Scope honesty:** the 2026-08-13 pass verified the 59 previously-listed files plus 9 named suspects. It did **not** rescan `app/` exhaustively, so the true orphan count is a floor, not a ceiling.
