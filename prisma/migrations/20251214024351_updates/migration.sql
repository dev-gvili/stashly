-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "inclusiveChildCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "inclusiveSize" BIGINT NOT NULL DEFAULT 0;
