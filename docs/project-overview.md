# Stashly: project overview

Stashly is a file storage app with personal stashes and shared workspaces.
Users upload, organise, search and share files; thumbnails, search embeddings
and OCR are computed in the browser on WebGPU.

This page is the map. Working conventions are in [`CLAUDE.md`](../CLAUDE.md);
each subsystem has its own page, listed at the end, and a skill in
`.claude/skills/`.

## Stack

| Layer | Technology |
|---|---|
| App | React 19, React Router 8 in framework mode (SSR), TypeScript (strict) |
| Server | Express 5 (`server.js`, `server/app.ts`) |
| Database | PostgreSQL with `pgvector` and `pg_trgm`, through Prisma 7; schema in `prisma/models/*.prisma`, client generated into `app/prisma/` |
| State | XState 5 (`app/machines/`) |
| UI | Tailwind CSS 4, shadcn/ui on Radix (`app/components/ui/`) |
| Storage | S3-compatible (Tigris on Fly.io), `app/.server/s3.ts` |
| Browser AI | `@huggingface/transformers`, `onnxruntime-web`, WebGPU |
| Auth | better-auth with GitHub, Google and Microsoft |
| Payments | Stripe |
| Analytics and errors | Vinktar |
| Tests | Vitest (unit), Playwright (E2E) |
| Build and deploy | Vite 8, pnpm, Docker (`node:24-bookworm-slim`), Fly.io |

## How a request flows

```
browser ──► route loader / action (app/routes/)
              │  authMiddleware has already put the session in context
              ▼
            action function (app/.server/*-actions.ts)
              │  checks access, then queries
              ▼
            Prisma (app/.server/db.ts) ──► PostgreSQL
```

- Routes never call Prisma. They call plain functions in
  `app/.server/*-actions.ts` (imported as `@/services/*`), which own
  validation, the access check and the query.
- `authMiddleware` resolves the session once per request on the app layout and
  on each API route (the few exceptions, such as the Stripe webhook and the
  health check, are listed in `app/.server/__tests__/auth-middleware.test.ts`);
  `meMiddleware` checks that `:me` is the signed-in user.
- Errors are `StashlyError` (`app/utils/api.errors.ts`); routes normalise them
  with `toErrorInfo`.
- Request bodies are parsed with `parseFormData` / `parseSearchParams` and Zod
  schemas in `app/schemas/`; mutating routes discriminate on `intent`. The
  upload and quota routes take JSON with an `action` field instead.

## Layout of `app/`

| Directory | Holds |
|---|---|
| `routes/` | Pages (`stash/`, `workspaces/`, `settings/`, `auth/`) and resource routes (`api/`). All declared in `app/routes.ts` |
| `.server/` | Action files and server modules; never bundled for the browser |
| `.client/` | Browser-only modules: Monaco, Mermaid, Prettier, type acquisition, the Vinktar client |
| `machines/` | XState machines: `upload/`, `reviset/` (the per-file upload machine), `db/`, `multipart/`, `quota/`, `thumbnail/`, `indexing/`, `pipeline/`, `onboard/`, `selection/`, `session/` |
| `workers/` | Web Workers and model clients, all going through `ai-queue.ts` |
| `components/` | `ui/` (shadcn), `core-components/` (reusable), `views/` (route-level views) |
| `hooks/`, `utils/`, `schemas/`, `types/` | Shared code |

## Data model

`Item` is the centre: files, folders and collections are all items, told apart
by `type`, with one-to-one facet tables for type-specific data (`File`,
`Folder`, `Image`, `Video`, `Audio`, `Pdf`, `Markdown`). Around it: `Drive` and
`Quota` (one quota per drive), `Workspace` / `WorkspaceMember`, `Permission`,
`ShareLink`, `Invitation` / `InvitationRecipient`, `Favorite`, `PinItem`,
`Search` / `SearchChunk`, `Thumbnail`, `Activity` with one model per action
kind, and `Notification`. Folder sizes, child counts, collection sizes and
upload quota charges are kept by database triggers. Details:
[dev-notes.md](dev-notes.md) and the
[schema profile](data_profile_stashly%20_prisma_schema.md).

## Access

Two levels, both checked inside action functions, never in loaders:

- Workspace roles: `viewer`, `member`, `admin`, `owner` (`WorkspaceMemberRole`).
- Item permissions: `read`, `write`, `owner` (`PermissionRole`), granted per
  item, per invitation or per share link. `assertItemAccess` in
  `permission-actions.ts` combines both.

A personal-stash folder can be shared and uploaded into by others, and an
upload is paid for by the folder's drive.

## Subsystems

| Subsystem | In short | Page |
|---|---|---|
| Upload | multipart from the browser to S3, one SQL statement creates the row and charges quota | [upload-multipart.md](upload-multipart.md) |
| Quota | per drive, charged and refunded on the server | [quota-and-machines.md](quota-and-machines.md) |
| Thumbnails | made in the browser for visible cards, private, signed on read | [thumbnail-pipeline.md](thumbnail-pipeline.md) |
| Search | keyword and semantic ranking fused with RRF | [search.md](search.md) |
| Search index | text extraction, chunks, vectors, OCR | [semantic-search.md](semantic-search.md) |
| Browser AI | the models, the WebGPU queue, OCR engines | [ai-pipeline.md](ai-pipeline.md) |
| Notifications | Postgres `NOTIFY` to SSE | [notifications-sse.md](notifications-sse.md) |
| Sharing | share links and invitations | [sharing-and-invitations.md](sharing-and-invitations.md) |
| Code viewer | Monaco, cross-file types, Go to Definition | [code-viewer.md](code-viewer.md) |
| Markdown reader | streamed body, sanitising, Mermaid | [markdown-reader.md](markdown-reader.md) |
| Routing and lists | route handles, sidebars, `usePagination` | [routing-and-ui.md](routing-and-ui.md) |

Other server pieces: activity is recorded fire-and-forget after each mutation
(`activity-actions.ts`, `stashly-activity-recording` skill); analytics events
go to Vinktar after the write commits; `app/.server/metrics.ts` serves
Prometheus metrics at `/api/metrics`.

## API

All resource routes are in `app/routes/api/` and declared in `app/routes.ts`.
Most resources have a flat path and a nested one under `items/:itemId/…`
served by the same handler.

| Path | For |
|---|---|
| `/api/items`, `/api/items/:itemId/*` | items: create, rename, move, copy, trash, restore, delete, download, upload rows, index writes |
| `/api/s3/upload`, `/api/s3/multipart` | multipart upload |
| `/api/quota` | quota reads |
| `/api/thumbnails/:itemId` | thumbnail presign, source and stage writes |
| `/api/search/items` | search, keyword (GET) and semantic (POST) |
| `/api/collections`, `/api/favorites`, `/api/pins`, `/api/locks` | per-user organisation |
| `/api/shares`, `/api/invitations`, `/api/permissions`, `/api/members`, `/api/workspaces`, `/api/users` | sharing and workspaces |
| `/api/comments`, `/api/versions` | backend only, no UI yet |
| `/api/notifications`, `/api/notifications/stream` | notification list, changes and the SSE feed |
| `/api/activities`, `/api/sidebar`, `/api/settings`, `/api/theme`, `/api/view`, `/api/source-types` | page support |
| `/api/stripe`, `/api/subscription` | billing |
| `/api/metrics`, `/api/health` | operations |
| `/api/auth/*` | better-auth |
| `/api/ai/*`, `/api/images` | registered, answer 501 |

## Status

What is built and what isn't: [roadmap.md](roadmap.md). Open engineering
problems: [tech-debt.md](tech-debt.md).
