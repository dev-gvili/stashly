# Stashly — Project Overview

Stashly is a full-stack file management platform for personal stashes and collaborative workspaces. Users upload, organize, search, and share files — with AI-powered features like transcription, captioning, and semantic search running directly in the browser via WebGPU.

Built with React Router 7 (SSR), Express 5, PostgreSQL (Prisma), and S3-compatible storage.

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
│  React 19 + React Router 7 (SSR)                               │
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
| **Frontend** | React 19, React Router 7 (SSR), TailwindCSS 4, shadcn/ui (Radix), XState 5, Framer Motion |
| **Backend** | Express 5, TypeScript (strict mode) |
| **Database** | PostgreSQL, Prisma ORM 7, pgvector extension (semantic search), pg_trgm (full-text) |
| **Storage** | AWS S3-compatible (Tigris on Fly.io), multipart upload via presigned URLs |
| **AI/ML** | HuggingFace Transformers.js, ONNX Runtime (WebGPU/WASM), Whisper, Tesseract OCR |
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
- **Versioning** — track file history over time
- **Trash** — soft-delete with restore, permanent deletion

### Upload
- Multipart S3 uploads via presigned URLs (files go directly from browser to S3)
- Concurrent upload queue with configurable parallelism
- Real-time progress tracking, pause/resume, quota enforcement
- XState state machines orchestrate the full lifecycle

### Search
- **Semantic search** via pgvector embeddings (cosine similarity on 384-dim vectors)
- **Full-text search** via PostgreSQL `search` field with filters (type, date, workspace)

### AI Features (Browser-Side)
- **Transcription** — Whisper speech-to-text with automatic language detection (120+ languages)
- **Image Captioning** — generate alt-text for uploaded images
- **Summarization** — extract key points from audio/text content
- **Translation** — multi-language text translation
- **Embeddings** — vector embeddings for semantic search indexing
- **Chat** — conversational AI interface
- All inference runs in Web Workers via ONNX Runtime (WebGPU with WASM fallback)

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
       │        ├── Item (file/folder) ── Permission
       │        │        │
       │        │        ├── Collection (many-to-many)
       │        │        ├── Comment
       │        │        ├── Version
       │        │        ├── Thumbnail
       │        │        ├── Metadata
       │        │        ├── Tag
       │        │        └── Favorite
       │        │
       │        ├── ShareLink ── Permission
       │        ├── Invitation
       │        └── Activity / AuditLog
       │
       ├── Quota
       ├── Subscription ── StoragePlan
       ├── Drive
       ├── Notification
       └── Session / Account / Verification (auth)
```

### Key Models (44 total)

| Model | Purpose |
|-------|---------|
| `User` | Account, profile, linked OAuth accounts |
| `Item` | File or folder — the central entity |
| `Workspace` | Collaborative space with members |
| `Permission` | Per-item or per-share access grants |
| `Collection` | Named groupings of items |
| `Quota` | Storage usage tracking (used / total) |
| `Subscription` | Stripe subscription state |
| `ShareLink` | Public/private share URLs |
| `Comment` | Threaded discussions on items |
| `Activity` | Audit log of user actions |
| `Notification` | User notification feed |

---

## 5. Layer Architecture

### Routes → Actions → Prisma

The repository/service split has been collapsed into a single **actions layer**. Each action file holds plain exported functions that combine business logic, permission checks, and direct Prisma access.

```
app/routes/              Route loaders/actions (data fetching, mutations) — call action functions
        │
        ▼
