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
│  │  Services │  │ API Routes│ │              └───────────────┘
│  │ (business │  │ (/api/*)  │ │
│  │  logic)   │  │           │ │
│  └─────┬─────┘  └───────────┘ │
│        │                      │
│  ┌─────▼──────────────┐      │
│  │   Repositories      │      │
│  │   (Prisma ORM)      │      │
│  └─────┬──────────────┘      │
└────────┼──────────────────────┘
         │
         ▼
┌───────────────────┐    ┌──────────┐    ┌─────────┐
│   PostgreSQL      │                   │ Stripe  │
│   + pgvector      │                   │(billing)│
└───────────────────┘                   └─────────┘
```

**Request flow:** Browser → React Router SSR loader/action → Service (permission check) → Repository (Prisma) → PostgreSQL.

**Upload flow:** Browser → presigned URL from server → direct PUT to S3 bucket → server records metadata.

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

### Key Models (29 total)

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

### Routes → Services → Repositories

```
app/routes/              Route loaders/actions (data fetching, mutations)
        │
        ▼
app/.server/services/    Business logic, permission enforcement, orchestration
        │
        ▼
app/.server/repositories/ Database access via Prisma (auto-generated)
        │
        ▼
app/prisma/              Generated Prisma client → PostgreSQL
```

### Routes (`app/routes/`)

Route modules export `loader` (GET) and `action` (POST/PUT/DELETE) functions plus a default React component. Loaders check sessions and redirect unauthenticated users.

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  return { user: session.user }
}
```

### Services (`app/.server/services/`)

Services enforce permissions before performing operations. They call repositories, never raw Prisma.

```typescript
// Typical service pattern
await workspaceMemberRepository.requireAtLeastRole(userId, workspaceId, 'member')
const item = await itemRepository.create({ ... })
await permissionRepository.create({ ... })
```

| Service | Responsibility |
|---------|---------------|
| `ItemService` | Item CRUD with permission checks |
| `WorkspaceItemService` | Sync item permissions with workspace roles |
| `workspaceMember.service` | Membership management, role changes |
| `shareLink.service` | Share link creation, permission grants |
| `search.service` | Search orchestration (pgvector + embeddings) |

### Repositories (`app/.server/repositories/`)

Auto-generated via `pnpm tsx ./scripts/generateRepository.v2.ts <ModelName>`. Provide typed CRUD, filtering, and pagination. **Do not hand-edit** — regenerate instead.

| Repository | Model |
|------------|-------|
| `ItemRepository` | Items (files/folders) |
| `WorkspaceRepository` | Workspaces |
| `PermissionRepository` | Access grants |
| `CollectionRepository` | Collections |
| `QuotaRepository` | Storage quotas |
| `SubscriptionRepository` | Stripe subscriptions |
| `StoragePlanRepository` | Storage tiers |
| `NotificationRepository` | Notifications |
| `ActivityRepository` | Audit trail |
| `userRepository` | User profiles |
| `shareLinkRepository` | Share links |
| `workspaceMember.repository` | Workspace members |

### Error Handling

All API errors use `ApiError` with typed `StashlyErrorCode` values (70+ codes covering storage, uploads, permissions, AI, and billing). Defined in `app/.server/api.errors.ts`.

---

## 6. Key Subsystems

### Upload System

The upload pipeline uses XState state machines in a parent-child actor pattern:

1. **User drops files** → Upload Manager spawns one File Actor per file
2. **File Actor** requests presigned URL from `/api/s3/presigned`
3. **File Actor** uploads chunks directly to S3 via presigned URLs (multipart for large files)
4. **Queue Machine** limits concurrent uploads (default: 5 slots)
5. **Quota Machine** checks storage limits before each upload
6. Upload complete → server records item metadata in database

Key files: `app/machines/upload/`, `app/machines/upload-v2/`, `app/machines/multipart/`

See: [`docs/upload-multipart.md`](upload-multipart.md)

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

| Machine | Purpose |
|---------|---------|
| `upload.machine` | Parent orchestrator — spawns file actors, manages queue |
| `upload-v2/upload-manager.machine` | Next-gen upload: manager + queue + worker separation |
| `file.machine` | Individual file upload lifecycle |
| `queue.machine` | Concurrent upload slot management |
| `quota.machine` | Storage quota state tracking |
| `s3.multipart` | S3 multipart upload lifecycle (create → upload → complete) |
| `ai.machine` | AI task orchestration (caption, transcribe, summarize) |
| `caption.machine` | Focused image captioning pipeline |
| `pipeline.machine` | Full audio pipeline (detect → transcribe → summarize → tag) |
| `subscription.machine` | Stripe subscription state |
| `onboard.machine` | New user setup flow |
| `selection.machine` | Multi-select UI state |
| `sidebar.machine` | Navigation panel state |
| `infiniteScroll.machine` | Lazy-loading pagination |
| `confirm.machine` | Confirmation dialog state |

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
| POST | `/api/s3/presigned` | Generate S3 presigned URLs |
| POST | `/api/s3/sts-token` | AWS STS token for direct upload |
| POST | `/api/upload` | Multipart upload operations |
| GET | `/api/quota` | Check storage quota |

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

### Search & Billing
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/search/:type` | Full-text or semantic search |
| POST | `/api/stripe` | Stripe webhook handler |
| GET | `/api/subscription` | Subscription status |
| GET | `/api/notifications` | Activity feed |

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
pnpm dev                  # Dev server (Vite HMR + Express) at http://localhost:5173
pnpm build                # Production build
pnpm start                # Production server
pnpm typecheck            # Type-check (typegen + tsc)
pnpm format               # Prettier
pnpm prisma migrate dev   # Run database migrations
pnpm test                 # Run tests (Vitest)
```

---

## 11. Related Documentation

| Document | Topic |
|----------|-------|
| [`docs/ai-pipeline.md`](ai-pipeline.md) | AI pipeline architecture (Transformers.js, Whisper, summarization) |
| [`docs/search.md`](search.md) | Semantic search, pgvector + embeddings |
| [`docs/upload-multipart.md`](upload-multipart.md) | S3 multipart upload state machine and streaming |
| [`docs/quota-and-machines.md`](quota-and-machines.md) | Quota system, XState integration |
| [`docs/routing-and-ui.md`](routing-and-ui.md) | Route handles, sidebars, pagination patterns |
| [`CLAUDE.md`](../CLAUDE.md) | Developer conventions, path aliases, workflows |
