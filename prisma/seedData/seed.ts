import { faker } from '@faker-js/faker'
import { inspect } from 'node:util'
import { getPrefixForModel, toObjectId } from '../../app/utils/converters'
import {
  generateMockUsers,
  generateMockDrive,
  generateMockStoragePlans,
  generateMockTopLevelFolders,
  generateMockSubFolders,
  generateMockLockedItems,
  generateMockFavoriteItems,
  generateMockItemsWithFile,
  generateMockFavoriteItem,
} from './data'
import {
  createFolder,
  createItem,
  createManyItemsBatched,
} from '../../app/.server/item-actions'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../app/prisma/client'
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    timeout: 15000,
  },
})

/**
 * Wipes every application table in one statement.
 *
 * Replaces the hand-ordered `deleteMany` cascade, which was both slow (one
 * round trip per model, plus a row-level trigger firing per deleted row) and
 * quietly incomplete: the `*Action` tables hold the FK (`ItemAction.createActionId
 * → CreateAction`) rather than being pointed at, and `ItemAction.activityId` is
 * `SET NULL`, so nothing reachable from `Activity` ever deleted them. They
 * accumulated across resets.
 *
 * `TRUNCATE ... CASCADE` sidesteps ordering entirely — Postgres resolves the FK
 * graph itself — and the table list is derived from the catalog, so a new Prisma
 * model is covered without touching this file.
 *
 * **Preserved on purpose:**
 * - `_prisma_migrations` — excluded by name. Truncating it would make Prisma
 *   believe the database is unmigrated and try to replay every migration.
 * - Extension-owned tables — excluded via `pg_depend` (pgvector, pg_trgm).
 * - **All triggers and functions.** `TRUNCATE` removes rows, never schema
 *   objects, so the migration-added rollup/notify machinery survives untouched.
 *   All 10 user triggers are `FOR EACH ROW`, and row-level triggers do **not**
 *   fire on `TRUNCATE` — which is what makes this fast, and why the size/child
 *   -count rollups don't thrash on the way out. If an `ON TRUNCATE` trigger is
 *   ever added, it *will* fire here.
 */
const RESET_SQL = `
DO $$
DECLARE
  target text;
BEGIN
  SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ')
  INTO target
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND c.relname <> '_prisma_migrations'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.deptype = 'e'
    );

  IF target IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || target || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;`

async function main(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(RESET_SQL)

    // Create storage plans
    const createdStoragePlans = await prisma.storagePlan.createManyAndReturn({
      data: generateMockStoragePlans(),
    })
    console.log('Created storage plans:', createdStoragePlans)
  } catch (error) {
    console.error('Error seeding database:', error)
  }
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
