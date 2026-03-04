/*
  Warnings:

  - The values [details,gallery] on the enum `ViewType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `exposureDenominator` on the `Image` table. All the data in the column will be lost.
  - You are about to drop the column `exposureNumerator` on the `Image` table. All the data in the column will be lost.
  - The `exposureTime` column on the `Image` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `type` on the `Search` table. All the data in the column will be lost.
  - You are about to drop the `Photo` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[id]` on the table `Item` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[createdAt,id]` on the table `Item` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,name]` on the table `Item` will be added. If there are existing duplicate values, this will fail.
  - Made the column `itemId` on table `Audio` required. This step will fail if there are existing NULL values in that column.
  - Made the column `itemId` on table `Image` required. This step will fail if there are existing NULL values in that column.
  - Made the column `itemId` on table `Video` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "SortBy" ADD VALUE 'id';

-- AlterEnum
BEGIN;
CREATE TYPE "ViewType_new" AS ENUM ('list', 'grid', 'river', 'waterfall');
ALTER TABLE "View" ALTER COLUMN "viewType" TYPE "ViewType_new" USING ("viewType"::text::"ViewType_new");
ALTER TYPE "ViewType" RENAME TO "ViewType_old";
ALTER TYPE "ViewType_new" RENAME TO "ViewType";
DROP TYPE "public"."ViewType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_itemId_fkey";

-- DropIndex
DROP INDEX "Item_updatedAt_idx";

-- DropIndex
DROP INDEX "Search_type_idx";

-- AlterTable
ALTER TABLE "Audio" ADD COLUMN     "composer" TEXT,
ALTER COLUMN "itemId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Image" DROP COLUMN "exposureDenominator",
DROP COLUMN "exposureNumerator",
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
DROP COLUMN "exposureTime",
ADD COLUMN     "exposureTime" DOUBLE PRECISION,
ALTER COLUMN "itemId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Search" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "codec" TEXT,
ADD COLUMN     "container" TEXT,
ALTER COLUMN "itemId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Workspace" ALTER COLUMN "default" DROP NOT NULL;

-- DropTable
DROP TABLE "Photo";

-- CreateIndex
CREATE INDEX "Collection_size_idx" ON "Collection"("size");

-- CreateIndex
CREATE UNIQUE INDEX "Item_id_key" ON "Item"("id");

-- CreateIndex
CREATE INDEX "Item_updatedAt_idx" ON "Item"("updatedAt");

-- CreateIndex
CREATE INDEX "Item_tags_idx" ON "Item" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");

-- CreateIndex
CREATE INDEX "search_cursor" ON "Item"("createdAt", "name");

-- CreateIndex
CREATE UNIQUE INDEX "cursor_pagination_idx" ON "Item"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Item_id_name_key" ON "Item"("id", "name");

-- CreateIndex
CREATE INDEX "Notification_message_idx" ON "Notification" USING SPGIST ("message");

-- CreateIndex
CREATE INDEX "Workspace_storagePlanId_idx" ON "Workspace"("storagePlanId");
