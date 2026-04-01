import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../../app/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { TEST_USER_EMAIL } from './constants'

export default async function globalTeardown() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  try {
    await prisma.user.deleteMany({ where: { email: TEST_USER_EMAIL } })
  } finally {
    await prisma.$disconnect()
  }
}
