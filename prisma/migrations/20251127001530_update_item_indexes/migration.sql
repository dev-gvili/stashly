/*
  Warnings:

  - You are about to drop the column `path` on the `Item` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ItemStatus" ADD VALUE 'deleted';
ALTER TYPE "ItemStatus" ADD VALUE 'locked';
ALTER TYPE "ItemStatus" ADD VALUE 'shared';

-- DropIndex
DROP INDEX "Item_category_idx";

-- DropIndex
DROP INDEX "Item_createdAt_idx";

-- DropIndex
DROP INDEX "Item_id_name_key";

-- DropIndex
DROP INDEX "Item_name_idx";

-- DropIndex
DROP INDEX "Item_path_key";

-- DropIndex
DROP INDEX "Item_status_idx";

-- DropIndex
DROP INDEX "Item_type_idx";

-- DropIndex
DROP INDEX "Item_updatedAt_idx";

-- DropIndex
DROP INDEX "Item_workspaceId_idx";

-- DropIndex
DROP INDEX "cursor_pagination_idx";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "path",
ADD COLUMN     "openedAt" TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "item_name_trgm_idx" ON "Item" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "parent_cursor" ON "Item"("parentId", "name" ASC);

-- CreateIndex
CREATE INDEX "parent_created_at" ON "Item"("parentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "parent_updated_at" ON "Item"("parentId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "parent_category_cursor" ON "Item"("parentId", "category", "name" ASC);

-- CreateIndex
CREATE INDEX "parent_status_cursor" ON "Item"("parentId", "status", "name" ASC);

-- CreateIndex
CREATE INDEX "parent_type_name_cursor" ON "Item"("parentId", "type", "name" ASC);

-- CreateIndex
CREATE INDEX "parent_type_created_at_cursor" ON "Item"("parentId", "type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "workspace_cursor" ON "Item"("workspaceId", "name" ASC);

-- CreateIndex
CREATE INDEX "drive_parent_name_cursor" ON "Item"("driveId", "parentId", "name" ASC);

-- CreateIndex
CREATE INDEX "parent_status_type_name_cursor" ON "Item"("parentId", "status", "type", "name" ASC);

-- CreateIndex
CREATE INDEX "drive_parent_created_at" ON "Item"("driveId", "parentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "drive_created_at" ON "Item"("driveId", "createdAt" DESC);

-- RenameIndex
ALTER INDEX "Item_tags_idx" RENAME TO "tags_gin_idx";
