# Project Analysis Report

Generated: 2026-10-04 | Focus: all | Method: read-only inspection (no builds, tests or DB access)

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Language | TypeScript 6.0.3 (strict) |
| Runtime | Node 24 (Debian bookworm-slim image) |
| Package manager | pnpm 12.4.1. Single package, not a monorepo. |
| Framework | React Router 8.4 in framework mode (SSR), React 19.3, Express 5.2 |
| Build | Vite 8.3, Tailwind 4.3 (Vite plugin), React Router typegen |
| Database | PostgreSQL 17 with pgvector and pg_trgm, through Prisma 7.10. The schema is split across `prisma/models/`. |
| State and forms | XState 5.33, React Hook Form, Zod 4.6 |
| UI | shadcn/ui on Radix (copied into the repo), Framer Motion, Recharts, Monaco, Embla |
| Auth | better-auth, with OAuth from GitHub, Google and Microsoft |
| Payments | Stripe 22 |
| Storage | AWS SDK v3 against Tigris (S3-compatible) |
| Media | PDF.js 6, Sharp, exifr |
| Browser AI | `@huggingface/transformers` 4.3 and ONNX Runtime Web on WebGPU |
| Tests | Vitest 5 (`node` environment only), Playwright 1.63 |
| Lint and format | Prettier 3.9. No linter: no ESLint or Biome config, and no `eslint` package in `package.json`. |
| CI/CD | GitHub Actions: typecheck against a baseline, unit tests on Postgres + pgvector, build, Docker smoke test |
| Hosting | Fly.io. A release command runs `prisma migrate deploy`. It uses shared-cpu-1x with 1 GB. Concurrency is capped at a soft 200 and hard 250 for SSE. |

## 2. Architecture

**Pattern:** layered, with feature-organized UI.

```
Express (server.js → server/app.ts)
  → React Router route modules        app/routes/ (registered in app/routes.ts)
    → middleware: auth → me → workspace
    → loader / action                 forward userId and workspaceId only
      → *-actions.ts                  app/.server/ (alias @/services/*)
        → Prisma → Postgres           triggers keep size and child-count rollups
Client side: app/machines/ (XState), app/workers/ (WebGPU AI, thumbnails), app/components/
```

| Directory | Role |
|---|---|
| `app/.server/` | Domain and service layer. Plain exported functions; authorization is enforced here. |
| `app/routes/`, `app/routes/api/` | Handlers that receive requests and call actions. `api/` and `auth/` sit outside the auth layout. |
| `app/components/{ui,core-components,views}` | Design system, reusable feature components, and route-level views |
| `app/machines/` | 14 machine areas, including upload, multipart, thumbnail, indexing, quota, pipeline, subscription, session and selection |
| `app/workers/` | AI queue, embedding, OCR and compute workers |
| `app/schemas/`, `app/types/` | Zod contracts and shared types |
| `prisma/` | Split schema and about 40 migrations. The generated client in `app/prisma/` is not tracked. |

**Entry points:** `server.js` → `server/app.ts` → `app/root.tsx` and `app/routes.ts`.

**Separation of concerns: A.** The `.server` split is enforced at build time, routes almost never call Prisma directly (4 route files still import `prisma`: `api/shares.ts`, `stash/gallery.tsx`, `stash/shares.tsx`, `workspaces/workspace.tsx`), and authorization lives in actions. The main weakness is file size: `item-actions.ts` is 3,962 lines.

## 3. Business Domain

**Domain:** a file manager with a personal drive and collaborative workspaces. Each user has a storage quota tied to a plan. Sharing works through permissions, share links and email invitations. Search combines keyword and semantic matching, and all AI work runs in the browser.

### Core entities

- **Item** is one tree for folders, files and collections.
  - Self-referencing `parentId` with cascade delete.
  - Status is one of normal, archived, trashed, locked or shared.
  - `size` and `inclusiveSize` are maintained by triggers.
  - Each item has at most one facet: File, Folder, Image, Video, Audio, Pdf or Markdown.
- **Drive** has one Quota and one Trash, and is linked to a StoragePlan and a Subscription.
- **Workspace** has members with the roles viewer, member, admin or owner. These roles map to item Permission rows (read, write or owner).
- **Sharing:** a ShareLink has a type (view, edit, embed or upload), a scope, and optional password and expiry. An Invitation has recipients, and each recipient has a status.
- **Search** keeps one row per item, and **SearchChunk** keeps about 300-token passages with `vector(768)`.

