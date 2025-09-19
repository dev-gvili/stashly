/*
  Warnings:

  - You are about to drop the `FileShare` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Preview` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[ownerId,stripeSubscriptionId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[folderId,viewType]` on the table `View` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `memberLimit` to the `StoragePlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceLimit` to the `StoragePlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `View` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Workspace` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "StoragePlanType" ADD VALUE 'custom';

-- DropIndex
DROP INDEX "Workspace_createdAt_idx";

-- DropIndex
DROP INDEX "Workspace_name_key";

-- DropIndex
DROP INDEX "Workspace_updatedAt_idx";

-- AlterTable
ALTER TABLE "Drive" ADD COLUMN     "memberLimit" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "storageLimit" BIGINT NOT NULL DEFAULT 100000000000,
ADD COLUMN     "workspaceLimit" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "StoragePlan" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "features" TEXT[],
ADD COLUMN     "memberLimit" INTEGER NOT NULL,
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "workspaceLimit" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "View" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "sortBy" SET DEFAULT 'name';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "storagePlanId" TEXT,
ALTER COLUMN "description" SET DEFAULT '';

-- DropTable
DROP TABLE "FileShare";

-- DropTable
DROP TABLE "Preview";

-- CreateIndex
CREATE INDEX "Quota_driveId_idx" ON "Quota"("driveId");

-- CreateIndex
CREATE INDEX "Quota_updatedAt_idx" ON "Quota"("updatedAt");

-- CreateIndex
CREATE INDEX "StoragePlan_stripePriceId_idx" ON "StoragePlan"("stripePriceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_ownerId_stripeSubscriptionId_key" ON "Subscription"("ownerId", "stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "View_viewType_idx" ON "View"("viewType");

-- CreateIndex
CREATE INDEX "View_sortBy_idx" ON "View"("sortBy");

-- CreateIndex
CREATE INDEX "View_folderId_idx" ON "View"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "View_folderId_viewType_key" ON "View"("folderId", "viewType");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_slug_idx" ON "Workspace"("slug");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_storagePlanId_fkey" FOREIGN KEY ("storagePlanId") REFERENCES "StoragePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
