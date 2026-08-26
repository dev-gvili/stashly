-- Revert for migration.sql in this directory.
--
-- Prisma has no `migrate down`, and Prisma only ever reads `migration.sql`, so
-- this file is inert until you run it yourself:
--
--   psql "$DATABASE_URL" -f prisma/migrations/20260826000000_defer_folder_item_fk/down.sql
--
-- Or from the repo root, without psql installed:
--
--   npx tsx --env-file=.env -e "import {prisma} from '@/services/db'; \
--     prisma.\$executeRawUnsafe('ALTER TABLE \"Folder\" ALTER CONSTRAINT \
--     \"Folder_itemId_fkey\" NOT DEFERRABLE').then(() => prisma.\$disconnect())"
--
-- This is catalog-only and instant. It restores the pre-migration behaviour
-- exactly — including the P2003 failure on bulk deletes of a mixed
-- ancestor/descendant set, which is the bug the migration exists to fix.
--
-- If you revert, `_prisma_migrations` still lists 20260826000000_defer_folder_item_fk
-- as applied. That is fine for a manual rollback; delete that row only if you
-- intend Prisma to re-apply the migration later.

ALTER TABLE "Folder"
  ALTER CONSTRAINT "Folder_itemId_fkey" NOT DEFERRABLE;
