import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../app/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const favs = await prisma.favorite.findMany({
  where: { favoritedById: 'usr_e2e_test_fixed_id_000000' },
})
console.log('Favorites:', favs.length, JSON.stringify(favs))

const items = await prisma.item.findMany({
  where: { id: { in: ['item_e2e_fav_aaa0000000000000', 'item_e2e_fav_bbb0000000000000', 'item_e2e_fav_ccc0000000000000', 'root_e2e_test_000000'] } },
  select: { id: true, name: true, parentId: true },
})
console.log('Test items:', items.length, JSON.stringify(items))

await prisma.$disconnect()
