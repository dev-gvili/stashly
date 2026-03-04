import '@dotenvx/dotenvx/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/models/',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seedData/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})

