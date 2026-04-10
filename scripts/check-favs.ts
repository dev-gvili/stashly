import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../app/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const favs = await prisma.favorite.findMany({
  where: { favoritedById: 'usr_e2e_test_fixed_id_000000' },
})
console.log('Favorites count:', favs.length)
console.log(JSON.stringify(favs, null, 2))

const items = await prisma.item.findMany({
  where: { favorites: { some: { favoritedById: 'usr_e2e_test_fixed_id_000000' } } },
  select: { id: true, name: true },
})
console.log('Favorited items:', items.length)
console.log(JSON.stringify(items, null, 2))

await prisma.$disconnect()
