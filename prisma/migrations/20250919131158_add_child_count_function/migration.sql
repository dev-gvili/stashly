-- This migration adds a trigger function to automatically update the 'childCount' on the 'Folder' table.

-- 1. Create the function to update the child count
CREATE OR REPLACE FUNCTION update_child_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE: Decrement the child count if the item was not 'trashed'.
  IF TG_OP = 'DELETE' THEN
    IF OLD."parentId" IS NOT NULL AND OLD.status != 'trashed' THEN
      UPDATE "Folder"
      SET "childCount" = "childCount" - 1
      WHERE "itemId" = OLD."parentId";
    END IF;
    RETURN OLD;
  END IF;

  -- Handle INSERT: Increment the child count if the item is not 'trashed'.
  IF TG_OP = 'INSERT' THEN
    IF NEW."parentId" IS NOT NULL AND NEW.status != 'trashed' THEN
      UPDATE "Folder"
      SET "childCount" = "childCount" + 1
      WHERE "itemId" = NEW."parentId";
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE: This covers moving items and changing their 'trashed' status.
  IF TG_OP = 'UPDATE' THEN
    -- If parentId changed (item moved)
    IF OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
      -- Decrement count for the old parent if the item was not 'trashed'
      IF OLD."parentId" IS NOT NULL AND OLD.status != 'trashed' THEN
        UPDATE "Folder"
        SET "childCount" = "childCount" - 1
        WHERE "itemId" = OLD."parentId";
      END IF;
      -- Increment count for the new parent if the item is not 'trashed'
      IF NEW."parentId" IS NOT NULL AND NEW.status != 'trashed' THEN
        UPDATE "Folder"
        SET "childCount" = "childCount" + 1
        WHERE "itemId" = NEW."parentId";
      END IF;
    -- If parentId is the same but status changed (item trashed or restored)
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
      -- Item was restored from trash
      IF OLD.status = 'trashed' AND NEW.status != 'trashed' THEN
        IF NEW."parentId" IS NOT NULL THEN
          UPDATE "Folder"
          SET "childCount" = "childCount" + 1
          WHERE "itemId" = NEW."parentId";
        END IF;
      -- Item was trashed
      ELSIF OLD.status != 'trashed' AND NEW.status = 'trashed' THEN
        IF NEW."parentId" IS NOT NULL THEN
          UPDATE "Folder"
          SET "childCount" = "childCount" - 1
          WHERE "itemId" = NEW."parentId";
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the triggers on the 'Item' table

-- Trigger for when a new item is created
CREATE TRIGGER item_child_count_insert
AFTER INSERT ON "Item"
FOR EACH ROW
EXECUTE FUNCTION update_child_count();

-- Trigger for when an item is moved or its parent otherwise changes
CREATE TRIGGER item_child_count_update
AFTER UPDATE ON "Item"
FOR EACH ROW
EXECUTE FUNCTION update_child_count();

-- Trigger for when an item is deleted
CREATE TRIGGER item_child_count_delete
AFTER DELETE ON "Item"
FOR EACH ROW
EXECUTE FUNCTION update_child_count();
