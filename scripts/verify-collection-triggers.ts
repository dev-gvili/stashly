import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../app/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  // 1. Confirm all three triggers exist on the correct tables
  const triggers = await prisma.$queryRaw<any[]>`
    SELECT trigger_name, event_object_table AS "table", event_manipulation AS event, action_timing AS timing
    FROM information_schema.triggers
    WHERE trigger_name IN (
      'collection_size_trigger',
      'item_size_collection_sync_trigger',
      'item_delete_collection_sync_trigger'
    )
    ORDER BY trigger_name, event
  `
  console.log('\n=== TRIGGERS ===')
  console.table(triggers)

  // 2. Confirm both functions are registered
  const fns = await prisma.$queryRaw<any[]>`
    SELECT proname AS function, pronargs AS args
    FROM pg_proc
    WHERE proname IN ('update_collection_size', 'sync_item_size_to_collections')
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  `
  console.log('\n=== FUNCTIONS ===')
  console.table(fns)

  // 3. Integrity audit — collections whose stored size drifts from member sum
  const drift = await prisma.$queryRaw<any[]>`
    SELECT
      c.id                              AS collection_id,
      c.name                            AS collection_name,
      c.size                            AS stored_size,
      COALESCE(SUM(m.size), 0)          AS computed_size,
      c.size - COALESCE(SUM(m.size), 0) AS drift
    FROM      "Item"             c
    LEFT JOIN "CollectionMember" cm ON cm."collectionId" = c.id
    LEFT JOIN "Item"             m  ON m.id = cm."itemId"
    WHERE c.type = 'collection'
    GROUP BY c.id, c.name, c.size
    HAVING c.size != COALESCE(SUM(m.size), 0)
  `
  console.log('\n=== SIZE DRIFT ===')
  if (drift.length === 0) {
    console.log('✓ No drift — all collection sizes accurate')
  } else {
    console.table(drift)

    // 4. Repair drifted collection sizes
    const repaired = await prisma.$executeRaw`
      UPDATE "Item" c
      SET    size = sub.computed
      FROM (
        SELECT c2.id, COALESCE(SUM(m.size), 0) AS computed
        FROM      "Item"             c2
        LEFT JOIN "CollectionMember" cm ON cm."collectionId" = c2.id
        LEFT JOIN "Item"             m  ON m.id = cm."itemId"
        WHERE  c2.type = 'collection'
        GROUP BY c2.id
      ) sub
      WHERE c.id   = sub.id
        AND c.size != sub.computed
    `
    console.log(`\n✓ Repaired ${repaired} collection(s)`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
