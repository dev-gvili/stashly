/*
  Warnings:

  - A unique constraint covering the columns `[rootId]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "rootId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_rootId_key" ON "user"("rootId");
