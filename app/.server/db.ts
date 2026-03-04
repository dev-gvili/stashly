import '@dotenvx/dotenvx/config'
import { PrismaClient } from '@/prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
// Create the client with accelerate extension
const prismaClientSingleton = () => {
  return new PrismaClient({
    adapter,
    errorFormat: 'pretty',
  }).$extends(withAccelerate())
}

declare global {
  // avoid multiple instances when hot-reloading
  // Use the correct type for the extended client
  var prismaClient: PrismaClient | undefined
}

// Use the existing client or create a new one
export const prisma = (globalThis.prismaClient ??=
  prismaClientSingleton() as unknown as PrismaClient)
