import { PrismaClient } from '@/prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

// Create the client with accelerate extension
const prismaClientSingleton = () => {
  return new PrismaClient({
    errorFormat: 'pretty',
  }).$extends(withAccelerate())
}

declare global {
  // avoid multiple instances when hot-reloading
  // Use the correct type for the extended client
  var prismaClient: PrismaClient | undefined
}


// Use the existing client or create a new one
globalThis.prismaClient ??= prismaClientSingleton() as unknown as PrismaClient

const prisma = globalThis.prismaClient

export { prisma }