### Key workflows

| Workflow | Rule |
|---|---|
| Upload | Presigned multipart upload straight to S3. `assertCanUploadTo` runs before item creation. A refused file's object is deleted (`item-actions.ts:1712`, `:1822`, `:1865`). |
| Quota | `applyQuotaDelta` is one atomic SQL UPDATE that applies the delta, clamps at 0 and sets the status. Thresholds: warning above 90%, critical above 99%, exceeded above 100% (`quota-actions.ts:64`, `:393`). |
| Trash | All-or-nothing write check, then one recursive CTE marks the subtree. A `TrashItem` row is created only for directly trashed ids. Restore leaves alone any descendants that were trashed separately earlier. |
| Permissions | `assertItemAccess` checks workspace membership first, then the item permission (`permission-actions.ts:561`). |
| Search | Trigram ranking and pgvector ranking are fused with RRF (k=60, depth 100), with ties broken by id. Scores are normalized to the top result (`search-actions.ts:1221`, `utils/search-query.ts:97`). |
| Thumbnails | Made only for cards on screen. A memory lane (cap 4) uses files held from upload. A download lane (cap 2, originals of 16 MB or less) pauses during uploads. |
| AI queue | One WebGPU slot with three priorities: interactive, default and background. FIFO within a priority, and a running job is never interrupted. |

### Integrations

- better-auth OAuth.
- Stripe.
- Tigris S3.
- An HTTP email service set by `EMAIL_SERVICE_URL` (provider not verified).
- Models from Hugging Face: `all-mpnet-base-v2` for embeddings, Florence-2 and GLM-OCR for OCR. Whisper and Qwen IDs also appear in the code.

---

## 4. Key Observations

### Strengths

- **Authorization is centralized.** Actions own the checks and loaders only pass ids along. Recent commits moved more checks the same way: folder access and `openedAt` went from loaders into actions.
- **Consistency is pushed into the database** where it matters: size rollups in triggers, atomic quota updates, and one statement each for trash and restore.
- **CI tests against real infrastructure:** a real Postgres with pgvector, a Docker smoke test, and a type baseline that fails if it allows more errors than exist.
- **No server inference cost.** All AI runs on the client.

### Concerns

- 🔴 **The Stripe webhook is a stub.** In `app/routes/api/stripe.ts`, all four handled events (checkout completed, subscription updated, subscription deleted, invoice paid) contain only `// TODO` comments and commented-out `prisma` calls. A renewal, cancellation or failed payment made in Stripe never reaches the `Subscription` table.
- 🟡 **There is no linter.** Prettier is the only static check besides `tsc`.
- 🟡 **Several large action files.** `item-actions.ts` is 3,962 lines and `invitation-actions.ts` is about 1,150, which makes changes there riskier.
- 🟡 **Quota is charged from the client.** The `api/quota` intents (`items-uploaded`, `items-trashed`, …) are called by the client quota machine. Whether the server re-derives the amounts or trusts the client is not verified, and it is worth checking.
- ⚪ The ShareLink scope enum still uses `organization`, which is due to be renamed `workspace`.

## 5. Quick Reference

| Aspect | Value |
|--------|-------|
| Language | TypeScript 6 (strict) |
| Framework | React Router 8 (SSR) on Express 5, with Prisma 7, Postgres 17 and XState 5 |
| Architecture | Layered: routes → `.server` actions → Prisma and DB triggers. UI organized by feature. |
| Domain | File storage and sharing with workspaces, quotas, Stripe plans and hybrid search, with AI running in the browser |
| Size | 521 tracked `.ts`/`.tsx` files under `app/` (excluding generated `app/prisma/`), about 40 migrations |
| Maturity | Growing toward mature: 720 commits since 2025-07-20, with CI and deploy pipelines in place |

---

## Evidence

**Checked directly against the repo:**
- The Stripe webhook contains only TODOs.
- No linter is configured.
- The file count is 521, from `git ls-files`.
- The list of machine directories.
- The entry points `server.js` and `server/app.ts`.
- `db.ts` and `fly.toml` reference Accelerate or PgBouncer.
- The first commit date and the commit count.

**Taken from the analysis agents, not checked directly:**
- Library versions.
- The individual line references in the business-domain section.

**Open questions:**
- Whether permissions are inherited down the item tree.
- How share links are redeemed.
- How locks and versions behave.
- What `api/ai.ts` does on the server.
- Which email provider is used.
- The order in which the client calls the quota-charging intents.
