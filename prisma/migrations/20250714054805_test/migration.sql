CREATE OR REPLACE FUNCTION update_parent_folder_size_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If parentId or size changed, update old and new parents accordingly
  IF (OLD."parentId" IS DISTINCT FROM NEW."parentId") OR (OLD."size" IS DISTINCT FROM NEW."size") THEN
    -- Decrement old parent if present
    IF OLD."parentId" IS NOT NULL AND OLD."size" IS NOT NULL THEN
      UPDATE "Item"
      SET "size" = "size" - OLD."size"
      WHERE "id" = OLD."parentId";
    END IF;
    -- Increment new parent if present
    IF NEW."parentId" IS NOT NULL AND NEW."size" IS NOT NULL THEN
      UPDATE "Item"
      SET "size" = "size" + NEW."size"
      WHERE "id" = NEW."parentId";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/*
  Warnings:

  - The values [image,video,audio,photo] on the enum `ItemType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `iamRoleArn` on the `File` table. All the data in the column will be lost.
  - Added the required column `ownerId` to the `Drive` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `TrashItem` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ItemType_new" AS ENUM ('folder', 'file', 'collection');
ALTER TABLE "Item" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Item" ALTER COLUMN "type" TYPE "ItemType_new" USING ("type"::text::"ItemType_new");
ALTER TYPE "ItemType" RENAME TO "ItemType_old";
ALTER TYPE "ItemType_new" RENAME TO "ItemType";
DROP TYPE "ItemType_old";
ALTER TABLE "Item" ALTER COLUMN "type" SET DEFAULT 'file';
COMMIT;

-- DropForeignKey
ALTER TABLE "TrashItem" DROP CONSTRAINT "TrashItem_trashId_fkey";

-- AlterTable
ALTER TABLE "Drive" ADD COLUMN     "ownerId" TEXT NOT NULL,
ALTER COLUMN "name" SET DEFAULT 'Stashly Drive';

-- AlterTable
ALTER TABLE "File" DROP COLUMN "iamRoleArn";

-- AlterTable
ALTER TABLE "Quota" ALTER COLUMN "deleted" SET DATA TYPE BIGINT,
ALTER COLUMN "remaining" SET DATA TYPE BIGINT,
ALTER COLUMN "total" SET DATA TYPE BIGINT,
ALTER COLUMN "used" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "TrashItem" ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "TrashItem_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrashItem" ADD CONSTRAINT "TrashItem_trashId_fkey" FOREIGN KEY ("trashId") REFERENCES "Trash"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION update_size()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE: decrement old parent
  IF TG_OP = 'DELETE' THEN
    IF OLD."parentId" IS NOT NULL AND OLD."size" IS NOT NULL THEN
      UPDATE "Item"
      SET "size" = "size" - OLD."size"
      WHERE "id" = OLD."parentId";
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT: increment new parent
  IF TG_OP = 'INSERT' THEN
    IF NEW."parentId" IS NOT NULL AND NEW."size" IS NOT NULL THEN
      UPDATE "Item"
      SET "size" = "size" + NEW."size"
      WHERE "id" = NEW."parentId";
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE: parentId or size changed
  IF TG_OP = 'UPDATE' THEN
    IF (OLD."parentId" IS DISTINCT FROM NEW."parentId") OR (OLD."size" IS DISTINCT FROM NEW."size") THEN
      -- Decrement old parent
      IF OLD."parentId" IS NOT NULL AND OLD."size" IS NOT NULL THEN
        UPDATE "Item"
        SET "size" = "size" - OLD."size"
        WHERE "id" = OLD."parentId";
      END IF;
      -- Increment new parent
      IF NEW."parentId" IS NOT NULL AND NEW."size" IS NOT NULL THEN
        UPDATE "Item"
        SET "size" = "size" + NEW."size"
        WHERE "id" = NEW."parentId";
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS item_size_update ON "Item";
DROP TRIGGER IF EXISTS item_size_decrement ON "Item";
DROP TRIGGER IF EXISTS item_size_update_on_update ON "Item";

CREATE TRIGGER item_size_update
AFTER INSERT ON "Item"
FOR EACH ROW
EXECUTE FUNCTION update_size();

CREATE TRIGGER item_size_update_on_update
AFTER UPDATE ON "Item"
FOR EACH ROW
EXECUTE FUNCTION update_size();

CREATE TRIGGER item_size_decrement
AFTER DELETE ON "Item"
FOR EACH ROW
EXECUTE FUNCTION update_size();