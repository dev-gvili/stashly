import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../../app/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { OTHER_USER_EMAIL, TEST_USER_EMAIL } from './constants'

export default async function globalTeardown() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  try {
    await prisma.user.deleteMany({
      where: { email: { in: [TEST_USER_EMAIL, OTHER_USER_EMAIL] } },
    })
  } finally {
    await prisma.$disconnect()
  }
}
