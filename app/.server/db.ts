import './env'
import { PrismaClient } from '@/prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { registerPoolMetrics } from './metrics'

declare global {
  // avoid multiple instances when hot-reloading
  // Use the correct type for the extended client
  var prismaClient: PrismaClient | undefined
  var pgPool: pg.Pool | undefined
}

// Own the pg.Pool explicitly instead of letting PrismaPg create it internally,
// so we can read live saturation gauges — `waitingCount` is the leading signal
// that the pool is backing up under load (docs/notifications-sse.md → metrics).
// `max`/`connectionTimeoutMillis` are env-tunable; behind PgBouncer this is the
// app→pooler fan-in, so it can stay modest.
const pool = (globalThis.pgPool ??= (() => {
  const p = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number.parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
    connectionTimeoutMillis: Number.parseInt(
      process.env.DATABASE_POOL_TIMEOUT_MS || '10000',
      10
    ),
  })
  registerPoolMetrics(p)
  return p
})())

const adapter = new PrismaPg(pool)
// Create the client with accelerate extension
const prismaClientSingleton = () => {
  return new PrismaClient({
    adapter,
    errorFormat: 'pretty',
  }).$extends(withAccelerate())
}

// Use the existing client or create a new one
export const prisma = (globalThis.prismaClient ??=
  prismaClientSingleton() as unknown as PrismaClient)
