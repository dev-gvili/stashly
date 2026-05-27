-- Recreate Folder_itemId_fkey with ON DELETE CASCADE.
-- The constraint may have been created without CASCADE due to schema evolution
-- (Folder.id used to equal Item.id; itemId was added later). This ensures
-- deleting an Item always cascade-deletes its Folder facet row.

ALTER TABLE "Folder"
  DROP CONSTRAINT IF EXISTS "Folder_itemId_fkey";

ALTER TABLE "Folder"
  ADD CONSTRAINT "Folder_itemId_fkey"
  FOREIGN KEY ("itemId")
  REFERENCES "Item"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
