-- AlterTable
ALTER TABLE "session" ADD COLUMN     "driveId" TEXT,
ADD COLUMN     "rootId" TEXT;

-- RenameForeignKey
ALTER TABLE "ItemAction" RENAME CONSTRAINT "ItemAction_copyActionIdId_fkey" TO "ItemAction_copyActionId_fkey";

-- RenameIndex
ALTER INDEX "ItemAction_copyActionIdId_key" RENAME TO "ItemAction_copyActionId_key";
