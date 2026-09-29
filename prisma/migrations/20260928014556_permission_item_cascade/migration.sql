-- DropForeignKey
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_itemId_fkey";

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
