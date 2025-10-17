# Copilot Instructions for Stashly

## Project Overview
Stashly is a full-stack React/Node.js application template using React Router, TypeScript, Prisma, XState, and TailwindCSS. It supports SSR, HMR, asset optimization, and integrates with S3 for storage and Algolia for search.

## Architecture & Key Patterns
- **Frontend:** All UI, routes, and components are in `app/`. Routing is managed by React Router (`app/routes/`, `react-router.config.ts`).
- **Backend:** API logic and services are in `app/services/` and `server/`. Auth, onboarding, quota, S3, and email are handled as service modules.
- **Database:** Prisma models are split by domain in `prisma/models/`, imported into `prisma/schema.prisma`, with migrations in `prisma/migrations/`.
- **State Machines:** Complex flows (e.g., file upload, onboarding) use XState v5. See `app/machines/` for examples, including multi-file upload with pause/resume and chunked S3 uploads.
- **Styling:** TailwindCSS is used, with global styles in `app/styles/global.css`.

## Developer Workflows
- **Install dependencies:** `npm install` or `pnpm install`
- **Start dev server:** `npm run dev`
- **Build for production:** `npm run build`
- **Run tests:** See `tests/` for structure; add test commands to `package.json` if missing.
- **Database migration:** Use Prisma CLI (`npx prisma migrate dev`, `npx prisma generate`)
- **Seed database:** `npx prisma db seed`

## Conventions & Patterns
- **TypeScript everywhere.**
- **Service Layer:** Business logic lives in `app/services/` (e.g., onboarding, auth, db, email, S3).
- **State Machines:** Use XState for complex workflows. See `app/machines/README.md` for file upload patterns, including chunked/multipart S3 uploads and pause/resume.
- **Component Organization:** UI components are modular and colocated by feature in `app/components/`.
- **Environment Variables:** Managed via `.env` (not included here).

## Integration Points
- **S3:** Storage integration via `app/services/s3.server.ts`
- **Algolia:** Search via `app/services/algolia.server.ts`
- **Email:** Email logic in `app/services/email.server.ts`
- **Db:** prisma client via `app/services/db.server.ts`
- **Auth:** Authentication integration via `app/services/auth.server.ts`
- **Auth:** Client-side authentication handler via `app/services/auth.server.ts`

## Examples
- **Onboarding a user:** See `onboard.server.ts` (imperative) and `onboard.machine.ts` (state machine).
- **Adding a new route:** Create a file in `app/routes/` and update `react-router.config.ts`.
- **Adding a new Prisma model:** Create in `prisma/models/`, import in `schema.prisma`, run migration.

## Tips for AI Agents
- Prefer service-layer changes for business logic.
- Use XState for new complex workflows; reference `app/machines/README.md` for advanced patterns.
- Keep UI components modular and colocated by feature.
- Reference existing patterns in `app/services/` and `prisma/models/` before introducing new ones.

---

_If any section is unclear or missing, please ask for clarification or provide feedback to improve these instructions._