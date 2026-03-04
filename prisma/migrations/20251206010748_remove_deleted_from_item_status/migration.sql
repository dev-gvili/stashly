/*
  Warnings:

  - The values [deleted] on the enum `ItemStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[id]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ItemStatus_new" AS ENUM ('normal', 'archived', 'trashed', 'locked', 'shared');
ALTER TABLE "public"."Item" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Item" ALTER COLUMN "status" TYPE "ItemStatus_new" USING ("status"::text::"ItemStatus_new");
ALTER TYPE "ItemStatus" RENAME TO "ItemStatus_old";
ALTER TYPE "ItemStatus_new" RENAME TO "ItemStatus";
DROP TYPE "public"."ItemStatus_old";
ALTER TABLE "Item" ALTER COLUMN "status" SET DEFAULT 'normal';
COMMIT;

-- DropIndex
DROP INDEX "user_storagePlanId_key";

-- AlterTable
ALTER TABLE "Workspace" ALTER COLUMN "slug" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_id_key" ON "Workspace"("id");
