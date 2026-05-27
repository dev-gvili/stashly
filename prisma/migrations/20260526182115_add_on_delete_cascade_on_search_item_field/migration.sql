/*
  Warnings:

  - A unique constraint covering the columns `[permissionActionId]` on the table `ItemAction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Search" DROP CONSTRAINT "Search_itemId_fkey";

-- DropIndex
DROP INDEX "Thumbnail_itemId_view_size_key";

-- AlterTable
ALTER TABLE "Item" ALTER COLUMN "name" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "ItemAction" ADD COLUMN     "permissionActionId" TEXT;

-- AlterTable
ALTER TABLE "Search" ALTER COLUMN "vector" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Thumbnail" ALTER COLUMN "size" SET DEFAULT 'small';

-- CreateTable
CREATE TABLE "PermissionAction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "PermissionAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchChunk" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "pageNum" INTEGER,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "vector" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchChunk_itemId_idx" ON "SearchChunk"("itemId");

-- CreateIndex
CREATE INDEX "SearchChunk_vector_idx" ON "SearchChunk"("vector");

-- CreateIndex
CREATE UNIQUE INDEX "SearchChunk_itemId_ord_key" ON "SearchChunk"("itemId", "ord");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_permissionActionId_key" ON "ItemAction"("permissionActionId");

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_permissionActionId_fkey" FOREIGN KEY ("permissionActionId") REFERENCES "PermissionAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchChunk" ADD CONSTRAINT "SearchChunk_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
