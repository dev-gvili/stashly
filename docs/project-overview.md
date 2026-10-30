---
title: "Stashly — Project Overview"
description: "Comprehensive overview of Stashly's architecture, tech stack, features, data model, and key subsystems."
author: "@AlonGvili"
date: 2026-08-30
tags:
  - "architecture"
  - "overview"
  - "tech stack"
  - "features"
  - "data model"
  - "state machines"
  - "API"
  - "auth"
---

# Stashly — Project Overview

Stashly is a full-stack file management platform for personal stashes and collaborative workspaces. Users upload, organize, search, and share files — with AI-powered features like transcription, captioning, and semantic search running directly in the browser via WebGPU.

Built with React Router 8 (SSR), Express 5, PostgreSQL (Prisma), and S3-compatible storage.

---

## Table of Contents

1. [Architecture at a Glance](#1-architecture-at-a-glance)
2. [Tech Stack](#2-tech-stack)
3. [Core Features](#3-core-features)
4. [Data Model](#4-data-model)
5. [Layer Architecture](#5-layer-architecture)
6. [Key Subsystems](#6-key-subsystems)
7. [State Machines (XState)](#7-state-machines-xstate)
8. [API Surface](#8-api-surface)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Deployment](#10-deployment)
11. [Related Documentation](#11-related-documentation)

---

## 1. Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                 │
│                                                                 │
│  React 19 + React Router 8 (SSR)                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Routes   │  │ XState   │  │ Web Workers  │  │ Direct S3 │  │
│  │ (loaders/ │  │ Machines │  │ (AI/ML via   │  │ Upload    │  │
│  │  actions) │  │ (upload, │  │  ONNX/WebGPU)│  │ (presigned│  │
│  │          │  │  quota…) │  │              │  │  URLs)    │  │
│  └────┬─────┘  └────┬─────┘  └──────────────┘  └─────┬─────┘  │
│       │              │                                │         │
└───────┼──────────────┼────────────────────────────────┼─────────┘
        │              │                                │
        ▼              ▼                                ▼
┌───────────────────────────────┐              ┌───────────────┐
│       Express 5 Server        │              │  S3-compatible│
│                               │              │  Storage      │
│  ┌──────────┐  ┌───────────┐ │              │  (Tigris)     │
│  │  Actions  │  │ API Routes│ │              └───────────────┘
│  │ (business │  │ (/api/*)  │ │
│  │  logic +  │  │           │ │
│  │  Prisma)  │  │           │ │
│  └─────┬─────┘  └───────────┘ │
│        │                      │
│  ┌─────▼──────────────┐      │
│  │   Prisma Client     │      │
│  │   (app/prisma/)     │      │
│  └─────┬──────────────┘      │
└────────┼──────────────────────┘
         │
         ▼
┌───────────────────┐    ┌──────────┐    ┌─────────┐
│   PostgreSQL      │                   │ Stripe  │
│   + pgvector      │                   │(billing)│
└───────────────────┘                   └─────────┘
```

**Request flow:** Browser → React Router SSR loader/action → Action function (`app/.server/*-actions.ts`, with permission checks + Prisma) → PostgreSQL.

**Upload flow:** Browser → multipart presigned URLs from `/api/s3/upload` → direct PUT to S3 bucket → upload machine spawns `createDbItem` actor → `POST /api/items` → server records metadata.

**AI flow:** Browser → Web Worker → HuggingFace Transformers.js (ONNX Runtime, WebGPU) → results back to UI.

---

## 2. Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, React Router 8 (SSR), TailwindCSS 4, shadcn/ui (Radix), XState 5, Framer Motion |
| **Backend** | Express 5, TypeScript (strict mode) |
| **Database** | PostgreSQL, Prisma ORM 7, pgvector extension (semantic search), pg_trgm (full-text) |
| **Storage** | AWS S3-compatible (Tigris on Fly.io), multipart upload via presigned URLs |
| **AI/ML** | HuggingFace Transformers.js, ONNX Runtime (WebGPU/WASM), Whisper |
| **Search** | pgvector + embeddings (full-text and semantic search) |
| **Auth** | better-auth (OAuth: GitHub, Google, Microsoft) |
| **Payments** | Stripe (subscriptions, webhooks) |
| **Testing** | Vitest, Playwright |
| **Build** | Vite 7, pnpm, Docker (multi-stage) |

---

## 3. Core Features

### File Management
- **Personal Stash** — private file storage with folders, collections, favorites, and trash
- **Workspaces** — shared spaces with role-based access (Owner / Admin / Member / Viewer)
- **Collections** — group files across folders by topic or project
- **Pins** — personal bookmarks surfaced at `/:me/stash/pinned`, ordered by user-defined position
- **Versioning** — track file history over time
- **Trash** — soft-delete with restore, permanent deletion

### Upload
- Multipart S3 uploads via presigned URLs (files go directly from browser to S3)
- Concurrent upload queue with configurable parallelism
- Real-time progress tracking, pause/resume, quota enforcement
- XState state machines orchestrate the full lifecycle

### Search
- **Semantic search** via pgvector embeddings (HNSW cosine similarity on 768-dim vectors)
- **Full-text search** via PostgreSQL `pg_trgm` trigram matching with filters (type, date, workspace)

### AI Features (Browser-Side)
- **Transcription** — Whisper speech-to-text with automatic language detection (120+ languages)
- **Image Captioning** — generate alt-text for uploaded images
- **Summarization** — extract key points from audio/text content
- **Translation** — multi-language text translation
- **Embeddings** — vector embeddings for semantic search indexing
- **PDF OCR** — per-page text extraction (GLM-OCR / Florence-2), streamed into the search index
- **Chat** — conversational AI interface
- All inference runs in Web Workers via ONNX Runtime (WebGPU with WASM fallback), serialized through the shared priority queue in `app/workers/ai-queue.ts`

### Document Reading
- **Markdown reader** — streamed body, server-extracted outline, Monaco-tokenized code fences, mermaid diagrams
- **Code viewer** — Monaco with cross-file type acquisition resolved from other uploaded files

### Sharing & Collaboration
- Share links with granular permissions (read / write)
- Comments and discussion threads on items
- Activity notifications
- Workspace invitations

### Billing
- Stripe subscription management with multiple storage tiers
- Quota enforcement (normal / warning / critical / exceeded states)
- Webhook-driven subscription state sync

### Settings
- Profile, account, security, billing, notifications, appearance
- Dark/light theme, responsive layout with mobile sidebar

---

## 4. Data Model

The database schema is split across individual files in `prisma/models/*.prisma` and merged at build time. PostgreSQL extensions: `vector` (pgvector) and `pg_trgm`.

### Core Entities

```
User ──┬── Workspace ──── WorkspaceMember (role-based)
       │        │
       │        ├── Item (file / folder / collection) ── Permission
       │        │        │
       │        │        ├── File / Folder / Image / Video / Audio / Pdf / Markdown (1:1 facets)
       │        │        ├── CollectionMember (self M:N — collection = Item type='collection')
       │        │        ├── Comment
       │        │        ├── ItemVersion
       │        │        ├── Thumbnail
       │        │        ├── Favorite
       │        │        ├── PinItem (per-user)
       │        │        ├── Search ── SearchChunk (per-passage vectors)
       │        │        └── Activity ── ItemAction / AccessAction
       │        │
       │        ├── ShareLink ── Permission
       │        ├── Invitation ── InvitationRecipient ── Permission
       │        └── AuditLog
       │
       ├── Quota
       ├── Subscription ── StoragePlan
       ├── Drive
       ├── Notification
       └── Session / Account / Verification (auth)
```

### Key Models (56 total)

The schema spans 56 models and 24 enums. A collection is **not** a separate model — it is an `Item` with `type='collection'`, with membership tracked by the `CollectionMember` self-relation. The legacy `Collection`, `CollectionItem`, `Metadata`, and `Tag` models were removed.

| Model | Purpose |
|-------|---------|
| `User` | Account, profile, linked OAuth accounts |
| `Item` | File, folder, or collection — the central entity (faceted by `File`/`Folder`/`Image`/`Video`/`Audio`/`Pdf`/`Markdown`) |
| `CollectionMember` | Item ↔ collection membership (self M:N) |
| `Workspace` / `WorkspaceMember` | Collaborative space + role-based membership |
| `Permission` | Per-item or per-share access grants |
| `Quota` / `StoragePlan` / `Subscription` | Storage usage, plan limits, Stripe state |
| `ShareLink` | Public/private share URLs |
| `Invitation` / `InvitationRecipient` | Multi-recipient invitation lifecycle |
| `Comment` | Discussions on items (one per user per item) |
| `Activity` / `ItemAction` (+17 action models) / `AuditLog` | Event log of user actions |
| `Search` / `SearchChunk` | Document + per-passage embedding vectors |
| `Favorite` / `PinItem` | Per-user item state |
| `Notification` | User notification feed |

> Full schema profile (every model, enum, index, and the 5 PL/pgSQL functions + 9 triggers): [`docs/data_profile_stashly _prisma_schema.md`](data_profile_stashly%20_prisma_schema.md).

---

## 5. Layer Architecture

### Routes → Actions → Prisma

The repository/service split has been collapsed into a single **actions layer**. Each action file holds plain exported functions that combine business logic, permission checks, and direct Prisma access.

```
app/routes/              Route loaders/actions (data fetching, mutations) — call action functions
        │                imported as `@/services/*`
        ▼
app/.server/*-actions.ts Plain exported functions — business logic + permission enforcement + Prisma
        │                `@/services/*` → app/.server/*  (see tsconfig.json paths)
        ▼
app/.server/db.ts        Prisma client singleton (generated client in app/prisma/) → PostgreSQL
```

### Routes (`app/routes/`)

Route modules export `loader` (GET) and `action` (POST/PUT/DELETE) functions plus a default React component. Loaders check sessions and redirect unauthenticated users. **Routes never call Prisma directly** — they import action functions from `app/.server/` via the `@/services/*` alias.

```typescript
import { redirect } from 'react-router'
import { auth } from '@/services/auth'
import type { Route } from './+types/route'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')
  return { user: session.user }
}
```

> **Dot-server plugin:** React Router's build rejects a route whose *client-bundled* exports can reach a server module. It strips server code from `loader`, `action`, `middleware` and `headers` only — so a `@/services/*` import is fine when just those touch it (`app/routes/settings/billing.tsx` imports from `@/services/*` in five places and builds clean), and fails when anything else does. It reads the **import graph, not usage**: an import nothing references still fails. Dev never surfaces this — `pnpm build` is the only check.

### Actions (`app/.server/*-actions.ts`)

No classes — every action file exports plain functions. Permissions are enforced inline. The action functions own the full chain: validation → permission check → Prisma → return.

```typescript
// In a route loader/action:
import { getCollectionForUser } from '@/services/collection-actions'
const collection = await getCollectionForUser(session.user.id, collectionId)
```

| Action file | Responsibility |
|---------|---------------|
| `item-actions.ts` | Item CRUD, `paginateItems`, `defaultItemSelect`, `createUploadedItem`, `updateItemOpenedAt`, `getFileItem`, `upsert*Facet` |
| `collection-actions.ts` | Collection CRUD, member add/remove (size is DB-trigger maintained) |
| `workspace-actions.ts` | Workspace + membership |
| `permission-actions.ts` | Per-item access grants |
| `share-actions.ts` | Share link CRUD |
| `invitation-actions.ts` | Email invitation lifecycle |
| `comment-actions.ts` | Threaded comments on items |
| `version-actions.ts` | File versions, restore |
| `subscription-actions.ts` | Stripe subscription state |
| `storage-actions.ts` / `storagePlan-actions.ts` | Storage usage + plans |
| `quota-actions.ts` | Quota deltas on trash/restore/delete |
| `notification-actions.ts` | Notification feed |
| `settings-actions.ts` | User settings |
| `user-actions.ts` | User profile lookups |
| `drive-actions.ts` | Drive provisioning |
| `thumbnail-actions.ts` | Thumbnail records (presign + PATCH) |
| `pin-actions.ts` | Pinned items — `pinItem`, `unpinItem`, `reorderPin`, `isPinned`, `getPinnedItems` (idempotent, cursor-paginated) |
| `lock-actions.ts` | Item edit locks (`LockedItem`) |
| `search-actions.ts` | Semantic/full-text search — `mapItemToSearch`, chunked embeddings (`SEARCH_VECTOR_DIM = 768`), raw-SQL vector writes |
| `activity-actions.ts` | Activity feed (uses `createActivity` fire-and-forget) |
| `source-resolution-actions.ts` | Code viewer cross-file type acquisition — `getProjectConfig`, `getSourceFiles` (permission-gated) |

Models still without dedicated action files: `Favorite`, `AuditLog`, `Trash/TrashItem`, `View`.

Non-action server modules alongside them: `db.ts` (the Prisma client), `auth.ts`, `s3.ts`, `stripe.ts`, `email.ts`, `onboard.ts`, `sidebar.ts`, `breadcrumbs.ts`, `theme.ts`, `metrics.ts`, `notification-events.ts`.

### Search Helper

All action files use `searchFactory` from `@/utils/search` for consistent paginated, filterable list operations. Filter builders live in `app/utils/filters/` (one file per entity, e.g. `item.filters.ts`), with the Zod shapes in `@/schemas/filters.schemas`.

> ⚠️ `searchFactory` does NOT auto-apply `defaultInclude`. Pass `include` explicitly on every `searchActivities` / `searchItems` call or relations will be omitted.

```typescript
import { searchFactory } from '@/utils/search'
import { buildItemFilters } from '@/utils/filters/item.filters'
```

### Error Handling

All action functions use `StashlyError` and `StashlyErrorCode` from `@/utils/api.errors` for consistent typed errors.

```typescript
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'

if (!item) {
  throw new StashlyError(StashlyErrorCode.ITEM_NOT_FOUND)
}
```

Two error shapes reach route handlers and they disagree on the field name: `StashlyError` exposes the HTTP status as `status`, while the ad-hoc guard errors from `throwGuardError` in `workspace-actions.ts` set `statusCode`. Route handlers normalise both through `toErrorInfo` rather than duck-typing one of them:

```typescript
import { toErrorInfo } from '@/utils/api.errors'

} catch (e) {
  const err = toErrorInfo(e)
  return data(
    { error: err.message ?? 'An error occurred' },
    { status: err.status ?? 500 }
  )
}
```

> `toErrorInfo` returns `status: undefined` for anything that isn't a plausible HTTP error code (400–599), so each call site keeps its own fallback — `?? 500` for most, `?? 404` for detail lookups.

---

## 6. Key Subsystems

### Upload System

The upload pipeline uses XState state machines in a parent-child actor pattern:

1. **User drops files** → `upload/upload.machine.ts` (parent) spawns one `reviset/file.machine.ts` per file
2. **File machine** requests presigned URLs from `/api/s3/upload` (action: `get-presigned-url`)
3. **File machine** uploads chunks in parallel directly to S3, verifies ETags
4. **Concurrency** is gated inside `upload.machine.ts` itself via `maxConcurrentUploads` (default 10) — there is no separate queue actor
5. **Quota pre-check**: the file machine invokes `checkQuota` from `quota/quota.actors.ts` (quota is charged on the server, in `createUploadedItem`). `quota/quota.machine.ts` is not spawned (tech-debt #41)
6. On `upload.done`, the parent spawns a `createDbItem` actor → `POST /api/items` (intent: `create_upload_item`) → `createUploadedItem()` writes the row, resolving any intermediate folders from the S3 key so dropped hierarchies survive
7. After DB write, status flips to `'itemCreated'` — this is the gate that triggers the thumbnail pipeline (prevents FK violations on `Thumbnail.itemId`)

Key files: `app/machines/upload/`, `app/machines/reviset/`, `app/machines/quota/`, `app/machines/multipart/`. The **active** per-file actor is `reviset/file.machine.ts` (imported by `upload.machine.ts:12`) — the folder name is misleading, and the `upload/file.machine.ts` sibling that looked authoritative was deleted in the 2026-08-14 purge along with the standalone queue/quota/multipart prototypes under `machines/actors/`.

See: [`docs/upload-multipart.md`](upload-multipart.md), [`docs/thumbnail-pipeline.md`](thumbnail-pipeline.md)

### Thumbnail Pipeline

Client-side, progressive WebP generation. Scheduling is the XState manager in `app/machines/thumbnail/` (`USE_THUMBNAIL_MACHINE = true`); the legacy hook orchestrator `useThumbnail` survives behind that switch. Gated on `status === 'itemCreated'` (not `'done'`). All output is one WebP per item at `thumbnails/{itemId}.webp` in S3, overwritten as later stages complete; the URL written to `Thumbnail.url` carries a `?v={stage}` cache-buster.

| Stage | Output |
|-------|--------|
| 1 | 8×8 blur preview — local `URL.createObjectURL` only, **not** persisted to S3/DB (image: tiny thumbnail · video: frame grab · PDF: first page) |
| 2 | 512px resize → presign → PUT to S3 (`?v=2`) — PDFs stop here |
| 3 | ViT saliency crop (`Xenova/vit-base-patch16-224`) — **images only** (`?v=3`) |

**Stage 0 (hex color) was removed in V2.** Heavy compute (PDF.js, canvas resize) runs in a singleton worker (`thumbnail.compute.worker.ts`, concurrency 1); stage-3 image AI runs on the main thread via `thumbnail.ai.ts` (WebGPU). Live stage updates ride a swappable signal layer (`app/hooks/thumbnail-signal/`, currently the keyed-fetcher implementation).

Pattern: `GET /api/thumbnails/:itemId/presign` → PUT to S3 → `PATCH /api/thumbnails/:itemId`. Any hex-color (`#…`) placeholder is filtered out of gallery queries.

See: [`docs/thumbnail-pipeline.md`](thumbnail-pipeline.md)

### Markdown Reader

`app/components/views/item-page/markdown-stage.tsx` renders uploaded `.md` files. The body streams from S3 as an unawaited loader promise consumed by `<Suspense>` + `<Await>`, so the shell paints first; headings are extracted server-side into an outline rail.

Fenced code is tokenized by **Monaco's own tokenizer** (`colorizeCode` in `app/.client/monaco.ts`), so a code block in a document and the same file in the code viewer share one theme object rather than two palettes. ```mermaid fences render as SVG diagrams via a lazily imported `app/.client/mermaid.ts` — client-side deliberately, since mermaid needs real text metrics, bakes hex into its output, and would become an SSRF surface if it rendered uploaded diagrams server-side.

See: [`docs/markdown-reader.md`](markdown-reader.md)

### Code Viewer

Uploaded source files open in Monaco (`app/.client/monaco.ts`, "Ink" theme). For `.ts`/`.tsx`, types are acquired **across uploaded files**: the client alias-maps imports, then `source-resolution-actions.ts` walks up to the nearest `tsconfig.json`/`jsconfig.json` to establish a project root (`getProjectConfig`) and returns the referenced files' text (`getSourceFiles`), resolving extensions and `index` files the way TypeScript would. Every read re-checks the same `read` permission the viewer enforces, and resolution is scoped to the owner so a project switch drops stale extra-libs.

See: [`docs/code-viewer.md`](code-viewer.md), [`docs/code-viewer-cross-file-options.md`](code-viewer-cross-file-options.md)

### Activity Feed

`activity-actions.ts` records create / upload / rename / move / copy / trash / restore / delete / share / comment / version / permission / **pin / collection (add·remove·empty) / favorite / bucket-empty** events on items — each backed by a dedicated action model (17 in total) joined to `ItemAction`. Activities fire-and-forget via `Promise.resolve().then(() => createActivity({...})).catch(() => {})` (so synchronous throws inside `createActivity` are caught). Rendered as a vertical timeline in `ActivityFeed` and the `ItemActivityDrawer`.

Routes: `GET /api/activities` (resource route).

### Notifications (SSE)

A Postgres trigger fires `pg_notify('notifications', …)` on every `Notification`
insert/update/delete. A single `LISTEN` connection per instance — pinned to
`globalThis` so dev HMR doesn't multiply it — receives those and fans them out
to that user's open `EventSource` streams at `GET /api/notifications/stream`.
Firing at the DB level means every writer works, including seeds, raw SQL and
other instances.

Every stream write is guarded: a disconnected client must not be able to take
the server down, so `send` is wrapped and the first throw tears the connection
down. A 25s heartbeat keeps intermediaries from dropping idle connections, and
compression is configured to skip `text/event-stream`.

See: [`docs/notifications-sse.md`](notifications-sse.md)

### Observability

`app/.server/metrics.ts` is a dependency-free Prometheus registry exposed at
`/api/metrics` (token-gated for scraping). It tracks the signals that break
first under a synchronized notification burst: event-loop lag, NOTIFY volume,
open SSE connections, `mark_all_read` count, and pg pool saturation.

Browsers also report *client-side* degradation there over `POST`: when an
optional stage falls back — no WebGPU, a PDF that won't render, a model that
won't load — it increments `stashly_client_degraded_total{stage,reason}` via
`sendBeacon`. Those stages fail inside a `catch` on the user's machine, so
without this the server sees nothing at all. Both labels are closed enums, so
an untrusted client can't inflate series cardinality.

### AI Pipeline

All AI inference runs **in the browser** via Web Workers, keeping the server stateless for ML:

```
Main Thread → Web Worker → ONNX Runtime (WebGPU or WASM fallback)
                              │
                              ├── Xenova/mms-lid-126 (language detection)
                              ├── onnx-community/whisper-large-v3-turbo (speech-to-text)
                              ├── Xenova/nllb-200-distilled-600M (translation)
                              ├── Xenova/paraphrase-multilingual-MiniLM-L12-v2 (pipeline tagging)
                              ├── Xenova/all-mpnet-base-v2 (search embeddings, 768-dim)
                              ├── Xenova/vit-base-patch16-224 (thumbnail saliency)
                              └── onnx-community/GLM-OCR-ONNX · Florence-2-*-ft (PDF OCR)
```

- Hardware auto-detection: uses GPU if available, falls back to CPU/WASM
- Chunked processing for long audio files
- All inference funnels through a single WebGPU context via the priority queue in `app/workers/ai-queue.ts`
- When an optional stage falls back (no WebGPU, a model that won't load), the client reports it to `/api/metrics` — see [Observability](#observability)

Key files: `app/workers/` (`ai-queue.ts`, `stash.ai.ts`, `embedding.ai.ts`, `thumbnail.ai.ts`, `ocr.ai.ts`, `ocr-florence.ai.ts`), `app/machines/pipeline/`, `app/.client/stashly-ai.ts`

See: [`docs/ai-pipeline.md`](ai-pipeline.md)

### Search System

Search is powered entirely by PostgreSQL + pgvector:

| Mode | Backend | Use Case |
|------|---------|----------|
| Full-text | PostgreSQL (`pg_trgm`) | Keyword search, faceted filtering |
| Semantic | pgvector (PostgreSQL) | "Find similar" queries, meaning-based search |

Embeddings are generated in-browser with `Xenova/all-mpnet-base-v2` (**768-dim** vectors). The document-level `Search.vector` is indexed HNSW with `vector_cosine_ops`; long documents are split into ~300-token passages stored in `SearchChunk` (one embedding per chunk) so matches can be highlighted.

Key files: `app/.server/search-actions.ts`, `app/utils/filters/`, `app/utils/search-query.ts` (`SEARCH_VECTOR_DIM`), `app/workers/embedding.ai.ts`

See: [`docs/search.md`](search.md)

### Quota & Storage

Storage quotas are tracked per user with four states:

| State | Meaning |
|-------|---------|
| `normal` | Under quota — uploads allowed |
| `warning` | Approaching limit — user notified |
| `critical` | Near limit — restricted operations |
| `exceeded` | Over quota — uploads blocked |

The quota state machine reacts to upload, copy, restore, and delete events.

Key files: `app/machines/quota/`, `app/.server/quota-actions.ts`

See: [`docs/quota-and-machines.md`](quota-and-machines.md)

### Billing (Stripe)

- Subscriptions managed via Stripe Checkout and Customer Portal
- Webhook handler at `/api/stripe` syncs subscription state to database
- Storage plans define quota limits per tier
- `subscription-actions.ts` and `storagePlan-actions.ts` own the data layer (no repository classes)

---

## 7. State Machines (XState)

Complex async workflows are modeled as XState 5 state machines in `app/machines/`:

| Machine | Location | Purpose |
|---------|----------|---------|
| `upload.machine` | `upload/` | Parent orchestrator — spawns file actors, gates concurrency via `maxConcurrentUploads` (default 10), runs `createDbItem` on upload done |
| `file.machine` | `reviset/` | Individual file upload lifecycle — **the active per-file actor**, imported by `upload.machine:12` despite the folder name |
| `thumbnail-manager.machine` | `thumbnail/` | Thumbnail scheduler — admits work, caps concurrency, spawns one item actor per item |
| `thumbnail-item.machine` | `thumbnail/` | Per-item stage 1→3 lifecycle with retry/attempt tracking (`attempt-store.ts`) |
| `s3.multipart.concurrent` / `.stream` | `multipart/` | Concurrent + streaming multipart utilities |
| `pipeline.machine` | `pipeline/` | Full audio pipeline (detect → transcribe → summarize → tag) |
| `subscription.machine` | `subscription/` | Stripe subscription state |
| `onboard.machine` | `onboard/` | New user setup flow |
| `selection.machine` | `selection/` | Multi-select UI state |
| `confirm.machine` | top-level | Confirmation dialog state |
| `sessionStorage.machine` | `session/` | Auth/session helpers |

Every machine listed above is live. The dead ones this table used to carry —
the `ai/` pair, the three `queue.machine` copies, `actors/quota.machine.ts`,
`actors/multipart.machine.ts`, `upload/file.machine.ts`, `sidebar.machine` and
`infinite-scroll.machine` — were deleted on 2026-08-14. `app/machines/actors/`
survives only as a shared `types.ts`; there is no `app/machines/ai/`. The live
AI path is `pipeline/` plus the modules in `app/workers/`.

`quota/quota.machine.ts` is left out of the table because nothing spawns it:
`upload.machine` spawned it until 2026-10-26, but nothing ever sent it an
event (tech-debt #41). It is kept for a possible shared quota actor. The live
quota code on the client is `quota.actors.ts`, whose `checkQuota` the file
machine invokes directly.

Machines are connected to React via `@xstate/react`. Parent machines spawn child actors for per-item or per-task state.

---

## 8. API Surface

All API routes live in `app/routes/api/` and are resource routes (no UI component).

> Routes are declared in `app/routes.ts`. Many resources expose both a top-level collection route and item-scoped nested routes (same handler, distinct `id`) — e.g. `/api/items/:itemId`, `/api/items/:itemId/{permissions,versions,comments,shares,favorites,invitations,download}`, `/api/collections/:collectionId/items`, `/api/users/:userId/{items,workspaces}`, `/api/workspaces/:workspaceId/{members,permissions}`.

### Items & Collections
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/items` | List / create items (trash/restore/delete via `intent` on the items handler) |
| GET | `/api/items/:itemId/download` | Item download |
| GET/POST | `/api/collections` | List / create collections |
| GET | `/api/collections/:collectionId/items` | Items in a collection |
| GET/POST | `/api/favorites` | List / toggle favorites |
| GET/POST | `/api/locks` | Acquire / release item edit locks |
| GET/POST | `/api/pins` | List / check pinned items (GET: `intent: list\|check`); pin / unpin / reorder (POST: `intent: pin\|unpin\|reorder`) |

### Workspaces & Members
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/workspaces` | List / create workspaces (+ `:workspaceId`, `/members`, `/permissions`) |
| GET/PATCH | `/api/members` | List / update workspace members |
| GET | `/api/users` | User lookups (+ `:userId`, `/items`, `/workspaces`) |
| POST | `/api/invitations` | Invite users (workspace or per-item) |
| GET/POST | `/api/permissions` | Manage item permissions |

### Sharing & Comments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/shares` | Create share links |
| GET/POST | `/api/comments` | List / create comments |

### Storage & Upload
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/s3/upload`, `/api/s3/multipart` | Multipart upload operations (JSON body, `action` discriminator: `create-multipart-upload` / `get-presigned-url` / `complete-multipart-upload` / `abort-multipart-upload`) |
| GET | `/api/quota` | Check storage quota |
| GET | `/api/images` | Image listing for gallery |
| GET | `/api/thumbnails/:itemId/presign` | Get presigned URL for thumbnail upload |
| POST/PATCH | `/api/thumbnails/:itemId` | Create / update thumbnail record |
| GET | `/api/thumbnails/:itemId/source` | Original download URL, for the on-demand thumbnail backfill |

### AI
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai/caption` | Image captioning |
| POST | `/api/ai/transcribe` | Audio transcription |
| POST | `/api/ai/translate` | Text translation |
| POST | `/api/ai/summarize` | Content summarization |
| POST | `/api/ai/embed` | Generate embeddings |
| POST | `/api/ai/suggestion` | AI-powered suggestions |
| POST | `/api/ai/chat` | Conversational AI |

### Search, Billing & Activity
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/search/:type` | Full-text or semantic search |
| POST | `/api/stripe` | Stripe webhook handler |
| GET | `/api/subscription` | Subscription status |
| GET | `/api/notifications` | Notification feed |
| GET | `/api/notifications/stream` | SSE feed of live notification changes, fed by Postgres `LISTEN`/`NOTIFY` |
| GET/POST | `/api/metrics` | Prometheus exposition (GET, token-gated); browsers `sendBeacon` degraded-stage reports (POST, session-gated) |
| GET | `/api/source-types` | Source-type lookup |
| GET | `/api/activities` | Item activity timeline |
| GET/POST | `/api/versions` | List / create file versions |
| GET | `/api/sidebar` | Sidebar tree data |
| GET/POST | `/api/settings` | User settings |
| GET/POST | `/api/theme` | Theme preference |
| GET/POST | `/api/view` | Layout/view preference |
| GET | `/api/health` | Health check |
| ALL | `/api/auth/*` | better-auth catch-all handler (OAuth callbacks, session endpoints) |

---

## 9. Authentication & Authorization

### Authentication

Powered by **better-auth** with Prisma adapter. Supports OAuth via GitHub, Google, and Microsoft.

```
app/.server/auth.ts    — Auth configuration, providers, hooks
app/routes/auth/       — Sign-in / sign-out pages
```

On user creation, an auto-onboard hook provisions:
- S3 storage bucket
- Default storage quota
- Free-tier subscription
- Root drive folder

### Authorization

Two-level permission model:

1. **Workspace roles** — Viewer / Member / Admin / Owner (`WorkspaceMemberRole`)
2. **Item permissions** — Read / Write / Owner grants (`PermissionRole`) per item or share link

Both are enforced **inline inside the action files** (`app/.server/*-actions.ts`) — there is no separate repository or service layer. Every action validates the caller before any Prisma mutation. Routes only check session existence and redirect to sign-in if unauthenticated.

---

## 10. Deployment

### Docker

Multi-stage Dockerfile:

```
Stage 1: Install all dependencies (npm ci)
Stage 2: Install production-only dependencies (--omit=dev)
Stage 3: Build application (npm run build)
Stage 4: Runtime (node:20-alpine) — copy prod deps + build output, run npm start
```

### Environment Variables

| Category | Variables |
|----------|-----------|
| **Database** | `DATABASE_URL` |
| **Auth** | `SESSION_SECRET`, `BETTER_AUTH_SECRET`, `BASE_URL`, OAuth client IDs/secrets |
| **Storage** | `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_ENDPOINT_URL`, `AWS_REGION` |
| **Payments** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

### Commands

```bash
pnpm dev                  # Dev server (Express + Vite HMR) at http://localhost (PORT env, default 80)
pnpm build                # Production build
pnpm start                # Production server
pnpm typecheck            # Type-check (typegen + tsc)
pnpm format               # Prettier
pnpm prisma migrate dev   # Run database migrations
pnpm test                 # Run unit tests (Vitest, app/utils/__tests__/)
pnpm test:watch           # Unit tests in watch mode
pnpm test:e2e             # E2E tests (Playwright, requires dev server)
pnpm test:e2e:ui          # E2E tests with Playwright UI
```

---

## 11. Related Documentation

| Document | Topic |
|----------|-------|
| [`docs/data_profile_stashly _prisma_schema.md`](data_profile_stashly%20_prisma_schema.md) | Full schema profile — models, enums, indexes, DB functions & triggers |
| [`docs/ai-pipeline.md`](ai-pipeline.md) | AI pipeline architecture (Transformers.js, Whisper, summarization) |
| [`docs/search.md`](search.md) / [`docs/semantic-search.md`](semantic-search.md) | Semantic search, pgvector + embeddings |
| [`docs/upload-multipart.md`](upload-multipart.md) | S3 multipart upload state machine and streaming |
| [`docs/thumbnail-pipeline.md`](thumbnail-pipeline.md) | Progressive WebP thumbnail pipeline (V2, stages 1–3) |
| [`docs/quota-and-machines.md`](quota-and-machines.md) | Quota system, XState integration |
| [`docs/routing-and-ui.md`](routing-and-ui.md) | Route handles, sidebars, pagination patterns |
| [`docs/markdown-reader.md`](markdown-reader.md) | Markdown stage — streaming body, outline rail, Monaco-tokenized fences, mermaid |
| [`docs/code-viewer.md`](code-viewer.md) / [`docs/code-viewer-cross-file-options.md`](code-viewer-cross-file-options.md) | Monaco code viewer and cross-file type acquisition |
| [`docs/notifications-sse.md`](notifications-sse.md) | Postgres `LISTEN`/`NOTIFY` → SSE notification stream |
| [`docs/suggestions-view.md`](suggestions-view.md) | Suggested-items / recency surface |
| [`docs/sharing-and-invitations.md`](sharing-and-invitations.md) | Share links, invitations, permission model |
| [`docs/roadmap.md`](roadmap.md) | Product roadmap and shipped phases |
| [`CLAUDE.md`](../CLAUDE.md) | Developer conventions, path aliases, workflows |
