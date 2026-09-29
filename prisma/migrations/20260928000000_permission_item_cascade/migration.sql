-- Recreate Permission_itemId_fkey with ON DELETE CASCADE.
-- The relation never declared onDelete, so Prisma defaulted the optional FK to
-- SET NULL: every permanent delete (and every descendant a folder delete
-- cascades to) left its Permission rows behind with itemId NULL.

-- Remove the rows already orphaned that way. A permission with no item, no
-- share link and no invitation recipient is tied to nothing. Its
-- _PermissionToUser rows go with it (that FK already cascades).
DELETE FROM "Permission"
WHERE "itemId" IS NULL
  AND "linkId" IS NULL
  AND "recipientId" IS NULL;

ALTER TABLE "Permission"
  DROP CONSTRAINT IF EXISTS "Permission_itemId_fkey";

ALTER TABLE "Permission"
  ADD CONSTRAINT "Permission_itemId_fkey"
  FOREIGN KEY ("itemId")
  REFERENCES "Item"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
