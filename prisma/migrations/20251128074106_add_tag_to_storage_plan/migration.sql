/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `Quota` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tag]` on the table `StoragePlan` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[memberLimit,workspaceLimit,storageLimit]` on the table `StoragePlan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tag` to the `StoragePlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Drive" ALTER COLUMN "memberLimit" DROP NOT NULL,
ALTER COLUMN "memberLimit" DROP DEFAULT,
ALTER COLUMN "storageLimit" DROP NOT NULL,
ALTER COLUMN "storageLimit" DROP DEFAULT,
ALTER COLUMN "workspaceLimit" DROP NOT NULL,
ALTER COLUMN "workspaceLimit" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StoragePlan" ADD COLUMN     "tag" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Quota_id_key" ON "Quota"("id");

-- CreateIndex
CREATE UNIQUE INDEX "StoragePlan_tag_key" ON "StoragePlan"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "StoragePlan_memberLimit_workspaceLimit_storageLimit_key" ON "StoragePlan"("memberLimit", "workspaceLimit", "storageLimit");

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_memberLimit_workspaceLimit_storageLimit_fkey" FOREIGN KEY ("memberLimit", "workspaceLimit", "storageLimit") REFERENCES "StoragePlan"("memberLimit", "workspaceLimit", "storageLimit") ON DELETE CASCADE ON UPDATE CASCADE;