app/.server/*-actions.ts Plain exported functions — business logic + permission enforcement + Prisma
        │
        ▼
app/prisma/              Generated Prisma client → PostgreSQL
```

### Routes (`app/routes/`)

Route modules export `loader` (GET) and `action` (POST/PUT/DELETE) functions plus a default React component. Loaders check sessions and redirect unauthenticated users. **Routes never call Prisma directly** — they import action functions via relative paths from `app/.server/`.

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  return { user: session.user }
}
```

> Note: The dot-server plugin blocks `@/services/*` path-alias imports inside `app/routes/` files. Use relative imports from `.server/` instead.

### Actions (`app/.server/*-actions.ts`)

No classes — every action file exports plain functions. Permissions are enforced inline. The action functions own the full chain: validation → permission check → Prisma → return.

```typescript
// In a route loader/action:
import { getCollectionForUser } from '../../.server/collection-actions'
const collection = await getCollectionForUser(session.user.id, collectionId)
```

| Action file | Responsibility |
|---------|---------------|
| `item-actions.ts` | Item CRUD, `paginateItems`, `defaultItemSelect`, `createUploadedItem`, `touchOpenedAt`, `getFileItem` |
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
| `activity-actions.ts` | Activity feed (uses `createActivity` fire-and-forget) |

Models still without dedicated action files: `Favorite`, `AuditLog`, `Trash/TrashItem`, `View`. Search action lives under `app/.server/search/`.

### Search Helper

All action files use `searchFactory` from `app/utils/search.ts` for consistent paginated, filterable list operations. Filter builders live in `app/.server/filters/`.

> ⚠️ `searchFactory` does NOT auto-apply `defaultInclude`. Pass `include` explicitly on every `searchActivities` / `searchItems` call or relations will be omitted.

### Error Handling

All action functions use `ApiError` and `ApiErrorCode` from `app/.server/api.errors.ts` for consistent typed errors. **Do not import `ApiError` in route files** — the dot-server plugin rejects `@/services/*` imports in `app/routes/`. Inside route action handlers, duck-type the error: `const err = e as { statusCode?: number; message?: string }`.

---

## 6. Key Subsystems

### Upload System

The upload pipeline uses XState state machines in a parent-child actor pattern:

1. **User drops files** → `upload/upload.machine.ts` (parent) spawns one `upload/file.machine.ts` per file
2. **File machine** requests presigned URLs from `/api/s3/upload` (action: `get-presigned-url`)
3. **File machine** uploads chunks in parallel directly to S3, verifies ETags
4. **`actors/queue.machine.ts`** limits concurrent uploads (default: 5 slots)
5. **`actors/quota.machine.ts`** checks storage limits before each upload
6. On `upload.done`, the parent spawns a `createDbItem` actor → `POST /api/items` (intent: `create_upload_item`) → `createUploadedItem()` writes the row
7. After DB write, status flips to `'itemCreated'` — this is the gate that triggers the thumbnail pipeline (prevents FK violations on `Thumbnail.itemId`)

Key files: `app/machines/upload/`, `app/machines/actors/`, `app/machines/multipart/`. The `app/machines/reviset/` directory holds a legacy actor; `upload/file.machine.ts` is the active path.

See: [`docs/upload-multipart.md`](upload-multipart.md), [`docs/thumbnail-pipeline.md`](thumbnail-pipeline.md)

### Thumbnail Pipeline

Client-side, 5-stage progressive WebP generation. Gated on `status === 'itemCreated'` (not `'done'`). All output is one WebP per item at `thumbnails/{itemId}.webp` in S3, overwritten as later stages complete.

| Stage | Output |
|-------|--------|
| 0 | Color hash placeholder (hex, no S3) |
| 1 | 8×8 blur preview |
| 2 | 512px resize |
| 3 | ViT saliency crop with face-aware crop via `FaceDetector` API |
| 4 | Florence-2 caption overlay (currently hidden from gallery — capped at stage 3) |

Pattern: `GET /api/thumbnails/:itemId/presign` → PUT to S3 → `PATCH /api/thumbnails/:itemId`. Hex-color stage-0 placeholders are filtered out of gallery queries.

See: [`docs/thumbnail-pipeline.md`](thumbnail-pipeline.md)

### Activity Feed

`activity-actions.ts` records create / rename / move / trash / restore / delete / copy / share / comment / version events on items. Activities fire-and-forget via `Promise.resolve().then(() => createActivity({...})).catch(() => {})` (so synchronous throws inside `createActivity` are caught). Rendered as a vertical timeline in `ActivityFeed` and the `ItemActivityDrawer`.

Routes: `GET /api/activities` (resource route).

### AI Pipeline

All AI inference runs **in the browser** via Web Workers, keeping the server stateless for ML:

```
Main Thread → Web Worker → ONNX Runtime (WebGPU or WASM fallback)
                              │
                              ├── MMS-LID-256 (language detection)
                              ├── Whisper (speech-to-text)
                              ├── Tiny-Aya (summarization)
                              └── Paraphrase-MultiLingual (embeddings)
```

- Hardware auto-detection: uses GPU if available, falls back to CPU/WASM
- Chunked processing for long audio files
- GPU load balancing across devices for concurrent tasks

Key files: `app/workers/`, `app/machines/ai/`, `app/.server/ai*.ts`

See: [`docs/ai-pipeline.md`](ai-pipeline.md)

### Search System

Search is powered entirely by PostgreSQL + pgvector:

| Mode | Backend | Use Case |
|------|---------|----------|
| Full-text | PostgreSQL | Keyword search, faceted filtering |
| Semantic | pgvector (PostgreSQL) | "Find similar" queries, meaning-based search |

Embeddings are generated with `sentence-transformers/all-MiniLM-L6-v2` (384-dim vectors, cosine distance).

Key files: `app/.server/search/`

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

Key files: `app/machines/quota/`, `app/.server/quota.ts`

See: [`docs/quota-and-machines.md`](quota-and-machines.md)

### Billing (Stripe)

- Subscriptions managed via Stripe Checkout and Customer Portal
- Webhook handler at `/api/stripe` syncs subscription state to database
- Storage plans define quota limits per tier
- `SubscriptionRepository` and `StoragePlanRepository` manage the data layer

---

## 7. State Machines (XState)

Complex async workflows are modeled as XState 5 state machines in `app/machines/`:

| Machine | Location | Purpose |
|---------|----------|---------|
| `upload.machine` | `upload/` | Parent orchestrator — spawns file actors, manages queue, runs `createDbItem` actor on upload done |
| `file.machine` | `upload/` | Individual file upload lifecycle (active implementation) |
| `file.machine` | `reviset/` | Legacy file upload actor (kept for reference) |
| `queue.machine` | `actors/` | Concurrent upload slot management |
| `quota.machine` | `actors/` | Storage quota state tracking |
| `multipart.machine` | `actors/` | Multipart S3 coordination |
| `s3.multipart.*` | `multipart/` | Streaming + presign utilities for multipart upload |
| `ai.machine` | `ai/` | AI task orchestration (caption, transcribe, summarize) |
| `caption.machine` | `ai/` | Focused image captioning pipeline |
| `pipeline.machine` | `pipeline/` | Full audio pipeline (detect → transcribe → summarize → tag) |
| `subscription.machine` | `subscription/` | Stripe subscription state |
| `onboard.machine` | `onboard/` | New user setup flow |
| `selection.machine` | `selection/` | Multi-select UI state |
| `sidebar.machine` | `sidebar/` | Navigation panel state |
| `pagination` | `pagination/` | Lazy-loading pagination |
| `confirm.machine` | top-level | Confirmation dialog state |
| `session/` | `session/` | Auth/session helpers |

Machines are connected to React via `@xstate/react`. Parent machines spawn child actors for per-item or per-task state.

---

## 8. API Surface

All API routes live in `app/routes/api/` and are resource routes (no UI component).

### Items & Collections
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/items` | List / create items |
| POST | `/api/items/trash` | Move items to trash |
| POST | `/api/items/restore` | Restore from trash |
| DELETE | `/api/items/delete` | Permanent deletion |
| GET/POST | `/api/collections` | List / create collections |
| GET/POST | `/api/favorites` | List / toggle favorites |

### Workspaces & Members
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/workspaces` | List / create workspaces |
| GET/PATCH | `/api/members` | List / update workspace members |
| POST | `/api/invitations` | Invite users to workspaces |
| GET/POST | `/api/permissions` | Manage item permissions |

### Sharing & Comments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/shares` | Create share links |
| GET/POST | `/api/comments` | List / create comments |

### Storage & Upload
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/s3/upload` | Multipart upload operations (JSON body, `action` discriminator: `create-multipart-upload` / `get-presigned-url` / `complete-multipart-upload` / `abort-multipart-upload`) |
| GET | `/api/quota` | Check storage quota |
| GET | `/api/thumbnails/:itemId/presign` | Get presigned URL for thumbnail upload |
| POST/PATCH | `/api/thumbnails/:itemId` | Create / update thumbnail record |

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
| GET | `/api/activities` | Item activity timeline |
| GET/POST | `/api/versions` | List / create file versions |
| GET | `/api/sidebar` | Sidebar tree data |
| GET/POST | `/api/settings` | User settings |
| GET/POST | `/api/theme` | Theme preference |
| GET/POST | `/api/view` | Layout/view preference |
| GET | `/api/health` | Health check |

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

1. **Workspace roles** — Owner / Admin / Member / Viewer (checked in services via `requireAtLeastRole`)
2. **Item permissions** — Read / Write grants per item or share link (checked in services via `PermissionRepository`)

Services enforce permissions before any data mutation. Routes check session existence and redirect to sign-in if unauthenticated.

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
pnpm dev                  # Dev server (Express + Vite HMR) at http://localhost:3000
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
| [`docs/ai-pipeline.md`](ai-pipeline.md) | AI pipeline architecture (Transformers.js, Whisper, summarization) |
| [`docs/search.md`](search.md) | Semantic search, pgvector + embeddings |
| [`docs/upload-multipart.md`](upload-multipart.md) | S3 multipart upload state machine and streaming |
| [`docs/thumbnail-pipeline.md`](thumbnail-pipeline.md) | 5-stage progressive WebP thumbnail pipeline |
| [`docs/quota-and-machines.md`](quota-and-machines.md) | Quota system, XState integration |
| [`docs/routing-and-ui.md`](routing-and-ui.md) | Route handles, sidebars, pagination patterns |
| [`docs/sharing-and-invitations.md`](sharing-and-invitations.md) | Share links, invitations, permission model |
| [`docs/roadmap.md`](roadmap.md) | Product roadmap and shipped phases |
| [`CLAUDE.md`](../CLAUDE.md) | Developer conventions, path aliases, workflows |
