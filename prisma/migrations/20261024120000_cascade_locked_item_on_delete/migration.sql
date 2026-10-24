-- A lock no longer blocks a permanent delete: it goes with its item, like
-- every other row that references "Item". With RESTRICT, deleting a locked
-- item from trash failed with LockedItem_itemId_fkey and took the whole batch
-- down with it.

-- DropForeignKey
ALTER TABLE "LockedItem" DROP CONSTRAINT "LockedItem_itemId_fkey";

-- AddForeignKey
ALTER TABLE "LockedItem" ADD CONSTRAINT "LockedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
