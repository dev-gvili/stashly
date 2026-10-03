-- Trash lists only what the user trashed directly. A directly trashed item
-- gets a TrashItem row; its descendants only get Item.status = 'trashed'.
--
-- Trash and TrashItem existed but nothing in the app read or wrote them, so
-- any rows in them are not app data. They are cleared before Trash gains a
-- NOT NULL driveId, which existing rows could not satisfy.
DELETE FROM "TrashItem";
DELETE FROM "Trash";

-- DropForeignKey
ALTER TABLE "TrashItem" DROP CONSTRAINT "TrashItem_trashId_fkey";

-- DropIndex
DROP INDEX "TrashItem_itemId_trashId_key";

-- AlterTable
ALTER TABLE "Trash" ADD COLUMN     "driveId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TrashItem" DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "restoredAt",
ADD COLUMN     "trashedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "trashedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Trash_driveId_key" ON "Trash"("driveId");

-- CreateIndex
CREATE INDEX "TrashItem_trashId_trashedAt_idx" ON "TrashItem"("trashId", "trashedAt");

-- AddForeignKey
ALTER TABLE "Trash" ADD CONSTRAINT "Trash_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrashItem" ADD CONSTRAINT "TrashItem_trashId_fkey" FOREIGN KEY ("trashId") REFERENCES "Trash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrashItem" ADD CONSTRAINT "TrashItem_trashedById_fkey" FOREIGN KEY ("trashedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill what is already in the trash, with the rule Trash used until now:
-- a trashed item whose parent is live (or that has no parent) was trashed
-- directly. Its trashedAt is updatedAt, which trashItems set when it ran.
-- Who trashed it was never recorded, so trashedById stays NULL.
INSERT INTO "Trash" ("id", "driveId", "updatedAt")
SELECT 'trsh_' || substr(md5(random()::text || d."driveId"), 1, 22), d."driveId", now()
FROM (SELECT DISTINCT "driveId" FROM "Item" WHERE "status" = 'trashed') d;

INSERT INTO "TrashItem" ("id", "itemId", "trashId", "trashedAt")
SELECT 'ti_' || substr(md5(random()::text || i."id"), 1, 22), i."id", t."id", i."updatedAt"
FROM "Item" i
JOIN "Trash" t ON t."driveId" = i."driveId"
LEFT JOIN "Item" p ON p."id" = i."parentId"
WHERE i."status" = 'trashed'
  AND (i."parentId" IS NULL OR p."status" <> 'trashed');
