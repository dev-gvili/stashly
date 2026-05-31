-- CreateEnum
CREATE TYPE "PinKind" AS ENUM ('pinned', 'unpinned', 'reordered');

-- CreateTable
CREATE TABLE "PinAction" (
    "id" TEXT NOT NULL,
    "kind" "PinKind" NOT NULL,

    CONSTRAINT "PinAction_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ItemAction" ADD COLUMN "pinActionId" TEXT;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ItemAction_pinActionId_key" ON "ItemAction"("pinActionId");

-- AddForeignKey
ALTER TABLE "ItemAction" ADD CONSTRAINT "ItemAction_pinActionId_fkey" FOREIGN KEY ("pinActionId") REFERENCES "PinAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
