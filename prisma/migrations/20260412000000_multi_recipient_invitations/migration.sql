-- AlterEnum
ALTER TYPE "InvitationStatus" ADD VALUE 'canceled';

-- DropForeignKey
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_id_fkey";

-- DropForeignKey
ALTER TABLE "CollectionItem" DROP CONSTRAINT "CollectionItem_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionItem" DROP CONSTRAINT "CollectionItem_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_invitationId_fkey";

-- DropIndex
DROP INDEX "Permission_invitationId_idx";

-- DropIndex
DROP INDEX "Permission_invitationId_key";

-- AlterTable
ALTER TABLE "Invitation" DROP COLUMN "email",
DROP COLUMN "role",
DROP COLUMN "status",
ADD COLUMN     "itemId" TEXT;

-- AlterTable
ALTER TABLE "Permission" DROP COLUMN "invitationId",
ADD COLUMN     "recipientId" TEXT;

-- DropTable
DROP TABLE "Collection";

-- DropTable
DROP TABLE "CollectionItem";

-- CreateTable
CREATE TABLE "CollectionMember" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationRecipient" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "role" TEXT NOT NULL DEFAULT 'read',
    "invitationId" TEXT NOT NULL,

    CONSTRAINT "InvitationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionMember_collectionId_idx" ON "CollectionMember"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionMember_itemId_idx" ON "CollectionMember"("itemId");

-- CreateIndex
CREATE INDEX "CollectionMember_createdAt_idx" ON "CollectionMember"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionMember_collectionId_itemId_key" ON "CollectionMember"("collectionId", "itemId");

-- CreateIndex
CREATE INDEX "InvitationRecipient_invitationId_idx" ON "InvitationRecipient"("invitationId");

-- CreateIndex
CREATE INDEX "InvitationRecipient_email_idx" ON "InvitationRecipient"("email");

-- CreateIndex
CREATE INDEX "InvitationRecipient_status_idx" ON "InvitationRecipient"("status");

-- CreateIndex
CREATE INDEX "Invitation_senderId_idx" ON "Invitation"("senderId");

-- CreateIndex
CREATE INDEX "Invitation_itemId_idx" ON "Invitation"("itemId");

-- CreateIndex
CREATE INDEX "Invitation_workspaceId_idx" ON "Invitation"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_recipientId_key" ON "Permission"("recipientId");

-- CreateIndex
CREATE INDEX "Permission_recipientId_idx" ON "Permission"("recipientId");

-- AddForeignKey
ALTER TABLE "CollectionMember" ADD CONSTRAINT "CollectionMember_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionMember" ADD CONSTRAINT "CollectionMember_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationRecipient" ADD CONSTRAINT "InvitationRecipient_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "InvitationRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
