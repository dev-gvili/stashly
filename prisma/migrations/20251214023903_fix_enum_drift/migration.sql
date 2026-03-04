/*
  Warnings:

  - You are about to drop the column `inclusiveChildCount` on the `Folder` table. All the data in the column will be lost.
  - You are about to drop the column `inclusiveSize` on the `Item` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Folder" DROP COLUMN "inclusiveChildCount";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "inclusiveSize";
