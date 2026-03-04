-- AlterEnum
ALTER TYPE "ThumbnailSize" ADD VALUE 'original';

COMMIT;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "inclusiveChildCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "inclusiveSize" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Thumbnail" ADD COLUMN     "view" "ViewType" NOT NULL DEFAULT 'grid',
ALTER COLUMN "size" SET DEFAULT 'original';

-- CreateIndex
CREATE INDEX "workspace_created_at" ON "Item"("workspaceId", "createdAt" DESC);
