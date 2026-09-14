import '@dotenvx/dotenvx/config'
import { defineConfig, env } from 'prisma/config'

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
    url: process.env.DIRECT_DATABASE_URL ?? env('DATABASE_URL'),
  },
})

