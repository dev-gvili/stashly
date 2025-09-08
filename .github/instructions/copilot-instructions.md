# Copilot Instructions for Stashly

## Project Overview
Stashly is a full-stack React application template using React Router, TypeScript, Prisma, xstate and TailwindCSS. It supports server-side rendering, hot module replacement, and asset optimization. The backend is Node.js, with Prisma for database access and S3 for storage integration.

## Architecture & Key Patterns
- **App Structure:**
  - Frontend code is in `app/` (routes, components, hooks, styles, services).
  - Backend logic and API endpoints are in `server/` and `app/services/`.
  - Database models and migrations are in `prisma/`.
  - Static assets are in `public/` and `app/assets/`.
- **Routing:**
  - Uses React Router. Route definitions are in `app/routes/` and `react-router.config.ts`.
- **Auth:**
  - Auth logic is in `app/auth/` and `app/services/auth.*.ts`.
  - Integrates with S3 and custom permissions.
- **Onboarding:**
  - New user onboarding is handled in `app/services/onboard.server.ts` (imperative) and optionally as a state machine in `app/services/onboard.machine.ts` (XState v5).
- **Database:**
  - Prisma models in `prisma/models/`, migrations in `prisma/migrations/`, schema in `prisma/schema.prisma`.
  - Seed script: `prisma/seed.ts`.
- **Styling:**
  - TailwindCSS, global styles in `app/styles/global.css`.

## Developer Workflows
- **Install dependencies:** `npm install` or `pnpm install`
- **Start dev server:** `npm run dev`
- **Build for production:** `npm run build`
- **Run tests:** (see `tests/` for structure; test commands may need to be added to package.json)
- **Database migration:** Use Prisma CLI (`npx prisma migrate dev`, `npx prisma generate`).
- **Seed database:** `npx prisma db seed`

## Conventions & Patterns
- **TypeScript everywhere.**
- **Services:** Business logic lives in `app/services/` (e.g., onboarding, auth, db, email, S3).
- **State Machines:** Use XState v5 for complex flows (see `onboard.machine.ts`).
- **Prisma:** Models are split by domain in `prisma/models/` and imported into `schema.prisma`.
- **Component Organization:** UI components in `app/components/`, grouped by feature/domain.
- **Environment Variables:** Managed via `.env` (not included here).

## Integration Points
- **S3:** Storage integration via `app/services/s3.server.ts`
- **Algolia:** Search via `app/services/algolia.server.ts`
- **Email:** Email logic in `app/services/email.server.ts`
- **Db:** prisma client via `app/services/db.server.ts`
- **Auth:** Authentication integration via `app/services/auth.server.ts`
- **Auth:** Client-side authentication handler via `app/services/auth.server.ts`

## Examples
- Onboarding a user: see `onboard.server.ts` (imperative) and `onboard.machine.ts` (state machine).
- Adding a new route: create a file in `app/routes/` and update `react-router.config.ts`.
- Adding a new Prisma model: create in `prisma/models/`, import in `schema.prisma`, run migration.

## Tips for AI Agents
- Prefer service-layer changes for business logic.
- Use XState for new complex workflows.
- Reference existing patterns in `app/services/` and `prisma/models/` before introducing new ones.
- Keep UI components modular and colocated by feature.

---

_If any section is unclear or missing, please ask for clarification or provide feedback to improve these instructions._
