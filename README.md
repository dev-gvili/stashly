# Stashly

A full-stack file management platform for personal stashes and collaborative workspaces, built with React Router 7 and Express 5.

## Features

- Personal stash and team workspaces with role-based permissions
- Multipart file uploads direct to S3-compatible storage (Tigris)
- Full-text search (Algolia) and semantic/vector search (pgvector)
- AI features: image captioning, transcription (Whisper), translation, embeddings, chat
- Collections, favorites, shares, versioning, and trash
- Stripe subscription billing with quota enforcement
- OAuth authentication (GitHub, Google, Microsoft)
- Dark/light theme, responsive layout, mobile sidebar

## Tech Stack

| Category   | Technologies |
|------------|-------------|
| Frontend   | React 19, React Router 7 (SSR), TailwindCSS 4, shadcn/ui, Radix UI, XState 5 |
| Backend    | Express 5, TypeScript strict, better-auth |
| Database   | PostgreSQL, Prisma ORM, pgvector |
| Storage    | AWS S3-compatible (Tigris on Fly.io), multipart upload |
| AI         | HuggingFace Transformers.js, ONNX Runtime WebGPU, Whisper, Tesseract OCR |
| Search     | Algolia (full-text), pgvector (semantic embeddings) |
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

Key variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `S3_*` (bucket/endpoint/keys), `ALGOLIA_*`, `STRIPE_*`.

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
  .server/        # Server-only code (never bundled to client)
    services/     # Business logic and permission enforcement
    repositories/ # Prisma-based data access (auto-generated)
    search/       # Algolia + pgvector search integrations
  .client/        # Client-only code (browser APIs)
  routes/         # React Router routes (UI + loaders/actions)
    api/          # REST API resource routes
    stash/        # Personal stash views
    workspaces/   # Workspace views
    settings/     # User settings views
  machines/       # XState state machines (upload, quota, session)
  workers/        # Web Workers for AI inference and tokenization
  schemas/        # Zod validation schemas (API + machine events)
  types/          # Shared TypeScript type definitions
  components/     # UI components (shadcn/ui in components/ui/)
  hooks/          # Reusable React hooks
  utils/          # Shared utilities
prisma/
  models/         # Split Prisma schema files (merged at build)
scripts/          # Code generation scripts
```

## Key Commands

```bash
pnpm dev                                          # Start dev server (Vite HMR + Express)
pnpm build                                        # Production build
pnpm typecheck                                    # Type-check the project
pnpm format                                       # Format with Prettier
pnpm prisma migrate dev                           # Run database migrations
pnpm tsx ./scripts/generateRepository.v2.ts <M>  # Scaffold repository + filters for a Prisma model
```
