# Stashly

A full-stack file management platform for personal stashes and collaborative workspaces, built with React Router 8 and Express 5.

## Features

- Personal stash and team workspaces with role-based permissions
- Multipart file uploads direct to S3-compatible storage (Tigris)
- Full-text and semantic/vector search (pgvector + embeddings)
- AI features: image captioning, transcription (Whisper), translation, embeddings, chat
- Collections, favorites, shares, versioning, and trash
- Stripe subscription billing with quota enforcement
- OAuth authentication (GitHub, Google, Microsoft)
- Dark/light theme, responsive layout, mobile sidebar

## Tech Stack

| Category   | Technologies |
|------------|-------------|
| Frontend   | React 19, React Router 8 (SSR), TailwindCSS 4, shadcn/ui, Radix UI, XState 5 |
| Backend    | Express 5, TypeScript strict, better-auth |
| Database   | PostgreSQL, Prisma ORM, pgvector |
| Storage    | AWS S3-compatible (Tigris on Fly.io), multipart upload |
| AI         | HuggingFace Transformers.js, ONNX Runtime WebGPU, Whisper, Tesseract OCR |
| Search     | pgvector + embeddings (full-text and semantic search) |
| Payments   | Stripe |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database

### Environment Setup

Copy the example env file and fill in required values:

```bash
cp .env.example .env
```

Key variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `S3_*` (bucket/endpoint/keys), `STRIPE_*`.

### Development

```bash
pnpm install
pnpm prisma migrate dev   # Apply database migrations
pnpm dev                  # Start dev server at http://localhost:5173
```

### Build

```bash
pnpm build    # Production build
pnpm start    # Run production server
```

## Project Structure

```
app/
├── .server/              # Server-only — excluded from client bundle
│   ├── auth.ts           # better-auth configuration (OAuth, sessions)
│   ├── db.ts             # Prisma client singleton
│   ├── env.ts            # Validated server env vars
│   ├── api.errors.ts     # ApiError / ApiErrorCode helpers
│   ├── repositories/     # Data access via Prisma (auto-generated — don't hand-edit)
│   ├── services/         # Business logic + permission enforcement
│   ├── search/           # pgvector semantic search and embeddings
│   └── s3.ts             # S3-compatible storage client (Tigris)
├── .client/              # Client-only — browser APIs, client AI helpers
├── routes/               # React Router 8 pages + loaders/actions
│   ├── layout.tsx        # Authenticated app shell
│   ├── api/              # REST resource routes (/api/items, /api/ai, …)
│   ├── stash/            # Personal stash views (home, file, folder, trash, shares)
│   ├── workspaces/       # Collaborative workspace views
│   └── settings/         # User / billing settings
├── machines/             # XState 5 state machines
│   ├── upload/           # File upload (parent + per-file actors)
│   ├── upload-v2/        # Upload manager v2 (queue + worker actors)
│   ├── multipart/        # S3 multipart upload utilities
│   ├── quota/            # Storage quota tracking + enforcement
│   ├── ai/               # Caption + transcription pipelines
│   ├── onboard/          # Onboarding flow
│   ├── subscription/     # Stripe subscription state
│   └── actors/           # Shared spawned child actors
├── workers/              # Web Workers (off main thread)
│   └── stash.worker.ts   # Language detection + tokenization (ONNX / Transformers.js)
├── schemas/              # Zod schemas — source of truth for validation
│   ├── api.schemas.ts    # API request / response shapes
│   └── machine.schemas.ts# XState machine event payloads
├── types/                # Derived TypeScript types (inferred from schemas + manual)
│   ├── api.types.ts
│   ├── machine.types.ts
│   └── upload-actors.types.ts
├── components/
│   ├── ui/               # shadcn/ui primitives (source-owned, Radix-based)
│   ├── stash/            # Stash-specific compound components
│   ├── upload/           # Upload dropzone + progress UI
│   ├── views/            # Gallery / grid / list view variants
│   └── navigation/       # Sidebar, header, toolbar
├── hooks/                # Reusable React hooks
├── utils/                # Shared pure utilities
│   └── __tests__/        # Vitest unit tests
└── styles/               # Global CSS + Tailwind theme

prisma/
├── models/               # One .prisma file per model (merged at build)
│   └── *.prisma          # user, item, collection, permission, quota, …
├── migrations/           # Migration history
└── schema.prisma         # Generated merged schema (don't edit directly)

scripts/                  # Code-gen + dev utilities
  generateRepository.v2.ts  # Scaffold repository + filters for a Prisma model
```

## Key Commands

```bash
pnpm dev                                          # Start dev server (Vite HMR + Express)
pnpm build                                        # Production build
pnpm typecheck                                    # Type-check the project
pnpm format                                       # Format with Prettier
pnpm prisma migrate dev                           # Run database migrations
pnpm tsx ./scripts/generateRepository.v2.ts <M>  # Scaffold repository + filters for a Prisma model
pnpm exec playwright test                         # Run E2E tests
pnpm exec playwright test --ui                    # Run E2E tests with Playwright UI
```

## Testing

### E2E Tests

End-to-end tests use [Playwright](https://playwright.dev/) and live in `tests/e2e/`.

The test suite requires a running dev server (auto-started by Playwright) and a real PostgreSQL database with `DATABASE_URL` and `BETTER_AUTH_SECRET` set in `.env`.

**Global setup** (`tests/e2e/global-setup.ts`) seeds a test user and writes a signed session cookie to `tests/e2e/.auth/session.json` so authenticated specs don't go through the UI login flow.

**Page Object Models** in `tests/e2e/pages/` encapsulate page interactions (`AuthPage`, `LayoutPage`, `StashPage`).

Use the `test` fixture from `tests/e2e/fixtures.ts` for authenticated specs; import from `@playwright/test` directly for unauthenticated specs.
