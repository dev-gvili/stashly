import '@dotenvx/dotenvx/config'
import { defineConfig } from 'prisma/config'

declare const process: {
  env: Record<string, string | undefined>
}

export default defineConfig({
  schema: 'prisma/models/',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seedData/seed.ts',
  },
  datasource: {
    // Migrations run DDL + advisory locks, which need a *direct* session
    // connection — routing them through PgBouncer's transaction pooling breaks.
    // Prefer DIRECT_DATABASE_URL; fall back to DATABASE_URL for local/dev where
    // there is no pooler in front.
    // Plain `process.env`, not Prisma's `env()`: `env()` throws when the var is
    // unset, which failed `prisma generate` — and with it `pnpm install`'s
    // postinstall — on any machine without a `.env`. Generate needs no URL;
    // commands that do (`migrate …`) still error clearly when it's missing.
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  },
})

