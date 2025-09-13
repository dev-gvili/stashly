/*
  Warnings:

  - You are about to drop the column `driveType` on the `Drive` table. All the data in the column will be lost.
  - You are about to drop the column `quotaId` on the `Drive` table. All the data in the column will be lost.
  - You are about to alter the column `exposureDenominator` on the `Image` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `deletedAt` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `read` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `remaining` on the `Quota` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `Quota` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `autoRenew` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `cancelAtPeriodEnd` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `cancelReason` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `canceledAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `currentPeriodEnd` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `currentPeriodStart` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `endsAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `interval` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `lastPaymentDate` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `nextBillingDate` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `previousPlan` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `trialEndsAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `iamRoleArn` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `WorkspaceMember` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `ItemLock` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlanChange` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ItemToTag` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[itemId,timeId]` on the table `Activity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemId]` on the table `Audio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemId,ownerId]` on the table `Comment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId]` on the table `Drive` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId,type]` on the table `Drive` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemId]` on the table `File` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemId]` on the table `Folder` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemId]` on the table `Image` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[copyActionIdId]` on the table `ItemAction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemId]` on the table `Photo` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemId]` on the table `Search` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId,storagePlanId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[itemId]` on the table `Video` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[memberId,workspaceId]` on the table `WorkspaceMember` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[driveId]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[subscriptionId]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[storagePlanId]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id` to the `Favorite` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemId` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemId` to the `Folder` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Notification` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updatedAt` to the `Quota` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemId` to the `Search` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Search` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vector` to the `Search` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ownerId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storagePlanId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `memberId` to the `WorkspaceMember` table without a default value. This is not possible if the table is not empty.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('info', 'warning', 'error', 'success');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('read', 'unread');

-- CreateEnum
CREATE TYPE "QuotaStatus" AS ENUM ('normal', 'warning', 'critical', 'exceeded');

-- CreateEnum
CREATE TYPE "StoragePlanType" AS ENUM ('free', 'basic', 'standard', 'premium');

-- DropForeignKey
ALTER TABLE "Audio" DROP CONSTRAINT "Audio_id_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_id_fkey";

-- DropForeignKey
ALTER TABLE "Folder" DROP CONSTRAINT "Folder_id_fkey";

-- DropForeignKey
ALTER TABLE "Image" DROP CONSTRAINT "Image_id_fkey";

-- DropForeignKey
ALTER TABLE "ItemLock" DROP CONSTRAINT "ItemLock_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_id_fkey";

-- DropForeignKey
ALTER TABLE "PlanChange" DROP CONSTRAINT "PlanChange_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "Video" DROP CONSTRAINT "Video_id_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceMember" DROP CONSTRAINT "WorkspaceMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "_ItemToTag" DROP CONSTRAINT "_ItemToTag_A_fkey";

-- DropForeignKey
ALTER TABLE "_ItemToTag" DROP CONSTRAINT "_ItemToTag_B_fkey";

-- DropIndex
DROP INDEX "Drive_driveType_idx";

-- DropIndex
DROP INDEX "Drive_quotaId_key";

-- DropIndex
DROP INDEX "Subscription_userId_key";

-- DropIndex
DROP INDEX "WorkspaceMember_userId_workspaceId_key";

-- AlterTable
ALTER TABLE "Audio" ADD COLUMN     "itemId" TEXT;

-- AlterTable
ALTER TABLE "Collection" ALTER COLUMN "size" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Drive" DROP COLUMN "driveType",
DROP COLUMN "quotaId",
ADD COLUMN     "type" "DriveType" NOT NULL DEFAULT 'personal';

-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "itemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "itemId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "exposureTime" TEXT,
ADD COLUMN     "itemId" TEXT,
ALTER COLUMN "exposureDenominator" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "deletedAt",
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "uploadId" TEXT,
ALTER COLUMN "size" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ItemAction" ADD COLUMN     "copyActionIdId" TEXT;

-- AlterTable
ALTER TABLE "ItemVersion" ALTER COLUMN "size" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "read",
ADD COLUMN     "status" "NotificationStatus" NOT NULL DEFAULT 'unread',
DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "deletedAt" TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "itemId" TEXT;

-- AlterTable
ALTER TABLE "Quota" DROP COLUMN "remaining",
DROP COLUMN "state",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "QuotaStatus" NOT NULL DEFAULT 'normal',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Search" ADD COLUMN     "itemId" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "vector" vector(768) NOT NULL,
ALTER COLUMN "content" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "amount",
DROP COLUMN "autoRenew",
DROP COLUMN "cancelAtPeriodEnd",
DROP COLUMN "cancelReason",
DROP COLUMN "canceledAt",
DROP COLUMN "currency",
DROP COLUMN "currentPeriodEnd",
DROP COLUMN "currentPeriodStart",
DROP COLUMN "endsAt",
DROP COLUMN "interval",
DROP COLUMN "lastPaymentDate",
DROP COLUMN "nextBillingDate",
DROP COLUMN "paymentMethod",
DROP COLUMN "plan",
DROP COLUMN "previousPlan",
DROP COLUMN "trialEndsAt",
DROP COLUMN "type",
DROP COLUMN "userId",
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "storagePlanId" TEXT NOT NULL,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ALTER COLUMN "id" SET DEFAULT (concat('subs_', encode(substr(sha256(random()::text::bytea), 0, 12), 'base64')));

-- AlterTable
ALTER TABLE "Tag" ALTER COLUMN "id" SET DEFAULT (concat('tag_', encode(substr(sha256(random()::text::bytea), 0, 12), 'base64'))),
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "itemId" TEXT;

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "iamRoleArn";

-- AlterTable
ALTER TABLE "WorkspaceMember" DROP COLUMN "userId",
ADD COLUMN     "memberId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "role",
ADD COLUMN     "driveId" TEXT,
ADD COLUMN     "storagePlanId" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "subscriptionId" TEXT;

-- DropTable
DROP TABLE "ItemLock";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "PlanChange";

-- DropTable
DROP TABLE "_ItemToTag";

-- DropEnum
DROP TYPE "BillingInterval";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "PlanType";

-- DropEnum
DROP TYPE "QuotaState";

-- DropEnum
DROP TYPE "SubscriptionType";

-- CreateTable
CREATE TABLE "CopyAction" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,

    CONSTRAINT "CopyAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LockedItem" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lockedById" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "LockedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoragePlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StoragePlanType" NOT NULL DEFAULT 'free',
    "storageLimit" BIGINT NOT NULL,
    "stripePriceId" TEXT,

    CONSTRAINT "StoragePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LockedItem_itemId_key" ON "LockedItem"("itemId");

-- CreateIndex
CREATE INDEX "LockedItem_expiresAt_idx" ON "LockedItem"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LockedItem_itemId_lockedById_key" ON "LockedItem"("itemId", "lockedById");

-- CreateIndex
CREATE UNIQUE INDEX "StoragePlan_stripePriceId_key" ON "StoragePlan"("stripePriceId");

-- CreateIndex
CREATE INDEX "StoragePlan_name_idx" ON "StoragePlan"("name");

-- CreateIndex
CREATE INDEX "StoragePlan_type_idx" ON "StoragePlan"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_itemId_timeId_key" ON "Activity"("itemId", "timeId");

-- CreateIndex
CREATE UNIQUE INDEX "Audio_itemId_key" ON "Audio"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_itemId_ownerId_key" ON "Comment"("itemId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Drive_ownerId_key" ON "Drive"("ownerId");

-- CreateIndex
CREATE INDEX "Drive_type_idx" ON "Drive"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Drive_ownerId_type_key" ON "Drive"("ownerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "File_itemId_key" ON "File"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_itemId_key" ON "Folder"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Image_itemId_key" ON "Image"("itemId");

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAction_copyActionIdId_key" ON "ItemAction"("copyActionIdId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_itemId_key" ON "Photo"("itemId");

-- CreateIndex
CREATE INDEX "Quota_status_idx" ON "Quota"("status");

-- CreateIndex
CREATE INDEX "Quota_createdAt_idx" ON "Quota"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Search_itemId_key" ON "Search"("itemId");

-- CreateIndex
CREATE INDEX "Search_vector_idx" ON "Search" USING hnsw ("vector" vector_cosine_ops);

-- CreateIndex
CREATE INDEX "Search_createdAt_idx" ON "Search"("createdAt");

-- CreateIndex
CREATE INDEX "Search_updatedAt_idx" ON "Search"("updatedAt");

-- CreateIndex
CREATE INDEX "Search_type_idx" ON "Search"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_ownerId_key" ON "Subscription"("ownerId");

-- CreateIndex
CREATE INDEX "Subscription_storagePlanId_idx" ON "Subscription"("storagePlanId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_createdAt_idx" ON "Subscription"("createdAt");

-- CreateIndex
CREATE INDEX "Subscription_endedAt_idx" ON "Subscription"("endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_ownerId_storagePlanId_key" ON "Subscription"("ownerId", "storagePlanId");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Video_itemId_key" ON "Video"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_memberId_workspaceId_key" ON "WorkspaceMember"("memberId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "user_driveId_key" ON "user"("driveId");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptionId_key" ON "user"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_storagePlanId_key" ON "user"("storagePlanId");

-- CreateIndex
CREATE UNIQUE INDEX "user_stripeCustomerId_key" ON "user"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_copyActionIdId_fkey" FOREIGN KEY ("copyActionIdId") REFERENCES "CopyAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audio" ADD CONSTRAINT "Audio_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockedItem" ADD CONSTRAINT "LockedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockedItem" ADD CONSTRAINT "LockedItem_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_storagePlanId_fkey" FOREIGN KEY ("storagePlanId") REFERENCES "StoragePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
